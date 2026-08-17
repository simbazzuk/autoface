import { FieldValue } from "firebase-admin/firestore";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { adminDb, adminStorage, requireUser } from "@/lib/server/firebase-admin";
import { recommendationFor } from "@/lib/server/discovery";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

const LOCAL_PHOTO_DIR = path.join(process.cwd(), ".autoface-local", "profile-photos");

function useLocalPhotoStorage() {
  return process.env.NODE_ENV !== "production"
    && process.env.AUTOFACE_LOCAL_PHOTO_STORAGE !== "false";
}

function safeLocalPath(uid: string, extension: string) {
  // Firebase UIDs are not filesystem paths, but normalise defensively anyway.
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(LOCAL_PHOTO_DIR, `${safeUid}.${extension}`);
}

async function removeLocalVariants(uid: string) {
  await Promise.all(["jpg","png","webp"].map((extension) =>
    unlink(safeLocalPath(uid, extension)).catch(() => {})
  ));
}

async function savePhotoBytes(uid: string, extension: string, bytes: Buffer, contentType: string) {
  if (useLocalPhotoStorage()) {
    await mkdir(LOCAL_PHOTO_DIR, { recursive: true });
    await removeLocalVariants(uid);
    const localPath = safeLocalPath(uid, extension);
    await writeFile(localPath, bytes, { flag: "w", mode: 0o600 });
    return { storageProvider: "local-dev", storagePath: localPath };
  }

  if (!adminStorage) throw new Error("PHOTO_STORAGE_NOT_CONFIGURED");
  const storagePath = `profile-photos/${uid}/primary.${extension}`;
  await adminStorage.bucket().file(storagePath).save(bytes, {
    resumable: false,
    contentType,
    metadata: {
      cacheControl: "private,max-age=300",
      metadata: { ownerUid: uid, purpose: "autoface-profile-photo" },
    },
  });
  return { storageProvider: "firebase", storagePath };
}

async function readPhotoBytes(storageProvider: string, storagePath: string) {
  if (storageProvider === "local-dev") {
    if (!useLocalPhotoStorage()) throw new Error("PHOTO_NOT_AVAILABLE");
    return readFile(storagePath);
  }
  if (!adminStorage) throw new Error("PHOTO_NOT_AVAILABLE");
  const [bytes] = await adminStorage.bucket().file(storagePath).download();
  return bytes;
}

async function deletePhotoBytes(uid: string, storageProvider: string, storagePath: string) {
  if (storageProvider === "local-dev") {
    await removeLocalVariants(uid);
    return;
  }
  if (adminStorage && storagePath) {
    await adminStorage.bucket().file(storagePath).delete({ ignoreNotFound: true }).catch(() => {});
  }
}

function imageType(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (buffer.length >= 8 && buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) {
    return { contentType: "image/png", extension: "png" };
  }
  if (buffer.length >= 12 && buffer.subarray(0,4).toString("ascii") === "RIFF" && buffer.subarray(8,12).toString("ascii") === "WEBP") {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

async function canView(viewerUid: string, targetUid: string) {
  if (!adminDb) return false;
  if (viewerUid === targetUid) return true;

  const [blockedByViewer, blockedByTarget] = await Promise.all([
    adminDb.collection("blocks").doc(`${viewerUid}__${targetUid}`).get(),
    adminDb.collection("blocks").doc(`${targetUid}__${viewerUid}`).get(),
  ]);
  if (blockedByViewer.exists || blockedByTarget.exists) return false;

  const matchId = [viewerUid,targetUid].sort().join("__");
  const match = await adminDb.collection("matches").doc(matchId).get();
  if (match.exists && match.data()?.status === "mutual") return true;

  return Boolean(await recommendationFor(viewerUid,targetUid));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const { uid } = await params;

    if (!(await canView(user.uid, uid))) {
      return NextResponse.json({ error: "PHOTO_NOT_AVAILABLE" }, { status: 404 });
    }

    const meta = await adminDb.collection("profilePhotos").doc(uid).get();
    if (!meta.exists || meta.data()?.active !== true) {
      return NextResponse.json({ error: "PHOTO_NOT_AVAILABLE" }, { status: 404 });
    }

    const storagePath = String(meta.data()?.storagePath ?? "");
    if (!storagePath) return NextResponse.json({ error: "PHOTO_NOT_AVAILABLE" }, { status: 404 });

    const storageProvider = String(meta.data()?.storageProvider ?? "firebase");
    const bytes = await readPhotoBytes(storageProvider, storagePath);
    const contentType = String(meta.data()?.contentType ?? "image/jpeg");

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message === "UNAUTHENTICATED" ? message : "PHOTO_NOT_AVAILABLE" }, {
      status: message === "UNAUTHENTICATED" ? 401 : 404,
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const { uid } = await params;
    if (uid !== user.uid) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const form = await request.formData();
    const upload = form.get("photo");
    if (!(upload instanceof File)) return NextResponse.json({ error: "PHOTO_REQUIRED" }, { status: 400 });
    if (upload.size <= 0 || upload.size > MAX_BYTES) {
      return NextResponse.json({ error: "PHOTO_TOO_LARGE", message: "Choose an image up to 5 MB." }, { status: 400 });
    }

    const bytes = Buffer.from(await upload.arrayBuffer());
    const detected = imageType(bytes);
    if (!detected) {
      return NextResponse.json({ error: "PHOTO_TYPE_NOT_ALLOWED", message: "Use a JPEG, PNG or WebP image." }, { status: 400 });
    }

    const previous = await adminDb.collection("profilePhotos").doc(uid).get();
    const previousPath = String(previous.data()?.storagePath ?? "");
    const previousProvider = String(previous.data()?.storageProvider ?? "firebase");

    // Clean up the previous object before switching provider/path.
    if (previousPath) {
      await deletePhotoBytes(uid, previousProvider, previousPath);
    }

    const stored = await savePhotoBytes(
      uid,
      detected.extension,
      bytes,
      detected.contentType,
    );
    const storagePath = stored.storagePath;

    await adminDb.collection("profilePhotos").doc(uid).set({
      uid,
      storagePath,
      storageProvider: stored.storageProvider,
      contentType: detected.contentType,
      sizeBytes: bytes.length,
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: previous.exists ? previous.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
    }, { merge: true });

    await adminDb.collection("securityEvents").add({
      uid,
      eventType: previous.exists ? "profile_photo_replaced" : "profile_photo_uploaded",
      riskLevel: "info",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, active: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, {
      status: message === "UNAUTHENTICATED" ? 401 : message === "SERVER_NOT_CONFIGURED" ? 500 : 500,
    });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const { uid } = await params;
    if (uid !== user.uid) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const ref = adminDb.collection("profilePhotos").doc(uid);
    const meta = await ref.get();
    const storagePath = String(meta.data()?.storagePath ?? "");
    const storageProvider = String(meta.data()?.storageProvider ?? "firebase");
    if (storagePath) await deletePhotoBytes(uid, storageProvider, storagePath);
    await ref.delete();

    await adminDb.collection("securityEvents").add({
      uid,
      eventType: "profile_photo_removed",
      riskLevel: "info",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

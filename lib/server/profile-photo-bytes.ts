import { readFile } from "node:fs/promises";
import { adminDb, adminStorage } from "@/lib/server/firebase-admin";

function localStorageAllowed() {
  return process.env.NODE_ENV !== "production" && process.env.AUTOFACE_LOCAL_PHOTO_STORAGE !== "false";
}

export async function getProfilePhotoBytes(uid: string) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const meta = await adminDb.collection("profilePhotos").doc(uid).get();
  if (!meta.exists || meta.data()?.active !== true) throw new Error("PROFILE_PHOTO_REQUIRED");

  const storagePath = String(meta.data()?.storagePath ?? "");
  const storageProvider = String(meta.data()?.storageProvider ?? "firebase");
  if (!storagePath) throw new Error("PROFILE_PHOTO_REQUIRED");

  if (storageProvider === "local-dev") {
    if (!localStorageAllowed()) throw new Error("PROFILE_PHOTO_REQUIRED");
    return new Uint8Array(await readFile(storagePath));
  }

  if (!adminStorage) throw new Error("PHOTO_STORAGE_NOT_CONFIGURED");
  const [bytes] = await adminStorage.bucket().file(storagePath).download();
  return new Uint8Array(bytes);
}

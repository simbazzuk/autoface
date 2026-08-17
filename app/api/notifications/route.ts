import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";

function asIso(value: unknown) {
  const v = value as { toDate?: () => Date } | null | undefined;
  return v?.toDate ? v.toDate().toISOString() : null;
}

function millis(value: unknown) {
  const v = value as { toDate?: () => Date } | null | undefined;
  return v?.toDate ? v.toDate().getTime() : 0;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    // v0.11.1 deliberately uses a single-field query only.
    // Sorting happens server-side to avoid requiring a Firestore composite index.
    const snap = await adminDb.collection("notifications")
      .where("recipientUid", "==", user.uid)
      .limit(100)
      .get();

    const docs = [...snap.docs]
      .sort((a, b) => millis(b.data().createdAt) - millis(a.data().createdAt))
      .slice(0, 50);

    const notifications = docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: String(data.type ?? "activity"),
        title: String(data.title ?? ""),
        body: String(data.body ?? ""),
        actionUrl: data.actionUrl ? String(data.actionUrl) : null,
        read: data.read === true,
        createdAt: asIso(data.createdAt),
      };
    });

    return NextResponse.json({
      notifications,
      unreadCount: notifications.filter((item) => !item.read).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const body = (await request.json()) as { id?: string; markAll?: boolean };

    if (body.markAll === true) {
      // Again, only query by recipientUid. Filtering unread items in Node avoids
      // a recipientUid + read composite index.
      const snap = await adminDb.collection("notifications")
        .where("recipientUid", "==", user.uid)
        .limit(100)
        .get();

      const unread = snap.docs.filter((doc) => doc.data().read !== true);
      if (unread.length === 0) return NextResponse.json({ ok: true, updated: 0 });

      const batch = adminDb.batch();
      unread.forEach((doc) => {
        batch.update(doc.ref, {
          read: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();

      return NextResponse.json({ ok: true, updated: unread.length });
    }

    if (!body.id) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    const ref = adminDb.collection("notifications").doc(body.id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.recipientUid !== user.uid) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    await ref.update({
      read: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { adminAuth, adminDb, requireUser } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";
const CONFIRMATION = "DELETE MY AUTOFACE ACCOUNT";

async function deleteDocs(query: FirebaseFirestore.Query) {
  const snap = await query.get();
  if (snap.empty) return 0;

  let count = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = adminDb!.batch();
    const group = snap.docs.slice(i, i + 400);
    group.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    count += group.length;
  }
  return count;
}

async function deleteConversation(ref: FirebaseFirestore.DocumentReference) {
  const messages = await ref.collection("messages").limit(1000).get();
  for (let i = 0; i < messages.docs.length; i += 400) {
    const batch = adminDb!.batch();
    messages.docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  await ref.delete();
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb || !adminAuth) throw new Error("SERVER_NOT_CONFIGURED");

    const body = await request.json() as { confirmation?: string };
    if (body.confirmation !== CONFIRMATION) {
      return NextResponse.json({ error: "CONFIRMATION_REQUIRED" }, { status: 400 });
    }

    const uid = user.uid;

    // Remove conversation data first because messages are subcollection documents.
    const conversations = await adminDb.collection("conversations")
      .where("participants", "array-contains", uid)
      .limit(200)
      .get();
    for (const conversation of conversations.docs) {
      await deleteConversation(conversation.ref);
    }

    // Server-owned relationship and activity data.
    await Promise.all([
      deleteDocs(adminDb.collection("notifications").where("recipientUid", "==", uid).limit(1000)),
      deleteDocs(adminDb.collection("interests").where("fromUid", "==", uid).limit(1000)),
      deleteDocs(adminDb.collection("interests").where("toUid", "==", uid).limit(1000)),
      deleteDocs(adminDb.collection("matches").where("participants", "array-contains", uid).limit(500)),
      deleteDocs(adminDb.collection("connections").where("participants", "array-contains", uid).limit(500)),
      deleteDocs(adminDb.collection("blocks").where("fromUid", "==", uid).limit(1000)),
      deleteDocs(adminDb.collection("blocks").where("toUid", "==", uid).limit(1000)),
      deleteDocs(adminDb.collection("reports").where("reporterUid", "==", uid).limit(1000)),
      deleteDocs(adminDb.collection("securityEvents").where("uid", "==", uid).limit(1000)),
      deleteDocs(adminDb.collection("verificationSessions").where("uid", "==", uid).limit(500)),
      deleteDocs(adminDb.collection("photoVerificationSessions").where("uid", "==", uid).limit(500)),
    ]);

    // Direct account documents.
    const directDocs = [
      "profiles",
      "relationshipProfiles",
      "identity",
      "authenticity",
      "discoveryPreferences",
      "users",
      "demoProfiles",
    ];
    const batch = adminDb.batch();
    directDocs.forEach((collection) => batch.delete(adminDb!.collection(collection).doc(uid)));
    await batch.commit();

    // Authentication account is removed last so the authenticated request can finish cleanly.
    await adminAuth.deleteUser(uid);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}

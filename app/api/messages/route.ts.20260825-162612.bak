import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { requireActiveMatch, messagingStatusCode } from "@/lib/server/messaging";
import { safeProjectionFor } from "@/lib/server/discovery";
import { createNotification } from "@/lib/server/notifications";

type SendBody = { matchId?: string; text?: string };

function asIso(value: unknown) {
  const maybe = value as { toDate?: () => Date } | null | undefined;
  return maybe?.toDate ? maybe.toDate().toISOString() : null;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const url = new URL(request.url);
    const matchId = url.searchParams.get("matchId") ?? "";
    if (!matchId) throw new Error("INVALID_REQUEST");
    const match = await requireActiveMatch(matchId, user.uid);
    const other = await safeProjectionFor(user.uid, match.otherUid);
    if (!other) throw new Error("TARGET_NOT_AVAILABLE");

    const snapshot = await adminDb.collection("conversations").doc(matchId)
      .collection("messages").orderBy("createdAt", "asc").limit(100).get();
    const messages = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        senderUid: String(data.senderUid ?? ""),
        text: String(data.text ?? ""),
        createdAt: asIso(data.createdAt),
      };
    });
    return NextResponse.json({ matchId, other, messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: messagingStatusCode(message) });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const body = (await request.json()) as SendBody;
    const matchId = body.matchId?.trim() ?? "";
    const text = body.text?.trim() ?? "";
    if (!matchId) throw new Error("INVALID_REQUEST");
    if (!text) throw new Error("MESSAGE_EMPTY");
    if (text.length > 1000) throw new Error("MESSAGE_TOO_LONG");
    const match = await requireActiveMatch(matchId, user.uid);

    const conversationRef = adminDb.collection("conversations").doc(matchId);
    const messageRef = conversationRef.collection("messages").doc();
    const now = FieldValue.serverTimestamp();
    const batch = adminDb.batch();
    batch.set(conversationRef, {
      matchId,
      participants: match.participants,
      status: "active",
      lastMessageAt: now,
      updatedAt: now,
      createdAt: now,
    }, { merge: true });
    batch.set(messageRef, {
      senderUid: user.uid,
      text,
      createdAt: now,
    });
    batch.set(adminDb.collection("securityEvents").doc(), {
      uid: user.uid,
      eventType: "message_sent",
      matchId,
      createdAt: now,
    });
    await batch.commit();
    const senderProfile = await safeProjectionFor(match.otherUid, user.uid);
    await createNotification({
      recipientUid: match.otherUid,
      type: "message",
      title: `${senderProfile?.firstName ?? "Your introduction"} sent you a message`,
      body: "You have a new message in your AutoFace conversation.",
      actionUrl: `/messages/${matchId}`,
      actorUid: user.uid,
      matchId,
    });
    return NextResponse.json({ ok: true, id: messageRef.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: messagingStatusCode(message) });
  }
}

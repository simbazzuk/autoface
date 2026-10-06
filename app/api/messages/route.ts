import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { requireActiveMatch, messagingStatusCode } from "@/lib/server/messaging";
import { recommendationFor, safeProjectionFor } from "@/lib/server/discovery";
import { createNotification } from "@/lib/server/notifications";
import { membershipFor } from "@/lib/server/membership";

type SendBody = { matchId?: string; text?: string };

const FREE_MESSAGE_LIMIT = 5;

function containsContactDetails(text: string) {
  const phone = /(?:\+?\d[\d\s().-]{7,}\d)/;
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const url = /\b(?:https?:\/\/|www\.)\S+/i;
  const social = /(?:^|\s)@[A-Za-z0-9._]{3,}/;
  return phone.test(text) || email.test(text) || url.test(text) || social.test(text);
}

async function messagingEntitlement(matchId: string, uid: string) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const membership = await membershipFor(uid);
  const unlimited = membership.entitlements.unlimitedMessaging;
  const sent = await adminDb.collection("conversations").doc(matchId)
    .collection("messages").where("senderUid", "==", uid).get();
  const sentCount = sent.size;
  return {
    plan: membership.plan,
    unlimited,
    contactDetailSharing: membership.entitlements.contactDetailSharing,
    freeLimit: FREE_MESSAGE_LIMIT,
    sentCount,
    remaining: unlimited ? null : Math.max(0, FREE_MESSAGE_LIMIT - sentCount),
    locked: !unlimited && sentCount >= FREE_MESSAGE_LIMIT,
  };
}

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
    const [other, recommendation] = await Promise.all([
      safeProjectionFor(user.uid, match.otherUid),
      recommendationFor(user.uid, match.otherUid),
    ]);
    if (!other) throw new Error("TARGET_NOT_AVAILABLE");

    const relationshipInsight = recommendation ? {
      available: true,
      compatibilityScore: recommendation.candidate.compatibilityScore,
      compatibilityLevel: recommendation.candidate.compatibilityLevel,
      strongestAlignments: recommendation.candidate.strongestAlignments,
      conversationPoints: recommendation.candidate.conversationPoints,
      dimensions: recommendation.dimensions.map((dimension) => ({
        code: dimension.code,
        label: dimension.label,
        score: dimension.score,
        explanation: dimension.explanation,
      })),
      confidence: recommendation.intelligence.confidence,
      confidenceScore: recommendation.intelligence.confidenceScore,
      summary: recommendation.summary,
      profileIntelligence: recommendation.profileIntelligence,
      notice: "Relationship insight explains your existing deterministic AutoFace compatibility result. It does not predict relationship success.",
    } : {
      available: false,
    };

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
    const messaging = await messagingEntitlement(matchId, user.uid);
    return NextResponse.json({ matchId, other, messages, messaging, relationshipInsight });
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
    const messaging = await messagingEntitlement(matchId, user.uid);
    if (messaging.locked) throw new Error("MESSAGE_LIMIT_REACHED");
    if (!messaging.contactDetailSharing && containsContactDetails(text)) {
      throw new Error("CONTACT_DETAILS_MEMBERSHIP_REQUIRED");
    }

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
    return NextResponse.json({
      ok: true,
      id: messageRef.id,
      messaging: {
        ...messaging,
        sentCount: messaging.sentCount + 1,
        remaining: messaging.unlimited ? null : Math.max(0, messaging.freeLimit - messaging.sentCount - 1),
        locked: !messaging.unlimited && messaging.sentCount + 1 >= messaging.freeLimit,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: messagingStatusCode(message) });
  }
}

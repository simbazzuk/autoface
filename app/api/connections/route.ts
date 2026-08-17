import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { requireActiveMatch, messagingStatusCode } from "@/lib/server/messaging";
import { safeProjectionFor } from "@/lib/server/discovery";

const allowedStages = ["introduced","chatting","getting_to_know","met","connected"] as const;
type Stage = typeof allowedStages[number];

function starterFor(strengths: string[], points: string[]) {
  const strength = strengths[0];
  const point = points[0];
  if (strength === "Family outlook") return "You both show strong alignment around family outlook. What does being close to family look like in everyday life for you?";
  if (strength === "Communication style") return "Your communication preferences appear well aligned. What helps you feel that a conversation is open and honest?";
  if (strength === "Lifestyle rhythm") return "Atlas sees alignment in your lifestyle rhythm. What does an ideal weekend look like when you have no obligations?";
  if (strength === "Relationship pace") return "You appear aligned on relationship pace. What does getting to know someone intentionally mean to you?";
  if (strength) return `Atlas sees alignment around ${strength.toLowerCase()}. What does that look like in a relationship for you?`;
  if (point) return `${point} is one area Atlas suggests exploring. How do you think about it in a future relationship?`;
  return "What is something important about you that is difficult to capture in a profile?";
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
    const snap = await adminDb.collection("connections").doc(matchId).get();
    const state = snap.data() ?? {};
    const myStage = allowedStages.includes(state.stages?.[user.uid]) ? state.stages[user.uid] as Stage : "introduced";
    const otherStage = allowedStages.includes(state.stages?.[match.otherUid]) ? state.stages[match.otherUid] as Stage : "introduced";
    return NextResponse.json({
      matchId, other, myStage, otherStage,
      conversationStarter: starterFor(other.strongestAlignments, other.conversationPoints),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: messagingStatusCode(message) });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const body = await request.json() as { matchId?: string; stage?: Stage };
    const matchId = body.matchId?.trim() ?? "";
    const stage = body.stage;
    if (!matchId || !stage || !allowedStages.includes(stage)) throw new Error("INVALID_REQUEST");
    const match = await requireActiveMatch(matchId, user.uid);
    const ref = adminDb.collection("connections").doc(matchId);
    await ref.set({
      matchId,
      participants: match.participants,
      [`stages.${user.uid}`]: stage,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await adminDb.collection("securityEvents").add({
      uid: user.uid, eventType: "connection_stage_changed", matchId, stage,
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, stage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: messagingStatusCode(message) });
  }
}

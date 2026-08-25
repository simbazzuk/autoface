import { adminDb } from "@/lib/server/firebase-admin";

export type ActiveMatch = {
  matchId: string;
  participants: string[];
  otherUid: string;
};

export async function requireActiveMatch(matchId: string, uid: string): Promise<ActiveMatch> {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const snap = await adminDb.collection("matches").doc(matchId).get();
  if (!snap.exists) throw new Error("MATCH_NOT_FOUND");
  const data = snap.data() ?? {};
  const participants = Array.isArray(data.participants) ? data.participants.map(String) : [];
  if (!participants.includes(uid)) throw new Error("FORBIDDEN");
  if (data.status !== "mutual") throw new Error("MATCH_INACTIVE");
  const otherUid = participants.find((p) => p !== uid);
  if (!otherUid) throw new Error("MATCH_INVALID");

  const blockIdA = `${uid}__${otherUid}`;
  const blockIdB = `${otherUid}__${uid}`;
  const [a, b] = await Promise.all([
    adminDb.collection("blocks").doc(blockIdA).get(),
    adminDb.collection("blocks").doc(blockIdB).get(),
  ]);
  if (a.exists || b.exists) throw new Error("MATCH_BLOCKED");
  return { matchId, participants, otherUid };
}

export function messagingStatusCode(message: string) {
  if (message === "UNAUTHENTICATED") return 401;
  if (message === "FORBIDDEN") return 403;
  if (["MATCH_NOT_FOUND", "TARGET_NOT_AVAILABLE"].includes(message)) return 404;
  if (["MATCH_INACTIVE", "MATCH_BLOCKED", "MATCH_INVALID"].includes(message)) return 409;
  if (["INVALID_REQUEST", "MESSAGE_EMPTY", "MESSAGE_TOO_LONG", "INVALID_ACTION"].includes(message)) return 400;
  return 500;
}

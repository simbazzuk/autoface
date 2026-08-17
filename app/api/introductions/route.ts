import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { safeProjectionFor } from "@/lib/server/discovery";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const matches = await adminDb.collection("matches").where("participants", "array-contains", user.uid).limit(20).get();
    const introductions = [];
    for (const match of matches.docs) {
      if (match.data().status !== "mutual") continue;
      const participants = (match.data().participants ?? []) as string[];
      const otherUid = participants.find((uid) => uid !== user.uid);
      if (!otherUid) continue;
      const profile = await safeProjectionFor(user.uid, otherUid);
      if (profile) introductions.push({ matchId: match.id, ...profile });
    }
    return NextResponse.json({ introductions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

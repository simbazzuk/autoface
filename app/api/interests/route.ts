import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { getEligibleMember } from "@/lib/server/discovery";
import { createNotification } from "@/lib/server/notifications";

type Body = { toUid?: string; action?: "interested" | "saved" | "pass" };

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const db = adminDb;
    const body = (await request.json()) as Body;
    if (!body.toUid || !["interested", "saved", "pass"].includes(body.action ?? "")) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    if (body.toUid === user.uid) return NextResponse.json({ error: "INVALID_TARGET" }, { status: 400 });
    const [fromMember, toMember] = await Promise.all([getEligibleMember(user.uid), getEligibleMember(body.toUid)]);
    if (!fromMember) return NextResponse.json({ error: "DISCOVERY_NOT_ENABLED" }, { status: 403 });
    if (!toMember) return NextResponse.json({ error: "TARGET_NOT_AVAILABLE" }, { status: 404 });

    const [blockedByMe, blockedByThem] = await Promise.all([
      db.collection("blocks").doc(`${user.uid}__${body.toUid}`).get(),
      db.collection("blocks").doc(`${body.toUid}__${user.uid}`).get(),
    ]);
    if (blockedByMe.exists || blockedByThem.exists) {
      return NextResponse.json({ error: "TARGET_NOT_AVAILABLE" }, { status: 404 });
    }

    const interestId = `${user.uid}_${body.toUid}`;
    await db.collection("interests").doc(interestId).set({
      fromUid: user.uid,
      toUid: body.toUid,
      status: body.action,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    let matched = false;
    if (body.action === "interested") {
      const reverse = await db.collection("interests").doc(`${body.toUid}_${user.uid}`).get();
      if (reverse.exists && reverse.data()?.status === "interested") {
        const participants = [user.uid, body.toUid].sort();
        const matchId = participants.join("__");
        await db.collection("matches").doc(matchId).set({
          participants,
          status: "mutual",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        await Promise.all([
          createNotification({ recipientUid: user.uid, type: "introduction", title: `New introduction with ${toMember.profile.firstName}`, body: "You both independently expressed interest. Your private Connection space is ready.", actionUrl: `/connections/${matchId}`, actorUid: body.toUid, matchId }),
          createNotification({ recipientUid: body.toUid, type: "introduction", title: `New introduction with ${fromMember.profile.firstName}`, body: "You both independently expressed interest. Your private Connection space is ready.", actionUrl: `/connections/${matchId}`, actorUid: user.uid, matchId }),
        ]);
        matched = true;
      }
    }
    return NextResponse.json({ ok: true, matched });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

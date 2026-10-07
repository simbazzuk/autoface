import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, requireUser, requireVerifiedUser } from "@/lib/server/firebase-admin";
import { getEligibleMember } from "@/lib/server/discovery";
import { createNotification } from "@/lib/server/notifications";

type Body = { toUid?: string; action?: "interested" | "saved" | "pass" };

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
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
    let matchedId: string | null = null;
    if (body.action === "interested") {
      const reverse = await db.collection("interests").doc(`${body.toUid}_${user.uid}`).get();
      if (reverse.exists && reverse.data()?.status === "interested") {
        const participants = [user.uid, body.toUid].sort();
        const matchId = participants.join("__");
        // A pair may previously have matched and later been blocked/unmatched.
        // Fresh mutual interest creates a fresh active connection while keeping
        // the deterministic match id used throughout AutoFace.
        await db.collection("matches").doc(matchId).set({
          participants,
          status: "mutual",
          endedBy: FieldValue.delete(),
          endedAt: FieldValue.delete(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        // Re-open the conversation only because BOTH members have now made
        // fresh Discovery decisions after the previous relationship ended.
        //
        // conversationStartedAt creates a new visible conversation period.
        // Older messages remain retained for safety/audit purposes but are
        // not surfaced in the newly established connection.
        const conversationStartedAt = FieldValue.serverTimestamp();

        await db.collection("conversations").doc(matchId).set({
          status: "active",
          closedReason: FieldValue.delete(),
          conversationStartedAt,
          lastMessageAt: FieldValue.delete(),
          updatedAt: conversationStartedAt,
        }, { merge: true });

        await Promise.all([
          createNotification({ recipientUid: user.uid, type: "introduction", title: `New introduction with ${toMember.profile.firstName}`, body: "You both independently expressed interest. Your private Connection space is ready.", actionUrl: `/connections/${matchId}`, actorUid: body.toUid, matchId }),
          createNotification({ recipientUid: body.toUid, type: "introduction", title: `New introduction with ${fromMember.profile.firstName}`, body: "You both independently expressed interest. Your private Connection space is ready.", actionUrl: `/connections/${matchId}`, actorUid: user.uid, matchId }),
        ]);
        matched = true;
        matchedId = matchId;
      }
    }

    return NextResponse.json({
      ok: true,
      matched,
      matchId: matchedId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : message === "EMAIL_VERIFICATION_REQUIRED" ? 403 : 500 });
  }
}

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";

type BlockedProfile = {
  blockId: string;
  uid: string;
  firstName: string;
  location: string | null;
  matchId: string | null;
  blockedAt: string | null;
  source: string | null;
};

function asIso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as {toDate?: unknown}).toDate === "function") {
    return (value as {toDate: () => Date}).toDate().toISOString();
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const snap = await adminDb.collection("blocks")
      .where("blockerUid", "==", user.uid)
      .limit(200)
      .get();

    const blocks = await Promise.all(snap.docs.map(async (doc) => {
      const data = doc.data() ?? {};
      const blockedUid = String(data.blockedUid ?? data.toUid ?? "");
      if (!blockedUid) return null;

      const profileSnap = await adminDb!.collection("profiles").doc(blockedUid).get();
      const profile = profileSnap.data() ?? {};
      return {
        blockId: doc.id,
        uid: blockedUid,
        firstName: String(profile.firstName ?? profile.displayName ?? "Member"),
        location: profile.location ? String(profile.location) : null,
        matchId: data.matchId ? String(data.matchId) : null,
        blockedAt: asIso(data.createdAt),
        source: data.source ? String(data.source) : null,
      } satisfies BlockedProfile;
    }));

    return NextResponse.json({
      blockedProfiles: blocks.filter((item): item is BlockedProfile => Boolean(item)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const body = await request.json() as { blockedUid?: string };
    const blockedUid = body.blockedUid?.trim() ?? "";
    if (!blockedUid || blockedUid === user.uid) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    const blockRef = adminDb.collection("blocks").doc(`${user.uid}__${blockedUid}`);
    const blockSnap = await blockRef.get();
    if (!blockSnap.exists) {
      return NextResponse.json({ error: "BLOCK_NOT_FOUND" }, { status: 404 });
    }

    const block = blockSnap.data() ?? {};
    const matchId = block.matchId ? String(block.matchId) : null;

    await blockRef.delete();

    let conversationRestored = false;
    if (matchId) {
      const reverseBlock = await adminDb.collection("blocks").doc(`${blockedUid}__${user.uid}`).get();
      const matchRef = adminDb.collection("matches").doc(matchId);
      const matchSnap = await matchRef.get();
      const match = matchSnap.data() ?? {};

      // Restore only the introduction this user closed by blocking, and only
      // when the other member has not independently blocked them.
      if (
        !reverseBlock.exists &&
        matchSnap.exists &&
        String(match.status ?? "") === "blocked" &&
        String(match.endedBy ?? "") === user.uid
      ) {
        const now = FieldValue.serverTimestamp();
        await matchRef.set({
          status: "mutual",
          endedBy: FieldValue.delete(),
          endedAt: FieldValue.delete(),
          updatedAt: now,
        }, { merge: true });

        await adminDb.collection("conversations").doc(matchId).set({
          status: "active",
          closedReason: FieldValue.delete(),
          updatedAt: now,
        }, { merge: true });

        conversationRestored = true;
      }
    }

    await adminDb.collection("securityEvents").add({
      uid: user.uid,
      eventType: "member_unblocked",
      targetUid: blockedUid,
      matchId,
      conversationRestored,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, blockedUid, matchId, conversationRestored });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

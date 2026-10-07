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

    // AutoFace has used two block record shapes during development:
    // current: blockerUid / blockedUid
    // legacy:  fromUid / toUid
    // Read both and merge them so Account & Notifications always reflects
    // the effective block state enforced by messaging/discovery.
    const [currentSnap, legacySnap] = await Promise.all([
      adminDb.collection("blocks")
        .where("blockerUid", "==", user.uid)
        .limit(200)
        .get(),
      adminDb.collection("blocks")
        .where("fromUid", "==", user.uid)
        .limit(200)
        .get(),
    ]);

    const docsByPath = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    currentSnap.docs.forEach((doc) => docsByPath.set(doc.ref.path, doc));
    legacySnap.docs.forEach((doc) => docsByPath.set(doc.ref.path, doc));

    const candidates = Array.from(docsByPath.values());
    const seenBlockedUids = new Set<string>();
    const blocks: BlockedProfile[] = [];

    for (const doc of candidates) {
      const data = doc.data() ?? {};
      const blockedUid = String(data.blockedUid ?? data.toUid ?? "");
      if (!blockedUid || blockedUid === user.uid || seenBlockedUids.has(blockedUid)) continue;

      seenBlockedUids.add(blockedUid);
      const profileSnap = await adminDb.collection("profiles").doc(blockedUid).get();
      const profile = profileSnap.data() ?? {};

      blocks.push({
        blockId: doc.id,
        uid: blockedUid,
        firstName: String(profile.firstName ?? profile.displayName ?? "Member"),
        location: profile.generalLocation
          ? String(profile.generalLocation)
          : profile.location
            ? String(profile.location)
            : null,
        matchId: data.matchId ? String(data.matchId) : null,
        blockedAt: asIso(data.createdAt),
        source: data.source ? String(data.source) : null,
      });
    }

    blocks.sort((a, b) => (b.blockedAt ?? "").localeCompare(a.blockedAt ?? ""));

    return NextResponse.json({ blockedProfiles: blocks });
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

    const canonicalRef = adminDb.collection("blocks").doc(`${user.uid}__${blockedUid}`);
    const canonicalSnap = await canonicalRef.get();

    // Support older/non-canonical block records as well as the current deterministic id.
    const ownedBlocks = await adminDb.collection("blocks")
      .where("blockerUid", "==", user.uid)
      .limit(200)
      .get();

    const matchingDocs = ownedBlocks.docs.filter((doc) => {
      const data = doc.data() ?? {};
      return String(data.blockedUid ?? data.toUid ?? "") === blockedUid;
    });

    if (!canonicalSnap.exists && matchingDocs.length === 0) {
      return NextResponse.json({ error: "BLOCK_NOT_FOUND" }, { status: 404 });
    }

    const sourceData = canonicalSnap.exists
      ? canonicalSnap.data() ?? {}
      : matchingDocs[0]?.data() ?? {};
    const matchId = sourceData.matchId ? String(sourceData.matchId) : null;

    const batch = adminDb.batch();
    if (canonicalSnap.exists) batch.delete(canonicalRef);
    for (const doc of matchingDocs) {
      if (doc.ref.path !== canonicalRef.path) batch.delete(doc.ref);
    }
    // Reset previous Discovery decisions in both directions.
    //
    // A block ends the relationship. If the blocker later explicitly
    // unblocks the member, both people must start again through the normal
    // Discovery journey. Old interested/saved/pass decisions must not
    // automatically recreate a mutual connection.
    const myInterestRef = adminDb
      .collection("interests")
      .doc(`${user.uid}_${blockedUid}`);

    const theirInterestRef = adminDb
      .collection("interests")
      .doc(`${blockedUid}_${user.uid}`);

    batch.delete(myInterestRef);
    batch.delete(theirInterestRef);

    await batch.commit();

    // Deliberately do NOT restore the old match/conversation.
    // Unblock removes the safety block and resets Discovery state.
    // Any future connection must be created through fresh mutual interest.
    await adminDb.collection("securityEvents").add({
      uid: user.uid,
      eventType: "member_unblocked",
      targetUid: blockedUid,
      matchId,
      conversationRestored: false,
      discoveryReset: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      blockedUid,
      matchId,
      conversationRestored: false,
      discoveryReset: true,
      rediscoveryEligible: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const demoSnap = await adminDb.collection("demoProfiles").doc(user.uid).get();
    if (!demoSnap.exists || demoSnap.data()?.isTestProfile !== true) {
      return NextResponse.json({ error: "TEST_PROFILE_REQUIRED" }, { status: 403 });
    }

    const decisions = await adminDb.collection("interests").where("fromUid", "==", user.uid).get();
    let reset = 0;
    let skippedMutual = 0;

    for (const doc of decisions.docs) {
      const targetUid = String(doc.data().toUid ?? "");
      if (!targetUid) continue;

      const participants = [user.uid, targetUid].sort();
      const matchRef = adminDb.collection("matches").doc(participants.join("__"));
      const matchSnap = await matchRef.get();

      // Do not silently dismantle an existing mutual introduction.
      if (matchSnap.exists && String(matchSnap.data()?.status ?? "") === "mutual") {
        skippedMutual += 1;
        continue;
      }

      await doc.ref.delete();
      reset += 1;
    }

    return NextResponse.json({
      ok: true,
      reset,
      skippedMutual,
      notice: skippedMutual
        ? "Non-mutual demo decisions were reset. Existing mutual introductions were preserved."
        : "Demo recommendation decisions were reset.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}

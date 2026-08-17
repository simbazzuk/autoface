import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { messagingStatusCode } from "@/lib/server/messaging";

type Body = {
  matchId?: string;
  action?: "unmatch" | "block" | "report";
  reason?: string;
  details?: string;
  blockAfterReport?: boolean;
};

const reportReasons = new Set([
  "fake_identity",
  "harassment",
  "financial_request",
  "inappropriate_content",
  "spam",
  "other",
]);

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const db = adminDb;
    const body = (await request.json()) as Body;
    const matchId = body.matchId?.trim() ?? "";
    const action = body.action;

    if (!matchId || !action || !["unmatch", "block", "report"].includes(action)) {
      throw new Error("INVALID_ACTION");
    }

    const matchRef = db.collection("matches").doc(matchId);
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) throw new Error("MATCH_NOT_FOUND");

    const data = matchSnap.data() ?? {};
    const participants = Array.isArray(data.participants)
      ? data.participants.map(String)
      : [];

    if (!participants.includes(user.uid)) throw new Error("FORBIDDEN");

    const otherUid = participants.find((uid) => uid !== user.uid);
    if (!otherUid) throw new Error("MATCH_INVALID");

    const now = FieldValue.serverTimestamp();

    if (action === "unmatch") {
      await matchRef.set(
        {
          status: "unmatched",
          endedBy: user.uid,
          endedAt: now,
          updatedAt: now,
        },
        { merge: true },
      );

      await db.collection("conversations").doc(matchId).set(
        {
          status: "closed",
          closedReason: "unmatched",
          updatedAt: now,
        },
        { merge: true },
      );

      await db.collection("securityEvents").add({
        uid: user.uid,
        eventType: "member_unmatched",
        matchId,
        targetUid: otherUid,
        createdAt: now,
      });

      return NextResponse.json({ ok: true, action });
    }

    if (action === "block") {
      await db.collection("blocks").doc(`${user.uid}__${otherUid}`).set({
        fromUid: user.uid,
        toUid: otherUid,
        blockerUid: user.uid,
        blockedUid: otherUid,
        matchId,
        createdAt: now,
      });

      await matchRef.set(
        {
          status: "blocked",
          endedBy: user.uid,
          endedAt: now,
          updatedAt: now,
        },
        { merge: true },
      );

      await db.collection("conversations").doc(matchId).set(
        {
          status: "closed",
          closedReason: "blocked",
          updatedAt: now,
        },
        { merge: true },
      );

      await db.collection("securityEvents").add({
        uid: user.uid,
        eventType: "member_blocked",
        matchId,
        targetUid: otherUid,
        createdAt: now,
      });

      return NextResponse.json({ ok: true, action });
    }

    const reason = body.reason?.trim() ?? "";
    const details = body.details?.trim() ?? "";

    if (!reportReasons.has(reason)) throw new Error("INVALID_REQUEST");
    if (details.length > 1000) throw new Error("INVALID_REQUEST");

    const reportRef = db.collection("reports").doc();

    await reportRef.set({
      reporterUid: user.uid,
      reportedUid: otherUid,
      matchId,
      reason,
      details,
      status: "open",
      blockAfterReport: body.blockAfterReport === true,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection("securityEvents").add({
      uid: user.uid,
      eventType: "member_reported",
      matchId,
      reportId: reportRef.id,
      targetUid: otherUid,
      reason,
      createdAt: now,
    });

    if (body.blockAfterReport === true) {
      await db.collection("blocks").doc(`${user.uid}__${otherUid}`).set({
        fromUid: user.uid,
        toUid: otherUid,
        blockerUid: user.uid,
        blockedUid: otherUid,
        matchId,
        source: "report",
        reportId: reportRef.id,
        createdAt: now,
      });

      await matchRef.set(
        {
          status: "blocked",
          endedBy: user.uid,
          endedAt: now,
          updatedAt: now,
        },
        { merge: true },
      );

      await db.collection("conversations").doc(matchId).set(
        {
          status: "closed",
          closedReason: "reported_and_blocked",
          updatedAt: now,
        },
        { merge: true },
      );

      await db.collection("securityEvents").add({
        uid: user.uid,
        eventType: "member_blocked_after_report",
        matchId,
        reportId: reportRef.id,
        targetUid: otherUid,
        createdAt: now,
      });
    }

    return NextResponse.json({
      ok: true,
      action,
      reportId: reportRef.id,
      blocked: body.blockAfterReport === true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: messagingStatusCode(message) },
    );
  }
}

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  requireVerifiedUser,
} from "@/lib/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Decision = "interested" | "saved" | "pass";

const allowedReasons = new Set([
  "shared_values",
  "relationship_goals",
  "lifestyle_alignment",
  "shared_interests",
  "profile_stood_out",
  "practical_reasons",
  "not_enough_shared_interests",
  "different_priorities",
  "just_not_for_me",
]);

type Body = {
  candidateUid?: string;
  decision?: Decision;
  reasons?: string[];
};

const PERSONALISABLE_REASONS = new Set([
  "shared_values",
  "relationship_goals",
  "lifestyle_alignment",
  "shared_interests",
  "not_enough_shared_interests",
  "different_priorities",
]);

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);

    if (!adminDb) {
      throw new Error("SERVER_NOT_CONFIGURED");
    }

    const body = (await request.json().catch(() => ({}))) as Body;

    const candidateUid = String(body.candidateUid ?? "").trim();
    const decision = body.decision;

    if (
      !candidateUid ||
      candidateUid === user.uid ||
      !decision ||
      !["interested", "saved", "pass"].includes(decision)
    ) {
      return NextResponse.json(
        { error: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const interest = await adminDb
      .collection("interests")
      .doc(`${user.uid}_${candidateUid}`)
      .get();

    if (
      !interest.exists ||
      interest.data()?.fromUid !== user.uid ||
      interest.data()?.toUid !== candidateUid ||
      interest.data()?.status !== decision
    ) {
      return NextResponse.json(
        { error: "DECISION_NOT_FOUND" },
        { status: 409 },
      );
    }

    const reasons = Array.from(
      new Set(
        (Array.isArray(body.reasons) ? body.reasons : [])
          .map(value => String(value))
          .filter(value => allowedReasons.has(value)),
      ),
    ).slice(0, 3);

    if (reasons.length === 0) {
      return NextResponse.json(
        { error: "FEEDBACK_REASON_REQUIRED" },
        { status: 400 },
      );
    }

    const feedbackId = `${user.uid}_${candidateUid}`;

    const usedForPersonalisation =
      reasons.some(reason => PERSONALISABLE_REASONS.has(reason));

    await adminDb
      .collection("discoveryFeedback")
      .doc(feedbackId)
      .set(
        {
          uid: user.uid,
          candidateUid,
          decision,
          reasons,
          source: "discovery_decision",
          usedForPersonalisation,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return NextResponse.json({
      ok: true,
      saved: true,
      usedForPersonalisation,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "UNKNOWN_ERROR";

    return NextResponse.json(
      { error: message },
      {
        status:
          message === "UNAUTHENTICATED"
            ? 401
            : message === "EMAIL_VERIFICATION_REQUIRED"
              ? 403
              : 500,
      },
    );
  }
}

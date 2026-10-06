import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  requireUser,
} from "@/lib/server/firebase-admin";

import {
  requireActiveMatch,
  messagingStatusCode,
} from "@/lib/server/messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Reflection =
  | "comfortable"
  | "interesting"
  | "unsure"
  | "not_for_me";

type Body = {
  matchId?: string;
  reflection?: Reflection;
};

const ALLOWED = new Set<Reflection>([
  "comfortable",
  "interesting",
  "unsure",
  "not_for_me",
]);

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);

    if (!adminDb) {
      throw new Error("SERVER_NOT_CONFIGURED");
    }

    const url = new URL(request.url);
    const matchId = String(
      url.searchParams.get("matchId") ?? "",
    ).trim();

    if (!matchId) {
      throw new Error("INVALID_REQUEST");
    }

    await requireActiveMatch(matchId, user.uid);

    const id = `${matchId}__${user.uid}`;

    const snap = await adminDb
      .collection("conversationReflections")
      .doc(id)
      .get();

    if (!snap.exists) {
      return NextResponse.json({
        reflection: null,
      });
    }

    const data = snap.data() ?? {};

    return NextResponse.json({
      reflection: ALLOWED.has(data.reflection)
        ? data.reflection
        : null,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR";

    return NextResponse.json(
      { error: message },
      { status: messagingStatusCode(message) },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);

    if (!adminDb) {
      throw new Error("SERVER_NOT_CONFIGURED");
    }

    const body =
      (await request.json().catch(() => ({}))) as Body;

    const matchId = String(body.matchId ?? "").trim();
    const reflection = body.reflection;

    if (
      !matchId ||
      !reflection ||
      !ALLOWED.has(reflection)
    ) {
      return NextResponse.json(
        { error: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const match =
      await requireActiveMatch(matchId, user.uid);

    const id = `${matchId}__${user.uid}`;

    await adminDb
      .collection("conversationReflections")
      .doc(id)
      .set(
        {
          matchId,
          uid: user.uid,
          otherUid: match.otherUid,
          reflection,
          source: "conversation_reflection",
          usedForPersonalisation: true,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return NextResponse.json({
      ok: true,
      reflection,
      usedForPersonalisation: true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR";

    return NextResponse.json(
      { error: message },
      { status: messagingStatusCode(message) },
    );
  }
}

import { NextResponse } from "next/server";

import { atlasApiError } from "@/lib/server/atlas-api-errors";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { requireActiveMatch } from "@/lib/server/messaging";
import {
  atlasAiEnabled,
  generateReplyCoach,
  type AtlasReplyCoachMessage,
} from "@/lib/server/atlas-ai";
import type { RelationshipProfile } from "@/lib/relationship-profile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);

    if (!adminDb) {
      throw new Error("SERVER_NOT_CONFIGURED");
    }

    if (!atlasAiEnabled()) {
      return NextResponse.json(
        { error: "ATLAS_AI_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    const body = (await request.json()) as {
      matchId?: string;
      consent?: boolean;
    };

    const matchId = body.matchId?.trim() ?? "";

    if (!matchId || body.consent !== true) {
      return NextResponse.json(
        { error: "AI_CONSENT_REQUIRED" },
        { status: 400 },
      );
    }

    const match = await requireActiveMatch(matchId, user.uid);

    const [viewerSnap, otherSnap, otherProfileSnap, messageSnapshot] =
      await Promise.all([
        adminDb.collection("relationshipProfiles").doc(user.uid).get(),
        adminDb.collection("relationshipProfiles").doc(match.otherUid).get(),
        adminDb.collection("profiles").doc(match.otherUid).get(),

        adminDb
          .collection("conversations")
          .doc(matchId)
          .collection("messages")
          .orderBy("createdAt", "desc")
          .limit(10)
          .get(),
      ]);

    if (!viewerSnap.exists || !otherSnap.exists) {
      return NextResponse.json(
        { error: "RELATIONSHIP_PROFILE_REQUIRED" },
        { status: 409 },
      );
    }

    const viewer = viewerSnap.data() as RelationshipProfile;
    const other = otherSnap.data() as RelationshipProfile;

    if (
      viewer.consentForAiDiscovery !== true ||
      other.consentForAiDiscovery !== true
    ) {
      return NextResponse.json(
        { error: "BOTH_AI_OPT_INS_REQUIRED" },
        { status: 409 },
      );
    }

    const otherName = String(
      otherProfileSnap.data()?.firstName ?? "your introduction",
    ).slice(0, 50);

    const messages: AtlasReplyCoachMessage[] = messageSnapshot.docs
      .reverse()
      .map((doc) => {
        const data = doc.data();

        return {
          sender:
            String(data.senderUid ?? "") === user.uid
              ? ("viewer" as const)
              : ("other" as const),
          text: String(data.text ?? "").trim().slice(0, 1000),
        };
      })
      .filter((message) => message.text.length > 0);

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "ATLAS_REPLY_REQUIRES_MESSAGES" },
        { status: 409 },
      );
    }

    const coach = await generateReplyCoach(
      otherName,
      messages,
    );

    return NextResponse.json({
      coach,
      persisted: false,
      contextMessages: messages.length,
      notice:
        "Atlas generated editable reply suggestions. Nothing was sent or saved.",
    });
  } catch (error) {
    return atlasApiError(error);
  }
}

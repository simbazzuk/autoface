import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

function serialise(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serialise);
  if (typeof value === "object") {
    const timestamp = value as { toDate?: () => Date };
    if (timestamp.toDate) return timestamp.toDate().toISOString();
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serialise(item)])
    );
  }
  return value;
}

async function docsForQuery(query: FirebaseFirestore.Query) {
  const snap = await query.get();
  return snap.docs.map((doc) => ({ id: doc.id, ...serialise(doc.data()) as object }));
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const uid = user.uid;

    const [
      profile,
      relationshipProfile,
      identity,
      discoveryPreferences,
      notifications,
      interestsFrom,
      interestsTo,
      matches,
      securityEvents,
    ] = await Promise.all([
      adminDb.collection("profiles").doc(uid).get(),
      adminDb.collection("relationshipProfiles").doc(uid).get(),
      adminDb.collection("identity").doc(uid).get(),
      adminDb.collection("discoveryPreferences").doc(uid).get(),
      docsForQuery(adminDb.collection("notifications").where("recipientUid", "==", uid).limit(500)),
      docsForQuery(adminDb.collection("interests").where("fromUid", "==", uid).limit(500)),
      docsForQuery(adminDb.collection("interests").where("toUid", "==", uid).limit(500)),
      docsForQuery(adminDb.collection("matches").where("participants", "array-contains", uid).limit(200)),
      docsForQuery(adminDb.collection("securityEvents").where("uid", "==", uid).limit(500)),
    ]);

    const conversationSnaps = await adminDb.collection("conversations")
      .where("participants", "array-contains", uid)
      .limit(200)
      .get();

    const conversations = [];
    for (const conversation of conversationSnaps.docs) {
      const messagesSnap = await conversation.ref.collection("messages")
        .orderBy("createdAt", "asc")
        .limit(1000)
        .get();

      conversations.push({
        id: conversation.id,
        ...serialise(conversation.data()) as object,
        messages: messagesSnap.docs.map((message) => ({
          id: message.id,
          ...serialise(message.data()) as object,
        })),
      });
    }

    const exportData = {
      generatedAt: new Date().toISOString(),
      account: {
        uid,
        email: user.email ?? null,
        emailVerified: Boolean(user.email_verified),
      },
      profile: profile.exists ? serialise(profile.data()) : null,
      relationshipProfile: relationshipProfile.exists ? serialise(relationshipProfile.data()) : null,
      identityEvidence: identity.exists ? serialise(identity.data()) : null,
      discoveryPreferences: discoveryPreferences.exists ? serialise(discoveryPreferences.data()) : null,
      notifications,
      interests: [...interestsFrom, ...interestsTo],
      matches,
      conversations,
      securityEvents,
      note: "This export contains AutoFace data associated with your authenticated account. Provider-held identity or biometric data is not stored by AutoFace and therefore is not included.",
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="autoface-data-${uid}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}

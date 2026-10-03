import { adminDb } from "@/lib/server/firebase-admin";

type PushInput = {
  recipientUid: string;
  title: string;
  body: string;
  type: string;
  matchId?: string | null;
};

export async function sendPushNotification(input: PushInput) {
  if (!adminDb) return;

  try {
    const snapshot = await adminDb
      .collection("pushTokens")
      .doc(input.recipientUid)
      .collection("tokens")
      .where("enabled", "==", true)
      .limit(10)
      .get();

    if (snapshot.empty) return;

    const messages = snapshot.docs
      .map((doc) => String(doc.data().token ?? ""))
      .filter((token) => token.startsWith("ExponentPushToken["))
      .map((token) => ({
        to: token,
        sound: "default",
        title: input.title,
        body: input.body,
        data: {
          type: input.type,
          matchId: input.matchId ?? null,
        },
      }));

    if (messages.length === 0) return;

    const response = await fetch(
      "https://exp.host/--/api/v2/push/send",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      }
    );

    if (!response.ok) {
      console.error(
        "AutoFace push notification failed",
        response.status,
        await response.text()
      );
    }
  } catch (error) {
    // Push is best-effort. It must never cause the underlying
    // AutoFace action (such as sending a message) to fail.
    console.error(
      "AutoFace push notification failed",
      error instanceof Error ? error.message : String(error)
    );
  }
}

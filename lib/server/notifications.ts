import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebase-admin";

export type NotificationType = "introduction" | "message" | "connection" | "verification" | "safety";

export async function createNotification(input: {
  recipientUid: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string | null;
  actorUid?: string | null;
  matchId?: string | null;
}) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

  // Safety notifications are mandatory. Other categories honour the
  // account holder's notification preferences.
  if (input.type !== "safety") {
    const prefs = await adminDb.collection("notificationPreferences").doc(input.recipientUid).get();
    const data = prefs.data() ?? {};
    const enabled = input.type === "introduction" ? data.introductions !== false
      : input.type === "message" ? data.messages !== false
      : input.type === "connection" ? data.connectionUpdates !== false
      : input.type === "verification" ? data.verificationUpdates !== false
      : true;

    if (!enabled) return;
  }

  await adminDb.collection("notifications").add({
    recipientUid: input.recipientUid,
    type: input.type,
    title: input.title,
    body: input.body,
    actionUrl: input.actionUrl ?? null,
    actorUid: input.actorUid ?? null,
    matchId: input.matchId ?? null,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

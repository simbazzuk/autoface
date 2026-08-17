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

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const body = await request.json() as {
      category?: "idea" | "problem" | "confusing" | "positive";
      message?: string;
    };

    const category = body.category ?? "idea";
    const message = body.message?.trim() ?? "";
    if (!["idea","problem","confusing","positive"].includes(category) || message.length < 3 || message.length > 1200) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    await adminDb.collection("betaFeedback").add({
      uid: user.uid,
      email: user.email ?? null,
      category,
      message,
      status: "new",
      appVersion: "0.15.0",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}

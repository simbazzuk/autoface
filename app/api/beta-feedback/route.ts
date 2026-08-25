import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const body = await request.json() as {
      category?: string;
      message?: string;
      rating?: number;
      contactAllowed?: boolean;
      source?: string;
    };

    const allowedCategories = ["idea","problem","confusing","positive","matching","atlas","introductions","verification","experience","other"];
    const category = body.category ?? "idea";
    const message = body.message?.trim() ?? "";
    const rating = Number.isInteger(body.rating) && Number(body.rating) >= 1 && Number(body.rating) <= 5 ? Number(body.rating) : null;
    const contactAllowed = body.contactAllowed === true;
    const source = body.source === "feedback_page" ? "feedback_page" : "get_started";
    if (!allowedCategories.includes(category) || message.length < 3 || message.length > 1200) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    await adminDb.collection("betaFeedback").add({
      uid: user.uid,
      email: user.email ?? null,
      category,
      message,
      status: "new",
      rating,
      contactAllowed,
      source,
      appVersion: "0.36.0",
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

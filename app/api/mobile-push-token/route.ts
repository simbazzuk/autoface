import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";

type Body = {
  token?: string;
  platform?: "ios" | "android";
};

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const body = (await request.json()) as Body;
    const token = String(body.token ?? "").trim();
    const platform = body.platform ?? "ios";

    if (!token || !token.startsWith("ExponentPushToken[")) {
      return NextResponse.json(
        { error: "INVALID_PUSH_TOKEN" },
        { status: 400 }
      );
    }

    const id = Buffer.from(token)
      .toString("base64url")
      .slice(0, 120);

    await adminDb
      .collection("pushTokens")
      .doc(user.uid)
      .collection("tokens")
      .doc(id)
      .set(
        {
          uid: user.uid,
          token,
          platform,
          enabled: true,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "UNKNOWN_ERROR";

    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 }
    );
  }
}

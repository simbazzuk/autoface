import { NextResponse } from "next/server";
import {
  adminAuth,
  requireUser
} from "@/lib/server/firebase-admin";
import {
  sendAccountVerificationEmail
} from "@/lib/server/email-notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);

    if (!adminAuth) {
      throw new Error("SERVER_NOT_CONFIGURED");
    }

    if (user.email_verified) {
      return NextResponse.json({
        ok: true,
        alreadyVerified: true
      });
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "EMAIL_REQUIRED" },
        { status: 400 }
      );
    }

    const verificationUrl =
      await adminAuth.generateEmailVerificationLink(
        user.email,
        {
          url: "https://mip.chat/mobile/email-verified"
        }
      );

    const result =
      await sendAccountVerificationEmail(
        user.uid,
        verificationUrl
      );

    if (!result.sent) {
      return NextResponse.json(
        {
          error:
            result.reason ??
            "VERIFICATION_EMAIL_FAILED"
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      sent: true
    });

  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR";

    return NextResponse.json(
      { error: message },
      {
        status:
          message === "UNAUTHENTICATED"
            ? 401
            : 500
      }
    );
  }
}

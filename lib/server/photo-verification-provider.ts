import { randomUUID } from "crypto";
import { verificationMode } from "@/lib/server/verification-provider";

export function createPhotoProviderSession(origin: string, sessionId?: string) {
  const mode = verificationMode();
  const id = sessionId ?? randomUUID();

  if (mode === "demo") {
    return {
      provider: "autoface-demo-photo",
      providerReference: `photo_demo_${id}`,
      redirectUrl: `${origin}/verify-photo/demo?session=${encodeURIComponent(id)}`,
    };
  }

  throw new Error("PROVIDER_NOT_CONFIGURED");
}

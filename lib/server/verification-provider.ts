import { randomUUID } from "crypto";

export type VerificationMode = "demo" | "provider";

export function verificationMode(): VerificationMode {
  return process.env.AUTOFACE_VERIFICATION_MODE === "provider" ? "provider" : "demo";
}

export function createProviderSession(origin: string, sessionId?: string) {
  const mode = verificationMode();
  const id = sessionId ?? randomUUID();

  if (mode === "demo") {
    return {
      provider: "autoface-demo",
      providerReference: `demo_${id}`,
      redirectUrl: `${origin}/verify-identity/demo?session=${encodeURIComponent(id)}`,
    };
  }

  throw new Error("PROVIDER_NOT_CONFIGURED");
}

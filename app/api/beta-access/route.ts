import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

function inviteRequired() {
  return (process.env.AUTOFACE_BETA_INVITE_REQUIRED ?? "false").toLowerCase() === "true";
}

function normaliseCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export async function GET() {
  return NextResponse.json({ inviteRequired: inviteRequired() });
}

export async function POST(request: Request) {
  try {
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const body = await request.json() as { action?: "validate" | "claim"; code?: string };
    const action = body.action;
    const code = normaliseCode(body.code ?? "");

    if (!inviteRequired()) return NextResponse.json({ ok: true, inviteRequired: false });
    if (!code || code.length > 40) return NextResponse.json({ error: "INVITE_REQUIRED" }, { status: 400 });

    const ref = adminDb.collection("betaInvites").doc(code);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "INVITE_INVALID" }, { status: 404 });

    const data = snap.data() ?? {};
    const maxUses = Number(data.maxUses ?? 1);
    const uses = Number(data.uses ?? 0);
    const enabled = data.enabled !== false;
    if (!enabled || uses >= maxUses) {
      return NextResponse.json({ error: "INVITE_UNAVAILABLE" }, { status: 409 });
    }

    if (action === "validate") {
      return NextResponse.json({ ok: true, inviteRequired: true });
    }

    if (action === "claim") {
      const user = await requireUser(request);
      await adminDb.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (!current.exists) throw new Error("INVITE_INVALID");
        const currentData = current.data() ?? {};
        const currentUses = Number(currentData.uses ?? 0);
        const currentMaxUses = Number(currentData.maxUses ?? 1);
        if (currentData.enabled === false || currentUses >= currentMaxUses) throw new Error("INVITE_UNAVAILABLE");

        tx.update(ref, {
          uses: currentUses + 1,
          lastClaimedAt: FieldValue.serverTimestamp(),
          lastClaimedBy: user.uid,
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.set(adminDb!.collection("betaAccess").doc(user.uid), {
          uid: user.uid,
          email: user.email ?? null,
          inviteCode: code,
          termsVersion: "2026-08-beta",
          privacyVersion: "2026-08-beta",
          joinedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401
      : message === "INVITE_INVALID" ? 404
      : message === "INVITE_UNAVAILABLE" ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

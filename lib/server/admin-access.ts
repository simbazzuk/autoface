import type { DecodedIdToken } from "firebase-admin/auth";
import { requireUser } from "@/lib/server/firebase-admin";

function adminEmails() {
  return new Set(
    (process.env.AUTOFACE_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminUser(user: DecodedIdToken) {
  const email = user.email?.toLowerCase();
  return Boolean(email && adminEmails().has(email));
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if (!isAdminUser(user)) throw new Error("ADMIN_FORBIDDEN");
  return user;
}

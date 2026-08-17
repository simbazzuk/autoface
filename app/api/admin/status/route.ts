import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/firebase-admin";
import { isAdminUser } from "@/lib/server/admin-access";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return NextResponse.json({ isAdmin: isAdminUser(user) });
  } catch {
    return NextResponse.json({ isAdmin: false }, { status: 401 });
  }
}

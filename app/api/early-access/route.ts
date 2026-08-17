import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Invalid submission" }, { status: 400 });

  const record = { name, email, createdAt: new Date().toISOString() };
  if (process.env.NODE_ENV !== "production") {
    const dir = path.join(process.cwd(), ".data");
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(path.join(dir, "early-access.ndjson"), JSON.stringify(record) + "\n", "utf8");
  }
  return NextResponse.json({ ok: true });
}

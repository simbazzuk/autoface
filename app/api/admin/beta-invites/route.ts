import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { requireAdmin } from "@/lib/server/admin-access";

export const runtime = "nodejs";

function cleanCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
}

function asIso(value: unknown) {
  const v = value as { toDate?: () => Date } | null | undefined;
  return v?.toDate ? v.toDate().toISOString() : null;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const snap = await adminDb.collection("betaInvites").limit(200).get();
    const invites = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        code: doc.id,
        enabled: data.enabled !== false,
        maxUses: Number(data.maxUses ?? 1),
        uses: Number(data.uses ?? 0),
        note: String(data.note ?? ""),
        createdAt: asIso(data.createdAt),
      };
    }).sort((a,b)=>(b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return NextResponse.json({ invites });
  } catch (error) {
    const message=error instanceof Error?error.message:"UNKNOWN_ERROR";
    return NextResponse.json({error:message},{status:message==="ADMIN_FORBIDDEN"?403:message==="UNAUTHENTICATED"?401:500});
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const body=await request.json() as {code?:string;maxUses?:number;note?:string};
    const code=cleanCode(body.code ?? "");
    const maxUses=Math.max(1,Math.min(100,Math.round(Number(body.maxUses ?? 1))));
    const note=(body.note ?? "").trim().slice(0,200);
    if(code.length<4)return NextResponse.json({error:"INVALID_CODE"},{status:400});

    const ref=adminDb.collection("betaInvites").doc(code);
    const existing=await ref.get();
    if(existing.exists)return NextResponse.json({error:"INVITE_EXISTS"},{status:409});
    await ref.set({code,maxUses,uses:0,note,enabled:true,createdBy:admin.uid,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
    await adminDb.collection("adminAuditEvents").add({
      adminUid:admin.uid,adminEmail:admin.email ?? null,action:"beta_invite_created",inviteCode:code,maxUses,createdAt:FieldValue.serverTimestamp()
    });
    return NextResponse.json({ok:true,code});
  } catch(error){
    const message=error instanceof Error?error.message:"UNKNOWN_ERROR";
    return NextResponse.json({error:message},{status:message==="ADMIN_FORBIDDEN"?403:message==="UNAUTHENTICATED"?401:500});
  }
}

export async function PATCH(request: Request) {
  try {
    const admin=await requireAdmin(request);
    if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");
    const body=await request.json() as {code?:string;enabled?:boolean};
    const code=cleanCode(body.code ?? "");
    if(!code||typeof body.enabled!=="boolean")return NextResponse.json({error:"INVALID_REQUEST"},{status:400});
    const ref=adminDb.collection("betaInvites").doc(code);
    if(!(await ref.get()).exists)return NextResponse.json({error:"NOT_FOUND"},{status:404});
    await ref.update({enabled:body.enabled,updatedAt:FieldValue.serverTimestamp()});
    await adminDb.collection("adminAuditEvents").add({
      adminUid:admin.uid,adminEmail:admin.email ?? null,action:body.enabled?"beta_invite_enabled":"beta_invite_disabled",inviteCode:code,createdAt:FieldValue.serverTimestamp()
    });
    return NextResponse.json({ok:true});
  } catch(error){
    const message=error instanceof Error?error.message:"UNKNOWN_ERROR";
    return NextResponse.json({error:message},{status:message==="ADMIN_FORBIDDEN"?403:message==="UNAUTHENTICATED"?401:500});
  }
}

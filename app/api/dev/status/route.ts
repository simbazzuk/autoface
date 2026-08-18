import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request:Request){
  try{
    if(process.env.NODE_ENV==="production") return NextResponse.json({developmentTools:false});
    await requireUser(request);
    return NextResponse.json({developmentTools:true});
  }catch{
    return NextResponse.json({developmentTools:false},{status:401});
  }
}

import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
export const runtime = "nodejs";
export async function GET(request: Request) {
 try {
  const user=await requireUser(request); if(!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const matchId=new URL(request.url).searchParams.get("matchId")?.trim()??"";
  if(!matchId) return NextResponse.json({error:"INVALID_REQUEST"},{status:400});
  const ms=await adminDb.collection("matches").doc(matchId).get();
  if(!ms.exists) return NextResponse.json({error:"MATCH_NOT_FOUND"},{status:404});
  const m=ms.data()??{}; const participants=Array.isArray(m.participants)?m.participants.map(String):[];
  if(!participants.includes(user.uid)) return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const otherUid=participants.find(x=>x!==user.uid); if(!otherUid) return NextResponse.json({error:"MATCH_INVALID"},{status:400});
  const [a,b]=await Promise.all([adminDb.collection("blocks").doc(`${user.uid}__${otherUid}`).get(),adminDb.collection("blocks").doc(`${otherUid}__${user.uid}`).get()]);
  if(a.exists||b.exists) return NextResponse.json({error:"MATCH_BLOCKED"},{status:409});
  const [profile,msgs]=await Promise.all([adminDb.collection("profiles").doc(otherUid).get(),adminDb.collection("conversations").doc(matchId).collection("messages").orderBy("createdAt","asc").limit(500).get()]);
  const pd=profile.data()??{};
  return NextResponse.json({history:{matchId,other:{uid:otherUid,firstName:String(pd.firstName??pd.displayName??"Member")},messages:msgs.docs.map(d=>{const x=d.data()??{};return{id:d.id,senderUid:String(x.senderUid??""),text:String(x.text??""),createdAt:x.createdAt?.toDate?.()?.toISOString?.()??null};})}});
 } catch(e){const x=e instanceof Error?e.message:"UNKNOWN_ERROR";return NextResponse.json({error:x},{status:x==="UNAUTHENTICATED"?401:500});}
}
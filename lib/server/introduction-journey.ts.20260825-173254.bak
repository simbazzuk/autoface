import { adminDb } from "@/lib/server/firebase-admin";
import { safeProjectionFor, type SafeDiscoveryProfile } from "@/lib/server/discovery";

export type PendingIntroduction = SafeDiscoveryProfile & {
  interestId:string;
  state:"waiting";
};

export type MutualIntroduction = SafeDiscoveryProfile & {
  matchId:string;
  state:"introduced"|"talking"|"getting_to_know"|"met"|"progressing";
  createdAt:string|null;
};

function iso(value:unknown){
  const v=value as {toDate?:()=>Date}|null;
  return v?.toDate?.().toISOString()??null;
}

export async function introductionJourneyFor(uid:string){
  if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");

  const [outgoing,matches]=await Promise.all([
    adminDb.collection("interests").where("fromUid","==",uid).get(),
    adminDb.collection("matches").where("participants","array-contains",uid).limit(30).get(),
  ]);

  const mutualOtherUids=new Set<string>();
  const mutual:MutualIntroduction[]=[];

  for(const match of matches.docs){
    const data=match.data();
    if(data.status!=="mutual")continue;
    const participants=(data.participants??[]) as string[];
    const otherUid=participants.find(x=>x!==uid);
    if(!otherUid)continue;
    mutualOtherUids.add(otherUid);
    const profile=await safeProjectionFor(uid,otherUid);
    if(!profile)continue;
    const journeyState=["introduced","talking","getting_to_know","met","progressing"].includes(String(data.journeyState))
      ? data.journeyState as MutualIntroduction["state"]
      : "introduced";
    mutual.push({matchId:match.id,state:journeyState,createdAt:iso(data.createdAt),...profile});
  }

  const waiting:PendingIntroduction[]=[];
  const saved:PendingIntroduction[]=[];
  for(const doc of outgoing.docs){
    const data=doc.data();
    const otherUid=String(data.toUid??"");
    if(!otherUid||mutualOtherUids.has(otherUid))continue;
    if(data.status!=="interested"&&data.status!=="saved")continue;
    const profile=await safeProjectionFor(uid,otherUid);
    if(!profile)continue;
    const item={interestId:doc.id,state:"waiting" as const,...profile};
    if(data.status==="interested")waiting.push(item);
    else saved.push(item);
  }

  mutual.sort((a,b)=>(b.createdAt??"").localeCompare(a.createdAt??""));
  return{
    waiting,
    mutual,
    saved,
    counts:{waiting:waiting.length,mutual:mutual.length,saved:saved.length},
  };
}

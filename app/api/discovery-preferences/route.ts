import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { defaultDiscoveryPreferences, type DiscoveryPreferences } from "@/lib/discovery-preferences";

const intents=["marriage","long_term_relationship","serious_relationship"] as const;
const locations=["anywhere_uk","same_general_area"] as const;
const professionModes=["doesnt_matter","similar_outlook","preferred_areas"] as const;
const professionAreas=["healthcare","technology","finance","engineering","education","legal","business","public_sector","creative","skilled_trades","other"] as const;
const educationPreferences=["doesnt_matter","similar_background","graduate_preferred","postgraduate_preferred"] as const;

export async function GET(request:Request){
 try{
  const user=await requireUser(request); if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");
  const snap=await adminDb.collection("discoveryPreferences").doc(user.uid).get();
  const data=snap.exists?snap.data():{};
  return NextResponse.json({preferences:{uid:user.uid,...defaultDiscoveryPreferences,...data}});
 }catch(error){const message=error instanceof Error?error.message:"UNKNOWN_ERROR";return NextResponse.json({error:message},{status:message==="UNAUTHENTICATED"?401:500})}
}

export async function POST(request:Request){
 try{
  const user=await requireUser(request); if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");
  const body=await request.json() as Partial<DiscoveryPreferences>;
  const minAge=Number(body.minAge),maxAge=Number(body.maxAge);
  if(!Number.isInteger(minAge)||!Number.isInteger(maxAge)||minAge<18||maxAge>100||minAge>maxAge)return NextResponse.json({error:"INVALID_AGE_RANGE"},{status:400});
  if(!locations.includes(body.locationPreference as typeof locations[number]))return NextResponse.json({error:"INVALID_LOCATION_PREFERENCE"},{status:400});
  const relationshipIntents=Array.isArray(body.relationshipIntents)?body.relationshipIntents.filter((x):x is typeof intents[number]=>intents.includes(x as typeof intents[number])):[];
  if(relationshipIntents.length===0)return NextResponse.json({error:"SELECT_RELATIONSHIP_INTENT"},{status:400});
  const ref=adminDb.collection("discoveryPreferences").doc(user.uid); const existing=await ref.get();
  const professionPreferenceMode=professionModes.includes(body.professionPreferenceMode as typeof professionModes[number])?body.professionPreferenceMode:"doesnt_matter";
  const preferredProfessionAreas=Array.isArray(body.preferredProfessionAreas)?body.preferredProfessionAreas.filter((x):x is typeof professionAreas[number]=>professionAreas.includes(x as typeof professionAreas[number])):[];
  const educationPreference=educationPreferences.includes(body.educationPreference as typeof educationPreferences[number])?body.educationPreference:"doesnt_matter";
  const heightPreferenceImportance =
    typeof body.heightPreferenceImportance === "string" &&
    ["doesnt_matter","preference","important"].includes(body.heightPreferenceImportance)
      ? body.heightPreferenceImportance
      : "doesnt_matter";
  const introductionLocation =
    typeof body.introductionLocation === "string" &&
    ["doesnt_matter","same_area","within_50_miles","uk_wide","international"].includes(body.introductionLocation)
      ? body.introductionLocation
      : "doesnt_matter";
  const sharedInterestPreference =
    typeof body.sharedInterestPreference === "string" &&
    ["doesnt_matter","preference","important"].includes(body.sharedInterestPreference)
      ? body.sharedInterestPreference
      : "doesnt_matter";
  const preferredHeightMinCm =
    typeof body.preferredHeightMinCm === "number" && Number.isFinite(body.preferredHeightMinCm)
      ? Math.max(120,Math.min(220,body.preferredHeightMinCm))
      : null;
  const preferredHeightMaxCm =
    typeof body.preferredHeightMaxCm === "number" && Number.isFinite(body.preferredHeightMaxCm)
      ? Math.max(120,Math.min(220,body.preferredHeightMaxCm))
      : null;
  const preferredSharedInterests=Array.isArray(body.preferredSharedInterests)?body.preferredSharedInterests.filter((x:unknown)=>typeof x==="string").slice(0,20):[];
  await ref.set({uid:user.uid,minAge,maxAge,locationPreference:body.locationPreference,relationshipIntents,requireRelocationOpen:body.requireRelocationOpen===true,professionPreferenceMode,preferredProfessionAreas,educationPreference,preferredHeightMinCm,preferredHeightMaxCm,heightPreferenceImportance,introductionLocation,sharedInterestPreference,preferredSharedInterests,createdAt:existing.exists?(existing.data()?.createdAt??FieldValue.serverTimestamp()):FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
  return NextResponse.json({ok:true});
 }catch(error){const message=error instanceof Error?error.message:"UNKNOWN_ERROR";return NextResponse.json({error:message},{status:message==="UNAUTHENTICATED"?401:500})}
}

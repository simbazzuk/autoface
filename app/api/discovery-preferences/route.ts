import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser, requireVerifiedUser } from "@/lib/server/firebase-admin";
import { defaultDiscoveryPreferences, type DiscoveryPreferences } from "@/lib/discovery-preferences";
import { membershipFor } from "@/lib/server/membership";

const intents=["marriage","long_term_relationship","serious_relationship"] as const;
const locations=["anywhere_uk","same_general_area"] as const;
const professionModes=["doesnt_matter","similar_outlook","preferred_areas"] as const;
const professionAreas=["healthcare","technology","finance","engineering","education","legal","business","public_sector","creative","skilled_trades","other"] as const;
const educationPreferences=["doesnt_matter","similar_background","graduate_preferred","postgraduate_preferred"] as const;

const preferenceImportance=["doesnt_matter","preference","important","essential"] as const;

const religions=["sikh","hindu","muslim","christian","buddhist","jewish","none","other","prefer_not_to_say"] as const;
const diets=["vegetarian","vegan","pescatarian","non_vegetarian","other","prefer_not_to_say"] as const;
const drinking=["never","occasionally","socially","regularly","prefer_not_to_say"] as const;
const smoking=["never","occasionally","regularly","prefer_not_to_say"] as const;
const children=["no_children","have_children","prefer_not_to_say"] as const;
const wantsChildren=["yes","no","open","unsure","prefer_not_to_say"] as const;

export async function GET(request:Request){
 try{
  const user=await requireVerifiedUser(request); if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");
  const [snap,membership]=await Promise.all([
    adminDb.collection("discoveryPreferences").doc(user.uid).get(),
    membershipFor(user.uid)
  ]);
  const data=snap.exists?snap.data():{};
  return NextResponse.json({preferences:{uid:user.uid,...defaultDiscoveryPreferences,...data},membership});
 }catch(error){const message=error instanceof Error?error.message:"UNKNOWN_ERROR";return NextResponse.json({error:message},{status:message==="UNAUTHENTICATED"?401:message==="EMAIL_VERIFICATION_REQUIRED"?403:500})}
}

export async function POST(request:Request){
 try{
  const user=await requireVerifiedUser(request); if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");
  const body=await request.json() as Partial<DiscoveryPreferences>;
  const minAge=Number(body.minAge),maxAge=Number(body.maxAge);
  if(!Number.isInteger(minAge)||!Number.isInteger(maxAge)||minAge<18||maxAge>100||minAge>maxAge)return NextResponse.json({error:"INVALID_AGE_RANGE"},{status:400});
  if(!locations.includes(body.locationPreference as typeof locations[number]))return NextResponse.json({error:"INVALID_LOCATION_PREFERENCE"},{status:400});
  const relationshipIntents=Array.isArray(body.relationshipIntents)?body.relationshipIntents.filter((x):x is typeof intents[number]=>intents.includes(x as typeof intents[number])):[];
  if(relationshipIntents.length===0)return NextResponse.json({error:"SELECT_RELATIONSHIP_INTENT"},{status:400});
  const membership=await membershipFor(user.uid);
  const advanced=membership.entitlements.advancedIntroductionPreferences;
  const ref=adminDb.collection("discoveryPreferences").doc(user.uid); const existing=await ref.get();
  const professionPreferenceMode=advanced && professionModes.includes(body.professionPreferenceMode as typeof professionModes[number]) ? body.professionPreferenceMode : "doesnt_matter";
  const preferredProfessionAreas=advanced&&Array.isArray(body.preferredProfessionAreas)?body.preferredProfessionAreas.filter((x):x is typeof professionAreas[number]=>professionAreas.includes(x as typeof professionAreas[number])):[];
  const educationPreference=advanced&&educationPreferences.includes(body.educationPreference as typeof educationPreferences[number])?body.educationPreference:"doesnt_matter";
  const heightPreferenceImportance =
    advanced && typeof body.heightPreferenceImportance === "string" &&
    ["doesnt_matter","preference","important"].includes(body.heightPreferenceImportance)
      ? body.heightPreferenceImportance
      : "doesnt_matter";
  const introductionLocation =
    advanced && typeof body.introductionLocation === "string" &&
    ["doesnt_matter","same_area","within_50_miles","uk_wide","international"].includes(body.introductionLocation)
      ? body.introductionLocation
      : "doesnt_matter";
  const sharedInterestPreference =
    typeof body.sharedInterestPreference === "string" &&
    ["doesnt_matter","preference","important"].includes(body.sharedInterestPreference)
      ? body.sharedInterestPreference
      : "doesnt_matter";
  const preferredHeightMinCm =
    advanced && typeof body.preferredHeightMinCm === "number" && Number.isFinite(body.preferredHeightMinCm)
      ? Math.max(120,Math.min(220,body.preferredHeightMinCm))
      : null;
  const preferredHeightMaxCm =
    advanced && typeof body.preferredHeightMaxCm === "number" && Number.isFinite(body.preferredHeightMaxCm)
      ? Math.max(120,Math.min(220,body.preferredHeightMaxCm))
      : null;
  const preferredSharedInterests=Array.isArray(body.preferredSharedInterests)?body.preferredSharedInterests.filter((x:unknown)=>typeof x==="string").slice(0,20):[];

  const cleanValues=<T extends string>(
    value:unknown,
    allowed:readonly T[],
  ):T[] =>
    Array.isArray(value)
      ?value.filter((x):x is T=>
          typeof x==="string" &&
          allowed.includes(x as T)
        )
      :[];

  const importance=(value:unknown)=>
    typeof value==="string" &&
    preferenceImportance.includes(
      value as typeof preferenceImportance[number]
    )
      ?value as typeof preferenceImportance[number]
      :"doesnt_matter";

  const preferredReligions=cleanValues(body.preferredReligions,religions);
  const religionImportance=
    preferredReligions.length>0
      ?importance(body.religionImportance)
      :"doesnt_matter";

  const preferredDiets=cleanValues(body.preferredDiets,diets);
  const dietImportance=
    preferredDiets.length>0
      ?importance(body.dietImportance)
      :"doesnt_matter";

  const preferredDrinking=cleanValues(body.preferredDrinking,drinking);
  const drinkingImportance=
    preferredDrinking.length>0
      ?importance(body.drinkingImportance)
      :"doesnt_matter";

  const preferredSmoking=cleanValues(body.preferredSmoking,smoking);
  const smokingImportance=
    preferredSmoking.length>0
      ?importance(body.smokingImportance)
      :"doesnt_matter";

  const preferredChildren=cleanValues(body.preferredChildren,children);
  const childrenImportance=
    preferredChildren.length>0
      ?importance(body.childrenImportance)
      :"doesnt_matter";

  const preferredWantsChildren=cleanValues(body.preferredWantsChildren,wantsChildren);
  const wantsChildrenImportance=
    preferredWantsChildren.length>0
      ?importance(body.wantsChildrenImportance)
      :"doesnt_matter";
  await ref.set({uid:user.uid,minAge,maxAge,locationPreference:body.locationPreference,relationshipIntents,requireRelocationOpen:advanced&&body.requireRelocationOpen===true,professionPreferenceMode,preferredProfessionAreas,educationPreference,preferredHeightMinCm,preferredHeightMaxCm,heightPreferenceImportance,introductionLocation,sharedInterestPreference,preferredSharedInterests,preferredReligions,religionImportance,preferredDiets,dietImportance,preferredDrinking,drinkingImportance,preferredSmoking,smokingImportance,preferredChildren,childrenImportance,preferredWantsChildren,wantsChildrenImportance,createdAt:existing.exists?(existing.data()?.createdAt??FieldValue.serverTimestamp()):FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
  return NextResponse.json({ok:true});
 }catch(error){const message=error instanceof Error?error.message:"UNKNOWN_ERROR";return NextResponse.json({error:message},{status:message==="UNAUTHENTICATED"?401:message==="EMAIL_VERIFICATION_REQUIRED"?403:500})}
}

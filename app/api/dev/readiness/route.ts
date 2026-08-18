import { NextResponse } from "next/server";
import { adminAuth, adminDb, requireUser } from "@/lib/server/firebase-admin";
import { calculateAuthenticity } from "@/lib/authenticity";
import { calculateRelationshipCompleteness, type RelationshipProfile } from "@/lib/relationship-profile";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  try{
    if(process.env.NODE_ENV==="production") throw new Error("DEVELOPMENT_ONLY");
    const user=await requireUser(request);
    if(!adminDb||!adminAuth) throw new Error("SERVER_NOT_CONFIGURED");
    const [profileSnap,relationshipSnap,identitySnap,authUser]=await Promise.all([
      adminDb.collection("profiles").doc(user.uid).get(),
      adminDb.collection("relationshipProfiles").doc(user.uid).get(),
      adminDb.collection("identity").doc(user.uid).get(),
      adminAuth.getUser(user.uid),
    ]);
    const profile=profileSnap.data()??{};
    const relationship=relationshipSnap.data()??{};
    const identity=identitySnap.data()??{};
    const authenticity=calculateAuthenticity({
      emailVerified:authUser.emailVerified===true,
      phoneVerified:Boolean(authUser.phoneNumber),
      mfaEnabled:Boolean(authUser.multiFactor?.enrolledFactors?.length),
      identityVerified:identity.identityVerified===true,
      livenessVerified:identity.livenessVerified===true,
      photoVerified:identity.photoVerified===true,
    });
    const atlasCompleteness=relationshipSnap.exists
      ? calculateRelationshipCompleteness(relationship as RelationshipProfile).score : 0;
    const checks={
      profileExists:profileSnap.exists,
      profileVisible:profile.visibility==="future_matches",
      atlasProfileExists:relationshipSnap.exists,
      compatibilityConsent:relationship.consentForCompatibility===true,
      authenticityReady:authenticity.score>=50,
    };
    return NextResponse.json({ok:true,ready:Object.values(checks).every(Boolean),checks,authenticityScore:authenticity.score,atlasCompleteness});
  }catch(error){
    const message=error instanceof Error?error.message:"UNKNOWN_ERROR";
    return NextResponse.json({error:message},{status:message==="UNAUTHENTICATED"?401:message==="DEVELOPMENT_ONLY"?403:500});
  }
}

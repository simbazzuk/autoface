import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import { adminAuth, adminDb, adminStorage, requireUser } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function assertDevelopment() {
  if (process.env.NODE_ENV === "production") throw new Error("DEVELOPMENT_ONLY");
}

async function requireTestUser(request: Request) {
  assertDevelopment();
  const user = await requireUser(request);
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  // Local development is already protected by assertDevelopment().
  // Any authenticated account may use the harness locally; mark it explicitly
  // so server-side Discovery continues to recognise it as synthetic/test data.
  await adminDb.collection("demoProfiles").doc(user.uid).set({
    uid:user.uid,
    isTestProfile:true,
    developmentAccount:true,
    updatedAt:FieldValue.serverTimestamp(),
  },{merge:true});
  return user;
}

async function deleteQuery(query: FirebaseFirestore.Query) {
  const snap = await query.get();
  if (snap.empty) return 0;
  let count = 0;
  for (let i=0;i<snap.docs.length;i+=350) {
    const batch=adminDb!.batch();
    snap.docs.slice(i,i+350).forEach((doc)=>batch.delete(doc.ref));
    await batch.commit();
    count += Math.min(350,snap.docs.length-i);
  }
  return count;
}

async function deleteConversation(ref: FirebaseFirestore.DocumentReference) {
  const messages = await ref.collection("messages").limit(1000).get();
  for (let i=0;i<messages.docs.length;i+=350) {
    const batch=adminDb!.batch();
    messages.docs.slice(i,i+350).forEach((doc)=>batch.delete(doc.ref));
    await batch.commit();
  }
  await ref.delete();
}

async function removeProfilePhoto(uid: string) {
  if (!adminDb) return;
  const ref=adminDb.collection("profilePhotos").doc(uid);
  const snap=await ref.get();
  const storagePath=String(snap.data()?.storagePath ?? "");
  const provider=String(snap.data()?.storageProvider ?? "firebase");
  if (storagePath && provider==="local-dev") {
    await unlink(storagePath).catch(()=>{});
  } else if (storagePath && adminStorage) {
    await adminStorage.bucket().file(storagePath).delete({ignoreNotFound:true}).catch(()=>{});
  }
  await ref.delete().catch(()=>{});
}

async function resetUserJourney(uid: string) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

  const conversations=await adminDb.collection("conversations")
    .where("participants","array-contains",uid).limit(300).get();
  for (const conversation of conversations.docs) await deleteConversation(conversation.ref);

  await Promise.all([
    deleteQuery(adminDb.collection("notifications").where("recipientUid","==",uid).limit(1000)),
    deleteQuery(adminDb.collection("interests").where("fromUid","==",uid).limit(1000)),
    deleteQuery(adminDb.collection("interests").where("toUid","==",uid).limit(1000)),
    deleteQuery(adminDb.collection("matches").where("participants","array-contains",uid).limit(500)),
    deleteQuery(adminDb.collection("connections").where("participants","array-contains",uid).limit(500)),
    deleteQuery(adminDb.collection("blocks").where("blockerUid","==",uid).limit(1000)),
    deleteQuery(adminDb.collection("blocks").where("blockedUid","==",uid).limit(1000)),
    deleteQuery(adminDb.collection("blocks").where("fromUid","==",uid).limit(1000)),
    deleteQuery(adminDb.collection("blocks").where("toUid","==",uid).limit(1000)),
    deleteQuery(adminDb.collection("reports").where("reporterUid","==",uid).limit(500)),
    deleteQuery(adminDb.collection("securityEvents").where("uid","==",uid).limit(1000)),
    deleteQuery(adminDb.collection("verificationSessions").where("uid","==",uid).limit(500)),
    deleteQuery(adminDb.collection("photoVerificationSessions").where("uid","==",uid).limit(500)),
  ]);

  await removeProfilePhoto(uid);

  const batch=adminDb.batch();
  ["profiles","relationshipProfiles","discoveryPreferences","notificationPreferences"].forEach((collection)=>{
    batch.delete(adminDb!.collection(collection).doc(uid));
  });

  // Keep enough synthetic trust evidence for a rebuilt test profile to enter
  // Discovery after setup. Authentication and the demo marker are preserved.
  batch.set(adminDb.collection("identity").doc(uid),{
    identityVerified:true,
    livenessVerified:true,
    photoVerified:false,
    developmentResetBaseline:true,
    updatedAt:FieldValue.serverTimestamp(),
  },{merge:true});
  batch.set(adminDb.collection("demoProfiles").doc(uid),{
    isTestProfile:true,
    resetAt:FieldValue.serverTimestamp(),
  },{merge:true});
  await batch.commit();
}

async function makeDiscoveryReady(uid:string){
  if(!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const [profileSnap,relationshipSnap]=await Promise.all([
    adminDb.collection("profiles").doc(uid).get(),
    adminDb.collection("relationshipProfiles").doc(uid).get(),
  ]);
  if(!profileSnap.exists) return {profile:false,relationship:relationshipSnap.exists,message:"Create and save your Profile first."};
  const batch=adminDb.batch();
  batch.set(adminDb.collection("profiles").doc(uid),{visibility:"future_matches",updatedAt:FieldValue.serverTimestamp()},{merge:true});
  batch.set(adminDb.collection("identity").doc(uid),{
    identityVerified:true,livenessVerified:true,developmentResetBaseline:true,updatedAt:FieldValue.serverTimestamp(),
  },{merge:true});
  if(relationshipSnap.exists){
    batch.set(adminDb.collection("relationshipProfiles").doc(uid),{consentForCompatibility:true,updatedAt:FieldValue.serverTimestamp()},{merge:true});
  }
  await batch.commit();
  return {profile:true,relationship:relationshipSnap.exists,message:relationshipSnap.exists
    ?"Your test account is now visible, compatibility-enabled and has the development trust baseline."
    :"Your Profile is visible and has the development trust baseline. Complete your Atlas Profile before opening Discover."};
}

type Seed = {
  uid:string; firstName:string; surname:string; preferredName?:string; age:number; location:string; occupation:string;
  caste:string; appearance:"turbaned"|"clean_shaven"|"not_applicable";
  practice:"amritdhari"|"practising"|"moderate"|"cultural_not_religious";
  diet:"vegetarian"|"non_vegetarian"|"vegan";
  family:1|2|3|4|5; communication:1|2|3|4|5; social:1|2|3|4|5;
  career:1|2|3|4|5; adventure:1|2|3|4|5; relocation:1|2|3|4|5;
  interests:1|2|3|4|5; independence:1|2|3|4|5;
  pace:"slow"|"balanced"|"intentional"; about:string;
};

const seeds: Seed[] = [
  {uid:"demo-sikh-harpreet",firstName:"Harpreet",surname:"Singh",age:34,location:"Manchester",occupation:"Civil Engineer",caste:"Jatt",appearance:"turbaned",practice:"moderate",diet:"vegetarian",family:5,communication:4,social:3,career:4,adventure:3,relocation:3,interests:4,independence:3,pace:"intentional",about:"Family-centred, grounded and ambitious. I enjoy travel, keeping active and spending time with close friends."},
  {uid:"demo-sikh-simran",firstName:"Simran",surname:"Kaur",age:31,location:"London",occupation:"Pharmacist",caste:"Khatri",appearance:"not_applicable",practice:"moderate",diet:"vegetarian",family:5,communication:4,social:4,career:4,adventure:4,relocation:2,interests:4,independence:3,pace:"balanced",about:"Warm, sociable and close to family. I value a good career, humour, travel and making time for the people who matter."},
  {uid:"demo-sikh-jaspreet",firstName:"Jaspreet",surname:"Singh",age:36,location:"Birmingham",occupation:"Technology Consultant",caste:"Ramgarhia",appearance:"turbaned",practice:"amritdhari",diet:"vegetarian",family:5,communication:5,social:3,career:4,adventure:2,relocation:3,interests:3,independence:3,pace:"intentional",about:"Faith, family and a calm home life are important to me. I value honesty, purpose and meaningful conversation."},
  {uid:"demo-sikh-priya",firstName:"Priya",surname:"Kaur",age:33,location:"Leeds",occupation:"Doctor",caste:"Jatt",appearance:"not_applicable",practice:"cultural_not_religious",diet:"non_vegetarian",family:4,communication:5,social:4,career:5,adventure:5,relocation:3,interests:4,independence:4,pace:"balanced",about:"Independent and family-minded. I love my work, trying new places, good food and building a life with plenty of laughter."},
  {uid:"demo-sikh-gurpreet",firstName:"Gurpreet",surname:"Singh",age:38,location:"Leicester",occupation:"Finance Manager",caste:"",appearance:"clean_shaven",practice:"practising",diet:"vegetarian",family:5,communication:3,social:2,career:4,adventure:2,relocation:2,interests:3,independence:3,pace:"slow",about:"Thoughtful and fairly private. Family, stability and a supportive partnership matter more to me than a busy social life."},
  {uid:"demo-sikh-navdeep",firstName:"Navdeep",surname:"Kaur",age:30,location:"Toronto, Canada",occupation:"Product Manager",caste:"Jatt",appearance:"not_applicable",practice:"moderate",diet:"non_vegetarian",family:4,communication:4,social:5,career:5,adventure:5,relocation:4,interests:5,independence:4,pace:"balanced",about:"Curious, active and career-focused. I enjoy new experiences but still make family and long-term relationships a priority."},
  {uid:"demo-sikh-aman",firstName:"Aman",surname:"Singh",age:35,location:"Nairobi, Kenya",occupation:"Business Owner",caste:"Ramgarhia",appearance:"turbaned",practice:"practising",diet:"vegetarian",family:5,communication:4,social:4,career:5,adventure:3,relocation:4,interests:3,independence:3,pace:"intentional",about:"Entrepreneurial, family oriented and community minded. I value faith, generosity and building something meaningful together."},
  {uid:"demo-sikh-kiran",firstName:"Kiran",surname:"Kaur",age:32,location:"Melbourne, Australia",occupation:"Architect",caste:"",appearance:"not_applicable",practice:"moderate",diet:"vegetarian",family:4,communication:4,social:3,career:4,adventure:5,relocation:4,interests:5,independence:4,pace:"balanced",about:"Creative, calm and adventurous. I value family, personal growth and having room for both independence and togetherness."},
];

function seededHobbies(firstName:string){const map:Record<string,string[]>={Harpreet:["fitness","travel","sports","family"],Simran:["cinema","travel","food","family","socialising"],Jaspreet:["family","volunteering","reading","fitness"],Priya:["travel","food","cinema","fitness","socialising"],Gurpreet:["family","reading","cinema"],Navdeep:["travel","fitness","socialising","food","outdoors"],Aman:["family","volunteering","sports","travel"],Kiran:["travel","arts","outdoors","cinema","food"]};return map[firstName]??[]}
function seededProfession(firstName:string){const map:Record<string,{professionArea:string;employmentType:string;careerImportance:string;educationLevel:string;educationField:string}>={Harpreet:{professionArea:"engineering",employmentType:"employed",careerImportance:"important",educationLevel:"undergraduate",educationField:"Civil Engineering"},Simran:{professionArea:"healthcare",employmentType:"employed",careerImportance:"important",educationLevel:"postgraduate",educationField:"Pharmacy"},Jaspreet:{professionArea:"technology",employmentType:"employed",careerImportance:"important",educationLevel:"undergraduate",educationField:"Computing"},Priya:{professionArea:"healthcare",employmentType:"employed",careerImportance:"very_important",educationLevel:"postgraduate",educationField:"Medicine"},Gurpreet:{professionArea:"finance",employmentType:"employed",careerImportance:"important",educationLevel:"undergraduate",educationField:"Finance"},Navdeep:{professionArea:"technology",employmentType:"employed",careerImportance:"very_important",educationLevel:"postgraduate",educationField:"Business"},Aman:{professionArea:"business",employmentType:"business_owner",careerImportance:"very_important",educationLevel:"undergraduate",educationField:"Business"},Kiran:{professionArea:"creative",employmentType:"employed",careerImportance:"important",educationLevel:"postgraduate",educationField:"Architecture"}};return map[firstName]??{professionArea:"other",employmentType:"employed",careerImportance:"moderate",educationLevel:"undergraduate",educationField:""}}
async function seedCommunity() {
  if (!adminDb || !adminAuth) throw new Error("SERVER_NOT_CONFIGURED");
  let created=0;
  for (const seed of seeds) {
    const email=`${seed.uid}@autoface.test`;
    try {
      await adminAuth.getUser(seed.uid);
      await adminAuth.updateUser(seed.uid,{email,emailVerified:true,displayName:`${seed.firstName} — TEST PROFILE`,disabled:false});
    } catch {
      await adminAuth.createUser({uid:seed.uid,email,emailVerified:true,displayName:`${seed.firstName} — TEST PROFILE`});
    }

    const batch=adminDb.batch();
    batch.set(adminDb.collection("profiles").doc(seed.uid),{
      uid:seed.uid,firstName:seed.firstName,surname:seed.surname,preferredName:seed.preferredName??"",age:seed.age,generalLocation:seed.location,
      heightCm:null,occupation:seed.occupation,...seededProfession(seed.firstName),education:"",educationInstitution:"",hobbies:seededHobbies(seed.firstName),caste:seed.caste,
      sikhAppearance:seed.appearance,sikhPractice:seed.practice,diet:seed.diet,
      relationshipIntent:"marriage",aboutMe:seed.about,visibility:"future_matches",
      showAge:true,showLocation:true,showOccupation:true,
      developmentSeed:true,updatedAt:FieldValue.serverTimestamp(),createdAt:FieldValue.serverTimestamp(),
    },{merge:true});
    batch.set(adminDb.collection("relationshipProfiles").doc(seed.uid),{
      uid:seed.uid,familyOrientation:seed.family,communicationDirectness:seed.communication,
      socialEnergy:seed.social,careerPriority:seed.career,routineVsAdventure:seed.adventure,
      relocationFlexibility:seed.relocation,sharedInterestsImportance:seed.interests,
      independencePreference:seed.independence,relationshipPace:seed.pace,
      idealWeekend:"A mix of family time, good food, something active and time to recharge.",
      whatMattersMost:"A kind, honest partnership with shared direction and mutual respect.",
      nonNegotiables:"Respect, honesty and serious intent.",
      consentForCompatibility:true,consentForAiDiscovery:false,
      developmentSeed:true,updatedAt:FieldValue.serverTimestamp(),createdAt:FieldValue.serverTimestamp(),
    },{merge:true});
    batch.set(adminDb.collection("identity").doc(seed.uid),{
      identityVerified:true,livenessVerified:true,photoVerified:true,developmentSeed:true,
      updatedAt:FieldValue.serverTimestamp(),
    },{merge:true});
    batch.set(adminDb.collection("demoProfiles").doc(seed.uid),{
      uid:seed.uid,isTestProfile:true,developmentSeed:true,updatedAt:FieldValue.serverTimestamp(),
    },{merge:true});
    batch.set(adminDb.collection("discoveryPreferences").doc(seed.uid),{
      uid:seed.uid,minAge:18,maxAge:100,locationPreference:"anywhere_uk",
      relationshipIntents:["marriage","long_term_relationship","serious_relationship"],
      requireRelocationOpen:false,professionPreferenceMode:"doesnt_matter",preferredProfessionAreas:[],educationPreference:"doesnt_matter",developmentSeed:true,updatedAt:FieldValue.serverTimestamp(),
    },{merge:true});
    await batch.commit();
    created++;
  }
  return created;
}

async function removeSeedCommunity() {
  if (!adminDb || !adminAuth) throw new Error("SERVER_NOT_CONFIGURED");
  for (const seed of seeds) {
    await resetUserJourney(seed.uid).catch(()=>{});
    const batch=adminDb.batch();
    ["profiles","relationshipProfiles","identity","discoveryPreferences","notificationPreferences","demoProfiles","profilePhotos"].forEach((c)=>batch.delete(adminDb!.collection(c).doc(seed.uid)));
    await batch.commit().catch(()=>{});
    await adminAuth.deleteUser(seed.uid).catch(()=>{});
  }
}

export async function POST(request: Request) {
  try {
    const user=await requireTestUser(request);
    const body=await request.json().catch(()=>({})) as {action?:string};
    if (body.action==="reset_me") {
      await resetUserJourney(user.uid);
      return NextResponse.json({ok:true,action:"reset_me",message:"Your test journey was reset. Authentication and the test-profile marker were preserved."});
    }
    if (body.action==="make_discovery_ready") {
      const result=await makeDiscoveryReady(user.uid);
      return NextResponse.json({ok:true,action:"make_discovery_ready",...result});
    }
    if (body.action==="seed_community") {
      const count=await seedCommunity();
      return NextResponse.json({ok:true,action:"seed_community",count,message:`Seeded ${count} synthetic Sikh test profiles.`});
    }
    if (body.action==="remove_seed_community") {
      await removeSeedCommunity();
      return NextResponse.json({ok:true,action:"remove_seed_community",message:"Synthetic Sikh test profiles were removed."});
    }
    return NextResponse.json({error:"INVALID_ACTION"},{status:400});
  } catch (error) {
    const message=error instanceof Error?error.message:"UNKNOWN_ERROR";
    const status=message==="UNAUTHENTICATED"?401:message==="TEST_PROFILE_REQUIRED"||message==="DEVELOPMENT_ONLY"?403:500;
    return NextResponse.json({error:message},{status});
  }
}

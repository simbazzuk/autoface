import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    if (process.env[key] !== undefined) continue;
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const password = process.env.AUTOFACE_DEMO_PASSWORD || "AutoFaceDemo!731";
const isClean = process.argv.includes("--clean");

if (!projectId || !clientEmail || !privateKey) {
  console.error("\nDemo seed stopped: Firebase Admin credentials are missing from .env.local.\n");
  process.exit(1);
}

const allowedProject = /(dev|test|demo|local|staging)/i.test(projectId);
if (!allowedProject || process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
  console.error(`\nDemo seed REFUSED for project '${projectId}'.`);
  console.error("The seed harness only runs against clearly named dev/test/demo/local/staging projects and never in production.\n");
  process.exit(1);
}

const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const auth = getAuth(app);
const db = getFirestore(app);

const demoMembers = [
  {
    key: "priya",
    email: "priya.demo@autoface.test",
    phoneNumber: "+447700900501",
    profile: {
      firstName: "Priya", age: 41, generalLocation: "Leeds", heightCm: 170,
      occupation: "Healthcare professional", education: "Postgraduate",
      relationshipIntent: "marriage",
      aboutMe: "Family-oriented, active and thoughtful. I enjoy travel, good food and making time for the people who matter.",
      visibility: "future_matches", showAge: true, showLocation: true, showOccupation: true,
    },
    relationship: {
      familyOrientation: 5, communicationDirectness: 4, socialEnergy: 3, careerPriority: 4,
      routineVsAdventure: 4, relocationFlexibility: 3, sharedInterestsImportance: 3,
      independencePreference: 4, relationshipPace: "intentional",
      idealWeekend: "A relaxed breakfast, time with family or friends, a long walk and dinner somewhere new.",
      whatMattersMost: "Trust, kindness, communication and building a stable life together.",
      nonNegotiables: "Honesty, respect and genuine intention for a long-term relationship.",
      consentForCompatibility: true,
    },
  },
  {
    key: "maya",
    email: "maya.demo@autoface.test",
    phoneNumber: "+447700900502",
    profile: {
      firstName: "Maya", age: 39, generalLocation: "Manchester", heightCm: 168,
      occupation: "Technology manager", education: "Degree",
      relationshipIntent: "long_term_relationship",
      aboutMe: "Warm, independent and curious. I like city breaks, fitness, live music and quiet Sundays at home.",
      visibility: "future_matches", showAge: true, showLocation: true, showOccupation: true,
    },
    relationship: {
      familyOrientation: 4, communicationDirectness: 4, socialEnergy: 4, careerPriority: 4,
      routineVsAdventure: 4, relocationFlexibility: 4, sharedInterestsImportance: 3,
      independencePreference: 4, relationshipPace: "balanced",
      idealWeekend: "A gym session, brunch, exploring somewhere new and a relaxed evening.",
      whatMattersMost: "A relationship where both people communicate openly and support each other's ambitions.",
      nonNegotiables: "Respect, consistency and emotional maturity.",
      consentForCompatibility: true,
    },
  },
  {
    key: "alisha",
    email: "alisha.demo@autoface.test",
    phoneNumber: "+447700900503",
    profile: {
      firstName: "Alisha", age: 38, generalLocation: "Birmingham", heightCm: 173,
      occupation: "Finance professional", education: "Professional qualification",
      relationshipIntent: "serious_relationship",
      aboutMe: "Outgoing but grounded. I value family, career, travel and having enough independence to keep growing as individuals.",
      visibility: "future_matches", showAge: true, showLocation: true, showOccupation: true,
    },
    relationship: {
      familyOrientation: 4, communicationDirectness: 5, socialEnergy: 5, careerPriority: 5,
      routineVsAdventure: 5, relocationFlexibility: 4, sharedInterestsImportance: 2,
      independencePreference: 5, relationshipPace: "slow",
      idealWeekend: "A day trip, restaurant with friends and then a quiet Sunday to reset for the week.",
      whatMattersMost: "Mutual respect, attraction, humour and space for both people to be themselves.",
      nonNegotiables: "Honesty, ambition and respectful communication.",
      consentForCompatibility: true,
    },
  },
];

async function ensureUser(member) {
  let user;
  try {
    user = await auth.getUserByEmail(member.email);
    user = await auth.updateUser(user.uid, {
      password,
      emailVerified: true,
      phoneNumber: member.phoneNumber,
      displayName: `${member.profile.firstName} — TEST PROFILE`,
      disabled: false,
    });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    user = await auth.createUser({
      email: member.email,
      password,
      emailVerified: true,
      phoneNumber: member.phoneNumber,
      displayName: `${member.profile.firstName} — TEST PROFILE`,
    });
  }
  return user;
}

async function deleteQuery(query) {
  const snap = await query.get();
  if (snap.empty) return;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function clearMatchState(uids) {
  for (const uid of uids) {
    await deleteQuery(db.collection("interests").where("fromUid", "==", uid));
    await deleteQuery(db.collection("interests").where("toUid", "==", uid));
    await deleteQuery(db.collection("matches").where("participants", "array-contains", uid));
  }
}

async function cleanDemoUsers() {
  const uids = [];
  for (const member of demoMembers) {
    try {
      const user = await auth.getUserByEmail(member.email);
      uids.push(user.uid);
      await Promise.all([
        db.collection("profiles").doc(user.uid).delete(),
        db.collection("relationshipProfiles").doc(user.uid).delete(),
        db.collection("identity").doc(user.uid).delete(),
        db.collection("demoProfiles").doc(user.uid).delete(),
      ]);
      await auth.deleteUser(user.uid);
      console.log(`Deleted ${member.email}`);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
  }
  await clearMatchState(uids);
}

async function main() {
  console.log(`\nAutoFace v0.7.1 demo harness`);
  console.log(`Project: ${projectId}`);

  if (isClean) {
    await cleanDemoUsers();
    console.log("\nDemo profiles cleaned.\n");
    return;
  }

  const seeded = [];
  for (const member of demoMembers) {
    const user = await ensureUser(member);
    seeded.push({ ...member, uid: user.uid });
  }

  // Make repeated runs deterministic: remove old interests/matches involving demo users.
  await clearMatchState(seeded.map((m) => m.uid));

  for (const member of seeded) {
    const now = FieldValue.serverTimestamp();
    await Promise.all([
      db.collection("profiles").doc(member.uid).set({ uid: member.uid, ...member.profile, createdAt: now, updatedAt: now }, { merge: true }),
      db.collection("relationshipProfiles").doc(member.uid).set({ uid: member.uid, ...member.relationship, createdAt: now, updatedAt: now }, { merge: true }),
      db.collection("identity").doc(member.uid).set({
        identityVerified: true,
        livenessVerified: true,
        photoVerified: false,
        provider: "autoface-demo-seed",
        providerReference: `seed_${member.key}`,
        verificationAssurance: "development-test-profile",
        verifiedAt: now,
        updatedAt: now,
      }, { merge: true }),
      db.collection("demoProfiles").doc(member.uid).set({
        uid: member.uid,
        isTestProfile: true,
        label: "TEST PROFILE",
        seedVersion: "0.7.1",
        email: member.email,
        seededAt: now,
      }, { merge: true }),
    ]);
  }

  console.log("\nCreated/refreshed demo members:\n");
  for (const member of seeded) {
    console.log(`  ${member.profile.firstName.padEnd(8)} ${member.email}`);
  }
  console.log(`\nPassword for all demo accounts: ${password}`);
  console.log("Authenticity: 75% (email + mobile + identity + liveness)");
  console.log("Discovery: enabled | Compatibility consent: enabled");
  console.log("Existing demo interests/matches were reset for repeatable testing.\n");
}

main().catch((error) => {
  console.error("\nDemo seed failed:", error?.message ?? error);
  process.exit(1);
});

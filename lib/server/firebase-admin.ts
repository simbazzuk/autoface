import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

export const firebaseAdminConfigured = Boolean(projectId && clientEmail && privateKey);

const adminApp = firebaseAdminConfigured
  ? (getApps()[0] ?? initializeApp({
      credential: cert({
        projectId: projectId!,
        clientEmail: clientEmail!,
        privateKey: privateKey!,
      }),
      storageBucket: process.env.FIREBASE_ADMIN_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    }))
  : null;

export const adminAuth = adminApp ? getAuth(adminApp) : null;
export const adminDb = adminApp ? getFirestore(adminApp) : null;
export const adminStorage = adminApp ? getStorage(adminApp) : null;

export async function requireUser(request: Request) {
  if (!adminAuth) throw new Error("SERVER_NOT_CONFIGURED");
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("UNAUTHENTICATED");
  return adminAuth.verifyIdToken(token, true);
}

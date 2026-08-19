"use client";

/**
 * Firebase client bridge for direct-to-Storage report uploads.
 *
 * Files never pass through our own server — the browser uploads straight to
 * Firebase Storage. Access is still gated by role, but not by anything this
 * module checks: it's enforced by Storage Security Rules (storage.rules)
 * reading a `canUploadReports` claim that only our server can mint (see
 * /api/firebase/token + src/server/services/firebase-admin.ts). This module
 * just signs the browser into Firebase using that server-issued token.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, signInWithCustomToken, type Auth } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL, type FirebaseStorage } from "firebase/storage";
import { api } from "@/lib/api/client";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True once every NEXT_PUBLIC_FIREBASE_* value has been filled in. */
export function isFirebaseClientConfigured(): boolean {
  return Object.values(firebaseConfig).every((v) => Boolean(v));
}

let app: FirebaseApp | null = null;
let signInPromise: Promise<void> | null = null;

function getApp(): FirebaseApp {
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return app;
}

function getFirebaseAuth(): Auth {
  return getAuth(getApp());
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getApp());
}

/**
 * Exchanges the app's own session for a Firebase sign-in, so Storage
 * Security Rules can see this user's role claim. Coalesces concurrent
 * callers onto one in-flight sign-in instead of minting a token per call.
 */
export function ensureFirebaseSignedIn(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth.currentUser) return Promise.resolve();
  if (signInPromise) return signInPromise;

  signInPromise = (async () => {
    const { token } = await api.post<{ token: string }>("/firebase/token");
    await signInWithCustomToken(auth, token);
  })().finally(() => {
    signInPromise = null;
  });
  return signInPromise;
}

/** Uploads one file to Storage and returns its public download URL. */
export async function uploadReportFile(path: string, file: File): Promise<string> {
  await ensureFirebaseSignedIn();
  const fileRef = ref(getFirebaseStorage(), path);
  await uploadBytes(fileRef, file, { contentType: file.type });
  return getDownloadURL(fileRef);
}

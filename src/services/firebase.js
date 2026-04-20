// src/services/firebase.js
// Firebase initialization – reads credentials from environment variables.
// Demo mode is now explicit opt-in via VITE_ENABLE_DEMO_MODE=true.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const demoModeRaw = String(import.meta.env.VITE_ENABLE_DEMO_MODE || "").trim().toLowerCase();
export const isDemoModeEnabled = demoModeRaw === "true";

function isPlaceholderValue(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return true;

  return (
    text.startsWith("your-") ||
    text.includes("your-project-id") ||
    text.includes("your-app-id") ||
    text.includes("your-sender-id") ||
    text.includes("your-api-key")
  );
}

const missingFirebaseKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !String(value || "").trim())
  .map(([key]) => key);

const hasPlaceholderValues = Object.values(firebaseConfig).some(isPlaceholderValue);

const hasFirebaseEnvConfig = missingFirebaseKeys.length === 0 && !hasPlaceholderValues;

let auth = null;
let db = null;
let initError = "";

if (hasFirebaseEnvConfig) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    initError = err?.message || "Unknown Firebase initialization error.";
    console.warn("Firebase initialization failed:", initError);
  }
} else if (missingFirebaseKeys.length > 0) {
  initError = `Missing Firebase env vars: ${missingFirebaseKeys.join(", ")}.`;
} else {
  initError = "Firebase env vars still use placeholder values.";
}

export const isFirebaseConfigured = !!auth && !!db;
export const firebaseConfigIssue = isFirebaseConfigured
  ? ""
  : initError || "Firebase is not configured.";

export { auth, db };

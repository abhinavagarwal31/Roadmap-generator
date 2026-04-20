// src/services/firebase.js
// Firebase initialization – reads credentials from environment variables.
// When credentials are not configured, exports null for auth/db.
// The app falls back to demo mode (localStorage) in that case.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

// Check if real credentials have been provided
export const isFirebaseConfigured =
  !!apiKey &&
  apiKey !== "your-api-key-here" &&
  !apiKey.includes("your-");

let auth = null;
let db = null;

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.warn("Firebase initialization failed:", err.message);
  }
}

export { auth, db };

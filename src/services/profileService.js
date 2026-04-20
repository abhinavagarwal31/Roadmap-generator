import { doc, getDoc, setDoc } from "firebase/firestore";

import { db, isDemoModeEnabled, isFirebaseConfigured } from "./firebase";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim();
const USER_PROFILE_PREFIX = "lumospath_user_profile_";

export async function getUserProfileDetails(userId) {
  const fallback = getLocalProfile(userId);
  if (!isFirebaseConfigured) {
    if (isDemoModeEnabled) return fallback;
    return normalizeProfile({});
  }

  try {
    const ref = doc(db, "users", userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return fallback;

    const normalized = normalizeProfile(snap.data()?.profile || {});

    // Keep local cache for smoother offline fallback.
    saveLocalProfile(userId, normalized);
    return normalized;
  } catch (err) {
    console.warn("Could not fetch user profile from Firestore:", err.message);
    return fallback;
  }
}

export async function saveUserProfileDetails(userId, profileInput) {
  const normalized = normalizeProfile(profileInput);

  if (isDemoModeEnabled) {
    // Keep local profile cached only in explicit demo mode.
    saveLocalProfile(userId, normalized);
  }

  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured for saving profile details.");
  }

  try {
    const ref = doc(db, "users", userId);
    await setDoc(ref, { profile: normalized }, { merge: true });
  } catch (err) {
    throw new Error(err?.message || "Could not save user profile to Firestore.");
  }

  return normalized;
}

export async function generateProfileMessage({ displayName, stats }) {
  const response = await fetch(`${API_BASE_URL}/api/ai/profile-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      displayName,
      stats,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const apiError = payload?.error || "Could not generate your profile message right now.";
    throw new Error(apiError);
  }

  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  if (!message) {
    throw new Error("Profile message response was empty.");
  }

  return message;
}

function getProfileStorageKey(userId) {
  return `${USER_PROFILE_PREFIX}${userId || "guest"}`;
}

function getLocalProfile(userId) {
  try {
    const raw = localStorage.getItem(getProfileStorageKey(userId));
    if (!raw) return normalizeProfile({});
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return normalizeProfile({});
  }
}

function saveLocalProfile(userId, profile) {
  localStorage.setItem(getProfileStorageKey(userId), JSON.stringify(profile));
}

function normalizeProfile(profile) {
  const weeklyStudyHours = Number(profile?.weeklyStudyHours);

  return {
    displayName: safeText(profile?.displayName),
    studyGoal: safeText(profile?.studyGoal),
    focusArea: safeText(profile?.focusArea),
    weeklyStudyHours: Number.isFinite(weeklyStudyHours)
      ? Math.max(0, Math.min(168, Math.round(weeklyStudyHours)))
      : 0,
  };
}

function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

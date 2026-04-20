// src/services/topicService.js
// Firestore read/write helpers for topics, skills, and user progress.
// Uses user-created tracks and Firestore data (no hardcoded default tracks).

import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";
import { getCustomTracks } from "./customTrackService";

// ─── Demo mode progress (localStorage) ───────────────────────────────────────

const DEMO_PROGRESS_PREFIX = "lumospath_progress_";
const LEGACY_DEMO_PROGRESS_PREFIX = "skillpath_progress_";
const DEMO_USER_KEY = "lumospath_demo_user";
const LEGACY_DEMO_USER_KEY = "skillpath_demo_user";

function getProgressKey(userId, legacy = false) {
  const prefix = legacy ? LEGACY_DEMO_PROGRESS_PREFIX : DEMO_PROGRESS_PREFIX;
  return `${prefix}${userId}`;
}

function getDemoProgress(userId) {
  try {
    const raw = localStorage.getItem(getProgressKey(userId));
    if (raw) return JSON.parse(raw);

    const legacyRaw = localStorage.getItem(getProgressKey(userId, true));
    const parsedLegacy = legacyRaw ? JSON.parse(legacyRaw) : {};
    if (legacyRaw) {
      localStorage.setItem(getProgressKey(userId), JSON.stringify(parsedLegacy));
      localStorage.removeItem(getProgressKey(userId, true));
    }
    return parsedLegacy;
  } catch {
    return {};
  }
}

function saveDemoProgress(userId, progress) {
  localStorage.setItem(getProgressKey(userId), JSON.stringify(progress));
}

function getResolvedUserId(preferredUserId) {
  if (preferredUserId) return preferredUserId;
  if (auth?.currentUser?.uid) return auth.currentUser.uid;

  try {
    const raw = localStorage.getItem(DEMO_USER_KEY) || localStorage.getItem(LEGACY_DEMO_USER_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.uid || "guest";
  } catch {
    return "guest";
  }
}

function uniqueById(items = []) {
  const map = new Map();
  items.forEach((item) => {
    if (item && item.id) map.set(item.id, item);
  });
  return Array.from(map.values());
}

function mergeWithCustomTracks(baseSkills = [], baseTopics = [], userId) {
  const resolvedUserId = getResolvedUserId(userId);
  const custom = getCustomTracks(resolvedUserId);

  return {
    skills: uniqueById([...baseSkills, ...(custom.skills || [])]),
    topics: uniqueById([...baseTopics, ...(custom.topics || [])]),
  };
}

// ─── Skills ─────────────────────────────────────────────────────────────────

/**
 * Fetch all skills.
 * Returns user-created tracks and Firestore skills (if available).
 */
export async function getSkills(userId) {
  if (!isFirebaseConfigured) {
    const { skills } = mergeWithCustomTracks([], [], userId);
    return skills;
  }

  try {
    const snapshot = await getDocs(collection(db, "skills"));
    if (!snapshot.empty) {
      const firestoreSkills = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const { skills } = mergeWithCustomTracks(firestoreSkills, [], userId);
      return skills;
    }
  } catch (err) {
    console.warn("Firestore unavailable, showing user-created tracks only:", err.message);
  }

  const { skills } = mergeWithCustomTracks([], [], userId);
  return skills;
}

// ─── Topics ─────────────────────────────────────────────────────────────────

/**
 * Fetch all topics.
 * Returns user-created topics and Firestore topics (if available).
 */
export async function getTopics(userId) {
  if (!isFirebaseConfigured) {
    const { topics } = mergeWithCustomTracks([], [], userId);
    return topics;
  }

  try {
    const snapshot = await getDocs(collection(db, "topics"));
    if (!snapshot.empty) {
      const firestoreTopics = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const { topics } = mergeWithCustomTracks([], firestoreTopics, userId);
      return topics;
    }
  } catch (err) {
    console.warn("Firestore unavailable, showing user-created topics only:", err.message);
  }

  const { topics } = mergeWithCustomTracks([], [], userId);
  return topics;
}

/**
 * Fetch a single topic by its ID.
 */
export async function getTopic(topicId, userId) {
  const { topics: customTopics } = mergeWithCustomTracks([], [], userId);
  const customTopic = customTopics.find((topic) => topic.id === topicId) || null;

  if (!isFirebaseConfigured) return customTopic;

  try {
    const ref = doc(db, "topics", topicId);
    const snap = await getDoc(ref);
    if (snap.exists()) return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.warn("Firestore unavailable, using user-created topic only:", err.message);
  }
  return customTopic;
}

// ─── User Progress ───────────────────────────────────────────────────────────

/**
 * Fetch the progress object for a user.
 * Returns { topicId: true, ... } or {} if no progress yet.
 */
export async function getUserProgress(userId) {
  if (!isFirebaseConfigured) return getDemoProgress(userId);

  try {
    const ref = doc(db, "users", userId);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data().progress || {};
    return {};
  } catch (err) {
    console.warn("Could not fetch user progress:", err.message);
    // Fall back to localStorage in case of Firestore error
    return getDemoProgress(userId);
  }
}

/**
 * Mark a topic as completed for a given user.
 */
export async function markTopicComplete(userId, topicId) {
  if (!isFirebaseConfigured) {
    // Demo mode: persist to localStorage
    const current = getDemoProgress(userId);
    saveDemoProgress(userId, { ...current, [topicId]: true });
    return;
  }

  try {
    const ref = doc(db, "users", userId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      await updateDoc(ref, { [`progress.${topicId}`]: true });
    } else {
      await setDoc(ref, { progress: { [topicId]: true } }, { merge: true });
    }
  } catch (err) {
    // Fallback to localStorage on Firestore error
    console.warn("Firestore write failed, saving locally:", err.message);
    const current = getDemoProgress(userId);
    saveDemoProgress(userId, { ...current, [topicId]: true });
  }
}

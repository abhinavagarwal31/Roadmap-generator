// src/services/customTrackService.js
// Persist user-created custom tracks in both localStorage (immediate, offline-capable)
// and Firestore (cross-device persistence) when Firebase is configured (#9).

import { doc, setDoc, deleteDoc, getDocs, collection } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

const CUSTOM_TRACK_STORAGE_PREFIX = "lumospath_custom_tracks_";
const LEGACY_CUSTOM_TRACK_STORAGE_PREFIX = "skillpath_custom_tracks_";

// ─── localStorage helpers ─────────────────────────────────────────────────────

function getStorageKey(userId, legacy = false) {
  const prefix = legacy ? LEGACY_CUSTOM_TRACK_STORAGE_PREFIX : CUSTOM_TRACK_STORAGE_PREFIX;
  return `${prefix}${userId || "guest"}`;
}

function parseStoredValue(raw) {
  if (!raw) return { skills: [], topics: [] };

  try {
    const parsed = JSON.parse(raw);
    return {
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    };
  } catch {
    return { skills: [], topics: [] };
  }
}

function uniqueById(items = []) {
  const map = new Map();
  items.forEach((item) => {
    if (item && item.id) map.set(item.id, item);
  });
  return Array.from(map.values());
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns custom tracks for a user from localStorage (fast, synchronous).
 * Called by topicService.js for immediate merging without an async round-trip.
 */
export function getCustomTracks(userId) {
  const key = getStorageKey(userId);
  const raw = localStorage.getItem(key);
  if (raw) return parseStoredValue(raw);

  // One-time migration path for older key namespace.
  const legacyRaw = localStorage.getItem(getStorageKey(userId, true));
  const parsedLegacy = parseStoredValue(legacyRaw);
  if (legacyRaw) {
    localStorage.setItem(key, JSON.stringify(parsedLegacy));
    localStorage.removeItem(getStorageKey(userId, true));
  }
  return parsedLegacy;
}

/**
 * Loads custom tracks from Firestore for a user and merges them into localStorage.
 * Call this once on app load (e.g. in Dashboard) to sync cross-device data.
 * Safe to call even when offline — errors are silently caught.
 */
export async function syncCustomTracksFromFirestore(userId) {
  if (!isFirebaseConfigured || !userId) return;

  try {
    const snapshot = await getDocs(collection(db, "users", userId, "customTracks"));
    if (snapshot.empty) return;

    const firestoreSkills = [];
    const firestoreTopics = [];

    snapshot.docs.forEach((d) => {
      const data = d.data();
      if (data.skill) firestoreSkills.push(data.skill);
      if (Array.isArray(data.topics)) firestoreTopics.push(...data.topics);
    });

    // Merge Firestore data on top of whatever is already in localStorage
    const local = getCustomTracks(userId);
    const merged = {
      skills: uniqueById([...local.skills, ...firestoreSkills]),
      topics: uniqueById([...local.topics, ...firestoreTopics]),
    };
    localStorage.setItem(getStorageKey(userId), JSON.stringify(merged));
  } catch (err) {
    console.warn("[customTrackService] Firestore sync failed (will use local data):", err.message);
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Add a custom AI-generated track for a user.
 * Writes to localStorage immediately, then persists to Firestore asynchronously.
 */
export async function addCustomTrack(userId, track) {
  if (!track?.skill || !Array.isArray(track?.topics)) {
    throw new Error("Invalid track format.");
  }

  // 1. localStorage write (instant — used by topicService immediately)
  const key = getStorageKey(userId);
  const current = getCustomTracks(userId);
  const updated = {
    skills: uniqueById([...current.skills, track.skill]),
    topics: uniqueById([...current.topics, ...track.topics]),
  };
  localStorage.setItem(key, JSON.stringify(updated));

  // 2. Firestore write (async, best-effort — cross-device persistence)
  if (isFirebaseConfigured && userId) {
    try {
      const ref = doc(db, "users", userId, "customTracks", track.skill.id);
      await setDoc(ref, {
        skill: track.skill,
        topics: track.topics,
        createdAt: Date.now(),
      });
    } catch (err) {
      // Non-fatal: data is already in localStorage
      console.warn("[customTrackService] Firestore write failed (track saved locally):", err.message);
    }
  }

  return updated;
}

/**
 * Remove a custom track for a user.
 * Removes from localStorage immediately, then deletes from Firestore asynchronously.
 */
export async function removeCustomTrack(userId, skillId) {
  const key = getStorageKey(userId);
  const current = getCustomTracks(userId);

  const skillToRemove = current.skills.find((skill) => skill.id === skillId);
  if (!skillToRemove) return current;

  const topicIds = new Set(skillToRemove.topics || []);

  const updated = {
    skills: current.skills.filter((skill) => skill.id !== skillId),
    topics: current.topics.filter(
      (topic) => !topicIds.has(topic.id) && topic.skillId !== skillId
    ),
  };

  // 1. localStorage remove (instant)
  localStorage.setItem(key, JSON.stringify(updated));

  // 2. Firestore delete (async, best-effort)
  if (isFirebaseConfigured && userId) {
    try {
      const ref = doc(db, "users", userId, "customTracks", skillId);
      await deleteDoc(ref);
    } catch (err) {
      console.warn("[customTrackService] Firestore delete failed (track removed locally):", err.message);
    }
  }

  return updated;
}

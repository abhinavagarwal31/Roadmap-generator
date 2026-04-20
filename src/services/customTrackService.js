// Persist user-created custom tracks in localStorage.
// Each user gets an isolated set of custom skills/topics.

const CUSTOM_TRACK_STORAGE_PREFIX = "lumospath_custom_tracks_";
const LEGACY_CUSTOM_TRACK_STORAGE_PREFIX = "skillpath_custom_tracks_";

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

export function addCustomTrack(userId, track) {
  if (!track?.skill || !Array.isArray(track?.topics)) {
    throw new Error("Invalid track format.");
  }

  const key = getStorageKey(userId);
  const current = getCustomTracks(userId);

  const updated = {
    skills: uniqueById([...current.skills, track.skill]),
    topics: uniqueById([...current.topics, ...track.topics]),
  };

  localStorage.setItem(key, JSON.stringify(updated));
  return updated;
}

export function removeCustomTrack(userId, skillId) {
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

  localStorage.setItem(key, JSON.stringify(updated));
  return updated;
}

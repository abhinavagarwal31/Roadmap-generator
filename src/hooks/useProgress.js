// src/hooks/useProgress.js
// Custom hook that manages a user's topic progress.
// Returns: completedTopics (array), isTopicUnlocked(), markComplete(), progressFor()

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserProgress, markTopicComplete } from "../services/topicService";

export function useProgress() {
  const { user } = useAuth();

  // completedMap: { topicId: true }
  const [completedMap, setCompletedMap] = useState({});
  const [loading, setLoading] = useState(true);

  // ── Fetch progress from Firestore on mount / user change ─────────────────
  useEffect(() => {
    if (!user) {
      setCompletedMap({});
      setLoading(false);
      return;
    }

    setLoading(true);
    getUserProgress(user.uid)
      .then((progress) => {
        setCompletedMap(progress || {});
      })
      .catch((err) => {
        console.error("Failed to load progress:", err);
      })
      .finally(() => setLoading(false));
  }, [user]);

  // Array of completed topic IDs (memoised inline for simplicity)
  const completedTopics = Object.keys(completedMap);

  // ── Unlock check ─────────────────────────────────────────────────────────
  /**
   * A topic is unlocked when ALL its prerequisites are completed.
   * Topics with no prerequisites are always unlocked.
   */
  const isTopicUnlocked = useCallback(
    (topic) => {
      if (!topic) return false;
      if (!topic.prerequisites || topic.prerequisites.length === 0) return true;
      return topic.prerequisites.every((id) => completedMap[id] === true);
    },
    [completedMap]
  );

  // ── Mark complete ─────────────────────────────────────────────────────────
  /**
   * Optimistically updates local state, then persists to Firestore.
   */
  const markComplete = useCallback(
    async (topicId) => {
      if (!user) return;

      // Optimistic update
      setCompletedMap((prev) => ({ ...prev, [topicId]: true }));

      try {
        await markTopicComplete(user.uid, topicId);
      } catch (err) {
        // Rollback on failure
        setCompletedMap((prev) => {
          const next = { ...prev };
          delete next[topicId];
          return next;
        });
        throw err;
      }
    },
    [user]
  );

  // ── Progress percentage for a skill ──────────────────────────────────────
  /**
   * Given an array of topic IDs belonging to a skill,
   * returns the completion percentage (0–100).
   */
  const progressFor = useCallback(
    (topicIds = []) => {
      if (topicIds.length === 0) return 0;
      const done = topicIds.filter((id) => completedMap[id] === true).length;
      return Math.round((done / topicIds.length) * 100);
    },
    [completedMap]
  );

  return {
    completedTopics,
    completedMap,
    isTopicUnlocked,
    markComplete,
    progressFor,
    loading,
  };
}

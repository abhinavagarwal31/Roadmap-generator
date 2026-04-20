// src/pages/TopicDetails.jsx
// Shows full topic info and lets the user mark it as completed.

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Loader from "../components/Loader";
import { getTopic, getTopics } from "../services/topicService";
import { useProgress } from "../hooks/useProgress";
import { useAuth } from "../context/AuthContext";

export default function TopicDetails() {
  const { id: topicId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid || "guest";

  const [topic, setTopic] = useState(null);
  const [topicTitleMap, setTopicTitleMap] = useState({});
  const [dataLoading, setDataLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState("");

  const { completedMap, isTopicUnlocked, markComplete } = useProgress();

  // Fetch this topic's data
  useEffect(() => {
    async function fetchTopic() {
      try {
        const [data, allTopics] = await Promise.all([
          getTopic(topicId, userId),
          getTopics(userId),
        ]);

        setTopic(data);

        const titleMap = allTopics.reduce((acc, currentTopic) => {
          acc[currentTopic.id] = currentTopic.title;
          return acc;
        }, {});
        setTopicTitleMap(titleMap);
      } catch (err) {
        console.error("Failed to load topic:", err);
      } finally {
        setDataLoading(false);
      }
    }
    fetchTopic();
  }, [topicId, userId]);

  if (dataLoading) return <Loader message="Loading topic..." />;

  if (!topic) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Navbar />
        <p className="text-gray-500 mt-20">Topic not found.</p>
      </div>
    );
  }

  const isCompleted = completedMap[topicId] === true;
  const isUnlocked = isTopicUnlocked(topic);

  async function handleMarkComplete() {
    if (isCompleted || !isUnlocked) return;
    setMarking(true);
    setMarkError("");
    try {
      await markComplete(topicId);
    } catch {
      setMarkError("Failed to save progress. Please try again.");
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <main className="max-w-2xl mx-auto px-6 pt-24 pb-16 animate-fade-in">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 text-sm hover:text-white transition-colors mb-6 block"
        >
          ← Back to Skill Tree
        </button>

        {/* Topic card */}
        <div className="bg-bg-card border border-neutral-800 rounded-lg p-8">
          {/* State badge */}
          <div className="mb-4">
            {isCompleted ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-950 text-green-400 border border-green-800">
                ✅ Completed
              </span>
            ) : isUnlocked ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-950 text-red-400 border border-red-900">
                🔴 Unlocked — Ready to Learn
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-500 border border-neutral-700">
                🔒 Locked — Complete prerequisites first
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-3">{topic.title}</h1>

          {/* Description */}
          <p className="text-gray-400 leading-relaxed mb-8">{topic.description}</p>

          {/* Prerequisites */}
          {topic.prerequisites && topic.prerequisites.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
                Prerequisites
              </h2>
              <div className="flex flex-wrap gap-2">
                {topic.prerequisites.map((prereqId) => (
                  <span
                    key={prereqId}
                    className={`text-xs px-2.5 py-1 rounded border ${
                      completedMap[prereqId]
                        ? "border-green-800 text-green-400 bg-green-950"
                        : "border-neutral-700 text-neutral-400"
                    }`}
                  >
                    {topicTitleMap[prereqId] || prereqId.replace("topic-", "").replace(/-/g, " ")}
                    {completedMap[prereqId] ? " ✓" : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Resources */}
          {topic.resources && topic.resources.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-3">
                Learning Resources
              </h2>
              <ul className="space-y-2">
                {topic.resources.map((res, i) => (
                  <li key={i}>
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-300 hover:text-white
                                 hover:underline transition-colors group"
                    >
                      <span className="text-accent-red group-hover:text-accent-redHover text-xs">↗</span>
                      {res.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Error */}
          {markError && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-900 rounded px-3 py-2 mb-4">
              {markError}
            </p>
          )}

          {/* Mark as completed button */}
          {isCompleted ? (
            <div className="w-full py-2.5 rounded text-center text-sm font-medium
                            bg-green-950 text-green-400 border border-green-800 cursor-default">
              ✓ Topic Completed
            </div>
          ) : (
            <button
              onClick={handleMarkComplete}
              disabled={!isUnlocked || marking}
              className={`w-full py-2.5 rounded text-sm font-semibold transition-all
                ${
                  isUnlocked
                    ? "bg-accent-red text-white hover:bg-accent-redHover active:bg-accent-redDim"
                    : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
                }
                disabled:opacity-50`}
            >
              {marking
                ? "Saving..."
                : isUnlocked
                ? "Mark as Completed ✓"
                : "Complete prerequisites first"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

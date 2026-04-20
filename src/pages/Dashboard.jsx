// src/pages/Dashboard.jsx
// Shows all available skills as cards with progress bars.
// Each card has a "View Path" button to open the skill tree.

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Loader from "../components/Loader";
import { getSkills, getTopics } from "../services/topicService";
import { useProgress } from "../hooks/useProgress";
import { useAuth } from "../context/AuthContext";
import { generateAssessmentQuiz, generateTrackWithAi } from "../services/aiTrackService";
import { addCustomTrack, removeCustomTrack, syncCustomTracksFromFirestore } from "../services/customTrackService";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid || "guest";
  const learnerName = getLearnerName(user);

  const [skills, setSkills] = useState([]);
  const [topics, setTopics] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [showTrackBuilder, setShowTrackBuilder] = useState(false);
  const [trackPrompt, setTrackPrompt] = useState("");
  const [assessmentQuiz, setAssessmentQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizLoading, setQuizLoading] = useState(false);
  const [builderLoading, setBuilderLoading] = useState(false);
  const [builderError, setBuilderError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [deletingSkillId, setDeletingSkillId] = useState("");

  // Fetch all skills and topics on mount
  const refreshDashboardData = useCallback(
    async ({ showLoader = true, syncFirestore = false } = {}) => {
      if (showLoader) setDataLoading(true);

      try {
        // Sync Firestore custom tracks into localStorage before fetching
        // (only on initial load to avoid extra round-trips on subsequent refreshes)
        if (syncFirestore) {
          await syncCustomTracksFromFirestore(userId);
        }

        const [skillsData, topicsData] = await Promise.all([
          getSkills(userId),
          getTopics(userId),
        ]);
        setSkills(skillsData);
        setTopics(topicsData);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        if (showLoader) setDataLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    // syncFirestore: true on first mount to pull cross-device custom tracks
    refreshDashboardData({ syncFirestore: true });
  }, [refreshDashboardData]);

  function resetTrackBuilderState() {
    setTrackPrompt("");
    setAssessmentQuiz(null);
    setQuizAnswers({});
    setBuilderError("");
    setQuizLoading(false);
    setBuilderLoading(false);
  }

  function openTrackBuilder() {
    setBuilderError("");
    setQuizAnswers({});
    setShowTrackBuilder(true);
  }

  function closeTrackBuilder() {
    if (builderLoading || quizLoading) return;
    setShowTrackBuilder(false);
    resetTrackBuilderState();
  }

  function handleTrackPromptChange(value) {
    setTrackPrompt(value);
    setBuilderError("");

    if (assessmentQuiz) {
      setAssessmentQuiz(null);
      setQuizAnswers({});
    }
  }

  function handleQuizAnswerChange(questionId, selectedOptionIndex) {
    setQuizAnswers((prev) => ({
      ...prev,
      [questionId]: selectedOptionIndex,
    }));
  }

  async function handleStartAssessment() {
    setBuilderError("");
    const normalizedPrompt = trackPrompt.trim();

    if (!normalizedPrompt) {
      setBuilderError("Enter a topic first, then start the assessment.");
      return;
    }

    setQuizLoading(true);
    try {
      const generatedQuiz = await generateAssessmentQuiz({
        prompt: normalizedPrompt,
      });

      setAssessmentQuiz(generatedQuiz);
      setQuizAnswers({});
    } catch (err) {
      setBuilderError(err?.message || "Could not generate assessment quiz right now.");
    } finally {
      setQuizLoading(false);
    }
  }

  async function handleGenerateTrack(e) {
    e.preventDefault();
    setBuilderError("");
    setNotice("");
    setActionError("");

    const normalizedPrompt = trackPrompt.trim();
    if (!normalizedPrompt) {
      setBuilderError("Please describe what track you want to learn.");
      return;
    }

    const quizQuestions = Array.isArray(assessmentQuiz?.questions) ? assessmentQuiz.questions : [];
    if (quizQuestions.length === 0) {
      setBuilderError("Please complete the assessment quiz before generating a track.");
      return;
    }

    const unansweredCount = quizQuestions.filter(
      (question) => !Number.isInteger(quizAnswers[question.id])
    ).length;

    if (unansweredCount > 0) {
      setBuilderError(`Please answer all quiz questions (${unansweredCount} remaining).`);
      return;
    }

    const correctAnswers = quizQuestions.reduce(
      (count, question) =>
        count + (quizAnswers[question.id] === question.correctOptionIndex ? 1 : 0),
      0
    );

    const totalQuestions = quizQuestions.length;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);

    setBuilderLoading(true);
    try {
      const generatedTrack = await generateTrackWithAi({
        prompt: normalizedPrompt,
        assessment: {
          correctAnswers,
          totalQuestions,
          percentage,
        },
      });

      await addCustomTrack(userId, generatedTrack);
      await refreshDashboardData({ showLoader: false });

      setShowTrackBuilder(false);
      resetTrackBuilderState();
      setNotice(
        `Added "${generatedTrack.skill.name}" to your dashboard. Quiz score: ${correctAnswers}/${totalQuestions}.`
      );
    } catch (err) {
      setBuilderError(err?.message || "Could not generate a track right now.");
    } finally {
      setBuilderLoading(false);
    }
  }

  async function handleDeleteTrack(skill) {
    if (!skill?.isCustom) return;

    const confirmed = window.confirm(`Remove "${skill.name}" from your dashboard?`);
    if (!confirmed) return;

    setDeletingSkillId(skill.id);
    setActionError("");
    setNotice("");

    try {
      await removeCustomTrack(userId, skill.id);
      await refreshDashboardData({ showLoader: false });
      setNotice(`Removed "${skill.name}".`);
    } catch (err) {
      setActionError(err?.message || "Could not remove this track.");
    } finally {
      setDeletingSkillId("");
    }
  }

  const { progressFor, loading: progressLoading } = useProgress();

  // ── Memoised skill card data ─────────────────────────────────────────────
  // Recomputes only when skills list or progress values change (#5 useMemo)
  const skillCardsData = useMemo(
    () =>
      skills.map((skill) => ({
        ...skill,
        progress: progressFor(skill.topics),
        completedCount: Math.round(
          (progressFor(skill.topics) / 100) * (skill.topics?.length || 0)
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [skills, progressFor]
  );

  if (dataLoading || progressLoading) return <Loader message="Loading your dashboard..." />;

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        {/* Heading */}
        <div className="mb-10 animate-fade-in">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Hey {learnerName}</h1>
              <p className="text-gray-500 text-sm">
                Your learning dashboard is ready. Pick a path, or take an adaptive assessment to get a personalized AI roadmap.
              </p>
            </div>

            <button
              onClick={openTrackBuilder}
              className="rounded border border-accent-red px-4 py-2 text-sm font-medium
                         text-accent-red hover:bg-accent-red hover:text-white
                         transition-all duration-200"
            >
              + Create AI Track
            </button>
          </div>

          {notice && (
            <p className="mt-3 text-sm text-green-400 bg-green-950 border border-green-900 rounded px-3 py-2">
              {notice}
            </p>
          )}

          {actionError && (
            <p className="mt-3 text-sm text-red-400 bg-red-950 border border-red-900 rounded px-3 py-2">
              {actionError}
            </p>
          )}
        </div>

        {/* Skill cards grid */}
        {skillCardsData.length === 0 ? (
          <div className="text-center text-gray-600 mt-20">
            <p className="text-lg">No skill paths found.</p>
            <p className="text-sm mt-1">Create your first track to get started.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {skillCardsData.map((skill, i) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                progress={skill.progress}
                onViewPath={() => navigate(`/skill/${skill.id}`)}
                onDeleteTrack={() => handleDeleteTrack(skill)}
                deleting={deletingSkillId === skill.id}
                delay={i * 60}
              />
            ))}
          </div>
        )}
      </main>

      {showTrackBuilder && (
        <TrackBuilderModal
          trackPrompt={trackPrompt}
          onTrackPromptChange={handleTrackPromptChange}
          assessmentQuiz={assessmentQuiz}
          quizAnswers={quizAnswers}
          quizLoading={quizLoading}
          builderLoading={builderLoading}
          builderError={builderError}
          onStartAssessment={handleStartAssessment}
          onQuizAnswerChange={handleQuizAnswerChange}
          onClose={closeTrackBuilder}
          onSubmit={handleGenerateTrack}
          show={showTrackBuilder}
        />
      )}
    </div>
  );
}

// ─── Skill Card ──────────────────────────────────────────────────────────────

function getLearnerName(user) {
  const fallback = user?.email ? user.email.split("@")[0] : "Learner";
  const rawName = (user?.displayName || fallback || "Learner").trim();
  const firstToken = rawName.split(" ").filter(Boolean)[0];
  return firstToken || "Learner";
}

function SkillCard({ skill, progress, onViewPath, onDeleteTrack, deleting, delay }) {
  const totalTopics = skill.topics?.length || 0;
  const completedCount = Math.round((progress / 100) * totalTopics);

  return (
    <div
      className="bg-bg-card border border-neutral-800 rounded-lg p-6 
                 hover:border-neutral-600 transition-all duration-200 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        {/* Skill name */}
        <h2 className="text-lg font-semibold text-white">{skill.name}</h2>

        {skill.isCustom && (
          <button
            type="button"
            onClick={onDeleteTrack}
            disabled={deleting}
            className="rounded border border-red-900 px-2.5 py-1 text-xs text-red-400
                       hover:bg-red-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Remove track"
          >
            {deleting ? "Removing..." : "Remove"}
          </button>
        )}
      </div>

      {skill.isCustom && (
        <p className="text-[11px] uppercase tracking-wider text-accent-red mb-2">AI Track</p>
      )}

      {/* Topic count */}
      <p className="text-gray-500 text-sm mb-4">
        {completedCount} / {totalTopics} topics completed
      </p>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-red rounded-full progress-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onViewPath}
        className="w-full py-2 rounded text-sm font-medium border border-accent-red
                   text-accent-red hover:bg-accent-red hover:text-white
                   transition-all duration-200"
      >
        View Path →
      </button>
    </div>
  );
}

function getDifficultyMeta(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "advanced") {
    return {
      label: "Advanced",
      className: "border-rose-900/70 bg-rose-950/40 text-rose-300",
    };
  }

  if (normalized === "intermediate") {
    return {
      label: "Intermediate",
      className: "border-amber-900/70 bg-amber-950/40 text-amber-300",
    };
  }

  return {
    label: "Beginner",
    className: "border-emerald-900/70 bg-emerald-950/40 text-emerald-300",
  };
}

function DifficultyBadge({ difficulty }) {
  const meta = getDifficultyMeta(difficulty);

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

function TrackBuilderModal({
  trackPrompt,
  onTrackPromptChange,
  assessmentQuiz,
  quizAnswers,
  quizLoading,
  builderLoading,
  builderError,
  onStartAssessment,
  onQuizAnswerChange,
  onClose,
  onSubmit,
  show,
}) {
  // #6 — useRef: auto-focus the textarea when the modal first opens
  const promptRef = useRef(null);
  useEffect(() => {
    if (show) {
      // Small delay to let the modal animate in before focusing
      const t = setTimeout(() => promptRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [show]);

  const questions = Array.isArray(assessmentQuiz?.questions) ? assessmentQuiz.questions : [];
  const answeredCount = questions.filter((question) => Number.isInteger(quizAnswers[question.id])).length;
  const remainingCount = Math.max(questions.length - answeredCount, 0);
  const completionPercent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const isQuizComplete = questions.length > 0 && answeredCount === questions.length;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 px-4 py-8 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl rounded-lg border border-neutral-800 bg-bg-card p-6 animate-fade-in">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Create Personalized AI Roadmap</h2>
            <p className="mt-1 text-sm text-gray-500">
              Enter your topic, take an adaptive assessment, and get a roadmap tailored to your current knowledge.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-neutral-500 transition-colors"
            disabled={builderLoading || quizLoading}
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm text-gray-400" htmlFor="track-prompt">
              What topic do you want to study?
            </label>
            <textarea
              ref={promptRef}
              id="track-prompt"
              rows={3}
              value={trackPrompt}
              onChange={(e) => onTrackPromptChange(e.target.value)}
              placeholder="Example: Data structures and algorithms for product interviews"
              className="w-full resize-none rounded border border-neutral-700 bg-bg-elevated px-3 py-2.5 text-sm
                         text-white placeholder-gray-600 outline-none focus:border-accent-red"
            />
            <p className="mt-2 text-xs text-gray-500">
              Changing the topic resets the quiz so your assessment always matches the selected topic.
            </p>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-gradient-to-br from-bg-elevated via-bg-elevated to-red-950/20 px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-accent-red">Knowledge Assessment</p>
                <p className="mt-1 text-sm text-gray-300">
                  {questions.length > 0
                    ? `Answer all ${questions.length} questions. Difficulty ramps up as you move forward.`
                    : "Start an adaptive 8-12 question quiz to estimate your current level automatically."}
                </p>
              </div>

              <button
                type="button"
                onClick={onStartAssessment}
                disabled={builderLoading || quizLoading}
                className="rounded border border-accent-red px-3 py-2 text-xs font-medium text-accent-red
                           hover:bg-accent-red hover:text-white transition-colors disabled:opacity-50"
              >
                {quizLoading
                  ? "Generating Assessment..."
                  : questions.length > 0
                  ? "Regenerate Assessment"
                  : "Start Assessment"}
              </button>
            </div>

            {questions.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <p>
                    {answeredCount}/{questions.length} answered
                  </p>
                  <p>{remainingCount} left</p>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-red/70 via-accent-red to-orange-400 transition-all duration-300"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {questions.length > 0 && (
            <div className="max-h-[48vh] space-y-4 overflow-y-auto pr-1">
              {questions.map((question, index) => (
                <fieldset
                  key={question.id}
                  className="relative overflow-hidden rounded-lg border border-neutral-800 bg-bg-elevated/90 p-4"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-red/60 to-transparent" />

                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="rounded-full border border-neutral-700 bg-bg-card px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-gray-400">
                      Question {index + 1}
                    </span>
                    <DifficultyBadge difficulty={question.difficulty} />
                  </div>

                  <p className="text-sm font-medium leading-relaxed text-white">{question.question}</p>

                  <div className="mt-4 grid gap-2">
                    {question.options.map((option, optionIndex) => {
                      const selected = quizAnswers[question.id] === optionIndex;
                      const optionLetter = String.fromCharCode(65 + optionIndex);

                      return (
                        <label
                          key={`${question.id}-option-${optionIndex}`}
                          className={`group flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                            selected
                              ? "border-accent-red bg-red-950/30 text-white"
                              : "border-neutral-800 text-gray-300 hover:border-neutral-600 hover:bg-bg-card"
                          }`}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            checked={selected}
                            onChange={() => onQuizAnswerChange(question.id, optionIndex)}
                            className="sr-only"
                          />

                          <span
                            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors ${
                              selected
                                ? "border-accent-red bg-accent-red/20 text-accent-red"
                                : "border-neutral-600 text-gray-400 group-hover:border-neutral-500"
                            }`}
                          >
                            {optionLetter}
                          </span>

                          <span className="flex-1 leading-relaxed">{option}</span>

                          {selected && (
                            <span className="rounded border border-accent-red/70 bg-red-950/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent-red">
                              Selected
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}

          {builderError && (
            <p className="rounded border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-400">
              {builderError}
            </p>
          )}

          {!isQuizComplete && (
            <p className="text-xs text-gray-500">
              {questions.length > 0
                ? `Answer the remaining ${remainingCount} question${remainingCount === 1 ? "" : "s"} to unlock personalized track generation.`
                : "Start the assessment to unlock personalized track generation."}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-neutral-700 px-4 py-2.5 text-sm text-gray-300
                         hover:border-neutral-500 hover:text-white transition-colors"
              disabled={builderLoading || quizLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={builderLoading || quizLoading || !isQuizComplete}
              className="rounded border border-accent-red bg-accent-red px-4 py-2.5 text-sm font-medium text-white
                         hover:bg-accent-redHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {builderLoading ? "Generating..." : "Generate Personalized Track"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

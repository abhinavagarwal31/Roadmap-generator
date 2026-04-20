import cors from "cors";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const port = Number(process.env.API_PORT || 8787);
const openAiUrl = "https://api.openai.com/v1/chat/completions";

const LEVEL_PROFILES = {
  beginner: {
    minTopics: 8,
    maxTopics: 12,
    defaultTopics: 9,
    coverage:
      "Focus on complete foundational coverage, gentle progression, and beginner-friendly sequencing.",
  },
  intermediate: {
    minTopics: 11,
    maxTopics: 16,
    defaultTopics: 13,
    coverage:
      "Include full practical core topics and workflow depth expected from someone with basic prior exposure.",
  },
  advanced: {
    minTopics: 14,
    maxTopics: 22,
    defaultTopics: 17,
    coverage:
      "Include comprehensive advanced coverage, system design depth, and expert-level implementation concerns.",
  },
};

const BREADTH_HINTS = [
  "from scratch",
  "end to end",
  "full stack",
  "system design",
  "architecture",
  "production",
  "deployment",
  "distributed",
  "interview",
  "roadmap",
  "master",
  "comprehensive",
  "project",
  "backend",
  "frontend",
  "data engineering",
  "machine learning",
  "devops",
  "security",
];

const ASSESSMENT_MIN_QUESTIONS = 8;
const ASSESSMENT_MAX_QUESTIONS = 12;
const ASSESSMENT_DEFAULT_QUESTIONS = 8;

const TRUSTED_RESOURCE_HOSTS = [
  "developer.mozilla.org",
  "react.dev",
  "nodejs.org",
  "expressjs.com",
  "mongodb.com",
  "firebase.google.com",
  "cloud.google.com",
  "learn.microsoft.com",
  "docs.python.org",
  "typescriptlang.org",
  "javascript.info",
  "freecodecamp.org",
  "geeksforgeeks.org",
  "w3schools.com",
  "khanacademy.org",
  "coursera.org",
  "edx.org",
  "youtube.com",
  "github.com",
  "stackoverflow.com",
  "google.com",
];

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/ai/generate-assessment", async (req, res) => {
  try {
    const apiKey = (process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(500).json({
        error: "OpenAI API key is not configured on the server.",
      });
    }

    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const assessmentPlan = estimateAssessmentPlan(prompt);
    const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

    const runAssessmentGeneration = async ({ strictMode = false } = {}) => {
      const response = await globalThis.fetch(openAiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are an expert technical interviewer. Create concise diagnostic quizzes and return only valid JSON.",
            },
            {
              role: "user",
              content: buildAssessmentPrompt(prompt, assessmentPlan, strictMode),
            },
          ],
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: payload?.error?.message || "AI assessment generation failed.",
        };
      }

      const content = payload?.choices?.[0]?.message?.content;
      return {
        ok: true,
        quiz: normalizeAssessmentQuiz(parseJsonSafely(content), prompt, assessmentPlan),
      };
    };

    const firstAttempt = await runAssessmentGeneration();
    if (!firstAttempt.ok) {
      return res.status(firstAttempt.status).json({
        error: firstAttempt.error,
      });
    }

    let quiz = firstAttempt.quiz;

    if (!quiz) {
      const secondAttempt = await runAssessmentGeneration({ strictMode: true });
      if (!secondAttempt.ok) {
        return res.status(secondAttempt.status).json({
          error: secondAttempt.error,
        });
      }

      quiz = secondAttempt.quiz;
    }

    if (!quiz) {
      return res.status(502).json({
        error: "AI returned an invalid assessment quiz (too few questions).",
      });
    }

    return res.json({ quiz });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Unexpected server error while generating assessment quiz.",
    });
  }
});

app.post("/api/ai/generate-track", async (req, res) => {
  try {
    const apiKey = (process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(500).json({
        error: "OpenAI API key is not configured on the server.",
      });
    }

    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const assessment = normalizeAssessmentInput(req.body?.assessment);
    const { key: level, profile: levelProfile } = resolveLevelProfileFromAssessment(assessment);
    const roadmapPlan = estimateRoadmapPlan(prompt, levelProfile, assessment);
    const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

    const runTrackGeneration = async ({ strictMode = false } = {}) => {
      const response = await globalThis.fetch(openAiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.5,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are an expert curriculum designer. Return only valid JSON with no markdown or extra text.",
            },
            {
              role: "user",
              content: buildPrompt({
                prompt,
                level,
                levelProfile,
                roadmapPlan,
                assessment,
                strictMode,
              }),
            },
          ],
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: payload?.error?.message || "AI generation failed.",
        };
      }

      const content = payload?.choices?.[0]?.message?.content;
      return {
        ok: true,
        track: parseJsonSafely(content),
      };
    };

    const firstAttempt = await runTrackGeneration();
    if (!firstAttempt.ok) {
      return res.status(firstAttempt.status).json({ error: firstAttempt.error });
    }

    let track = firstAttempt.track;

    if (!hasMinimumTopicDepth(track, roadmapPlan.minRequiredTopics)) {
      const secondAttempt = await runTrackGeneration({ strictMode: true });

      if (!secondAttempt.ok) {
        return res.status(secondAttempt.status).json({
          error: secondAttempt.error,
        });
      }

      if (secondAttempt.track) {
        track = secondAttempt.track;
      }
    }

    if (!track) {
      return res.status(502).json({
        error: "AI returned invalid JSON for track generation.",
      });
    }

    if (!hasMinimumTopicDepth(track, roadmapPlan.minRequiredTopics)) {
      return res.status(502).json({
        error: `AI returned an incomplete roadmap (${countTrackTopics(track)} topics). Please try again with a slightly broader prompt.`,
      });
    }

    const enrichedTrack = enrichTrackResources(track);
    return res.json({ track: enrichedTrack });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Unexpected server error while generating track.",
    });
  }
});

app.post("/api/ai/profile-message", async (req, res) => {
  try {
    const apiKey = (process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(500).json({
        error: "OpenAI API key is not configured on the server.",
      });
    }

    const displayName = safeText(req.body?.displayName) || "Learner";
    const summary = {
      tracks: toSafeNumber(req.body?.stats?.tracks),
      totalTopics: toSafeNumber(req.body?.stats?.totalTopics),
      completedTopics: toSafeNumber(req.body?.stats?.completedTopics),
      completionRate: toSafeNumber(req.body?.stats?.completionRate),
    };

    const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

    const response = await globalThis.fetch(openAiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a supportive study mentor. Write concise, motivating feedback. Return only valid JSON.",
          },
          {
            role: "user",
            content: `Write one short personalized appreciation message for this learner.\n\nLearner: ${displayName}\nStats:\n- Tracks: ${summary.tracks}\n- Total topics: ${summary.totalTopics}\n- Completed topics: ${summary.completedTopics}\n- Completion rate: ${summary.completionRate}%\n\nRequirements:\n- 2-4 sentences\n- Positive and specific to the progress\n- Encourage the next step\n\nReturn this JSON shape exactly:\n{ "message": "string" }`,
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        error: payload?.error?.message || "AI message generation failed.",
      });
    }

    const content = payload?.choices?.[0]?.message?.content;
    const parsed = parseJsonSafely(content);
    const message = safeText(parsed?.message);

    if (!message) {
      return res.status(502).json({
        error: "AI returned invalid profile message.",
      });
    }

    return res.json({ message });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Unexpected server error while generating profile message.",
    });
  }
});

app.listen(port, () => {
  console.log(`AI API server running on http://localhost:${port}`);
});

function estimateAssessmentPlan(prompt) {
  const normalizedPrompt = safeText(prompt).toLowerCase();
  const wordCount = normalizedPrompt ? normalizedPrompt.split(/\s+/).filter(Boolean).length : 0;

  let complexityBoost = 0;
  if (wordCount >= 8) complexityBoost += 1;
  if (wordCount >= 16) complexityBoost += 1;
  if (wordCount >= 26) complexityBoost += 1;

  const breadthHits = BREADTH_HINTS.reduce(
    (count, hint) => count + (normalizedPrompt.includes(hint) ? 1 : 0),
    0
  );
  if (breadthHits >= 2) complexityBoost += 1;
  if (breadthHits >= 4) complexityBoost += 1;

  const targetQuestions = clamp(
    ASSESSMENT_DEFAULT_QUESTIONS + complexityBoost,
    ASSESSMENT_MIN_QUESTIONS,
    ASSESSMENT_MAX_QUESTIONS
  );

  const minRequiredQuestions = clamp(
    targetQuestions - 1,
    ASSESSMENT_MIN_QUESTIONS,
    ASSESSMENT_MAX_QUESTIONS
  );

  return {
    targetQuestions,
    minRequiredQuestions,
    maxQuestions: ASSESSMENT_MAX_QUESTIONS,
  };
}

function buildAssessmentPrompt(prompt, assessmentPlan, strictMode = false) {
  const plan = assessmentPlan || estimateAssessmentPlan(prompt);
  const strictInstructions = strictMode
    ? `\n- IMPORTANT: Your previous quiz was too short. Expand it now.\n- Do not return fewer than ${plan.minRequiredQuestions} questions.`
    : "";

  return `Create a diagnostic quiz for the learning topic: ${prompt}

Requirements:
- Return around ${plan.targetQuestions} multiple-choice questions
- Do not return fewer than ${plan.minRequiredQuestions} questions
- Do not return more than ${plan.maxQuestions} questions
- Questions should progress from basic to advanced
- Each question must have exactly 4 options
- Exactly one option must be correct
- Keep each question practical and concept-focused (avoid trivia)
- Add a difficulty value for each question: beginner, intermediate, or advanced${strictInstructions}

Return exactly this JSON shape:
{
  "topic": "string",
  "questions": [
    {
      "question": "string",
      "difficulty": "beginner|intermediate|advanced",
      "options": ["string", "string", "string", "string"],
      "correctOptionIndex": 0,
      "explanation": "string"
    }
  ]
}`;
}

function buildPrompt({ prompt, level, levelProfile, roadmapPlan, assessment, strictMode = false }) {
  const strictInstructions = strictMode
    ? `\n- IMPORTANT: Your first draft was too short. Expand the roadmap and include any missing modules.\n- Do not return fewer than ${roadmapPlan.minRequiredTopics} topics.`
    : "";

  const inferredLevelLabel = formatLevelLabel(level);
  const quizSummary = assessment
    ? `${assessment.correctAnswers}/${assessment.totalQuestions} correct (${assessment.percentage}%)`
    : "No assessment provided. Infer cautiously from topic complexity.";

  return `Create a practical learning track for: ${prompt}\n\nConstraints:\n- Learner readiness is inferred from quiz performance (not manually selected)\n- Inferred readiness: ${inferredLevelLabel}\n- Quiz summary: ${quizSummary}\n- Topic count is auto-selected by inferred readiness and topic breadth\n- Target coverage depth: ${levelProfile.coverage}\n- Roadmap target topic count: ${roadmapPlan.targetTopics}\n- Preferred topic range for this request: ${roadmapPlan.minRequestedTopics}-${roadmapPlan.maxRequestedTopics}\n- Absolute minimum topic count for this learner profile: ${roadmapPlan.minRequiredTopics}\n- Include all essential and relevant topics for this profile\n- Topics should flow from fundamentals to advanced concepts\n- Include concise, realistic topic descriptions\n- Include 3-5 high quality resources per topic\n- Prefer trustworthy sources such as official docs, respected tutorials, and well-known educational platforms\n- Use only real, valid HTTPS links${strictInstructions}\n\nQuality checks before returning JSON:\n- topics.length must be >= ${roadmapPlan.minRequiredTopics}\n- topics.length should usually be between ${roadmapPlan.minRequestedTopics} and ${roadmapPlan.maxRequestedTopics}\n- If the requested skill is broad, add extra modules instead of collapsing the roadmap\n\nReturn exactly this JSON shape:\n{\n  "skillName": "string",\n  "skillDescription": "string",\n  "topics": [\n    {\n      "title": "string",\n      "description": "string",\n      "resources": [\n        { "label": "string", "url": "https://..." }\n      ],\n      "prerequisiteIndexes": [0]\n    }\n  ]\n}\n\nRules for prerequisiteIndexes:\n- Use indexes that point to earlier topics only\n- First topic should usually have []\n- Keep dependencies simple and acyclic`;
}

function resolveLevelProfileFromAssessment(assessment) {
  const ratio = assessment ? assessment.correctAnswers / assessment.totalQuestions : 0;

  if (ratio >= 0.75) {
    return { key: "advanced", profile: LEVEL_PROFILES.advanced };
  }

  if (ratio >= 0.4) {
    return { key: "intermediate", profile: LEVEL_PROFILES.intermediate };
  }

  return { key: "beginner", profile: LEVEL_PROFILES.beginner };
}

function normalizeAssessmentInput(input) {
  const total = toSafeNumber(input?.totalQuestions);
  if (total <= 0) return null;

  const totalQuestions = clamp(total, 1, 20);
  const correctAnswers = clamp(toSafeNumber(input?.correctAnswers), 0, totalQuestions);
  const derivedPercentage = Math.round((correctAnswers / totalQuestions) * 100);
  const providedPercentage = Number(input?.percentage);

  const percentage = Number.isFinite(providedPercentage)
    ? clamp(Math.round(providedPercentage), 0, 100)
    : derivedPercentage;

  return {
    totalQuestions,
    correctAnswers,
    percentage,
  };
}

function normalizeAssessmentQuiz(rawQuiz, prompt, assessmentPlan) {
  const plan = assessmentPlan || estimateAssessmentPlan(prompt);
  const minRequiredQuestions = clamp(
    Number(plan?.minRequiredQuestions) || ASSESSMENT_MIN_QUESTIONS,
    4,
    ASSESSMENT_MAX_QUESTIONS
  );
  const maxQuestions = clamp(
    Number(plan?.maxQuestions) || ASSESSMENT_MAX_QUESTIONS,
    minRequiredQuestions,
    ASSESSMENT_MAX_QUESTIONS
  );

  const rawQuestions = Array.isArray(rawQuiz?.questions) ? rawQuiz.questions : [];

  const questions = rawQuestions
    .slice(0, maxQuestions)
    .map((question, index) => {
      const questionText = safeText(question?.question);
      if (!questionText) return null;

      const options = (Array.isArray(question?.options) ? question.options : [])
        .map((option) => safeText(option))
        .filter(Boolean)
        .slice(0, 4);

      if (options.length < 4) return null;

      const rawCorrectOptionIndex = Number(question?.correctOptionIndex);
      const correctOptionIndex = Number.isInteger(rawCorrectOptionIndex)
        ? clamp(rawCorrectOptionIndex, 0, options.length - 1)
        : 0;

      return {
        id: `assessment-${index + 1}`,
        question: questionText,
        difficulty: normalizeAssessmentDifficulty(question?.difficulty, index, rawQuestions.length),
        options,
        correctOptionIndex,
        explanation: safeText(question?.explanation),
      };
    })
    .filter(Boolean);

  if (questions.length < minRequiredQuestions) return null;

  return {
    topic: safeText(rawQuiz?.topic) || prompt,
    questions,
  };
}

function estimateRoadmapPlan(prompt, levelProfile, assessment) {
  const normalizedPrompt = safeText(prompt).toLowerCase();
  const wordCount = normalizedPrompt ? normalizedPrompt.split(/\s+/).filter(Boolean).length : 0;

  let complexityBoost = 0;
  if (wordCount >= 8) complexityBoost += 1;
  if (wordCount >= 16) complexityBoost += 1;
  if (wordCount >= 26) complexityBoost += 1;

  const breadthHits = BREADTH_HINTS.reduce(
    (count, hint) => count + (normalizedPrompt.includes(hint) ? 1 : 0),
    0
  );
  if (breadthHits >= 2) complexityBoost += 1;
  if (breadthHits >= 4) complexityBoost += 1;

  if (assessment) {
    if (assessment.percentage >= 85) complexityBoost += 2;
    else if (assessment.percentage >= 65) complexityBoost += 1;
    else if (assessment.percentage <= 20) complexityBoost -= 1;
  }

  const targetTopics = clamp(
    levelProfile.defaultTopics + complexityBoost,
    levelProfile.minTopics,
    levelProfile.maxTopics
  );

  const minRequestedTopics = clamp(
    targetTopics - 1,
    levelProfile.minTopics,
    levelProfile.maxTopics
  );

  const maxRequestedTopics = clamp(
    targetTopics + 2,
    levelProfile.minTopics,
    levelProfile.maxTopics
  );

  return {
    targetTopics,
    minRequestedTopics,
    maxRequestedTopics,
    minRequiredTopics: levelProfile.minTopics,
  };
}

function hasMinimumTopicDepth(track, minTopics) {
  return countTrackTopics(track) >= minTopics;
}

function countTrackTopics(track) {
  return Array.isArray(track?.topics) ? track.topics.length : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAssessmentDifficulty(value, index, totalQuestions) {
  const normalized = safeText(value).toLowerCase();
  if (["beginner", "intermediate", "advanced"].includes(normalized)) {
    return normalized;
  }

  const safeTotal = Math.max(1, Number(totalQuestions) || 1);
  const ratio = (index + 1) / safeTotal;

  if (ratio <= 0.35) return "beginner";
  if (ratio <= 0.75) return "intermediate";
  return "advanced";
}

function formatLevelLabel(value) {
  const text = safeText(value);
  if (!text) return "Beginner";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function parseJsonSafely(input) {
  if (!input) return null;

  try {
    return JSON.parse(input);
  } catch {
    const start = input.indexOf("{");
    const end = input.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;

    try {
      return JSON.parse(input.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function enrichTrackResources(track) {
  if (!track || !Array.isArray(track.topics)) return track;

  const topics = track.topics.map((topic) => {
    const title = safeText(topic?.title) || "Learning topic";

    const trustedResources = (Array.isArray(topic?.resources) ? topic.resources : [])
      .map((resource) => ({
        label: safeText(resource?.label),
        url: safeUrl(resource?.url),
      }))
      .filter((resource) => resource.label && resource.url)
      .filter((resource) => isTrustedResourceUrl(resource.url));

    const resources = dedupeResources([
      ...trustedResources,
      ...buildFallbackResources(title),
    ]).slice(0, 4);

    return {
      ...topic,
      resources,
    };
  });

  return {
    ...track,
    topics,
  };
}

function buildFallbackResources(topicTitle) {
  const query = encodeURIComponent(topicTitle);
  const tutorialQuery = encodeURIComponent(`${topicTitle} tutorial`);

  return [
    {
      label: `${topicTitle} official docs`,
      url: `https://www.google.com/search?q=${query}+official+documentation`,
    },
    {
      label: `${topicTitle} practical tutorial`,
      url: `https://www.google.com/search?q=${tutorialQuery}`,
    },
    {
      label: `${topicTitle} video guide`,
      url: `https://www.youtube.com/results?search_query=${tutorialQuery}`,
    },
  ];
}

function isTrustedResourceUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return TRUSTED_RESOURCE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeUrl(value) {
  const text = safeText(value);
  if (!text) return "";

  try {
    const parsed = new URL(text);
    return parsed.protocol === "https:" ? text : "";
  } catch {
    return "";
  }
}

function dedupeResources(resources) {
  const seen = new Set();

  return resources.filter((resource) => {
    const key = resource?.url?.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toSafeNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}


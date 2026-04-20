export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

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

export function getModelName() {
  return String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
}

export function getJsonBody(req) {
  if (!req || req.body == null) return {};
  if (typeof req.body === "object") return req.body;
  if (typeof req.body !== "string") return {};

  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

export function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function ensurePost(req, res) {
  applyCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return false;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: `Method ${req.method || "UNKNOWN"} not allowed.` });
    return false;
  }

  return true;
}

export async function callOpenAi({ apiKey, model, temperature, messages }) {
  const response = await globalThis.fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    error: payload?.error?.message || "OpenAI request failed.",
    content: payload?.choices?.[0]?.message?.content || "",
  };
}

export function buildAssessmentPrompt(prompt) {
  return `Create a short diagnostic quiz for the learning topic: ${prompt}

Requirements:
- Exactly 5 multiple-choice questions
- Questions should progress from basic to advanced
- Each question must have exactly 4 options
- Exactly one option must be correct
- Keep each question practical and concept-focused (avoid trivia)

Return exactly this JSON shape:
{
  "topic": "string",
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctOptionIndex": 0,
      "explanation": "string"
    }
  ]
}`;
}

export function buildTrackPrompt({ prompt, level, levelProfile, roadmapPlan, assessment, strictMode = false }) {
  const strictInstructions = strictMode
    ? `\n- IMPORTANT: Your first draft was too short. Expand the roadmap and include any missing modules.\n- Do not return fewer than ${roadmapPlan.minRequiredTopics} topics.`
    : "";

  const inferredLevelLabel = formatLevelLabel(level);
  const quizSummary = assessment
    ? `${assessment.correctAnswers}/${assessment.totalQuestions} correct (${assessment.percentage}%)`
    : "No assessment provided. Infer cautiously from topic complexity.";

  return `Create a practical learning track for: ${prompt}\n\nConstraints:\n- Learner readiness is inferred from quiz performance (not manually selected)\n- Inferred readiness: ${inferredLevelLabel}\n- Quiz summary: ${quizSummary}\n- Topic count is auto-selected by inferred readiness and topic breadth\n- Target coverage depth: ${levelProfile.coverage}\n- Roadmap target topic count: ${roadmapPlan.targetTopics}\n- Preferred topic range for this request: ${roadmapPlan.minRequestedTopics}-${roadmapPlan.maxRequestedTopics}\n- Absolute minimum topic count for this learner profile: ${roadmapPlan.minRequiredTopics}\n- Include all essential and relevant topics for this profile\n- Topics should flow from fundamentals to advanced concepts\n- Include concise, realistic topic descriptions\n- Include 3-5 high quality resources per topic\n- Prefer trustworthy sources such as official docs, respected tutorials, and well-known educational platforms\n- Use only real, valid HTTPS links${strictInstructions}\n\nQuality checks before returning JSON:\n- topics.length must be >= ${roadmapPlan.minRequiredTopics}\n- topics.length should usually be between ${roadmapPlan.minRequestedTopics} and ${roadmapPlan.maxRequestedTopics}\n- If the requested skill is broad, add extra modules instead of collapsing the roadmap\n\nReturn exactly this JSON shape:\n{\n  "skillName": "string",\n  "skillDescription": "string",\n  "topics": [\n    {\n      "title": "string",\n      "description": "string",\n      "resources": [\n        { "label": "string", "url": "https://..." }\n      ],\n      "prerequisiteIndexes": [0]\n    }\n  ]\n}\n\nRules for prerequisiteIndexes:\n- Use indexes that point to earlier topics only\n- First topic should usually have []\n- Keep dependencies simple and acyclic`;
}

export function normalizeAssessmentQuiz(rawQuiz, prompt) {
  const rawQuestions = Array.isArray(rawQuiz?.questions) ? rawQuiz.questions : [];

  const questions = rawQuestions
    .slice(0, 5)
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
        options,
        correctOptionIndex,
        explanation: safeText(question?.explanation),
      };
    })
    .filter(Boolean);

  if (questions.length < 5) return null;

  return {
    topic: safeText(rawQuiz?.topic) || prompt,
    questions,
  };
}

export function normalizeAssessmentInput(input) {
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

export function resolveLevelProfileFromAssessment(assessment) {
  const ratio = assessment ? assessment.correctAnswers / assessment.totalQuestions : 0;

  if (ratio >= 0.75) {
    return { key: "advanced", profile: LEVEL_PROFILES.advanced };
  }

  if (ratio >= 0.4) {
    return { key: "intermediate", profile: LEVEL_PROFILES.intermediate };
  }

  return { key: "beginner", profile: LEVEL_PROFILES.beginner };
}

export function estimateRoadmapPlan(prompt, levelProfile, assessment) {
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

export function hasMinimumTopicDepth(track, minTopics) {
  return countTrackTopics(track) >= minTopics;
}

export function countTrackTopics(track) {
  return Array.isArray(track?.topics) ? track.topics.length : 0;
}

export function enrichTrackResources(track) {
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

    const resources = dedupeResources([...trustedResources, ...buildFallbackResources(title)]).slice(0, 4);

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

export function parseJsonSafely(input) {
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

export function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function toSafeNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
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

function dedupeResources(resources) {
  const seen = new Set();

  return resources.filter((resource) => {
    const key = resource?.url?.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatLevelLabel(value) {
  const text = safeText(value);
  if (!text) return "Beginner";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

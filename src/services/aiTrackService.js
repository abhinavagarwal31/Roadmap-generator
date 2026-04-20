// Generate custom tracks via backend API.
// The backend reads OPENAI_API_KEY from server env.

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim();

export async function generateAssessmentQuiz({ prompt }) {
  const cleanedPrompt = (prompt || "").trim();
  if (!cleanedPrompt) {
    throw new Error("Please enter a topic before starting the assessment.");
  }

  const response = await fetch(`${API_BASE_URL}/api/ai/generate-assessment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: cleanedPrompt,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const apiError = payload?.error || "Assessment quiz request failed. Please try again.";
    throw new Error(apiError);
  }

  const rawQuiz = payload?.quiz;
  if (!rawQuiz) {
    throw new Error("AI response did not contain assessment quiz content.");
  }

  return normalizeAssessmentQuiz(rawQuiz, cleanedPrompt);
}

export async function generateTrackWithAi({ prompt, assessment }) {

  const cleanedPrompt = (prompt || "").trim();
  if (!cleanedPrompt) {
    throw new Error("Please describe the track you want to generate.");
  }

  const normalizedAssessment = normalizeAssessmentPayload(assessment);

  const response = await fetch(`${API_BASE_URL}/api/ai/generate-track`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: cleanedPrompt,
      assessment: normalizedAssessment,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const apiError = payload?.error || "AI request failed. Please try again.";
    throw new Error(apiError);
  }

  const rawTrack = payload?.track;
  if (!rawTrack) {
    throw new Error("AI response did not contain track content.");
  }

  return normalizeTrack(rawTrack, cleanedPrompt);
}

function normalizeAssessmentQuiz(rawQuiz, prompt) {
  const rawQuestions = Array.isArray(rawQuiz?.questions) ? rawQuiz.questions : [];

  const questions = rawQuestions
    .slice(0, 5)
    .map((question, index) => {
      const questionText = safeText(question?.question);
      const options = (Array.isArray(question?.options) ? question.options : [])
        .map((option) => safeText(option))
        .filter(Boolean)
        .slice(0, 4);

      if (!questionText || options.length < 4) return null;

      const rawCorrectOptionIndex = Number(question?.correctOptionIndex);
      const correctOptionIndex = Number.isInteger(rawCorrectOptionIndex)
        ? clamp(rawCorrectOptionIndex, 0, options.length - 1)
        : 0;

      const questionSlug = slugify(questionText) || `question-${index + 1}`;

      return {
        id: `assessment-${index + 1}-${questionSlug.slice(0, 24)}`,
        question: questionText,
        options,
        correctOptionIndex,
      };
    })
    .filter(Boolean);

  if (questions.length < 4) {
    throw new Error("Assessment quiz was incomplete. Please try again.");
  }

  return {
    topic: safeText(rawQuiz?.topic) || prompt,
    questions,
  };
}

function normalizeAssessmentPayload(assessment) {
  if (!assessment || typeof assessment !== "object") return null;

  const totalQuestions = clamp(toPositiveInteger(assessment?.totalQuestions), 1, 20);
  const correctAnswers = clamp(toNonNegativeInteger(assessment?.correctAnswers), 0, totalQuestions);
  const derivedPercentage = Math.round((correctAnswers / totalQuestions) * 100);
  const providedPercentage = Number(assessment?.percentage);
  const percentage = Number.isFinite(providedPercentage)
    ? clamp(Math.round(providedPercentage), 0, 100)
    : derivedPercentage;

  return {
    totalQuestions,
    correctAnswers,
    percentage,
  };
}

function normalizeTrack(rawTrack, prompt) {
  const skillName = safeText(rawTrack?.skillName) || `${toTitleCase(prompt)} Track`;
  const skillDescription = safeText(rawTrack?.skillDescription) || `AI-generated learning path for ${prompt}.`;

  const rawTopics = Array.isArray(rawTrack?.topics) ? rawTrack.topics : [];
  if (rawTopics.length === 0) {
    throw new Error("AI returned an empty track. Please try a different prompt.");
  }

  const timestamp = Date.now();
  const skillSlug = slugify(skillName);
  const skillId = `custom-skill-${skillSlug}-${timestamp}`;

  const topicIds = rawTopics.map((topic, index) => {
    const topicSlug = slugify(safeText(topic?.title) || `topic-${index + 1}`);
    return `custom-topic-${skillSlug}-${timestamp}-${topicSlug}-${index + 1}`;
  });

  const topics = rawTopics.map((topic, index) => {
    const title = safeText(topic?.title) || `Topic ${index + 1}`;
    const description = safeText(topic?.description) || `${title} concepts and practical exercises.`;
    const resources = normalizeResources(topic?.resources, title);

    const rawPrereq = Array.isArray(topic?.prerequisiteIndexes)
      ? topic.prerequisiteIndexes
      : index === 0
      ? []
      : [index - 1];

    const prerequisites = rawPrereq
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value < index)
      .map((value) => topicIds[value]);

    return {
      id: topicIds[index],
      title,
      description,
      resources,
      prerequisites,
      position: {
        x: 120 + index * 260,
        y: 180 + (index % 2) * 140,
      },
      skillId,
      isCustom: true,
    };
  });

  return {
    skill: {
      id: skillId,
      name: skillName,
      description: skillDescription,
      topics: topicIds,
      isCustom: true,
    },
    topics,
  };
}

function normalizeResources(rawResources, topicTitle) {
  const normalized = (Array.isArray(rawResources) ? rawResources : [])
    .map((resource) => ({
      label: safeText(resource?.label),
      url: safeUrl(resource?.url),
    }))
    .filter((resource) => resource.label && resource.url);

  const merged = dedupeResources([
    ...normalized,
    ...buildFallbackResources(topicTitle),
  ]);

  return merged.slice(0, 4);
}

function buildFallbackResources(topicTitle) {
  const query = encodeURIComponent(topicTitle);
  const tutorialQuery = encodeURIComponent(`${topicTitle} tutorial`);

  return [
    {
      label: `${topicTitle} official documentation`,
      url: `https://www.google.com/search?q=${query}+official+documentation`,
    },
    {
      label: `${topicTitle} practical tutorial`,
      url: `https://www.google.com/search?q=${tutorialQuery}`,
    },
    {
      label: `${topicTitle} video walkthrough`,
      url: `https://www.youtube.com/results?search_query=${tutorialQuery}`,
    },
  ];
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

function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeUrl(value) {
  const text = safeText(value);
  if (!text) return "";

  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? text : "";
  } catch {
    return "";
  }
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function toTitleCase(input) {
  return String(input || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toPositiveInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 5;
  return Math.round(numeric);
}

function toNonNegativeInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric);
}

import {
  buildAssessmentPrompt,
  callOpenAi,
  ensurePost,
  getJsonBody,
  getModelName,
  normalizeAssessmentQuiz,
  parseJsonSafely,
  safeText,
} from "../_lib/aiCore.js";

export default async function handler(req, res) {
  if (!ensurePost(req, res)) return;

  try {
    const apiKey = (process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(500).json({
        error: "OpenAI API key is not configured on the server.",
      });
    }

    const body = getJsonBody(req);
    const prompt = safeText(body?.prompt);
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const result = await callOpenAi({
      apiKey,
      model: getModelName(),
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are an expert technical interviewer. Create concise diagnostic quizzes and return only valid JSON.",
        },
        {
          role: "user",
          content: buildAssessmentPrompt(prompt),
        },
      ],
    });

    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error || "AI assessment generation failed.",
      });
    }

    const parsed = parseJsonSafely(result.content);
    const quiz = normalizeAssessmentQuiz(parsed, prompt);

    if (!quiz) {
      return res.status(502).json({
        error: "AI returned an invalid assessment quiz.",
      });
    }

    return res.status(200).json({ quiz });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Unexpected server error while generating assessment quiz.",
    });
  }
}

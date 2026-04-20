import {
  buildAssessmentPrompt,
  callOpenAi,
  estimateAssessmentPlan,
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

    const assessmentPlan = estimateAssessmentPlan(prompt);

    const runAssessmentGeneration = async ({ strictMode = false } = {}) => {
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
            content: buildAssessmentPrompt(prompt, assessmentPlan, strictMode),
          },
        ],
      });

      if (!result.ok) {
        return {
          ok: false,
          status: result.status,
          error: result.error || "AI assessment generation failed.",
        };
      }

      const parsed = parseJsonSafely(result.content);
      return {
        ok: true,
        quiz: normalizeAssessmentQuiz(parsed, prompt, assessmentPlan),
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
        error: `AI returned an invalid assessment quiz (too few questions). Please try again.`,
      });
    }

    return res.status(200).json({ quiz });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Unexpected server error while generating assessment quiz.",
    });
  }
}

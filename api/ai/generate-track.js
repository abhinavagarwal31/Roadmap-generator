import {
  buildTrackPrompt,
  callOpenAi,
  countTrackTopics,
  ensurePost,
  enrichTrackResources,
  estimateRoadmapPlan,
  getJsonBody,
  getModelName,
  hasMinimumTopicDepth,
  normalizeAssessmentInput,
  parseJsonSafely,
  resolveLevelProfileFromAssessment,
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

    const assessment = normalizeAssessmentInput(body?.assessment);
    const { key: level, profile: levelProfile } = resolveLevelProfileFromAssessment(assessment);
    const roadmapPlan = estimateRoadmapPlan(prompt, levelProfile, assessment);
    const model = getModelName();

    const runTrackGeneration = async ({ strictMode = false } = {}) => {
      const result = await callOpenAi({
        apiKey,
        model,
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content:
              "You are an expert curriculum designer. Return only valid JSON with no markdown or extra text.",
          },
          {
            role: "user",
            content: buildTrackPrompt({
              prompt,
              level,
              levelProfile,
              roadmapPlan,
              assessment,
              strictMode,
            }),
          },
        ],
      });

      if (!result.ok) {
        return {
          ok: false,
          status: result.status,
          error: result.error || "AI generation failed.",
        };
      }

      return {
        ok: true,
        track: parseJsonSafely(result.content),
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
    return res.status(200).json({ track: enrichedTrack });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Unexpected server error while generating track.",
    });
  }
}

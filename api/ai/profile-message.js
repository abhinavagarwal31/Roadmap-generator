import {
  callOpenAi,
  ensurePost,
  getJsonBody,
  getModelName,
  parseJsonSafely,
  safeText,
  toSafeNumber,
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
    const displayName = safeText(body?.displayName) || "Learner";

    const summary = {
      tracks: toSafeNumber(body?.stats?.tracks),
      totalTopics: toSafeNumber(body?.stats?.totalTopics),
      completedTopics: toSafeNumber(body?.stats?.completedTopics),
      completionRate: toSafeNumber(body?.stats?.completionRate),
    };

    const result = await callOpenAi({
      apiKey,
      model: getModelName(),
      temperature: 0.7,
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
    });

    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error || "AI message generation failed.",
      });
    }

    const parsed = parseJsonSafely(result.content);
    const message = safeText(parsed?.message);

    if (!message) {
      return res.status(502).json({
        error: "AI returned invalid profile message.",
      });
    }

    return res.status(200).json({ message });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Unexpected server error while generating profile message.",
    });
  }
}

import { applyCors } from "./_lib/aiCore.js";

export default function handler(req, res) {
  applyCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  res.status(200).json({ ok: true });
}

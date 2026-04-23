export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const text = await response.text();
    res.setHeader("Content-Type", "application/json");
    res.status(response.status).send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

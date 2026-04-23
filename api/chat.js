export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const key = process.env.ANTHROPIC_API_KEY;
  console.log("KEY_SET:", !!key, "KEY_PREFIX:", key?.substring(0, 18));
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(req.body),
  });
  console.log("ANTHROPIC_STATUS:", response.status);
  const data = await response.json();
  console.log("ANTHROPIC_BODY:", JSON.stringify(data).substring(0, 300));
  res.json(data);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const key = process.env.ANTHROPIC_API_KEY;
  console.log("Nokkel starter med:", key?.substring(0, 15));
  console.log("Nokkel lengde:", key?.length);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(req.body),
  });

  const data = await response.json();
  console.log("Anthropic svar:", JSON.stringify(data).substring(0, 500));
  res.json(data);
}

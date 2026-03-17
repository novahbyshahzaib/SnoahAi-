// SnoahAI — Cohere API Proxy
// Deployed as a Vercel serverless function at /api/cohere
// Forwards requests to Cohere's OpenAI-compatible endpoint.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'Missing API key. Add your Cohere key in SnoahAI Settings.' });

  const apiUrl = 'https://api.cohere.com/compatibility/v1/chat/completions';

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    });

    if (req.body?.stream) {
      res.writeHead(response.status, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally { res.end(); }
    } else {
      const data = await response.json();
      return res.status(response.status).json(data);
    }
  } catch (error) {
    console.error('Cohere proxy error:', error);
    return res.status(500).json({ error: 'Proxy error: ' + error.message });
  }
}

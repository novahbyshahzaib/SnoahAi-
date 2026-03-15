// SnoahAI — Notion API Proxy
// Deployed as a Vercel serverless function at /api/notion
// Forwards requests to Notion API using the user's token from the request header.

export default async function handler(req, res) {
  // Allow requests from any origin (needed for browser fetch)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-notion-key');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get the Notion token from the request header (sent by SnoahAI)
  const notionToken = req.headers['x-notion-key'];
  if (!notionToken) {
    return res.status(401).json({ error: 'Missing Notion token. Add your token in SnoahAI Settings.' });
  }

  // Get the API path from the query string e.g. ?path=pages or ?path=blocks/ID/children
  const apiPath = req.query.path;
  if (!apiPath) {
    return res.status(400).json({ error: 'Missing path query parameter.' });
  }

  const notionUrl = `https://api.notion.com/v1/${apiPath}`;

  try {
    const response = await fetch(notionUrl, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: ['POST', 'PATCH', 'PUT'].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();

    // Forward the exact status code from Notion
    return res.status(response.status).json(data);

  } catch (error) {
    console.error('Notion proxy error:', error);
    return res.status(500).json({ error: 'Proxy error: ' + error.message });
  }
}

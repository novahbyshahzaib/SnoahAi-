// SnoahAI — Slack API Proxy
// Deployed as a Vercel serverless function at /api/slack
// Handles Slack OAuth and API requests

export default async function handler(req, res) {
  // Allow requests from any origin (needed for browser fetch)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-slack-key, x-slack-token');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get the Slack token from the request header
  const slackToken = req.headers['x-slack-key'] || req.headers['x-slack-token'];
  if (!slackToken) {
    return res.status(401).json({ error: 'Missing Slack token. Add your token in SnoahAI Settings.' });
  }

  // Get the API path from the query string
  const apiPath = req.query.path;
  if (!apiPath) {
    return res.status(400).json({ error: 'Missing path query parameter.' });
  }

  const slackUrl = `https://slack.com/api/${apiPath}`;

  try {
    const response = await fetch(slackUrl, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${slackToken}`,
        'Content-Type': 'application/json',
      },
      body: ['POST', 'PATCH', 'PUT'].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();

    // Check for Slack API errors
    if (!data.ok) {
      return res.status(400).json({ error: data.error || 'Slack API error' });
    }

    // Forward the exact status code from Slack
    return res.status(response.status).json(data);

  } catch (error) {
    console.error('Slack proxy error:', error);
    return res.status(500).json({ error: 'Proxy error: ' + error.message });
  }
}
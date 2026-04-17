// SnoahAI — Plugin utility endpoint
// Deployed as a Vercel serverless function at /api/plugin
// Provides CORS-safe health + payload echo for plugin diagnostics.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'plugin', cors: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const mode = String(body.mode || 'execute');
    const prompt = typeof body.prompt === 'string' ? body.prompt : '';
    return res.status(200).json({
      ok: true,
      mode,
      promptLength: prompt.length,
      timestamp: Date.now()
    });
  } catch (error) {
    return res.status(500).json({ error: 'Plugin endpoint error: ' + error.message });
  }
}

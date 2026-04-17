// SnoahAI — Plugin utility endpoint
// Deployed as a Vercel serverless function at /api/plugin
// Provides CORS-safe health + payload echo for plugin diagnostics.

export default async function handler(req, res) {
  const reqOrigin = req.headers.origin || '';
  const allowedOrigins = (process.env.SNOAH_ALLOWED_ORIGINS || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  const defaultOrigins = ['https://snoah.ai', 'https://www.snoah.ai'];
  const isVercelPreview = /\.vercel\.app$/i.test(reqOrigin);
  const isAllowed = (allowedOrigins.length ? allowedOrigins : defaultOrigins).includes(reqOrigin) || isVercelPreview;
  const corsOrigin = isAllowed ? reqOrigin : defaultOrigins[0];

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Vary', 'Origin');
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

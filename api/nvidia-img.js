// SnoahAI — NVIDIA NIM Image Generation Proxy
// Deployed as a Vercel serverless function at /api/nvidia-img
// Proxies image generation requests to NVIDIA NIM to avoid CORS issues.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'Missing API key. Add your NVIDIA key in SnoahAI Settings → Image Generation.' });

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('NVIDIA image proxy error:', error);
    return res.status(500).json({ error: 'Proxy error: failed to reach NVIDIA NIM API.' });
  }
}

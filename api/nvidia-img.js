// SnoahAI — NVIDIA NIM Image Generation Proxy
// Deployed as a Vercel serverless function at /api/nvidia-img
// Proxies image generation requests to NVIDIA NIM to avoid CORS issues.
// Uses NVIDIA's native genai endpoint (https://ai.api.nvidia.com/v1/genai/{model})
// which accepts: prompt, cfg_scale, aspect_ratio, seed, steps, negative_prompt

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'Missing API key. Add your NVIDIA key in SnoahAI Settings → Image Generation.' });

  try {
    const body = req.body || {};

    // Map OpenAI-style model names to NVIDIA native genai model paths
    let modelPath = (body.model || 'black-forest-labs/flux-schnell')
      .replace(/flux\.1-schnell/i, 'flux-schnell')
      .replace(/flux\.1-dev/i,     'flux-dev')
      .replace(/flux-1-schnell/i,  'flux-schnell')
      .replace(/flux-1-dev/i,      'flux-dev');

    // Build NVIDIA native request (only supported fields)
    const nativeBody = {
      prompt:          body.prompt          || '',
      cfg_scale:       body.cfg_scale       != null ? body.cfg_scale       : 5,
      aspect_ratio:    body.aspect_ratio    || '1/1',
      seed:            body.seed            != null ? body.seed            : 0,
      steps:           body.steps           != null ? body.steps           : 4,
      negative_prompt: body.negative_prompt || '',
    };

    const nvidiaUrl = `https://ai.api.nvidia.com/v1/genai/${modelPath}`;

    const response = await fetch(nvidiaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':        'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(nativeBody),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('NVIDIA image proxy error:', error);
    return res.status(500).json({ error: 'Proxy error: ' + error.message });
  }
}

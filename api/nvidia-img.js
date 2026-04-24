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
    const model = body.model || 'black-forest-labs/flux-schnell';
    const prompt = body.prompt || '';
    const sizeMap = { '1/1': '1024x1024', '16/9': '1344x768', '9/16': '768x1344', '4/3': '1152x896', '3/4': '896x1152' };
    const openAiBody = {
      model,
      prompt,
      n: 1,
      size: sizeMap[body.aspect_ratio] || '1024x1024',
      seed: body.seed != null ? body.seed : 0,
    };

    const openAiRes = await fetch('https://integrate.api.nvidia.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(openAiBody),
    });
    if (openAiRes.ok) {
      const data = await openAiRes.json();
      return res.status(openAiRes.status).json(data);
    }

    // Fallback: NVIDIA native genai endpoint for models that are not exposed via OpenAI-compatible path
    const nativeModelPath = String(model)
      .replace(/flux\.1-schnell/ig, 'flux-schnell')
      .replace(/flux\.1-dev/ig, 'flux-dev')
      .replace(/flux-1-schnell/ig, 'flux-schnell')
      .replace(/flux-1-dev/ig, 'flux-dev');
    const nativeRes = await fetch(`https://ai.api.nvidia.com/v1/genai/${nativeModelPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        prompt,
        cfg_scale: body.cfg_scale != null ? body.cfg_scale : 5,
        aspect_ratio: body.aspect_ratio || '1/1',
        seed: body.seed != null ? body.seed : 0,
        steps: body.steps != null ? body.steps : 4,
        negative_prompt: body.negative_prompt || '',
      }),
    });
    const fallbackData = await nativeRes.json().catch(() => ({}));
    if (!nativeRes.ok) {
      const upstreamError = (fallbackData && (fallbackData.error || fallbackData.message)) || (await openAiRes.text().catch(() => 'NVIDIA upstream error'));
      return res.status(nativeRes.status || openAiRes.status || 500).json({ error: upstreamError });
    }
    return res.status(nativeRes.status).json(fallbackData);
  } catch (error) {
    console.error('NVIDIA image proxy error:', error);
    return res.status(500).json({ error: 'Proxy error: ' + error.message });
  }
}

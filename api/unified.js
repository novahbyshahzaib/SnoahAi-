// SnoahAI — Unified AI Proxy
// Consolidates multiple OpenAI-compatible API providers into a single endpoint
// Providers: NVIDIA, xAI, HuggingFace, DeepInfra, Cohere, NanoGPT
// Image Generation: NVIDIA NIM via ?provider=nvidia&type=image
// Usage: /api/unified?provider=nvidia|xai|huggingface|deepinfra|cohere|nanogpt[&type=image]

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const provider = req.query.provider;
  const type = req.query.type;
  const apiKey = req.headers['x-api-key'];

  if (!provider) {
    return res.status(400).json({ error: 'Missing provider parameter. Use ?provider=nvidia|xai|huggingface|deepinfra|cohere|nanogpt[&type=image]' });
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key. Add your API key in SnoahAI Settings.' });
  }

  const chatConfigs = {
    nvidia: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', name: 'NVIDIA' },
    xai: { url: 'https://api.x.ai/v1/chat/completions', name: 'xAI' },
    huggingface: { url: 'https://router.huggingface.co/v1/chat/completions', name: 'HuggingFace' },
    deepinfra: { url: 'https://api.deepinfra.com/v1/openai/chat/completions', name: 'DeepInfra' },
    cohere: { url: 'https://api.cohere.com/compatibility/v1/chat/completions', name: 'Cohere' },
    nanogpt: { url: 'https://nano-gpt.com/api/v1/chat/completions', name: 'NanoGPT' }
  };

  const imageConfigs = {
    nvidia: { url: 'https://integrate.api.nvidia.com/v1/images/generations', name: 'NVIDIA' }
  };

  if (type === 'image') {
    const config = imageConfigs[provider];
    if (!config) {
      return res.status(400).json({ error: `Image generation not supported for ${provider}. Only nvidia supports image generation.` });
    }
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
      const response = await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify(openAiBody),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (error) {
      console.error(`${config.name} image proxy error:`, error);
      return res.status(500).json({ error: `Image proxy error: ${error.message}` });
    }
  }

  const config = chatConfigs[provider];
  if (!config) {
    return res.status(400).json({ error: `Unknown provider: ${provider}. Valid providers: ${Object.keys(chatConfigs).join(', ')}` });
  }

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(req.body),
    });

    if (req.body?.stream) {
      res.writeHead(response.status, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' });
      const reader = response.body.getReader();
      try { while (true) { const { done, value } = await reader.read(); if (done) break; res.write(value); } } finally { res.end(); }
    } else {
      const data = await response.json();
      return res.status(response.status).json(data);
    }
  } catch (error) {
    console.error(`${config.name} proxy error:`, error);
    return res.status(500).json({ error: `Proxy error: ${error.message}` });
  }
}
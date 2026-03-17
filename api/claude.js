// SnoahAI — Claude (Anthropic) API Proxy
// Deployed as a Vercel serverless function at /api/claude
// Transforms OpenAI-format requests to Anthropic Messages API format,
// and converts Anthropic SSE streaming back to OpenAI-compatible SSE.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'Missing API key. Add your Anthropic (Claude) key in SnoahAI Settings.' });

  const { model = 'claude-3-5-haiku-20241022', messages = [], stream = false, temperature, top_p, max_tokens = 4096 } = req.body || {};

  // Separate system message from conversation messages
  let systemPrompt = '';
  const conversationMessages = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt = typeof msg.content === 'string' ? msg.content : (msg.content?.[0]?.text || '');
    } else if (msg.role === 'user' || msg.role === 'assistant') {
      // Anthropic only accepts string content or content blocks
      let content = msg.content;
      if (Array.isArray(content)) {
        // Convert OpenAI vision format to Anthropic content blocks
        content = content.map(part => {
          if (part.type === 'text') return { type: 'text', text: part.text };
          if (part.type === 'image_url') {
            const url = part.image_url?.url || '';
            if (url.startsWith('data:')) {
              const [meta, data] = url.split(',');
              const mediaType = meta.replace('data:', '').replace(';base64', '');
              return { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
            }
            return { type: 'image', source: { type: 'url', url } };
          }
          return { type: 'text', text: String(part) };
        });
      }
      conversationMessages.push({ role: msg.role, content });
    }
  }

  // Anthropic requires alternating user/assistant roles; merge consecutive same-role messages
  const mergedMessages = [];
  for (const msg of conversationMessages) {
    if (mergedMessages.length > 0 && mergedMessages[mergedMessages.length - 1].role === msg.role) {
      const prev = mergedMessages[mergedMessages.length - 1];
      if (typeof prev.content === 'string' && typeof msg.content === 'string') {
        // Both string — concatenate
        prev.content += '\n\n' + msg.content;
      } else {
        // Mixed or array content — normalise both to arrays and concatenate
        const prevBlocks = typeof prev.content === 'string'
          ? [{ type: 'text', text: prev.content }]
          : prev.content;
        const newBlocks = typeof msg.content === 'string'
          ? [{ type: 'text', text: msg.content }]
          : msg.content;
        prev.content = [...prevBlocks, ...newBlocks];
      }
    } else {
      mergedMessages.push({ ...msg });
    }
  }

  const anthropicBody = {
    model,
    messages: mergedMessages,
    // Cap at 8192 — Anthropic's max_tokens limit for most models
    max_tokens: Math.min(max_tokens || 4096, 8192),
    stream,
  };
  if (systemPrompt) anthropicBody.system = systemPrompt;
  if (temperature !== undefined) anthropicBody.temperature = temperature;
  if (top_p !== undefined) anthropicBody.top_p = top_p;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });

    if (!stream) {
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
      // Convert to OpenAI format
      return res.status(200).json({
        choices: [{ message: { role: 'assistant', content: data.content?.[0]?.text || '' }, finish_reason: data.stop_reason }],
        usage: { prompt_tokens: data.usage?.input_tokens || 0, completion_tokens: data.usage?.output_tokens || 0 },
      });
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return res.status(response.status).json(errData);
    }

    // Stream: convert Anthropic SSE → OpenAI-compatible SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              const evt = JSON.parse(raw);
              if (evt.type === 'message_start' && evt.message?.usage) {
                inputTokens = evt.message.usage.input_tokens || 0;
              } else if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                // Emit as OpenAI-compatible delta
                const chunk = { choices: [{ delta: { content: evt.delta.text }, finish_reason: null }] };
                res.write('data: ' + JSON.stringify(chunk) + '\n\n');
              } else if (evt.type === 'message_delta' && evt.usage) {
                outputTokens = evt.usage.output_tokens || 0;
              } else if (evt.type === 'message_stop') {
                // Emit usage chunk then DONE
                const usageChunk = { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens } };
                res.write('data: ' + JSON.stringify(usageChunk) + '\n\n');
                res.write('data: [DONE]\n\n');
              }
            } catch (_) {}
          }
        }
      }
    } finally {
      res.end();
    }
  } catch (error) {
    console.error('Claude proxy error:', error);
    return res.status(500).json({ error: 'Proxy error: ' + error.message });
  }
}

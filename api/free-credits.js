// SnoahAI — Selective Free Credits proxy
// POST /api/free-credits  { platform, model, messages, temperature?, top_p?, max_tokens?, stream? }
// Lets visitors chat with a small curated set of FREE models on four platforms —
// OpenRouter, Groq, Gemini, Mistral AI — using the OWNER's keys. Users never
// supply a key and never see one: the keys live only in Vercel server env vars
// (OPENROUTER_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY) and are
// read from process.env here, on the server, only.
//
// Security rules (do not weaken them):
// - NEVER read a key from the request body, query, or headers. Any x-api-key
//   header sent by a client is ignored entirely.
// - NEVER return a key, a fragment of a key, or any hint about which key is
//   missing. A platform whose key is not configured answers with the same
//   generic "not set up yet" message.
// - NEVER log keys. Logs carry platform/model/status only.
// - Platform and model are validated against the allow-lists below. Anything
//   else is rejected. The client dropdown is UI only; this list is the law.
// - All four providers are called through their OpenAI-compatible
//   /chat/completions endpoints, so one code path serves them all.
//
// Daily limit (20 free messages per user):
// - Enforced best-effort per IP in memory (20/day + 10/minute). Vercel
//   serverless functions are stateless and short-lived, so this counter does
//   NOT survive cold starts or scale across instances — it is a polite guard,
//   not a hard guarantee. The hard backstops are the provider-side rate
//   limits and spend caps on the owner's accounts. The frontend also keeps a
//   per-day counter in localStorage and shows the remaining messages.
//
// Free-model notes (checked 2026-11-27; free catalogues churn, so if a model
// stops working upstream, remove it from the allow-list below):
// - OpenRouter: only ":free" suffixed models are free. The live catalogue
//   currently lists 10; the old llama-3.3-70b-instruct:free / gemma-3-27b-it:free
//   are GONE. Default is google/gemma-4-31b-it:free. Free tier caps at
//   50 req/day unless $10 of credits was ever purchased.
// - Groq: the Llama chat models (llama-3.3-70b-versatile, llama-3.1-8b-instant)
//   were removed from the free tier on 2026-08-16. Free chat models now are
//   openai/gpt-oss-20b, openai/gpt-oss-120b and qwen/qwen3.8-27b.
// - Gemini: gemini-2.5-flash is on the free tier; called via Google's
//   OpenAI-compatible endpoint.
// - Mistral: free API access is disputed — Mistral's docs said from early
//   Nov 2026 that the Free plan no longer includes API access, and on a
//   tested free key mistral-small-latest returns 429 with a zero rate limit.
//   open-mistral-nemo and codestral-latest DID answer on a free key, so they
//   are the free defaults here. mistral-small-latest is listed only because
//   it works with a billed key; if the owner's key has no billing, it fails.

const DAILY_LIMIT = 20;
const PER_MINUTE_LIMIT = 10;
const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 20000;
const MAX_TOTAL_CHARS = 100000;

const PLATFORMS = {
  openrouter: {
    env: 'OPENROUTER_API_KEY',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: [
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'nvidia/nemotron-3.5-lightning:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
    ],
    headers: { 'HTTP-Referer': 'https://snoah-ai.vercel.app', 'X-Title': 'SnoahAI Free Credits' },
  },
  groq: {
    env: 'GROQ_API_KEY',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'],
    headers: {},
  },
  gemini: {
    env: 'GEMINI_API_KEY',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'],
    headers: {},
  },
  mistral: {
    env: 'MISTRAL_API_KEY',
    url: 'https://api.mistral.ai/v1/chat/completions',
    models: ['open-mistral-nemo', 'codestral-latest', 'mistral-small-latest'],
    headers: {},
  },
};

// Best-effort per-IP usage. Map: ip -> { day: 'YYYY-MM-DD', count: number, stamps: number[] }
// Lives only as long as this function instance stays warm. See the header note.
const usageByIp = new Map();

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function checkLimit(ip) {
  const now = Date.now();
  const today = todayKey();
  let rec = usageByIp.get(ip);
  if (!rec || rec.day !== today) {
    rec = { day: today, count: 0, stamps: [] };
    usageByIp.set(ip, rec);
  }
  rec.stamps = rec.stamps.filter((t) => now - t < 60000);
  if (rec.stamps.length >= PER_MINUTE_LIMIT) return 'minute';
  if (rec.count >= DAILY_LIMIT) return 'daily';
  return null;
}

function countUse(ip) {
  const rec = usageByIp.get(ip);
  if (!rec) return;
  rec.count += 1;
  rec.stamps.push(Date.now());
}

function clampNumber(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeUpstreamMessage(data, fallback) {
  if (data && typeof data === 'object') {
    const err = data.error;
    if (typeof err === 'string' && err) return err.slice(0, 300);
    if (err && typeof err.message === 'string' && err.message) return err.message.slice(0, 300);
    if (typeof data.message === 'string' && data.message) return data.message.slice(0, 300);
  }
  return fallback;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const body = req.body || {};
  const platform = body.platform;
  const model = body.model;
  const messages = body.messages;

  const config = PLATFORMS[platform];
  if (!config) {
    return res.status(400).json({ error: 'Unknown platform. Valid platforms: openrouter, groq, gemini, mistral.' });
  }
  if (typeof model !== 'string' || !config.models.includes(model)) {
    return res.status(400).json({ error: 'That model is not available in Free Credits for this platform.' });
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: 'Messages must be a non-empty list (max 50 messages).' });
  }
  let totalChars = 0;
  for (const m of messages) {
    if (!m || typeof m !== 'object') return res.status(400).json({ error: 'Each message must have a role and content.' });
    if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'system') {
      return res.status(400).json({ error: 'Message roles must be user, assistant or system.' });
    }
    if (typeof m.content !== 'string' || m.content.length === 0 || m.content.length > MAX_MESSAGE_CHARS) {
      return res.status(400).json({ error: 'Each message must be text under 20,000 characters.' });
    }
    totalChars += m.content.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return res.status(400).json({ error: 'Conversation is too long. Start a new chat.' });
    }
  }

  // Server-side key only. Never from the request, never logged, never returned.
  const apiKey = process.env[config.env];
  if (!apiKey) {
    return res.status(503).json({ error: 'This platform is not set up yet. Please try another platform.' });
  }

  const ip = clientIp(req);
  const limitHit = checkLimit(ip);
  if (limitHit === 'daily') {
    return res.status(429).json({ error: "You have used today's 20 free messages. Please come back tomorrow." });
  }
  if (limitHit === 'minute') {
    return res.status(429).json({ error: 'Too many requests — please wait a moment and try again.' });
  }

  const upstreamBody = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: clampNumber(body.temperature, 0.7, 0, 2),
    top_p: clampNumber(body.top_p, 1, 0, 1),
    max_tokens: Math.floor(clampNumber(body.max_tokens, 2048, 1, 4096)),
    stream: body.stream === true,
  };

  countUse(ip);

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
        ...config.headers,
      },
      body: JSON.stringify(upstreamBody),
    });

    if (upstreamBody.stream) {
      res.writeHead(response.status, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      if (!response.body) return res.end();
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        res.end();
      }
      return;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`Free Credits ${platform}/${model} upstream ${response.status}`);
      return res.status(response.status).json({ error: safeUpstreamMessage(data, 'The AI platform returned an error. Please try again.') });
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error(`Free Credits ${platform}/${model} proxy error:`, error.message);
    return res.status(500).json({ error: 'Could not reach the AI platform. Please try again.' });
  }
}

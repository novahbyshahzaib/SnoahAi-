// SnoahAI — Browser Agent Proxy
// Deployed as a Vercel serverless function at /api/browser
// Fetches the full content of a URL via Jina AI Reader and returns clean Markdown.
// Also supports DuckDuckGo Instant Answer search when ?q= is provided.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const query = req.method === 'POST' ? req.body?.q : req.query?.q;
  const url   = req.method === 'POST' ? req.body?.url : req.query?.url;

  // ── DuckDuckGo Instant Answer search mode ──────────────────────────────
  if (query) {
    try {
      const ddgUrl = 'https://api.duckduckgo.com/?q=' +
        encodeURIComponent(query) +
        '&format=json&no_html=1&skip_disambig=1&t=SnoahAI';

      const r = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'SnoahAI/1.0 (+https://snoah.vercel.app)' },
      });
      if (!r.ok) throw new Error('DuckDuckGo HTTP ' + r.status);
      const d = await r.json();

      const results = [];

      // Abstract (instant answer)
      if (d.AbstractText) {
        results.push({
          title: d.Heading || query,
          url: d.AbstractURL || 'https://duckduckgo.com/?q=' + encodeURIComponent(query),
          snippet: d.AbstractText,
        });
      }

      // Related topics
      (d.RelatedTopics || []).slice(0, 6).forEach(t => {
        if (t.Text && t.FirstURL) {
          results.push({ title: t.Text.split(' - ')[0] || t.Text, url: t.FirstURL, snippet: t.Text });
        }
      });

      // Answer (e.g. calculations, definitions)
      if (d.Answer && !results.some(r => r.snippet === d.Answer)) {
        results.unshift({ title: 'DuckDuckGo Answer', url: 'https://duckduckgo.com/?q=' + encodeURIComponent(query), snippet: d.Answer });
      }

      return res.status(200).json({ results: results.slice(0, 5) });
    } catch (err) {
      console.error('DuckDuckGo search error:', err);
      return res.status(500).json({ error: 'DuckDuckGo search failed: ' + err.message });
    }
  }

  // ── URL browsing mode (Agentic Web Search) ─────────────────────────────
  if (!url) {
    return res.status(400).json({ error: 'Provide ?url=URL to browse a page or ?q=QUERY to search.' });
  }

  // Basic URL validation
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Invalid protocol');
  } catch {
    return res.status(400).json({ error: 'Invalid URL. Must start with http:// or https://' });
  }

  try {
    // Use Jina AI Reader — free, no API key, returns clean Markdown
    const jinaUrl = 'https://r.jina.ai/' + url;
    const r = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'User-Agent': 'SnoahAI/1.0 (+https://snoah.vercel.app)',
        'X-Return-Format': 'markdown',
      },
      signal: AbortSignal.timeout(25000),
    });

    if (!r.ok) throw new Error('Jina reader HTTP ' + r.status);

    let text = await r.text();

    // Trim to ~8000 chars to save tokens (roughly 2000 tokens)
    if (text.length > 8000) {
      text = text.substring(0, 8000) + '\n\n[Content truncated for token efficiency]';
    }

    return res.status(200).json({
      url,
      content: text,
      title: parsedUrl.hostname,
    });
  } catch (err) {
    console.error('Browser proxy error:', err);
    return res.status(500).json({ error: 'Could not fetch URL: ' + err.message });
  }
}

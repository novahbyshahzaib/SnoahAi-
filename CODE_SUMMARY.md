# SnoahAI Code Summary

## Project Overview
- **Name**: SnoahAI
- **Type**: AI Chat Web Application
- **Stack**: HTML/CSS/JS (Tailwind CSS) + Vercel Serverless Functions
- **Main File**: index.html (~13,858 lines)
- **Total API Files**: 7 (under 12 Vercel limit)

## File Structure
```
SnoahAi-/
├── index.html           # Main application (all UI, JS, CSS inline)
├── snoahsecret.html     # Community feature page
├── api/
│   ├── unified.js       # Consolidated AI proxy (NVIDIA, xAI, HuggingFace, DeepInfra, Cohere, NanoGPT + Image Gen)
│   ├── github.js        # GitHub API proxy
│   ├── slack.js         # Slack API proxy
│   ├── browser.js       # Web search/browser agent proxy (DuckDuckGo, Jina AI)
│   ├── claude.js        # Anthropic Claude proxy
│   ├── notion.js        # Notion API proxy
│   └── plugin.js        # Plugin system proxy
├── package.json
└── vercel.json
```

## Key Features (113+ features documented in AI Knowledge)

### Core AI Platforms (20+)
- Gemini, OpenRouter, Groq, Together AI, Mistral AI
- NVIDIA NIM, HuggingFace, GitHub Models, Claude, Copilot
- Google AI Studio, Ollama, Cohere, DeepInfra
- Cerebras, SambaNova, Fireworks, xAI (Grok), Perplexity, NanoGPT
- Custom endpoint support

### Voice & Audio
- Voice Conversation Mode (Web Speech API + TTS)
- Speech-to-text input (mic button in input area)
- Text-to-speech output (ElevenLabs, OpenAI, Groq, Gemini)
- Audio file playback

### Image & Media
- Image generation (Pollinations, Gemini Imagen, NVIDIA NIM, Together AI, HuggingFace)
- Multi-image upload and preview
- Image analysis with AI

### Productivity Features
- Workflow Automation Engine (4 templates + custom)
- Canvas mode for visual organization
- Templates system
- Chat branching
- Memory/context management
- Temporary chat mode

### Integrations
- GitHub: Issues, repos, code review
- Slack: Channels, messaging
- Notion: Pages, databases
- Web search (Wikipedia, DuckDuckGo, Brave)

### UI/UX
- Dark/light theme support
- Sidebar navigation
- Search across chats
- Keyboard shortcuts
- Slash commands (/explain, /summarize, /translate, /workflow, etc.)
- Auto-save, localStorage persistence

## API Endpoints Summary

### Consolidated via unified.js (?provider=xxx)
| Provider | Endpoint | Notes |
|----------|----------|-------|
| nvidia | /api/unified?provider=nvidia | Chat + Image (type=image) |
| huggingface | /api/unified?provider=huggingface | Chat |
| deepinfra | /api/unified?provider=deepinfra | Chat |
| cohere | /api/unified?provider=cohere | Chat |
| xai | /api/unified?provider=xai | Chat |
| nanogpt | /api/unified?provider=nanogpt | Chat |

### Individual Endpoints (cannot be consolidated)
| Endpoint | Purpose |
|----------|---------|
| /api/github | GitHub API proxy |
| /api/slack | Slack API proxy |
| /api/claude | Anthropic Claude |
| /api/browser | Web search + URL reading |
| /api/notion | Notion integration |
| /api/plugin | Plugin system |
| /api/free-credits | Selective Free Credits — free models on OpenRouter, Groq, Gemini using the owner's server-side keys (env vars). No user key input; 20 free messages/day/user (client localStorage counter + best-effort per-IP server cap). See "Selective Free Credits" below. |

### Selective Free Credits (added 2026-11-27; Mistral removed 2026-11-27, OpenRouter default changed 2026-11-27; main-chat mode added 2026-11-27)
- Sidebar menu item + modal (`free-credits-modal` in index.html). Three platforms, each defaulting to a free model, user can switch model within the platform from a curated dropdown. No API key input anywhere in the section.
- Server: `api/free-credits.js` — validates platform/model against a server-side allow-list, proxies via each provider's OpenAI-compatible `/chat/completions` endpoint with keys from server env vars only (`OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`). Keys are never read from the request, never logged, never returned.
- Defaults (checked 2026-11-27; free catalogues churn): OpenRouter `nvidia/nemotron-3-ultra-550b-a55b:free`, Groq `openai/gpt-oss-20b`, Gemini `gemini-2.5-flash`. Note: Groq Llama models left the free tier Aug 2026; the old OpenRouter default `google/gemma-4-31b-it:free` returned 429 rate-limited on a live test 2026-11-27, so the default was switched to Nemotron 3 Ultra.
- Mistral removed 2026-11-27 (owner's decision): both owner keys authenticate, but the account has no API subscription, so chat returns 402 "You need a subscription". The platform was removed from the server allow-list and the modal — do not re-add without a billed key.
- Main-chat mode (toggle "Use free credits in main chat" in the modal; state in localStorage `snoah_fc_main_enabled`, default OFF): when ON, the main chat offers ONLY OpenRouter, Groq, Gemini and sends through `/api/free-credits` with no user API key (streaming via the endpoint's SSE passthrough, same `readStream` parser). The header shows a "Free credits ON · X / 20 left" chip (tap → opens the modal). The previous platform is remembered in `snoah_fc_prev_platform` and restored when the toggle is turned off. The 20/day counter (`snoah_free_credits_v1`) is shared with the popup; one successful main-chat reply = one message. Multi-AI is bypassed while free mode is on (single platform only). Auto-memory extraction and auto-titling are skipped in free mode (they need a user key / would burn a free message). The user's own per-platform model setting is never overwritten by a free-model choice. When OFF, the main chat behaves exactly as before.
- Daily limit: 20/day per user. Client counter in localStorage (`snoah_free_credits_v1`); server enforces a best-effort per-IP cap in memory (stateless functions, so not a hard guarantee — provider spend caps are the backstop).

## Important Code Patterns

### Platform Detection
```javascript
const isNvidia = platform === 'nvidia';
const isHF = platform === 'huggingface';
const isGH = platform === 'githubmodels';
```

### API URL Selection (Multiple locations)
- Lines ~6950-6965: Test API connection
- Line ~7658: Memory/chat URL selection
- Line ~11052: MULTI_AI_URLS object
- Lines ~12214-12245: Main chat API URL

### Key Variables
- `voiceConversationMode` - Voice mode toggle
- `voiceConversationActive` - Voice conversation state
- `workflows` - Saved workflows object
- `workflowTemplates` - Pre-built workflow templates
- `platform` - Current AI platform

### Key Functions
- `openWorkflowModal()` / `closeWorkflowModal()` - Workflow UI
- `executeWorkflow(name, steps)` - Run workflow steps
- `toggleVoiceConversationMode()` - Voice mode toggle
- `startVoiceListening()` - Speech recognition
- `generateImage(prompt, provider)` - Image generation

## LocalStorage Keys
- `snoah_workflows` - Saved workflows
- `snoah_workflow_history` - Execution history
- `snoahai_platform` - Selected platform
- `snoahai_api_keys` - API keys storage
- `snoah_agentic_ws` - Agentic web search toggle

## Update Rules
When editing code, UPDATE this file to reflect:
1. New features added
2. API endpoint changes
3. UI component changes
4. New integrations
5. Bug fixes that change functionality

Last Updated: May 13, 2026

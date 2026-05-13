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
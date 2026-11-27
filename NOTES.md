# SnoahAI — Selective Free Credits (Fri 2026-11-27)

User gave full permission + decisions: each platform defaults to a FREE model but the user can change it; daily free limit 20 messages/user.

## What was built (branch `snoahai-free-credits`, PR #63, squash-merged 29302642)
- `api/free-credits.js` (new): POST-only server proxy. Validates platform/model against a server-side allow-list, proxies via each provider's OpenAI-compatible /chat/completions endpoint with keys from server env vars only (OPENROUTER_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY). Never reads a key from the request, never logs/returns keys. Missing key → generic 503 "not set up yet". Supports stream passthrough (same pattern as unified.js); frontend uses non-streaming. Best-effort per-IP limit in memory: 20/day + 10/min (stateless functions — honest limit, provider caps are the backstop).
- `index.html` (pure insertion, 239 added lines, 0 removed): sidebar "Selective Free Credits" button, `free-credits-modal` (platform grid, model dropdown, mini chat, remaining counter), JS (`FREE_CREDITS_MODELS`, open/close/select/send functions). No API key input anywhere; client fetch sends only {platform, model, messages, temperature, max_tokens} to /api/free-credits.
- `CODE_SUMMARY.md`: new endpoint row + "Selective Free Credits" section per its update rules.

## Defaults + switchable models (verified 2026-11-27)
- OpenRouter default `google/gemma-4-31b-it:free`; also gemma-4-26b-a4b-it:free, nemotron-3-nano-omni-30b-a3b-reasoning:free, nemotron-3.5-lightning:free, nemotron-3-ultra-550b-a55b:free. Live OpenRouter catalogue check: only 10 :free models remain; llama-3.3-70b-instruct:free and gemma-3-27b-it:free are GONE.
- Groq default `openai/gpt-oss-20b`; also gpt-oss-120b, qwen/qwen3.8-27b. Llama chat models left the Groq free tier 2026-08-16 (the app's existing Groq default llama-3.3-70b-versatile no longer works on free keys).
- Gemini default `gemini-2.5-flash`; also gemini-2.5-flash-lite, gemini-2.0-flash. Via Google's OpenAI-compatible endpoint.
- Mistral default `open-mistral-nemo`; also codestral-latest, mistral-small-latest (billed key only). Mistral free API access disputed since Nov 2026 — Free plan reportedly no longer includes API access; mistral-small-latest returns 429 on a free key. Reported plainly to the user.

## Verification
- Base: local index.html blob SHA matched main HEAD exactly (3f762fc6…) before editing.
- `node --check api/free-credits.js` OK; all 4 inline <script> blocks in index.html parse OK.
- Diff vs main: 239 added lines, 0 removed. Security grep clean: x-api-key appears only in a comment; no Authorization header in the new client fetch; no key input in the new modal.
- Branch SHAs verified identical to local before PR (index.html b81a214f…, free-credits.js cc36e68e…, CODE_SUMMARY.md bf426c65…).
- PR #63 created and squash-merged 29302642.
- Live verification DONE Fri 2026-11-27 ~19:10 IST: live index.html is 200, 997,962 bytes (exactly the local build) and contains "Selective Free Credits", "free-credits-modal", "openFreeCreditsModal", "google/gemma-4-31b-it:free", "snoah_free_credits_v1". Live /api/free-credits: POST {} → 400 "Unknown platform…", GET → 405 "Method not allowed", POST valid {platform: gemini, model: gemini-2.5-flash, messages:[hi]} → 503 "This platform is not set up yet" — the function is deployed and validating, and the key is confirmed not configured yet (expected).
- Live verification: pending — see final report (curl of live index.html + GET/POST /api/free-credits).

## Still owed (NOT testable yet)
- None — all four keys were added to Vercel 2026-11-27 evening, redeployed 19:24 IST, and live-tested (see below).

## Live test results (2026-11-27 ~19:27 IST, POST /api/free-credits)
- Gemini (gemini-2.5-flash) ✅ real reply; Groq (openai/gpt-oss-20b) ✅ real reply.
- OpenRouter key ✅ works (Nemotron free model replied), BUT the default gemma-4-31b-it:free returned 429 rate-limited from OpenRouter.
- Mistral ❌ 402 "You need a subscription" on BOTH owner keys (keys authenticate, account has no API subscription).

## Change 2026-11-27 ~19:41 IST — Free Credits in MAIN chat (PR #65, branch snoahai-free-credits-main-chat, NOT yet merged — awaiting owner review)
- Owner's instruction: build free credits into the main chat with a toggle — when ON, main chat offers ONLY OpenRouter, Groq, Gemini with NO user API key; when OFF, main chat works exactly like before.
- What was built (index.html only; api/free-credits.js untouched):
  - Toggle "Use free credits in main chat" in the Free Credits modal. State in localStorage `snoah_fc_main_enabled`, DEFAULT OFF. Takes effect immediately.
  - When ON: `#platform-select` is rebuilt to only the 3 free platforms; `selectPlatform()` rejects any other platform (toast + revert); current platform switches to a free one (prefers the popup's last-picked free platform) and the previous platform is remembered in `snoah_fc_prev_platform` and restored on OFF. Header chip "Free credits ON · X / 20 left" (tap → opens the modal). Sidebar model label + Settings model field show the free model; Settings model field is read-only while ON; the model directory (cards + dropdown) shows only the free models for the current platform; picking one there or in the modal saves to the shared `snoah_fc_model_<platform>` choice. `saveSettings()` never overwrites the user's own model with a free model.
  - Send path (`submitMessage`): no-key guard skipped for free platforms; shared 20/day counter (`snoah_free_credits_v1`) checked before the message is added; routes through POST /api/free-credits with `stream:true` (endpoint's SSE passthrough, parsed by the existing `readStream` — OpenAI delta format, same as OpenRouter/Groq); `platform` field added to the request body; Gemini goes through the same OpenAI-compatible branch (not the native Gemini API path). One successful reply = one counted message (bumped once in FINALISE, so retries and agentic browse re-runs don't double-count). Free-mode 429/503/other errors surface the server's message text (not raw JSON) and sync the local counter on daily-limit errors. `rotateKey()` returns false in free mode (no user key to rotate). Token-limit check skipped (free mode has its own limit). Multi-AI fan-out bypassed (single platform only). Auto-memory extraction skipped (needs a user key); auto-titling skipped (would burn a free message). `helperFetch` (Summarize) routes through /api/free-credits in free mode and counts one message. Web-search pre-fetch now also runs for free-mode Gemini (native grounding is bypassed on the OpenAI-compatible endpoint); otherwise web search, voice/TTS, and image generation are untouched.
  - When OFF: every free-mode branch is gated on `fcMainEnabled()`; normal-mode code paths are unchanged (verified by diff review — only additive/gated edits).
- Verification: base verified vs main HEAD bdeae164 (blob SHAs matched before editing: index.html b73fbd2a…, api/free-credits.js 96b2605c…, CODE_SUMMARY.md 22c585b4…). `node --check api/free-credits.js` OK; all 4 non-empty inline `<script>` blocks in index.html parse OK. Diff vs main reviewed in full (317 diff lines, index.html only). Security grep: no API key values in any file; no MISTRAL_API_KEY in free-credits code.
- Still needs a LIVE test after merge (not yet done — this is a UI + send-path change, and no browser test was run): on the live site, turn the toggle ON, confirm only 3 platforms appear in Settings, send a message on each free platform in the main chat (streaming reply, counter drops by 1, chip updates), confirm the previous platform returns when the toggle is turned OFF, and confirm normal-mode sends still use the user's own key.

## Change 2026-11-27 ~19:30 IST (PR #64, branch snoahai-remove-mistral, squash-merged bdeae164, auto-merged per his rule)
- Owner's instruction: keep only 3 platforms, remove Mistral; OpenRouter default → nvidia/nemotron-3-ultra-550b-a55b:free.
- Removed Mistral from api/free-credits.js allow-list + index.html modal button + FREE_CREDITS_MODELS; OpenRouter def changed to the Nemotron 3 Ultra free model; CODE_SUMMARY.md updated. Main app's own Mistral support (user-supplied keys) untouched.
- Live-verified after auto-deploy: live index.html 997,262 B, no Mistral in the Free Credits modal, "three platforms" text present, new default present; OpenRouter new default ✅ real reply; Mistral POST → 400 "Unknown platform. Valid platforms: openrouter, groq, gemini."; Gemini ✅ still works.
- NOTE: MISTRAL_API_KEY env var still sits in Vercel (unused now — the server never reads it). Remove it from Vercel only if he asks.

## Fix 2026-11-27 ~19:55 IST — main-chat free mode sent the WRONG model (PR #66, pending)
- Live test of PR #65 (browser, no key): toggle/chip/3-platform filter all worked, but sending in the main chat FAILED — error box "Credit/billing limit exceeded for Gemini" and the counter never dropped (20/20 stayed, no credit consumed).
- Root cause: the main chat used `fcSelectedModel()`, which is scoped to the POPUP's picked platform (`fcPlatform`). The popup sat on OpenRouter/Nemotron, so with main platform=Gemini the request went out as platform=gemini + model=nvidia/nemotron-3-ultra-550b-a55b:free. The server rightly rejected it (400 "That model is not available..."), and the app's generic error mapper misread the word "Credits" in that message as a billing problem — hence the misleading Gemini billing error. (The request DID go through /api/free-credits; the native Gemini path was not involved.)
- Fix (index.html only): new helper `fcMainSelectedModel()` — same logic as `fcSelectedModel()` but scoped to the MAIN chat's `platform`, with a fallback to the OpenRouter default. All 7 main-chat call sites switched to it (fcApplyMainMode, updateModelLabels, both settings-model writes, helperFetch, submitMessage _activeModelNow + chatModel). The popup keeps using `fcSelectedModel()`. Also: in free mode the error box now shows the server's message as-is instead of the platform error mapping.
- Verified: all 4 non-empty inline script blocks parse OK; fix-only diff vs live PR #65 reviewed (9 changes, nothing else); remaining `fcSelectedModel()` uses are the popup only.
- Live re-test still needed after merge: toggle ON, send in the main chat on Gemini AND on OpenRouter (streaming reply, counter drops to 19/20), toggle OFF restores everything.

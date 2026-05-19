# AI-Assisted Authoring

NavSlides Editor exposes a pluggable **AI provider** that can generate, refine, and restructure slide content directly from the editor.

## What it does

- **Generate slides** from a prompt or outline
- **Rewrite** selected text for tone, length, or audience
- **Suggest layouts** for a slide based on the content already there
- **Translate** slides between languages

## Pluggable backend

The provider is selected per-deployment via env vars; see `server/services/ai-provider.js`. Swap between hosted APIs and a local model without touching the client.

The endpoint is rate-limited and guarded server-side (`server/services/ai-endpoint-guard.js`), so usage stays within whatever quota or budget you configure.

## Privacy posture

AI calls are opt-in per action — no slide content leaves the server unless the user clicks an AI button. This matters for self-hosted instances handling sensitive material.

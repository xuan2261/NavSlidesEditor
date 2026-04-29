---
phase: 4
title: "AI Provider Hardening"
status: completed
priority: P1
effort: "5h"
dependencies: [1]
---

# Phase 4: AI Provider Hardening

## Context Links
- [Plan](./plan.md)
- `server/services/ai-provider.js`
- `server/routes/ai.js`
- `server/routes/settings.js`
- `client/src/utils/ai.js`
- `client/src/pages/SettingsPage.jsx`

## Overview
Restrict custom AI endpoint abuse, validate AI output shape, and avoid leaking provider/internal errors to the client.

## Key Insights
- Custom endpoint is useful and should stay.
- Server-side fetch must not reach private/internal networks.
- Zod already exists on server.

## Requirements
- Functional: custom endpoint supports valid HTTP(S) OpenAI-compatible URLs.
- Functional: private IPs, localhost, link-local, file URLs are rejected.
- Functional: AI outline output is schema-validated before returning.
- Functional: client receives generic error; server logs detailed cause.
- Non-functional: no OpenAI/Gemini behavior regression.

## Architecture
Add `server/services/url-guard.js` or `server/services/ai-endpoint-guard.js`:
- parse URL.
- allow `http`/`https` only.
- DNS resolve hostname.
- reject private, loopback, link-local, multicast, unspecified IPs.
- optional allowlist env later: `AI_CUSTOM_ENDPOINT_ALLOWLIST`.

AI output schema:
```js
const outlineResponseSchema = z.object({
  slides: z.array(z.object({
    title: z.string(),
    bulletPoints: z.array(z.string()).optional(),
    layout: z.string().optional(),
    notes: z.string().optional()
  }))
})
```

## Related Code Files
- Create: `server/services/ai-endpoint-guard.js`
- Modify: `server/services/ai-provider.js`
- Modify: `server/routes/ai.js`
- Modify/Create tests:
  - `server/services/ai-provider.test.js`
  - `server/routes/ai.test.js` if route tests split out
  - `server/routes/api-surface.test.js`

## Implementation Steps
1. Implement endpoint guard with URL parsing and IP range checks.
2. Call guard before `fetch(url)` in `callCustom()`.
3. Preserve `/chat/completions` suffix logic after validation.
4. Add schema for outline result.
5. Convert parse/schema failures to safe `502`/`400` style response.
6. Log detailed internal error server-side.
7. Return generic client message:
   - `AI provider request failed`
   - `AI returned invalid outline`

## Todo List
- [x] Add endpoint guard service.
- [x] Reject localhost/private/internal endpoints.
- [x] Validate AI outline JSON shape.
- [x] Hide provider details in client response.
- [x] Add tests for valid and invalid endpoints.

## Tests / Verification
- Unit:
  - reject `http://localhost:...`
  - reject `http://127.0.0.1`
  - reject `http://169.254.169.254`
  - reject private RFC1918 ranges.
  - allow public HTTPS test host with mocked fetch.
- Route:
  - malformed outline returns controlled error.
  - valid outline returns `outline`.
  - provider error does not include internal URL/API message.
- Commands:
  - `npm run test -- server/services/ai-provider.test.js`
  - `npm run test -- server/routes/api-surface.test.js`
  - `npm run build`

## Success Criteria
- [x] Custom endpoint remains usable for valid public endpoints.
- [x] Private/internal targets blocked.
- [x] AI output malformed shape blocked.
- [x] Client error messages safe.

## Risk Assessment
- Risk: local LM users use `localhost`.
- Mitigation: document allowlist/env override if project wants local LLM support.
- Risk: DNS resolution tests flaky.
- Mitigation: mock `dns.lookup`.

## Security Considerations
- SSRF hardening is server boundary; no impact on HTML embed.

## Next Steps
- Phase 5 updates client error handling around AI/settings.

---
phase: 9
title: "Privacy Bounded Presentation Analytics"
status: pending
priority: P2
effort: "5-8d"
dependencies: [1]
---

# Phase 9: Privacy Bounded Presentation Analytics

## Context Links

- Brainstorm Feature 6: extend existing analytics to live sessions and standalone beacon.
- Audit correction: add privacy/retention rules before richer analytics.
- Code: `server/routes/analytics.js`, `server/services/socket-handler.js`, `client/src/components/AnalyticsModal.jsx`
- Tests: `server/services/socket-handler.test.js`, `tests/e2e/live.spec.js`, `tests/e2e/sharing.spec.js`

## Overview

Persist useful presentation analytics without violating the product's no-tracking
identity. Start with aggregate live session metrics and short retention.

## Key Insights

- Current analytics stores `totalViews` and share-token/referrer events only.
- Live navigation is broadcast through Socket.IO but not persisted.
- Standalone HTML beacon requires explicit product/privacy decision because it phones home.
- Analytics access is already share-token gated.

## Requirements

- Functional: define retention, opt-out, and data minimization rules first.
- Functional: persist live session join/end, slide navigation, fragment changes, and derived time-on-slide.
- Functional: AnalyticsModal shows aggregate watch time and drop-off by slide.
- Functional: keep analytics scoped to presentation ID and valid share token.
- Non-functional: no IP/user-agent/country storage unless explicitly approved.
- Non-functional: standalone HTML beacon is opt-in or deferred.

## Architecture

```text
socket-handler live events
  -> analytics service with storage lock
  -> bounded analytics.json sessions[]
  -> analytics route aggregates
  -> AnalyticsModal charts
```

Data model should store bounded events and derive UI metrics server-side:

```js
{
  totalViews,
  events: [],
  sessions: [{ id, token, joinTime, endTime, duration, viewedSlides, slideTime, lastSlide, dropOff }]
}
```

## Related Code Files

- Modify: `server/routes/analytics.js`
- Modify/Create: `server/services/analytics-service.js`
- Modify: `server/services/socket-handler.js`
- Modify: `server/services/socket-handler.test.js`
- Create: `server/routes/analytics.test.js`
- Modify: `client/src/components/AnalyticsModal.jsx`
- Create: `client/src/components/AnalyticsModal.test.jsx`
- Optional modify: `shared/src/htmlGenerator.js` only if standalone beacon is approved.
- Modify: `tests/e2e/live.spec.js`
- Modify: `tests/e2e/sharing.spec.js`
- Delete: none.

## Implementation Steps

1. Write privacy rules: fields stored, retention count/days, opt-out flag, standalone beacon decision.
2. Extract analytics write/read helpers into a small service to avoid bloating route/socket files.
3. Add tests for existing share-link analytics access guard before schema changes.
4. Extend analytics schema with bounded `sessions` array and migration-safe defaults.
5. On viewer/controller join, create or update a session with non-identifying ID.
6. On navigate/fragment/disconnect/end, update derived slide time and last slide.
7. Keep event count bounded, similar to existing 200-event cap.
8. Extend `/api/analytics/:id` response with aggregate watch time, drop-off, slideTime.
9. Update `AnalyticsModal.jsx` with aggregate cards/charts and empty states.
10. Defer standalone HTML beacon unless opt-in UX and privacy wording are approved.

## Todo List

- [ ] Privacy/retention rules accepted before persistence.
- [ ] Analytics service extracted and tested.
- [ ] Live session persistence added with bounded storage.
- [ ] Route aggregates added behind existing token guard.
- [ ] Analytics UI shows useful aggregate metrics.
- [ ] Standalone beacon decision recorded.

## Verification & Tests

```bash
npm run test -- server/services/socket-handler.test.js server/routes/analytics.test.js client/src/components/AnalyticsModal.test.jsx
npx playwright test tests/e2e/live.spec.js tests/e2e/sharing.spec.js
npm run lint
npm run build
```

Optional load gate if `k6` is installed:

```bash
npm run test:load:ws
```

Manual smoke:

- Start live session, join viewer, navigate slides/fragments, disconnect viewer.
- Open analytics with valid share token and verify aggregate values.
- Try analytics without token and with wrong token; expect 403.

## Success Criteria

- [ ] No analytics data is exposed without valid share token.
- [ ] Live sessions are persisted with retention bounds.
- [ ] UI reports aggregate metrics without collecting personal identifiers.
- [ ] Standalone beacon is either opt-in or explicitly deferred.
- [ ] Existing share-link view analytics still work.

## Risk Assessment

- Risk: analytics conflicts with no-tracking brand.
- Mitigation: aggregate/minimize data, document retention, add opt-out if needed.
- Risk: file-backed analytics grows or races under live traffic.
- Mitigation: storage lock, bounded arrays, load test where possible.

## Security Considerations

- Keep token gate on analytics route.
- Do not store IP addresses, raw user agents, or stable cross-presentation identifiers by default.
- Validate beacon/session payloads if standalone beacon is later approved.

## Next Steps

Update docs and changelog in Phase 10 after analytics decision/implementation.

## Unresolved Questions

- Retention policy: event count, day limit, or both?
- Should standalone exported HTML ever call back to the server by default? Default recommendation: no.

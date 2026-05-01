---
phase: 8
title: "Phase 9: Privacy Bounded Presentation Analytics"
status: deferred
priority: P2
effort: "5-8d"
dependencies: [0]
reason: "P2 gated; privacy/retention rules not defined; decision required before any code"
---

# Phase 8: Privacy Bounded Presentation Analytics

## Context Links

- Predecessor: Phase 0 (baseline) — current analytics stores `totalViews` and share-token events only
- Code: `server/routes/analytics.js`, `server/services/socket-handler.js`
- Code: `client/src/components/AnalyticsModal.jsx`
- Tests: `server/services/socket-handler.test.js`, `tests/e2e/live.spec.js`, `tests/e2e/sharing.spec.js`

## Overview

Persist useful presentation analytics without violating the product's no-tracking identity.
Start with aggregate live session metrics and short retention. Define privacy rules
BEFORE adding event persistence.

**Priority: P2** — gated on privacy/retention decision.

## Key Insights

- Current analytics: `totalViews` + share-token/referrer events only.
- Live navigation is broadcast via Socket.IO but not persisted.
- Standalone HTML beacon requires explicit privacy decision (it phones home).
- Analytics access is already share-token gated.

## Privacy Rules (Define First)

Before touching code, agree on:

| Rule | Decision |
|------|----------|
| Retention count | Max N sessions per presentation (e.g. 50) |
| Retention days | Auto-purge sessions older than N days (e.g. 90) |
| Opt-out | Can owner disable analytics? |
| IP storage | No IP addresses stored |
| User-agent | No raw user-agent strings |
| Cross-presentation ID | No stable identifier across decks |
| Standalone beacon | Opt-in only, or deferred |

## Architecture

```
socket-handler live events
  -> analytics-service.js (bounded write)
  -> server/data/analytics.json sessions[] (bounded storage)
  -> /api/analytics/:id route aggregates
  -> AnalyticsModal charts
```

**Data model:**
```js
{
  totalViews: number,
  events: [],          // existing format
  sessions: [{
    id: string,        // non-identifying session token
    joinTime: number,
    endTime: number,
    duration: number,   // derived
    viewedSlides: number[],
    slideTime: {},     // { slideId: ms }
    lastSlide: number,
    dropOff: boolean,  // disconnected without reaching last slide
  }]
}
```

## Related Code Files

- Modify: `server/routes/analytics.js`
- Create: `server/services/analytics-service.js`
- Modify: `server/services/socket-handler.js`
- Modify: `server/services/socket-handler.test.js`
- Create: `server/routes/analytics.test.js`
- Modify: `client/src/components/AnalyticsModal.jsx`
- Create: `client/src/components/AnalyticsModal.test.jsx`
- Optional: `shared/src/htmlGenerator.js` (if standalone beacon approved)
- Modify: `tests/e2e/live.spec.js`
- Modify: `tests/e2e/sharing.spec.js`

## Implementation Steps

### 1. Privacy/Retention Rules First (STRICT GATE)

Write the rules document. **Steps 2-9 cannot start until Step 1 is formally approved.**

Privacy rules must define:
- Fields stored: session join time, end time, duration, viewed slides, slide time, last slide, drop-off
- Retention: max sessions per presentation (e.g., 1000), max days (e.g., 30)
- Opt-out: `?no_analytics=1` URL parameter disables collection
- Standalone beacon: default = NO (opt-in only)
- NOT stored: IP address, user-agent, stable cross-presentation identifiers

**Decision gate:** If rules conflict with implementation decisions (e.g., "no session duration storage"), Steps 2-9 need rework before starting.

### 2. Extract Analytics Service

Extract write/read helpers into `server/services/analytics-service.js`:
- `addSession(presentationId, sessionToken)` — bounded write
- `updateSession(presentationId, sessionId, updates)` — append navigation events
- `endSession(presentationId, sessionId)` — set endTime, derive duration
- `getAnalytics(presentationId)` — aggregate for API response
- `pruneOldSessions(presentationId)` — enforce retention limits

Unit tests for all service methods.

### 3. Extend Socket.IO Session Tracking

In `socket-handler.js`:
- `presenter-join`: create session with `joinTime`
- `viewer-join`: create session with `joinTime`
- `slide-change`: update `viewedSlides`, `slideTime`, `lastSlide`
- `fragment-change`: update `slideTime`
- `disconnect`: set `endTime`, derive `duration`, detect `dropOff`

### 4. Update Analytics Route

Extend `/api/analytics/:id` response:
```js
{
  totalViews: number,
  sessions: [...],       // bounded
  aggregates: {
    totalDuration: number,
    avgWatchTime: number,
    dropOffRate: number,
    slideTime: {},       // { slideIndex: avgMs }
  }
}
```

### 5. Update AnalyticsModal

Update `AnalyticsModal.jsx` with:
- Aggregate cards: total views, avg watch time, drop-off rate
- Per-slide heatmap: time spent per slide
- Session list (last N sessions, most recent first)
- Empty state when no sessions recorded

### 6. Standalone Beacon Decision

If standalone HTML export should phone home:
- Opt-in only — requires explicit user toggle
- Privacy wording must be clear and honest
- Default: no beacon, local session only

Document decision: implement in follow-up or defer indefinitely.

## Todo List

- [ ] **Privacy/retention rules formally approved (GATE — no code until approved)**
- [ ] Analytics service extracted and unit tested
- [ ] Live session persistence added with bounded storage
- [ ] Route aggregates added behind existing token guard
- [ ] AnalyticsModal shows aggregate metrics
- [ ] File-backed analytics benchmarked (`npm run test:load:ws`)
- [ ] Standalone beacon: decision recorded (default: NO)
- [ ] Standalone beacon decision recorded (opt-in or deferred)

## Verification Commands

```bash
npm run test -- server/services/socket-handler.test.js server/routes/analytics.test.js
npm run test -- client/src/components/AnalyticsModal.test.jsx
npx playwright test tests/e2e/live.spec.js tests/e2e/sharing.spec.js
npm run lint
npm run build
```

Optional load gate:
```bash
npm run test:load:ws
```

## Manual Smoke

- Start live session, join viewer, navigate slides/fragments, disconnect viewer
- Open analytics with valid share token — verify aggregate values
- Try analytics without token and with wrong token — expect 403

## Success Criteria

- [ ] No analytics data exposed without valid share token
- [ ] Live sessions persisted with retention bounds
- [ ] UI reports aggregate metrics without personal identifiers
- [ ] Standalone beacon is either opt-in or explicitly deferred
- [ ] Existing share-link view analytics still work

## Risk Assessment

- Risk: analytics conflicts with no-tracking brand.
  - Mitigation: aggregate/minimize data, document retention, add opt-out if needed.
- Risk: file-backed analytics grows or races under live traffic.
  - Mitigation: storage lock, bounded arrays, load test where possible.

## Security Considerations

- Keep token gate on analytics route.
- Do not store IP addresses, raw user agents, or stable cross-presentation identifiers.
- Validate beacon/session payloads if standalone beacon later approved.

## Next Steps

Proceed to Phase 9 (docs, changelog, release gates) after analytics is complete or deferred.

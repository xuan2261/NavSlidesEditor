---
phase: 5
title: "Improve Round-trip Matching Algorithm"
status: completed
priority: P1
effort: 4h
dependencies: ["4"]
---

# Phase 5: Improve Round-trip Matching Algorithm

## Overview

Cải thiện matching algorithm từ index-based (naive) sang fingerprint-based (type + normalized position bucket + size bucket + text prefix). Fix 2 bugs từ red team review and prevent inflated official ≥98 scores.

## Requirements

- Functional: Matching không dựa vào element index, dùng fingerprint + greedy matching
- Functional: Only exact/proximity matches count as stable; `type-only` is diagnostic/partial and does not count as a full match
- Non-functional: Dễ debug, clear mismatch reasons, tested

## Common Bugs to Avoid in New Implementation

These are common mistakes when implementing fingerprint-based greedy matching that would break correctness:

**Bug Pattern #1: `indexOf` returns wrong index for duplicate fingerprints**
```js
// WRONG: find returns element, indexOf searches entire array
let match = roundTripFPs.find(rt => rt.fingerprint === src.fingerprint && !used.has(roundTripFPs.indexOf(rt)))
used.add(roundTripFPs.indexOf(match)) // indexOf always returns FIRST match index → wrong target!
```

**Fix:** Track `used` by direct object reference, not by `indexOf`:
```js
if (match) { match.used = true } // correct: mark the matched object directly
```

**Bug Pattern #2: Proximity check runs AFTER match is already made**
```js
// WRONG: match is ALREADY accepted before proximity check
let match = roundTripFPs.find(rt => rt.el.type === src.el.type && !rt.used)
// positionClose check here — but match was ALREADY made above!
```

**Fix:** Compute `positionClose` before accepting the match:
```js
if (!match) {
  const tol = 5 // px
  match = targets.find(rt =>
    rt.el.type === src.el.type && !rt.used &&
    Math.abs((src.el.x||0) - (rt.el.x||0)) <= tol &&
    Math.abs((src.el.y||0) - (rt.el.y||0)) <= tol
  )
  method = match ? 'proximity' : null
}
```

## Architecture

```js
function buildFingerprint(element) {
  const BUCKET = 20    // px position bucket
  const SIZE_BUCKET = 10 // px size bucket
  const pos = [
    Math.round((element.x || 0) / BUCKET),
    Math.round((element.y || 0) / BUCKET),
  ]
  const size = [
    Math.round((element.width || 0) / SIZE_BUCKET),
    Math.round((element.height || 0) / SIZE_BUCKET),
  ]
  const parts = [String(element.type || ''), ...pos, ...size]
  if (String(element.type || '') === 'text') {
    const text = stripHtml(element.content || '').substring(0, 50).trim()
    parts.push(text)
  }
  return parts.join('|')
}

function matchElements(sourceEls, roundTripEls) {
  const sources = sourceEls.map((el, idx) => ({ el, fp: buildFingerprint(el), used: false }))
  const targets = roundTripEls.map((el, idx) => ({ el, fp: buildFingerprint(el), used: false }))
  const results = []

  for (const src of sources) {
    // Priority 1: exact fingerprint match
    let match = targets.find(rt => rt.fp === src.fp && !rt.used)
    let method = match ? 'exact' : null

    // Priority 2: same type + position within tolerance (check BEFORE accepting)
    if (!match) {
      const tol = 5 // px
      match = targets.find(rt =>
        rt.el.type === src.el.type && !rt.used &&
        Math.abs((src.el.x||0) - (rt.el.x||0)) <= tol &&
        Math.abs((src.el.y||0) - (rt.el.y||0)) <= tol &&
        Math.abs((src.el.width||0) - (rt.el.width||0)) <= tol &&
        Math.abs((src.el.height||0) - (rt.el.height||0)) <= tol
      )
      method = match ? 'proximity' : null
    }

    // Priority 3: same type (any position) — diagnostic only, not stable
    if (!match) {
      match = targets.find(rt => rt.el.type === src.el.type && !rt.used)
      method = match ? 'type-only' : null
    }

    if (match) {
      match.used = true
      results.push({
        source: src.el,
        roundTrip: match.el,
        method,
        stable: method === 'exact' || method === 'proximity',
      })
    } else {
      results.push({ source: src.el, roundTrip: null, method: 'unmatched', stable: false })
    }
  }
  return results
}
```

## Related Code Files

- Modify: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`

## Implementation Steps

### Step 1: Implement buildFingerprint

```js
function buildFingerprint(element) {
  const BUCKET = 20
  const SIZE_BUCKET = 10
  const pos = [
    Math.round((element.x || 0) / BUCKET),
    Math.round((element.y || 0) / BUCKET),
  ]
  const size = [
    Math.round((element.width || 0) / SIZE_BUCKET),
    Math.round((element.height || 0) / SIZE_BUCKET),
  ]
  const parts = [String(element.type || ''), ...pos, ...size]
  if (String(element.type || '') === 'text') {
    const text = stripHtml(element.content || '').substring(0, 50).trim()
    parts.push(text)
  }
  return parts.join('|')
}
```

### Step 2: Implement matchElements (greedy, correct)

Fix both bugs:
- Track `used` array to prevent reuse
- Position tolerance check BEFORE accepting match
- Track used by direct index, not by fingerprint

### Step 3: Update computeRoundTripStability

Return per-type scores, stable/partial counts, and match list:
```js
const byType = {}
for (const m of matches) {
  const type = m.source?.type || 'other'
  if (!byType[type]) byType[type] = { total: 0, stable: 0, partial: 0, unmatched: 0 }
  byType[type].total++
  if (m.stable) byType[type].stable++
  else if (m.method === 'type-only') byType[type].partial++
  else byType[type].unmatched++
}
```

### Step 4: Run corpus

```bash
node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./PPTX --roundtrip --strict
```

Expected: Stability ≥ 98% overall in strict production+raster mode. `type-only` does not contribute to the numerator.

## Success Criteria

- [x] Matching no longer index-based
- [x] Used tracking prevents false reuse (fixed Bug #1)
- [x] Position tolerance checked BEFORE match accepted (fixed Bug #2)
- [x] Per-element-type breakdown includes stable/partial/unmatched counts
- [x] Duplicate-fingerprint test case passes
- [x] `type-only` matches are reported but not counted as stable
- [x] Stability ≥ 98% overall across 4 decks

## Risk Assessment

- **Risk:** Bucket size too coarse (20px) — **Mitigation:** Test with 10px and 20px; choose based on corpus
- **Risk:** Text fingerprint collision — **Mitigation:** Include position bucket + 50-char prefix
- **Risk:** Tolerance too strict (5px) — **Mitigation:** Make tolerance configurable and record chosen tolerance in final report
- **Risk:** Inflated metric from weak matches — **Mitigation:** count only `exact`/`proximity`; treat `type-only` as partial diagnostics

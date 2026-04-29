# Reviewer Report - PPTX Coordinate Fidelity

Date: 2026-04-27
Scope: plan 260426-2128-pptx-import-coordinate-fidelity-hardening

## Findings

- No P0/P1 correctness issue found in changed import geometry/property pipeline.
- New geometry helper isolates numeric/affine transforms, reduces mapper inline math.
- 0-value coordinate fallback bug class covered and fixed.
- Absolute line endpoint normalization now explicit + tested.
- Canonical import crop now editor-native (`imageW/imageH/imageOffset*`), export compatibility preserved.
- Group flattening now matrix-based, deterministic bounds, stable z-order.
- Corpus harness now emits by-type drift/coverage/count; generated fixture strict gates added.
- New e2e import flow verifies render bbox sanity and save/reload persistence after edit.

## Risks Remaining

- Real-deck group/shape max drift metrics still high in corpus report; currently informational for non-generated decks.
- Corpus still small (`n=4`) and may miss edge decks.

## Recommendation

- Keep current strict global gates.
- Expand generated fixtures + real-deck corpus incrementally.
- Promote selected by-type gates to hard fail for real decks once baseline stabilized.

## Unresolved Questions

- None.
---
phase: 5
title: Corpus Validation And Docs
status: completed
effort: S
---

# Phase 5: Corpus Validation And Docs

## Context Links

- Corpus report: `plans/20260424-1508-pptx-parser-benchmark-hard/reports/corpus-ground-truth.md`
- Roadmap: `docs/project-roadmap.md`
- Changelog: `docs/project-changelog.md`

## Overview

Add optional local corpus validation and update project docs after importer implementation.

## Requirements

- Script can run against local untracked `PPTX/`.
- If present, validate 4 decks and total 145 slides.
- Per deck counts: 41, 39, 45, 20.
- No parser process crash.
- Keep corpus optional for CI.
- Update roadmap/changelog to state importer status.
- Update plan status through `ck plan check`.

## Related Code Files

- Create: `scripts/validate-pptx-import-corpus.js`
- Modify: `docs/project-roadmap.md`
- Modify: `docs/project-changelog.md`

## Implementation Steps

1. Create optional corpus validator.
2. Run validator when local `PPTX/` exists.
3. Run server/client focused tests.
4. Run lint, full tests, build.
5. Update docs with shipped/importer validation notes.
6. Mark plan phases through `ck plan check`.

## Todo List

- [x] Corpus validator
- [x] Focused server/client tests
- [x] Full lint/test/build
- [x] Roadmap update
- [x] Changelog update
- [x] Plan check updates

## Tests

- `node scripts/validate-pptx-import-corpus.js --input PPTX`
- `npx vitest run server`
- `npx vitest run client`
- `npm run lint`
- `npm test`
- `npm run build`

## Success Criteria

- Optional corpus validates 4 decks and 145 slides locally.
- CI can run without `PPTX/`.
- Docs reflect production importer state.

## Risk Assessment

- Local corpus is untracked. Mitigation: validator skips cleanly when absent.

## Security Considerations

- Validation uploads go to temporary local path and are removed.

## Next Steps

- Future plan: editable chart/OLE/SmartArt only after separate benchmark and design.

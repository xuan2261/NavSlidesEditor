# Phase 01 Strict Corpus Gate Truth

## Overview

Priority: High  
Status: Superseded  
Goal: stop drift between strict corpus behavior, CLI messages, and docs.

## Requirements

- Keep current strict average round-trip floor at 50% unless fidelity work is explicitly in scope.
- Export/format threshold labels from constants instead of hardcoded text.
- Tests must fail if CLI says a different percent than the enforced constant.

## Related Files

- `server/services/pptx-import/pptx-import-corpus-cli.js`
- `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`
- `server/services/pptx-import/pptx-import-corpus-cli.test.js`

## Steps

1. Add focused CLI test for dynamic semantic and round-trip failure text.
2. Add small percent-label helper or strict gate metadata export.
3. Replace hardcoded `98%` / `99%` text with generated labels.

## Success Criteria

- Focused Vitest test passes.
- No threshold constant behavior changes.

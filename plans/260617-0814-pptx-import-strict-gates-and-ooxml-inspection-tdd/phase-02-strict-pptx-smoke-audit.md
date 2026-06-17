# Phase 02 Strict PPTX Smoke Audit

## Overview

Priority: High  
Status: Superseded  
Goal: make the default strict PPTX command practical for PR/runtime-sensitive verification.

## Requirements

- `test:pptx:strict` runs `test:corpus` and `test:pptx:browser-audit`.
- `test:pptx:browser-audit:full` remains the release signoff path.
- Add a contract test around package scripts.

## Related Files

- `package.json`
- `tests/unit/pptx-import-strict-scripts-contract.test.js`
- `README.md`

## Steps

1. Add script contract test that rejects `test:pptx:browser-audit:full` in `test:pptx:strict`.
2. Update `package.json`.
3. Update README command description.

## Success Criteria

- Contract test passes.
- Full audit command still exists unchanged.

# Phase 02 OfficeCLI hardening evidence

- Date: 2026-07-15
- Scope: candidate qualification, protected execution-copy checks, receipt identity inputs
- Status: partial; G1 remains open

## Red/green log

1. `npx vitest run server/services/pptx-import/officecli/gateway.test.js -t "candidate identity without"`
   - Red: candidate-only qualification reached launcher result handling instead of failing closed.
   - Green after gateway receipt guard: pass.
2. `npx vitest run server/services/pptx-import/officecli/qualification.test.js -t "verifies candidate bytes"`
   - Red: candidate qualification reported direct execution/validation.
   - Green after candidate-only contract wording: pass; `validation: false`, no-execution reason.
3. `npx vitest run server/services/pptx-import/officecli/native-launcher-client.test.js -t "candidate identity without"`
   - Red: launcher client accepted candidate-only input.
   - Green after receipt requirement: pass.
4. `npx vitest run server/services/pptx-import/officecli/native-launcher-client.test.js -t "different policy"`
   - Red: mismatched containment policy reached process handling.
   - Green after policy binding: pass.
5. `npx vitest run server/services/pptx-import/officecli/native-launcher-client.test.js -t "different input bytes"`
   - Red: emitted `inputSha256` was ignored.
   - Green after input hash binding: pass.
6. `npx vitest run server/services/pptx-import/officecli/qualification.test.js`
   - Green: 10 tests passed, including pre-existing target, symbolic-link, and multi-link rejection.

## Implemented controls

- Candidate identity alone cannot qualify validation or mutation.
- Receipt binds candidate binary hash/version, execution-copy identity, launcher identity, policy digest, and staged input SHA-256.
- Terminal receipts preserve typed `failed` outcomes and require verdict/exit-code coherence.
- Execution-copy staging safely reuses only an already-verified immutable copy; unsafe pre-existing targets fail closed. Revalidation rejects links, multi-link files, non-canonical paths, outside-root paths, and hash drift.
- Qualification is re-read for each gateway validation request; revoked tuples are not reused.

## Open evidence

- No official OfficeCLI asset acquisition record or physical Windows/MSVC qualification receipt.
- No proof yet for restricted identity, app-data/profile ACL isolation, egress denial, or native pre-launch TOCTOU closure.
- G1 and higher dependent gates remain open; no claim promotion implied.

## Unresolved questions

- Select and protect the production OfficeCLI acquisition records and launcher policy authority before G1.

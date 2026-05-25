# NavSlides Editor v1.9.7

Release date: 2026-05-25

## Highlights

- Hardened PPTX import fidelity with mapper golden masters, drift diagnostics, and 10-deck strict corpus acceptance.
- Added async PPTX import jobs with polling, SSE progress, cancellation, one-running-job protection, and background cleanup.
- Preserved imported PPTX media through SHA256 deduplication, extension allowlist checks, and magic-byte validation.
- Preserved table per-cell/per-side borders across import, editor canvas rendering, and shared export rendering.
- Split the PPTX mapper into focused modules while keeping the public mapper contract stable.
- Strengthened worker startup IPC with ready ACK handling and safer progress forwarding.

## Verification

- `npm test` passed: 182 files / 1527 tests.
- `npm run test:corpus` passed: 10/10 decks, 100.0% semantic fidelity, 99.0% round-trip stability.
- `npm run build` passed.

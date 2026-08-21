# Phase 05 — Full verification and artifact qualification

Status: **Conditionally complete** — full test/build/lint/matrix/E2E, Windows Electron and best-effort PPTX lanes pass; Docker unavailable; importer-native strict and PowerPoint visual policy fail closed.

## Goal

Tạo fresh evidence fixes hoạt động trên clean dependency tree và production-like artifacts, không chỉ trong hoisted dev workspace.

## Preconditions

- Focused regression tests của Phase 1–4 pass.
- Locked baselines được áp dụng: Electron `42.9.3`, electron-builder `26.15.3`, Node `22.22.0`/public floor `>=22.13.0`, TipTap `2.27.2`, raw analytics editor/operator-only.
- Không còn `npm ls` invalid, route-state fixture stale, SVG API failure, shutdown double-run, Rclone preservation hoặc cancelled-import late-settlement failure đã biết.

## Verification sequence

1. Clean dependency install dưới exact Node `22.22.0` từ authoritative locks; record Node/npm/OS/arch và lock hashes.
2. Dependency/artifact gates: exact TipTap v2 peers, declared `undici`, checked-in Electron server lock, two-run same-OS closure hash, staged vendor manifest, immutable base digests.
3. Focused security/reliability/data-integrity/accessibility tests, gồm operator Analytics UI/public-share negative, effective Electron sandbox, shutdown single-flight, Rclone preservation và import late settle.
4. Full unit/integration suite; lint; type/build gates nếu project có.
5. `npm run build`, `npm run docs:build`, `npm run test:audit`, `npm run matrix:gate`.
6. Full E2E and supported-browser smoke; load tests theo existing project contract.
7. Build Docker image và Windows Electron artifact. Run vendored Socket.IO + Live Presenter, AI endpoint resolution, reverse-proxy analytics boundary, exact-origin navigation, effective sandbox, health/API và clean shutdown smoke.
8. Run PPTX qualification suite, gồm cancellation/timeout late-settlement scenario, để bảo đảm dependency/runtime changes không regress import/export path.
9. Emit signed-or-checksummed release evidence index linking command receipts, dependency/vendor manifests, immutable image digests và artifact SHA-256.

## Required evidence

- Mỗi command receipt có timestamp, exact command, cwd, Node/npm/OS/arch, exit code, test totals và artifact identifier.
- Dependency receipt có root + isolated lock hashes, canonical production tree hash và same-Windows-image rerun comparison; vendor receipt có required-file hashes; artifact receipt có immutable base digest + SHA-256.
- 0 unexplained failures; environment-only skips phải có owner/reason và không được áp dụng cho High/security artifact gates.
- No source/config mutation during verification ngoài generated artifacts đã ignore.
- `git status --short` chỉ chứa intended implementation/docs changes.

## Release gate

Không đánh dấu production-ready nếu bất kỳ High regression còn reproduce; operator/share boundary hoặc effective sandbox chưa được runtime-probe; shutdown/Rclone/import cleanup gates fail; full suite chưa hoàn tất; artifact receipt thiếu; hoặc production dependency closure/artifact generation vẫn phụ thuộc undeclared/transitive/floating state.

## Final outcome

- Full Vitest: 564 files passed, 1 skipped; 4539 tests passed, 3 skipped.
- Lint/build/docs/audit/matrix/E2E: PASS; matrix 112/112, element-control 141 rows; E2E 512 passed, 21 skipped.
- Windows Electron: final artifacts rebuilt; API/vendor/package-source smoke plus browser-driven packaged PPTX import/editor smoke PASS.
- Docker: environment-blocked because no executable is installed.
- PPTX best-effort: PASS. Native strict: 9/11 decks pass; `Bai_2_1` and `Bai_2_5` fail on 13 total unmapped/permanent placeholder nodes. PowerPoint oracle: evidence integrity PASS, fixed `phase08_full` qualification FAIL at mean SSIM `0.23698886751039192`, minimum `0`.
- Decision: conditionally blocked, matching `../reports/full-codebase-remediation-release-evidence-260820.json`.

## Risks / rollback

- Artifact suites tốn thời gian; chạy focused → full theo thứ tự để fail fast, nhưng không bỏ final full gates.
- Nếu clean install khác developer tree, coi đó là dependency defect; không sửa bằng manual node_modules reconciliation.
- Nếu release artifact fail, rollback phase gây lỗi theo commit boundary và rerun từ clean install.

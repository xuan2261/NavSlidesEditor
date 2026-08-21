---
title: "Full codebase remediation plan"
---

# Full codebase remediation plan

Ngày: 2026-08-20  
Status: Implemented and verified — source remediation complete; release conditionally blocked by unavailable Docker qualification plus failing PPTX native-strict and PowerPoint visual gates.
Source review: [verified closure report](../reports/code-review-260820-0235-full-codebase.md)

## Outcome

Đưa monorepo về production-ready baseline: deterministic dependency/artifact closure, capability/origin/network boundaries đúng, verified regressions được sửa, data integrity và accessibility được bảo vệ, full verification chạy trên clean environment.

## Constraints / non-goals

- Giữ public contracts trừ khi security boundary bắt buộc thay đổi.
- Không mở rộng trust model để coi author-controlled presentation HTML là untrusted.
- Không tối ưu dashboard iframe nếu chưa có profiling/budget chứng minh bottleneck.
- Native OfficeCLI launcher vẫn theo external qualified-binary contract hiện tại.
- Socket.IO browser client là build-time vendored asset từ client dependency vào `server/vendor`; không thêm server runtime dependency nếu artifact contract không yêu cầu.
- Runtime baseline đã khóa: Electron `42.9.3`, electron-builder `26.15.3`, Node `22.22.0` (floor public `>=22.13.0`); Docker, CI, root engines và release tooling phải dùng cùng exact runtime line hoặc immutable image digest đã qualification.
- Analytics raw là editor/operator-only surface. Owner boundary là loopback/Electron desktop hoặc reverse proxy đã authenticate editor/API routes; share token không cấp quyền analytics và không có viewer analytics endpoint trong scope này.
- Mỗi phase phải giữ test evidence; không weaken tests để tạo green build.

## Phases

1. [Production runtime closure](phase-01-production-runtime-closure.md) — **Complete**.
2. [Security and capability boundaries](phase-02-security-capability-boundaries.md) — **Complete**.
3. [Presenter and product reliability](phase-03-presenter-product-reliability.md) — **Complete**.
4. [Data integrity and accessibility](phase-04-data-integrity-accessibility.md) — **Complete**.
5. [Full verification and artifact qualification](phase-05-full-verification-artifacts.md) — **Conditionally complete**: Windows Electron and best-effort PPTX qualified; Docker unavailable; native strict passes 9/11 decks and PowerPoint oracle evidence is valid but below fixed SSIM policy.

## Dependencies

- Thứ tự tích hợp bắt buộc: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5.
- Phase 1 khóa dependency graph, exact runtime và artifact receipts trước khi security/client tests của Phase 2 được coi là authoritative.
- Phase 2 khóa capability/origin/network boundary; Phase 3 hoàn tất shared client behavior; Phase 4 mới tích hợp lifecycle/data-integrity/accessibility để tránh ownership conflict.
- Phase 5 chỉ bắt đầu khi focused tests của Phase 1–4 pass, gồm route-state, SVG API, shutdown single-flight, Rclone preservation và cancelled-import late-settlement tests.

## Acceptance result

| Criterion | Result |
|---|---|
| Original 3 High findings no longer reproduce | PASS |
| Accepted red-team security/integrity findings implemented | PASS |
| Exact TipTap/Electron/Node/Undici dependency closure | PASS |
| Analytics/share, Electron origin/sandbox/IPC, mapped/NAT64 boundaries | PASS |
| Shutdown/Rclone/import/SVG/accessibility/theme/docs/lint contracts | PASS |
| Full unit/integration suite | PASS — 564 files passed, 1 skipped; 4539 tests passed, 3 skipped |
| Production build and lint | PASS |
| Coverage matrix | PASS — 112/112, 0 GAP/FAIL/TAGGED; 141 element-control rows |
| Independent final code review | PASS |
| Windows Electron final rebuild/runtime smoke/receipt | PASS |
| Docker artifact/runtime smoke | BLOCKED — no Docker executable on this workstation |
| PPTX best-effort qualification | PASS |
| PPTX native importer strict + PowerPoint visual oracle | FAIL-CLOSED — strict passes 9/11 decks; PowerPoint evidence integrity passes but visual qualification fails mean/min SSIM policy |

Release decision: **conditionally blocked**, not unconditional production-ready. Authoritative evidence: `../reports/full-codebase-remediation-release-evidence-260820.json`.

## Locked decisions

- Runtime: Electron `42.9.3` + electron-builder `26.15.3` + Node `22.22.0` (public engine floor `>=22.13.0`); không giữ Electron 33/Node 20 compatibility.
- TipTap: khóa toàn bộ `@tiptap/*` trực tiếp ở exact `2.27.2`; không migrate schema sang v3 trong remediation này.
- Analytics: raw analytics chỉ thuộc editor/operator surface. Local loopback/Electron user là operator; remote deployment dựa trên authenticated reverse-proxy boundary. Share viewer không có analytics capability.
- Packaging: `server/package.json` là owner production dependencies; Electron dùng checked-in isolated lock + `npm ci`; vendor publication dùng staging + manifest + atomic replace.

## Red Team Review

Session: 2026-08-20  
Scope: whole-plan assumption, security-boundary, failure-mode và release-gate attack.  
Kết quả deduplicate: 13 findings — Critical 1, High 7, Medium 5; accepted 7, rejected 6.

| Finding | Severity | Disposition | Plan response |
| --- | --- | --- | --- |
| Analytics owner boundary chưa chỉ rõ credential/navigation contract | Critical | Accepted | Khóa operator boundary là loopback/Electron hoặc authenticated reverse proxy; share token bị loại khỏi analytics auth/client contract; thêm owner UI + public-share negative gates. |
| TipTap major choice thiếu migration contract | High | Accepted | Khóa exact v2.27.2 family; fixture round-trip existing HTML trước/sau, không migrate schema v3. |
| Packaging reproducibility thiếu exact runtime/lock/receipt contract | High | Accepted | Khóa Node 22.22.0, checked-in Electron server lock, immutable image digest và machine-checkable closure receipts. |
| Sandbox chỉ được kiểm bằng config/static assertions | High | Accepted | Bắt buộc packaged runtime probe effective renderer sandbox và negative navigation behavior. |
| Shutdown có thể chạy hai lần và release store trước drain | High | Accepted | Một `shutdownOnce` promise cho signal/server/Electron; admission stop → bounded drain/force-close → store release. |
| Rclone failure có thể phá pre-existing config directory/state | Medium | Accepted | Temp ownership hẹp; failed probe giữ byte/metadata/directory state cũ và không để residue. |
| Cancelled PPTX import late rejection không được track | Medium | Accepted | Track cả late resolve/reject, cleanup owned output và chờ detached cleanup trong shutdown/test harness. |
| Exact-origin navigation matrix chưa đủ | High | Rejected | Plan hiện đã yêu cầu parsed exact origin, userinfo/encoding/default-port/subdomain/blob/main-frame/subframe matrix và packaged smoke. |
| IPC sender/key validation chưa đủ | High | Rejected | Locked default là xóa unused bridge/handlers; validation matrix chỉ áp dụng nếu consumer thật buộc giữ IPC. |
| IPv6 SSRF policy chưa exhaustive | Medium | Rejected | Scope có chủ ý là defense-in-depth cho mapped/special-use inputs; presentation author/operator giữ quyền cấu hình endpoint. |
| Windows start test chưa đủ process-tree rigor | Medium | Rejected | Existing requirement đã chạy documented command, poll health và clean shutdown trên native Windows CI. |
| Reveal timer ownership chưa đủ cụ thể | High | Rejected | Generation-owned interval/timeout/onload + stale A→B fake-timer test đã khóa race và leak contract. |
| Marketplace empty/error state còn mơ hồ | Medium | Rejected | Plan đã tách loading/error/data, Retry, success cards và successful-empty state với focused tests. |

Consistency sweep: không còn contradiction với locked Node/Electron/TipTap/analytics decisions; phase order và release receipts đã explicit; không thêm dashboard optimization, built-in account system hoặc viewer analytics ngoài scope.

## Implementation journal

- 2026-08-20 — Revalidated the original report; rejected the false static Socket.IO 404 finding and locked Electron `42.9.3`, Node `22.22.0`, TipTap `2.27.2`, and operator-only analytics.
- 2026-08-20 — Closed dependency/runtime, capability, presenter reliability, lifecycle/data-integrity, accessibility, documentation, lint, CI/release, and dependency-audit workstreams.
- 2026-08-20 — Independent review found two residual issues: well-known NAT64 private IPv4 bypass and presenter shortcut actions without real runtime consumers.
- 2026-08-20 — Added NAT64 embedded-IPv4 normalization; routed popup timer actions through the primary live socket; mapped supported game actions; removed unsupported team/reveal controls from registry/config/docs.
- 2026-08-21 — Fixed oracle capture's browser-context `VIEWPORT` reference by passing the deterministic viewport explicitly into `page.evaluate`; focused capture tests, full Vitest, E2E and full browser audit pass.
- 2026-08-21 — Re-ran release gates: native strict now qualifies 9/11 decks but still rejects `Bai_2_1`/`Bai_2_5`; local Microsoft PowerPoint evidence passes integrity but fails the fixed `phase08_full` SSIM policy. Release remains blocked by those truthful PPTX results and unavailable Docker qualification.


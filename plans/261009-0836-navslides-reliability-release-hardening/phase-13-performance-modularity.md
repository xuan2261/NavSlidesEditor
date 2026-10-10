---
title: "Phase 13: Hiệu năng navigator và ranh giới module theo bằng chứng"
status: pending
priority: P2
depends_on: [06, 07]
---

# Phase 13 — Benchmark 50/100/300, tối ưu có điều kiện

## Phạm vi và trạng thái

- [ ] **Pending; chưa chạy test hoặc benchmark.** Đây chỉ là PLAN, không triển khai runtime, fixture, script hay cấu hình.
- [ ] Nhận evidence phase 06 (history regression) và 07 (PPTX publication); fixture nhập phải là dữ liệu đã publish hợp lệ, không benchmark trạng thái import nửa chừng.
- [ ] Bàn giao kết quả cho 14; không phụ thuộc 12. Trình tự cuối: `06,07 → 13 → 14 → 12`.
- Không mặc định virtualization, cache, thay cấu trúc history hoặc TypeScript migration là cần thiết. Không thay public schema/API chỉ để tăng tốc; không chia file theo LOC tùy tiện.

## Rescout bắt buộc trước từng ưu tiên

Đã đọc CLAUDE.md, docs/code-standards.md (state/controllers), docs/codebase-summary.md (editor model), docs/design-guidelines.md (thumbnails), runtime và test bên dưới. Đây là quan sát source, **không phải xác nhận performance**.

| Ưu tiên / owner vai trò | Quan sát cần xác minh lại ở SHA triển khai | Quyết định sau rescout |
| --- | --- | --- |
| P1 correctness — editor maintainer | SlidePanel selection dùng ID nhưng focus/drag/menu vẫn dùng index; fallback `slide-${index}`, child key fallback index | Ghi mapping và test reorder/delete trước mọi windowing; không gọi index là stable identity |
| P2 baseline — performance owner | SlidePanel map toàn bộ parent; mỗi child có preview riêng; mỗi preview có ResizeObserver hoặc resize listener | Đo rendered rows/DOM/observer, không suy diễn số lượng chỉ từ parent count |
| P2 subscription/history — editor + phase06 owner | EditorPage có nhiều selector Zustand nhưng presentation là local state; history clone JSON, pending snapshot, debounce 500ms, HISTORY_CAP=50 | Profile commit/retained heap, không chuyển presentation vào store hoặc đổi cap như một “fix” mặc định |
| P2 optional cache/windowing — UI owner | useMemo chỉ theo reference; master/tokens/resolution ảnh hưởng thumbnail | Chỉ mở slice nếu baseline được duyệt chứng minh bottleneck; otherwise ghi no-op có bằng chứng |
| P3 modular contracts — editor + tooling owner | Controller đã tách; EditorNavigator nhận object `c` lớn; shared dùng JSDoc | Chọn seam có lỗi/chi phí thực; không blanket rewrite JS→TS |

Mỗi mục pending phải ghi lại SHA, đường dẫn/callers mới, sai khác từ phase06/07, owner chấp thuận, quyết định keep/defer/change trước RED. Nếu không còn tái hiện vấn đề, giữ characterization và đóng bằng chứng no-op, không tạo lỗi giả.

## Inventory đã kiểm tra và tác động dự kiến

Số dòng là snapshot đọc source (không phải budget); phải đo lại khi bắt đầu. File hiện hữu không nằm trong danh sách này không được sửa nếu chưa bổ sung impact review.

| File hiện hữu | Dòng đã kiểm tra | Tác động nếu cần |
| --- | ---: | --- |
| client/src/pages/EditorPage.jsx | 953 | Composition, selector/callback boundary; không cắt chỉ vì >200 LOC |
| client/src/components/editor/editor-navigator.jsx | 66 | Adapter navigation parent/child và layout commands |
| client/src/components/SlidePanel.jsx | 116 | ID/index, keyboard, selection, drag, context menu |
| client/src/components/slide-panel/slide-navigator-item.jsx | 68 | Semantics, child rows, roving focus; không bỏ accessible actions |
| client/src/components/slide-panel/slide-thumbnail-preview.jsx | 149 | Static preview, token/master resolution, observer lifecycle |
| client/src/hooks/editor-controller/use-editor-history-controller.js | 148 | Snapshot/pending/redo ownership; phase06 là regression gate |
| client/src/utils/history-stack.js | 19 | Giữ bounded undo/redo invariant |
| client/src/components/SlidePanel.test.jsx | 194 | Mở rộng stable-ID và keyboard contracts |
| client/src/components/slide-panel/slide-thumbnail-preview.test.jsx | 111 | Geometry, sanitizer, inert runtime và cleanup |
| client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx | 153 | History/autosave integration, fake timer được cleanup |
| tests/e2e/slide-management.spec.js | 189 | POM + API fixtures, xóa deck sau test |
| vitest.config.mjs / config/vitest/client-jsdom.config.mjs | 42 / 20 | Giữ lane jsdom; không dùng thời gian jsdom làm browser budget |
| playwright.config.js | 138 | Chromium built client, isolated data/uploads, server không reuse |

File **PROPOSED**, chưa tồn tại/chưa được tạo trong task này:

| Đường dẫn đề xuất | Kích thước dự kiến | Điều kiện / impact |
| --- | --- | --- |
| tests/e2e/editor-navigator-performance.spec.js | 140–190 dòng | Benchmark browser riêng, không đổi full-suite timing gate |
| tests/e2e/fixtures/navigator-performance-fixtures.js | 80–140 dòng | Seed/hash, parent/child distribution và payload size tái lập |
| client/src/components/slide-panel/navigator-model.js | 70–140 dòng | Chỉ nếu cần pure ID→address/window model; test cùng seam |
| client/src/components/slide-panel/thumbnail-revision-cache.js | 70–140 dòng | Chỉ sau approval; bounded disposal, không giữ deck vô hạn |
| client/src/components/slide-panel/navigator-model.test.js | 100–180 dòng | Contract adapter index/stable ID và invalidation |
| config/types/navigator-contracts.json | 20–50 dòng | Optional allowlist checkJs/noEmit, không include cả monorepo |

Kích thước chỉ là ước lượng review. Ưu tiên module có một trách nhiệm, API nhỏ và tests rõ; tuân thủ hướng dẫn CLAUDE cho module mới, không mass-format/split file cũ.

## Protocol benchmark và budget — **PROPOSED, cần baseline approval**

- [ ] Cố định SHA/build hash, lock hash, Node/Chromium, OS, CPU/model/core, RAM/GPU, power mode, viewport/DPR, fonts, network/cache settings; máy cắm nguồn, không job nền. Browser instrumentation cùng chế độ giữa baseline/candidate.
- [ ] Dataset 50/100/300 **parent slides**, báo riêng số child (ví dụ mỗi parent thứ 5 có 2 child), tổng effective rows, số element, image bytes, resolution/layout/token mix. Có cohort text nhẹ và mixed imported/static media; tài nguyên local cố định seed/hash, không CDN biến động.
- [ ] Cold: 30 context/profile mới cho mỗi size/cohort, cache browser rỗng. Warm: 5 lượt warm-up loại khỏi thống kê rồi 30 mẫu mỗi size/cohort trên cache đã làm nóng; ghi session boundaries. Không trộn cold/warm, không xóa outlier im lặng.
- [ ] Đo navigation→navigator usable (row + focus sẵn sàng), select/keyboard→next painted active slide, scroll frame/long task, drag start→drop commit, undo/redo latency. Ghi raw samples, p50/p95 nearest-rank và đơn vị; không cộng p95 của các thao tác.
- [ ] Ghi heap trước load/sau idle/sau 100 edit–undo–redo/sau 20 mount-unmount; retained heap sau GC chỉ ở Chromium diagnostic có cùng GC policy (không đưa GC vào timed interaction). Thiếu heap API ghi unsupported, không suy ra 0.
- [ ] Ghi DOM node/row count và số ResizeObserver, resize listeners, store subscribers còn sống, subscribe/unsubscribe delta; observer count dùng instrumentation đếm constructor/disconnect/targets, không gọi đó là browser native metric. Đối chiếu session không instrumentation để biết overhead.

| Budget ứng viên PROPOSED | Điều kiện phê duyệt |
| --- | --- |
| p95 select/keyboard ≤100ms warm, p95 cold usable ≤2000ms | Performance owner duyệt sau baseline trên hardware đã ghi; không phải số đã đạt |
| p95 candidate không xấu hơn baseline quá 10% ở từng size/cohort | Noise/repeatability phải đủ nhỏ; nếu variance lớn, tăng mẫu và dừng kết luận |
| Tối ưu chỉ nhận khi metric bottleneck cải thiện ≥20% mà correctness giữ nguyên | Ngưỡng đề xuất, cần owner ký; không đổi dataset để đạt |
| Retained heap sau cleanup ≤baseline idle +10%; không tăng tuyến tính qua 20 vòng | Chấp thuận sau phân tích GC/noise; stack cap không đồng nghĩa bounded bytes |
| Observer/subscriber trở về baseline sau unmount; DOM window bound theo viewport+overscan+row pin | Lifecycle invariant chính xác; bound DOM chỉ áp dụng khi thực sự chọn virtualization |

Không có baseline số đo hiện tại. `npm run test:benchmark` và `test:ci-budget` đo Vitest suite, **không** thay navigator benchmark. Nếu baseline đạt budget và profile không có hotspot đáng kể: không virtualization/cache, lưu quyết định cùng mẫu đo.

## Contracts và thiết kế tối thiểu nếu được duyệt

1. ID là identity; index chỉ là địa chỉ hiện tại tại thời điểm dispatch. Adapter dự kiến `resolveAddress(slideId, childId?)` phải đọc snapshot mới nhất, từ chối ID mất/duplicate. Legacy thiếu ID cần chính sách normalize được owner duyệt, không lặng lẽ persist ID sinh mỗi render.
2. Windowing phải giữ hoặc remount/scroll-into-view row focused/selected/context-menu origin/drag target; không mất selection khi row ngoài viewport. Parent/child có chiều cao thay đổi, không coi child index là parent index. Hidden/offscreen row khác hidden slide và hidden element: runtime hiện lọc hidden element; docs “hidden slides reduced opacity” cần rescout, không tự tạo tính năng đó trong phase13.
3. Cache tùy chọn keyed bởi deck identity + stable slide/child ID + **revision nội dung** + master revision + token revision + resolution + renderer/sanitizer revision. Đây là contract đề xuất, không khẳng định runtime đã có revision field. Không dùng index hoặc chỉ aggregate save generation: unsaved edit/undo vẫn phải invalidation. Bound entries/bytes, evict on deck change/delete; không cache DOM node/subscription hoặc giữ mọi historical revision.
4. Selection-only/store UI update không invalidate content preview; edit/token/master/undo/redo/import phải invalidate đúng dependent preview. Không bỏ sanitization, inert, placeholder cho executable media để tiết kiệm thời gian.
5. Subscription profile xác định selector nào gây commit; chỉ ổn định callback/selector tại seam đo được. History tối ưu phải giữ pending flush, redo invalidation, dirty state, depth symmetry; không chia sẻ mutable snapshot và không đổi semantics phase06.
6. Type-check incremental chỉ khi rescout xác định ambiguity thật: JSDoc `NavigatorAddress`, read-only preview input và callback signatures tại adapter; runtime validation cho dữ liệu external vẫn giữ. Root chưa có script typecheck/TypeScript direct dependency: tooling owner phải duyệt compiler pin và lock change riêng trước `tsc`; không dùng `npx` tải compiler ngầm. Allowlist `allowJs/checkJs/noEmit`, negative fixture sai child address phải fail; không kéo tất cả JSX/controllers vào TS vì convenience.

## Ma trận deep TDD

Mỗi ID phải có log RED assertion đúng nguyên nhân (không import error), GREEN cùng test và trace/fixture hash. Existing characterization có thể đã xanh: thêm adversarial fixture hoặc ghi no-op, không ép RED giả.

| ID | Risk / layer | Setup và kích thích | Assertion bắt buộc |
| --- | --- | --- | --- |
| S13-01 | P2 browser perf | 50/100/300, cold/warm protocol trên | Raw samples và p50/p95 tách cohort; budget chưa duyệt không báo PASS |
| S13-02 | P1 RTL | Select ID B rồi reorder/insert trước B | aria-pressed vẫn B; callback dùng địa chỉ mới |
| S13-03 | P1 browser a11y | End/Home/Arrow qua row ngoài window, Enter | Focus thật đúng ID, duy nhất roving parent tab stop, activate không xảy ra chỉ vì Arrow |
| S13-04 | P1 browser | Chọn nhiều row, scroll selected row ra khỏi viewport, quay lại | Selected IDs/batch delete vẫn đúng, không xóa theo recycled index |
| S13-05 | P1 browser drag | Drag qua window boundary, reorder trong lúc drag; cancel | Không drop nhầm slide, cancel không mutate, focus phục hồi |
| S13-06 | P1 RTL + browser | Parent có child; chọn child rồi parent cùng index; reorder parent | Active target/selection/rich text reset đúng; child không ghi sang parent |
| S13-07 | P1 RTL | Hidden element, offscreen row, deck có hidden flag legacy | Hidden element không preview; offscreen không mất selection; hidden-slide policy được xác nhận trước assertion |
| S13-08 | P1 unit/RTL | Edit cùng ID, đổi master/tokens/resolution, undo/redo | Cache không stale; dependency invalidation đúng, slide khác không render lại vô cớ |
| S13-09 | P1 unit | Hai deck trùng slide ID; delete rồi undo; revision lặp | Không cross-deck cache hit; eviction bounded và restore nội dung đúng |
| S13-10 | P1 RTL security | HTML/SVG/media độc, cache miss và hit | Không iframe/script/media runtime, sanitizer giữ hiệu lực, inert preview |
| S13-11 | P2 RTL + browser heap | 20 mount/unmount/route switch; fallback không ResizeObserver | Observer/listener/subscriber delta về baseline, không detached nodes tăng tuyến tính |
| S13-12 | P1 integration + heap | 100 edits, pending <500ms rồi undo/redo, 300-parent deck | Full state/dirty/autosave đúng phase06, history cap đối xứng; đo clone/retained bytes |
| S13-13 | P2 profiler | Toggle grid/selection không sửa content, rồi sửa một child | Commit fan-out theo seam; thumbnail unrelated không bị stale hoặc update lan không giải thích |
| S13-14 | P1 browser a11y | Shift+F10 row rồi scroll/remove origin, Escape | Menu focus không rơi body ngoài policy; fallback focus tới ID hợp lệ |
| S13-15 | P3 contract | Optional checkJs positive/negative fixtures, stale address | Sai shape bị type gate chặn; runtime adapter từ chối ID mất; không mở rộng type scope ngầm |

## Tests Before → RED → Green → Refactor → Tests After

- [ ] **Tests Before:** rescout file inventory/callers, nhận phase06/07 receipts; chạy characterization có sẵn trong implementation run; lưu baseline correctness/perf riêng, failure có sẵn được triage không che giấu.
- [ ] **RED:** chọn đúng scenario theo hotspot; thêm regression tối thiểu trước change. Chứng minh expected failure ở invariant; performance RED chỉ khi budget đã được phê duyệt và lặp lại ổn định.
- [ ] **Green:** sửa nhỏ nhất; đo lại theo protocol không đổi hardware/fixtures. Mỗi optional optimization là commit có thể revert riêng.
- [ ] **Refactor:** pure address adapter, preview input boundary hoặc lifecycle owner nếu justified; giữ callbacks/index compatibility tại public seam. Không đổi history algorithm cùng cache/windowing trong một commit.
- [ ] **Tests After:** replay S13, phase06 history gate, thumbnail sanitizer và slide-management; đối chiếu perf baseline/candidate, ghi unsupported/skipped/deferred rõ lý do. Full regression/release do phase12 sở hữu.

### Lệnh cho lần thực thi tương lai — không chạy trong task PLAN

```bash
npx vitest run client/src/components/SlidePanel.test.jsx client/src/components/slide-panel/slide-thumbnail-preview.test.jsx
npx vitest run client/src/utils/history-stack.test.js client/src/hooks/editor-controller/use-editor-active-slide-controller.test.jsx client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx
npm run build
npx playwright test tests/e2e/slide-management.spec.js tests/e2e/slide-management-modal-and-multiselect.spec.js --project=chromium --workers=1
# Chỉ sau khi tạo spec PROPOSED và review protocol sampling nội bộ:
npx playwright test tests/e2e/editor-navigator-performance.spec.js --project=chromium --workers=1 --retries=0
# Chỉ sau tooling approval, compiler local đã pin, config PROPOSED tồn tại:
node node_modules/typescript/bin/tsc -p config/types/navigator-contracts.json --noEmit
```

Playwright mặc định dùng built client + npm start, global setup và data/uploads riêng; phải kiểm tra prerequisites config/production.env/runtime closure trước run, không bypass prestart để có số đẹp. Retry benchmark tắt; functional retry không được biến thành baseline perf.

## Exit evidence và rollback

- [ ] Performance owner ký baseline + budget hoặc quyết định defer; editor owner ký correctness/ID/focus; phase06 owner ký history compatibility.
- [ ] Evidence bundle đề xuất `plans/reports/navslides-hardening/phase13/<run-id>/`: manifest SHA/build/fixture/hardware, raw samples, summary p50/p95, heap/DOM/observer/subscription snapshots, profiler/trace, command+exit code, RED/GREEN links, unsupported list và rationale no-op/optimization. Không tạo bundle giả trong PLAN.
- [ ] Mỗi assertion trỏ S13 ID; không dùng ảnh screenshot thay state/focus assertion, không gọi source review là benchmark PASS.
- [ ] Rollback: revert riêng cache/windowing/selector adapter nếu p95, stale content, keyboard/drag/history regression; giữ characterization và receipts thất bại. Khôi phục full-list static preview là fallback; không xóa dữ liệu, giảm history cap hoặc nới budget để qua gate.
- [ ] Phase14 chỉ nhận measured claims đã duyệt; mọi candidate chưa qua gate chuyển pending/deferred có owner, không chặn bằng dependency vòng với phase12.

---
title: "Phase 06 — Xác minh regression history, không làm lại fix redo"
status: pending
priority: P1
depends_on: [phase-01-start]
effort: "1–2 ngày kiểm chứng và bổ sung test thiếu"
mode: "--deep --tdd"
---

# Phase 06 — Verification-first cho history hiện có

**Status: pending. Dependency: 06 ← 01.** Không phụ thuộc settings. Đây là kế hoạch kiểm chứng fix hiện hữu, **không phải dự án rewrite undo/redo hoặc server snapshot**. Không chạy test trong lượt lập PLAN; không suy ra PASS từ việc đọc source.

## Hiện trạng đã đọc và ranh giới

- `client/src/hooks/editor-controller/use-editor-history-controller.js` hiện đã có `pendingSnapshotRef`, `commitPendingSnapshot`, seed clone, debounce 500ms, invalidate redo ngay trong layout effect, guard `applyingUndoRef`, `canUndo/canRedo`, và restore/reconcile selection. Undo commit pending rồi pop history; redo lấy entry cuối redo, push vào history và restore **chính entry đó**. Không mô tả bug redo cũ là vẫn chưa sửa.
- `client/src/utils/history-stack.js`: `HISTORY_CAP = 50`, `pushHistory` trả array mới; test đã bao phủ cap, giữ 30 redo entries, không mutate input. Cap 50 snapshots nghĩa sau 60 committed edits chỉ còn tối đa **49 lần undo** từ current, không hứa 50 undo cộng current.
- `client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx` đã có undo/redo, hai undo/hai redo đúng current, immediate undo trước debounce + branch invalidation, availability. Đây là evidence source cần chạy lại, không duplicate rồi tuyên bố fix mới.
- Server là lớp history khác: `history.js` đã có before-restore snapshot, cap 50 + preserve target, hash CAS legacy restore, per-deck `withHistoryLock`, package lifecycle ngoài presentations lock, forward generation và compensation. Các test restore/package integrity/lock order/delete compensation đã tồn tại và đã đọc. Giữ làm regression liên quan, không mở rộng thành sửa package lifecycle ở phase 06.

## Rescout checklist

- [ ] Đọc lại phase 01 baseline/diff để xác định commit fix redo hiện tại; ghi SHA vào evidence sau này, không đoán commit.
- [ ] Đọc lại controller, `history-stack`, selection reconciler và EditorPage wiring; tìm mọi handler undo/redo/seed và shortcuts/ribbon callers.
- [ ] Map từng case dưới đây tới test có sẵn trước thêm mới; không thêm test trùng chỉ để tăng count.
- [ ] Đọc persistence controller/wiring nếu assertion dirty/save phát hiện vấn đề: tách history availability khỏi saved-baseline semantics; không sửa persistence âm thầm.
- [ ] Kiểm tra fixture temp DATA_DIR, CJS cache reset, fake timers và cleanup; test server không được dùng production data.
- [ ] Đọc `common-verification.md` nếu đã có; xác minh wrapper inventory và scripts vẫn đúng; kiểm tra platform limitations.

## Inventory existing/proposed chính xác

| File | Action / trạng thái | Cỡ hiện tại → delta dự kiến | Test impact |
|---|---|---|---|
| `client/src/hooks/editor-controller/use-editor-history-controller.js` | Có; đọc/verify, mặc định **không sửa** | 148 → 0; chỉ patch nhỏ nếu RED mới chứng minh | không redo rewrite |
| `client/src/utils/history-stack.js` | Có; đọc/giữ nguyên | 19 → 0 | cap và immutability |
| `client/src/utils/history-stack.test.js` | Có; giữ 3 test; thêm edge input/cap nếu thiếu | 32 → +15–30 | pure unit |
| `client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx` | Có; giữ 5 cases hiện tại; tăng assertion khi cần | 153 → +10–35 | integration UI thật |
| `client/src/hooks/editor-controller/use-editor-history-controller.test.jsx` | **Proposed**; chỉ thêm direct hook cases còn thiếu: cap, seed, timers, isolation | mới 140–195 | S06-04/05/07/08/09 |
| `client/src/utils/history-selection-reconciler.js` | Có, đã xác minh đường dẫn qua glob/import; **cần đọc nội dung ở rescout**, không claim behavior chưa đọc | chưa đo; delta 0 | selection regression boundary |
| `client/src/pages/EditorPage.jsx` | Có, xác minh bằng grep và test import; đọc wiring ở rescout, không sửa | chưa đo; delta 0 | integration route/controller |
| `server/routes/history.js` | Có; verification-only | 364 → 0 | không rewrite snapshot lifecycle |
| `server/services/history-lock.js` | Có; đọc/giữ lock finally release | 17 → 0 | serialization regression |
| `server/routes/history-restore-snapshot.test.js` | Có; reuse 3 tests reversible/CAS/cap | 133 → 0–20 | real storage + HTTP |
| `server/routes/history-package-integrity.test.js` | Có; reuse package authority/retention/target cap | 269 → 0 | không refactor suite chỉ vì >200 cũ |
| `server/routes/history-package-lock-order.test.js` | Có; reuse lock-order/stale generation tests | 185 → 0 | CJS monkeypatch trước router import |
| `server/routes/history-snapshot-delete-compensation.test.js` | Có; reuse unknown release status compensation | 117 → 0 | disk + package owner assertions |

Chỉ file test proposed được thêm mặc định; code patch là contingency cần RED chứng minh. File mới dưới 200 LOC theo CLAUDE. Không đổi storage schema, cap hoặc debounce như một cách làm test dễ xanh.

## Invariants cần khóa bằng test

1. A→B→C, undo→B→A, redo→B→C; redo hiện tại đã restore entry đúng, test phải bảo vệ chứ không sửa lại thuật toán.
2. Edit chưa hết 500ms vẫn undo được; pending commit đúng một lần. Undo/redo không tạo ghost history sau khi timer cũ chạy. Branch edit sau undo xóa redo ngay, không chờ debounce.
3. Seed là clone, clear pending/redo, reset availability. Mutation object đầu vào sau seed không sửa history. Hai editor/controller không dùng chung stack.
4. Cả push history/redo dùng shared cap; snapshot cap khác số bước undo; cần phân biệt edit burst coalesced trong 500ms với edit đã commit. Dùng fake timer advance chính xác thay sleep.
5. Toolbar availability phản ánh stack thật; Ctrl+Z/Y và buttons dùng cùng behavior. Save affordance là regression UI hiện có, nhưng `hasChanges = history.length > 1` không đồng nghĩa saved-baseline equality. Nếu phát hiện save-baseline bug, ghi gap/dependency rõ ràng, không tuyên bố phase này đã fix persistence.
6. Reconcile không để selection/editing trỏ vào element không tồn tại; chỉ thêm assertions sau đọc helper/wiring. Không thay active-slide policy ngoài scope khi chưa có RED.
7. Server restore legacy phải giữ before-restore và không ghi đè concurrent save; package restore dùng retained authority + generation tiến, không downgrade về compatibility JSON. Không giữ presentations lock trong package lifecycle. Snapshot target phải tồn tại sau prune khi cap đầy; release lỗi phải giữ recoverable snapshot khi owner status chưa biết.

## TDD phù hợp với fix đã có

1. **Tests Before — baseline:** chạy test hiện có, ghi kết quả cả 5 characterization + 3 stack tests trước thay đổi. Nếu chúng xanh thì kết luận “fix tồn tại và được xác minh”, không tạo RED giả bằng sửa production. Nếu fail, phân loại env/fixture/behavior trước patch.
2. **RED cho khoảng trống:** chỉ thêm cases cap đủ chu kỳ, seed isolation, timer sau undo/unmount nếu chưa có. Case mới có thể xanh ngay vì behavior đã đúng; đánh dấu characterization PASS, không bịa red-green. Để chứng minh test nhạy với lỗi cũ, có thể mutation tạm trong working tree cô lập (redo restore sai entry hoặc bỏ pending commit), thấy test fail rồi **revert mutation trước commit**; không yêu cầu làm hỏng source chính.
3. **GREEN:** mặc định không production changes. Chỉ khi RED thực chứng minh regression hiện tại, sửa tối thiểu đúng assertion; nếu cần đổi semantics persistence/package thì dừng xin scope thay vì rewrite.
4. **REFACTOR:** chỉ fixture/test duplication cần thiết; maintain identity assertion và exact snapshots, restore timers/mocks trong afterEach/finally. Không đổi cap, bỏ integration cases, dùng timeout lớn che race hoặc chuyển test thành toàn mock controller.
5. **Tests After:** targeted mới/cũ, server history regression, full suite/build/lint; so baseline trước/sau và mutation receipt nếu dùng. Dừng nếu test sửa behavior đã có ngoài yêu cầu; evidence phải ghi rõ “verified existing fix”, không gọi là redo fix mới.

## Ma trận 15 case (có sẵn được reuse, không đồng nghĩa 15 test mới)

| ID | Priority | Layer | Input / interleaving | Expected assertion |
|---|---|---|---|---|
| S06-01 | P0 | page integration, có sẵn | A→B→C committed; undo×2/redo×2 | A/B/C chính xác ở từng bước, cuối C và chu kỳ B→C tiếp vẫn đúng |
| S06-02 | P0 | page integration, có sẵn | edit B rồi undo trước 500ms, redo | undo A; redo B; pending không mất |
| S06-03 | P0 | page integration, có sẵn | undo về A, gõ branch D trước debounce | redo disabled ngay; undo A, redo D, không về B cũ |
| S06-04 | P0 | hook proposed | 60 committed snapshots, undo tới biên rồi redo hết | bounded 50 entries, tối đa 49 undo, final current snapshot nguyên vẹn |
| S06-05 | P1 | hook proposed | seed A rồi mutate input; seed deck khác khi pending | clone không alias; stack/redo/pending reset; không snapshot deck trước |
| S06-06 | P1 | page integration, có sẵn | edit/undo/redo bằng controls | canUndo/canRedo đúng; save affordance regression giữ |
| S06-07 | P0 | hook proposed | undo pending rồi advance timer 500ms thêm lần nữa | không ghost entry/duplicate; redo một lần đủ về B |
| S06-08 | P1 | hook proposed | burst B/C dưới 500ms; unmount trước timer | coalesce theo contract, không callback publish sau unmount |
| S06-09 | P1 | hook proposed | hai hook/editor A và X, edit/undo A | X không đổi availability/snapshot; cleanup không chạm instance khác |
| S06-10 | P1 | pure unit, có sẵn | push 60 + push 30 redo + input array | cap50, giữ đủ30 redo, input bất biến |
| S06-11 | P0 | server HTTP/disk, có sẵn | restore v1 từ current v2 | live=v1; Before restore chứa v2; IDs/updatedAt hợp lệ |
| S06-12 | P0 | server HTTP/disk, có sẵn | pause snapshot write; concurrent save; resume restore | 409; concurrent save còn nguyên, không overwrite |
| S06-13 | P0 | package integration, có sẵn | retained snapshot + stale compatibility JSON | authority khôi phục đúng, generation successor; lifecycle ngoài presentations lock |
| S06-14 | P0 | package/disk, có sẵn | cap50, restore target oldest; hoặc head stale | target/owner còn sau prune; stale trả409 không orphan history owner |
| S06-15 | P0 | package/disk, có sẵn | delete snapshot, release fail + owner query fail | snapshot còn với packageReleasePending=true, owner giữ được; không silent success |

S06-14 có hai nhánh phải map hai test names riêng trong evidence. Các assertions chưa có (ví dụ updatedAt exact) chỉ bổ sung nếu cần; đừng khẳng định source test đã assert tất cả expected ở bảng.

## Lệnh thực tế — ghi để chạy sau, không chạy bây giờ

Root `npm test` chạy wrapper inventory **auto-refresh trước mỗi run**, kể cả targeted paths; `npm run test:inventory` tồn tại nhưng không cần gọi riêng. Không thay bằng test filter không match rồi tính là pass.

```bash
# Tests Before
npm test -- client/src/utils/history-stack.test.js client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx
npm test -- server/routes/history-restore-snapshot.test.js server/routes/history-package-integrity.test.js server/routes/history-package-lock-order.test.js server/routes/history-snapshot-delete-compensation.test.js
# Proposed hook test: chỉ dùng sau khi thực sự tạo
npm test -- client/src/hooks/editor-controller/use-editor-history-controller.test.jsx client/src/utils/history-stack.test.js client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx
# Tests After: chạy lại nhóm server ở trên rồi regression toàn repo
npm test
npm run lint
npm run build
```

Cần lưu exit code, platform, node version, test counts và lý do skip. Build có generated artifacts; audit diff theo phase 01, không tự commit dist. Inventory refresh có thể sửa generated inventory, review tách biệt test/source changes. Không chạy `npm run format` toàn repo vì đó là lệnh sửa file.

## Rollback và data compatibility

Mặc định chỉ bổ sung test nên không migration dữ liệu hay user-visible rollback. Nếu có patch nhỏ chứng minh bằng RED, rollback commit patch độc lập nhưng giữ regression để thấy lý do thất bại; không rollback fix redo đã có. Browser history vẫn in-memory, cap50/debounce500 giữ nguyên. Server snapshot JSON/package owners/generation không đổi format. Không xóa snapshot/owner hoặc reset head để làm test xanh; temp DATA_DIR phải cleanup đúng. Nếu backend package regression đỏ, không downgrade package-backed history thành legacy restore, ghi blocker sang phase package tương ứng.

## Unchecked implementation tasks và exit evidence

- [ ] Map S06-01…15 tới cases tồn tại và chỉ ra gap thật; ghi commit fix đã có.
- [ ] Chạy Tests Before với environment cô lập và lưu receipt, không sửa controller trước baseline.
- [ ] Thêm hook characterization thiếu; mutation-check tùy chọn phải revert hoàn toàn.
- [ ] Chỉ patch nếu RED thật; review scope để tránh redo rewrite/persistence redesign.
- [ ] Chạy Tests After/full suite/lint/build, đối chiếu frontend và backend boundaries.
- [ ] Exit: evidence ghi rõ verified-existing-fix; mapping 15 IDs→test names, counts, RED hoặc characterization/mutation rationale, GREEN logs nếu patch, SHA trước/sau, clean mutation diff, không schema/data migration. Không đóng phase chỉ vì source nhìn đúng; giữ pending tới khi có execution evidence.

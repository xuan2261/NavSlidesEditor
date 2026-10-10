---
title: "Phase 03 — Settings UI giữ edit in-flight và conflict UX"
status: pending
priority: P1
depends_on: [phase-02-settings-atomic-revisions]
effort: "2–3 ngày triển khai + verification"
mode: "--deep --tdd"
---

# Phase 03 — Không mất bản nháp khi save hoặc conflict

**Status: pending. Dependency: 03 ← 02.** Chỉ lập kế hoạch; chưa chạy test. Multi-tab stale protection là yêu cầu đã chọn, không phải tùy chọn UX có thể bỏ.

## Scout đã xác minh

Đã đọc toàn bộ `SettingsPage.jsx` (620 LOC) và `SettingsPage.test.jsx` (122 LOC), CLAUDE và scripts root. Trang hiện fetch trực tiếp GET/PUT `/api/settings`, lưu toàn bộ form, chỉ disable nút Save khi saving; success `setSettings(response)` đè cả edit sau dispatch. GET fail đặt defaults và vẫn cho Save, dễ ghi đè cấu hình thật. Test hiện có kiểm tra unsaved AI test connection, labels/focus, provider→model, cancel shortcut trước Sync, và save error alert; chưa có deferred save/conflict/revision. Không có settings API helper hoặc controller hiện tại: những tên dưới đây đều là **proposed**.

## Rescout checklist

- [ ] Đọc lại phase 02; chốt strong ETag, protocol header, body flat, 428/412/400 và mask legacy; không dựa vào weak ETag tự sinh của Express.
- [ ] Tìm lại mọi `/api/settings` caller, mock fetch và tests render SettingsPage; cập nhật mock response headers giống trình duyệt thật.
- [ ] Xem các UI primitives/accessibility hiện tại trước chọn alert/dialog; phân biệt conflict settings với `conflictId` shortcut đã có.
- [ ] Kiểm tra React StrictMode/unmount behavior, timer save message, test environment và test inventory wrapper.
- [ ] Kiểm tra phase 01 regression baseline và `common-verification.md` nếu xuất hiện; không mở rộng sang rewrite shortcut/cloud sync.

## Inventory file/action/size/test impact

| File | Tình trạng / hành động | Cỡ hiện tại → delta | Tác động test |
|---|---|---|---|
| `client/src/pages/SettingsPage.jsx` | Có; tích hợp controller, dirty/status/conflict actions; giữ shortcut/AI/Sync | 620 → khoảng -40/+60 | integration và accessibility cũ |
| `client/src/pages/SettingsPage.test.jsx` | Có; mock ETag/protocol, sửa save-failure fixture thành dirty form | 122 → +20–40 | giữ 5 regression cũ |
| `client/src/hooks/use-settings-save-controller.js` | **Proposed**; base/draft/revision/request lifecycle | mới 150–195 | deferred races/unmount |
| `client/src/hooks/use-settings-save-controller.test.jsx` | **Proposed**; controlled promises/state machine | mới 150–195 | S03-01…05/09/10/13 |
| `client/src/utils/settings-draft.js` | **Proposed**; pure field-version reconciliation + secret intent | mới 90–150 | không serialize metadata vào form |
| `client/src/utils/settings-draft.test.js` | **Proposed**; nested fields và secret comparisons | mới 100–170 | S03-02/03/11 |
| `client/src/components/settings-conflict-panel.jsx` | **Proposed**; accessible review/reload actions | mới 80–140 | alert/focus/explicit discard |
| `client/src/pages/settings-conflict.test.jsx` | **Proposed**; page integration multi-client contract fixtures | mới 150–195 | S03-06…08/12 |
| `server/routes/settings-revision.test.js` | **Proposed tại phase 02**, không claim tồn tại hiện tại; đọc/reuse sau dependency | phase 03 delta 0 | real HTTP contract đối chiếu UI fixtures |

Mỗi file mới dưới 200 LOC; không chia toàn trang 620 LOC thành hàng loạt component ngoài yêu cầu. Không sửa editor autosave/history tại phase này.

## Invariants và state machine thực dụng

1. Giữ riêng `base` (snapshot server đã acknowledge), `draft` (intent hiện tại), `revision` (strong ETag), `fieldVersions`, `requestId`, trạng thái load/saving/dirty/conflict/error. Đây là thiết kế mới, không tên hàm đã tồn tại. Mỗi thay đổi field tăng version; provider tự đổi model phải đánh dấu **cả hai** field, AI nested theo leaf path.
2. GET thành công cần `Settings-Revision-Protocol: 1` và strong `ETag: "settings-<opaque>"`. Body vẫn flat; metadata không trộn vào form. GET fail hoặc thiếu contract: form không được Save; hiển thị Retry/upgrade rõ ràng. Không dùng defaults làm authoritative base khi load thất bại. Có thể xem form fallback nhưng không PUT.
3. Khi Save: chụp `sentDraft`, `sentVersions`, `sentRevision`, requestId; gửi đúng `If-Match`. Chỉ một PUT in-flight; dùng synchronous ref gate ngoài `disabled` để chặn double click cùng tick. Fields vẫn editable. Payload giữ semantics server: top-level shallow, AI merge; không gửi revision metadata hoặc sentinel như secret mới.
4. Success đúng request: cập nhật base bằng response masked và revision R2; field có version không đổi từ dispatch lấy response, field có version mới giữ draft. Dirty tính lại theo field intent, **không** `setSettings(response)` toàn bộ. Message khi còn edits: “Đã lưu bản gửi; còn thay đổi chưa lưu”, không “tất cả đã lưu”. Không tự save vòng hai; user chủ động Save với R2.
5. Secret cần intent riêng `unchanged | replace | clear`: sentinel là trạng thái configured, không secret thực. Sau success, nếu secret version không đổi thì xóa plaintext draft trong memory và chuyển unchanged/configured theo response. Nếu user nhập key mới trong khi request đang chạy, giữ đúng key mới và dirty; không so plaintext với sentinel để quyết định đã lưu. Không localStorage/sessionStorage/log hay conflict preview plaintext API key. Legacy `aiApiKey` không phải form editable; không echo giá trị mask legacy để ghi nhầm secret.
6. 412: giữ nguyên draft và base cũ, khóa Save bình thường, hiện `role=alert` “Cấu hình đã đổi ở tab khác”; **không tự retry**, không bỏ If-Match. Cung cấp “Xem bản mới” (GET mới, không PUT, không thay draft), “Bỏ bản nháp và dùng bản server” (confirm, rồi cập nhật base/draft/revision), và “Áp dụng lại thay đổi của tôi” (review rõ các field dirty lên bản mới, người dùng xác nhận rồi vẫn cần Save).
7. Review merge dùng old base/local intent/latest server; server-only fields phải được giữ. Field cả hai phía đổi yêu cầu chọn local/server; secret phía server không thể so sánh từ mask nên mọi local secret intent sau 412 phải xác nhận lại, không kết luận “không conflict” vì sentinel giống nhau. Rebase chỉ sau hành động explicit, luôn gửi token latest; tab thứ ba đổi trong lúc review → 412 lần nữa, vẫn giữ draft.
8. 428 là client/server contract mismatch: giữ draft, báo cần reload/nâng cấp, không fallback PUT không header. New UI/old server thiếu protocol → read-only; old UI/new server → 428 như phase 02. Không có “force overwrite” hoặc wildcard.
9. Network/5xx giữ draft/revision; server có thể đã commit nhưng response bị mất. Cho kiểm tra lại GET/review, không tự retry token mới. Nếu retry thủ công cùng R gặp 412 thì UX conflict thông thường. Không hứa save chưa xảy ra khi không biết.
10. Abort GET/unmount và requestId guard: response cũ/timer cũ không reset draft/status mới; cleanup timers/listeners. GET “bản mới” về sau khi người dùng gõ tiếp không đè draft. Test Connection dùng unsaved AI hiện tại như trước; shortcut localStorage và cloud modal không bị đưa vào settings revision.

## Numbered RED / GREEN / REFACTOR

1. **RED — Tests Before:** baseline SettingsPage hiện hữu; thêm deferred PUT, gõ B sau dispatch A, resolve A để tái hiện overwrite. Thêm mock HTTP 412/428 và header thiếu; assert cả DOM lẫn request count/body/If-Match, không chỉ snapshot.
2. **GREEN:** controller tối thiểu giữ base/draft và field version, precondition handshake, synchronous in-flight guard; integrate Save/dirty/load error. Pure secret intent helper để không dùng equality với mask.
3. **RED → GREEN conflict:** test giữ draft sau 412, GET latest không overwrite, confirm discard/rebase và stale lần hai; triển khai panel accessible với focus hợp lý, giữ label có sẵn.
4. **REFACTOR:** tách pure reconcile khỏi network/state hook; dọn timer/request guard; giữ mỗi helper dưới 200 LOC, không thay provider registry/shortcut flow. Không thêm optimistic auto-retry hay generic form framework.
5. **Tests After:** targeted unit+page, route contract phase 02, full suite/build/lint; rehearsal hai tab thật cùng backend + mixed-version matrix. Tests xanh sẵn trước refactor phải vẫn xanh; RED mới phải chứng minh đúng lỗi bằng assertion cụ thể.

## Ma trận 13 ca độc lập

| ID | Priority | Layer | Input / interleaving | Expected assertion |
|---|---|---|---|---|
| S03-01 | P0 | hook/page | send theme A; đổi theme B; resolve A/R2 | draft B, base A, dirty true; save tiếp If-Match R2 |
| S03-02 | P0 | pure/page | send ai.model; sửa endpoint trong PUT | model acknowledged, endpoint mới giữ; nested merge không mất field |
| S03-03 | P0 | pure/hook | gửi key A; nhập B; response sentinel | B vẫn dirty; A không còn trong base/log; nếu không edit lại thì clear plaintext |
| S03-04 | P0 | hook | double Save trước rerender | đúng 1 PUT, fields vẫn editable |
| S03-05 | P0 | hook/page | PUT network fail/5xx sau dispatch | draft/base/token giữ, alert, không tự retry |
| S03-06 | P0 | page/HTTP contract | A và B load R; A save; B save R | B thấy 412 alert; draft không đổi; không PUT lần hai |
| S03-07 | P0 | page | 412→GET latest trong khi user tiếp tục edit | latest chỉ vào review; draft mới không bị overwrite |
| S03-08 | P0 | page | explicit rebase; server-only field đổi; tab C save trước submit | payload giữ server-only field, conflict lần hai giữ draft; token không bị bỏ |
| S03-09 | P1 | hook | request/timer cũ resolve sau unmount hoặc request mới | không stale state update/status clear; cleanup xác định |
| S03-10 | P0 | page | GET fail hoặc server cũ không protocol/strong ETag | Save disabled, Retry/upgrade alert; zero PUT defaults |
| S03-11 | P0 | pure/page | secret cả hai tab đổi nhưng GET mask giống | không auto-resolve secret; review không lộ plaintext; explicit intent required |
| S03-12 | P1 | page/a11y | discard cancel/confirm bằng keyboard | cancel giữ draft; confirm dùng latest; focus/alert truy cập được |
| S03-13 | P0 | hook/page | PUT 428 hoặc malformed success thiếu R2 | giữ draft, chặn save tiếp tới resync; không báo saved toàn bộ |

## Commands — chỉ hướng dẫn, không chạy ở bước PLAN

`npm test` root đã xác minh tự refresh inventory qua `scripts/vitest/run-vitest-suite.mjs`; path proposed chỉ dùng sau khi tạo, không chạy test suite rỗng để giả evidence.

```bash
# Tests Before
npm test -- client/src/pages/SettingsPage.test.jsx
# RED/GREEN + Tests After (proposed files phải đã tồn tại)
npm test -- client/src/hooks/use-settings-save-controller.test.jsx client/src/utils/settings-draft.test.js client/src/pages/settings-conflict.test.jsx client/src/pages/SettingsPage.test.jsx
npm test -- server/routes/settings-revision.test.js server/routes/settings-merge.test.js server/routes/api-surface.test.js
npm test
npm run lint
npm run build
```

Rehearsal thủ công: hai tab GET cùng R, A đổi theme save, B đổi model save → conflict; B xem latest và rebase rõ ràng → save R2; trong PUT cuối gõ endpoint mới → endpoint còn dirty. Lặp đổi secret bằng giá trị synthetic; evidence chỉ configured/empty, không screenshots chứa secret. Kiểm tra new UI/old API read-only, old UI/new API 428. Có thể bổ sung browser automation sau rescout, không gọi một E2E file chưa tồn tại là test hiện hành.

## Rollback / data compatibility

Không migration browser storage vì draft chỉ memory. Reload để upgrade có thể mất draft nên cảnh báo và cho user giữ trang, không tự reload sau conflict. Không cung cấp export secret. Rollback UI độc lập phải giữ backend CAS; nếu UI cũ không biết token, Save bị 428 là hành vi an toàn có thông báo release. Không rollback server thành writable last-writer-wins để chữa UX. Phối hợp phase 02 release cùng bundle/API, kiểm tra cache cũ và header qua proxy trước mở writes.

## Implementation tasks và exit evidence

- [ ] Chốt contract phase 02, cập nhật mock headers và baseline 5 cases cũ.
- [ ] RED deferred save/secret/version guard; implement reconcile không overwrite edits.
- [ ] Implement load fail/read-only compatibility + 412/428 review/discard/rebase explicit.
- [ ] Giữ Test Connection/provider/shortcut/Sync behavior, kiểm tra keyboard/a11y và unmount cleanup.
- [ ] Refactor nhỏ và chạy Tests After/full regression/lint/build.
- [ ] Exit: đủ S03-01…13 gắn test names/commit/lệnh, RED→GREEN log, DOM/request assertions, manual two-tab + mixed-version receipts, không secret trong artifact; không đóng phase nếu test còn pass nhờ mock bỏ contract header. Trạng thái pending đến khi có bằng chứng triển khai.

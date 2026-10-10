---
title: "Phase 02 — Settings atomic và revision preconditions"
status: pending
priority: P1
depends_on: [phase-01-start]
effort: "2–3 ngày triển khai + bằng chứng"
mode: "--deep --tdd"
---

# Phase 02 — Settings atomic và chống stale đa tab

## Mục tiêu và hiện trạng đã xác minh

**Status: pending.** Dependency: **02 ← 01**. Người dùng đã chọn bảo vệ multi-tab; chỉ serialize ghi file là chưa đủ. Phase này lập hợp đồng server bắt buộc revision, phase 03 tiêu thụ hợp đồng đó. Chưa chạy test; đây là kế hoạch, không phải báo cáo PASS.

Đã đọc `CLAUDE.md`, `package.json`, storage, settings route và các test liên quan. `readSettings()` và `writeSettings()` hiện khóa riêng bằng `withFileLock`; route đọc–merge–ghi ngoài một critical section nên có lost update. `writeJsonAtomic()` hiện đã dùng tmp + rename, retry Windows và quyền secret 0600; không viết lại cơ chế atomic. Chưa có `withSettings` hay revision helper. GET/PUT mask `ai.apiKey` bằng `***configured***`; top-level shallow replace, riêng `ai` merge một cấp. `initDataFiles()` còn tạo trường legacy `aiApiKey`. Middleware lỗi hiện chỉ trả `{error}`, không giữ `code`.

## Rescout trước khi code

- [ ] Đọc lại phase 01 và diff mới; xác định single-process writer trong web/Electron; không tuyên bố process-local lock bảo vệ nhiều server dùng chung DATA_DIR.
- [ ] Tìm toàn repo `readSettings`, `writeSettings`, `/api/settings`, `aiApiKey`; phân loại runtime writer, fixture, reader trước khi đổi export.
- [ ] Đọc lại `server/index.js` mount/error chain, CORS/proxy và Express auto ETag; kiểm tra header qua deployment thực tế.
- [ ] Chốt tài liệu revision với phase 03 trước RED; kiểm tra reserved metadata có đụng key dữ liệu người dùng không.
- [ ] Chụp fixture legacy không metadata, secret configured/empty, unknown top-level; backup không đưa secret vào evidence.
- [ ] Kiểm tra `common-verification.md` trong thư mục plan nếu đã xuất hiện; áp dụng gate bổ sung, không chặn kế hoạch vì hiện chưa có.

## Inventory chính xác

LOC hiện tại là xấp xỉ theo scout; delta là ngân sách, không phải cam kết phải sửa. File mới ghi rõ **proposed**. Chỉ triển khai sau khi phase được giao.

| File | Tình trạng / hành động | Cỡ hiện tại → delta dự kiến | Tác động test |
|---|---|---|---|
| `server/services/storage.js` | Có; thêm transaction settings, reuse lock + atomic writer; mọi runtime writer xoay revision | 339 → +35–60 | integration real disk, lỗi ghi/lock |
| `server/routes/settings.js` | Có; GET/PUT revision, validation, lỗi có code, mask dùng chung | 59 → +35–65 | thay request cũ không precondition |
| `server/services/settings-contract.js` | **Proposed**; merge/mask/validate metadata, token parser thuần | mới 100–160 | unit contract; không giả định helper đã tồn tại |
| `server/services/settings-contract.test.js` | **Proposed**; validation, sentinel, token | mới 120–180 | S02-04/06/07/08 |
| `server/routes/settings-revision.test.js` | **Proposed**; CAS/race/rollout thực Express + storage | mới 150–195 | S02-01…05/09/10/12 |
| `server/services/settings-atomic.test.js` | **Proposed**; barrier, failure injection, restart | mới 120–190 | S02-02/10/11/13 |
| `server/routes/settings-merge.test.js` | Có; giữ 3 assertions hiện có, thêm GET→If-Match | 75 → +25–50 | không xóa regression secret |
| `server/routes/api-surface.test.js` | Có; case settings gửi header từ GET | 297 → +5–15 | cross-route regression |
| `server/services/storage.test.js` | Có; đọc/giữ nguyên, chỉ thêm assertion nếu thiếu | 143 → 0–15 | atomic và POSIX secret mode |
| `server/middleware/error-handler.js` | Có; đọc/không đổi toàn hệ thống | 24 → 0 | route tự trả lỗi contract, tránh làm rơi code |
| `client/src/pages/SettingsPage.jsx` | Có; tham chiếu contract, **sửa ở phase 03** | 620 → 0 tại phase này | phối hợp release |

File code mới giữ dưới 200 LOC theo CLAUDE; không lợi dụng phase này để chia toàn bộ storage cũ.

## Hợp đồng đề xuất và invariants

1. Dữ liệu settings vẫn flat, giữ unknown keys; thêm metadata nội bộ `_settingsRevision` là token ngẫu nhiên opaque, không hash secret. Không dùng hash JSON đã mask: đổi secret A→B vẫn phải đổi revision dù body công khai giống nhau. Không dùng hash plaintext làm oracle đoán secret.
2. GET trả body flat tương thích, loại metadata nội bộ, mask cả `ai.apiKey` lẫn `aiApiKey` legacy nếu có. Trả **strong `ETag: "settings-<opaque>"`**, `Cache-Control: no-store`, `Settings-Revision-Protocol: 1`. PUT thành công trả cùng shape + header revision mới. Explicit ETag phải thắng Express auto-generated weak ETag; kiểm tra proxy không strip header. Same-origin hiện tại; deployment cross-origin phải expose ETag/protocol và allow If-Match trước enable write.
3. PUT bắt buộc đúng một strong `If-Match` do GET/PUT trước đó cấp. Thiếu → **428**, `{code:'SETTINGS_PRECONDITION_REQUIRED', error:...}`; token hợp lệ nhưng cũ → **412**, `SETTINGS_REVISION_CONFLICT`; malformed/weak/list/wildcard → **400**, `SETTINGS_INVALID_PRECONDITION`. Không nhận `*`, không fallback header→body, không tự fetch revision rồi ghi hộ client.
4. Đọc latest → so token → validate/merge → sinh token → persist → trả masked snapshot phải ở **một** settings critical section. Không gọi `readSettings`/`writeSettings` khóa lại cùng file bên trong lock. Hai PUT cùng revision: đúng một 200, một 412; kể cả sửa hai trường khác nhau cũng không silently merge stale intent.
5. Mỗi PUT được chấp nhận xoay token kể cả no-op, đơn giản hóa CAS. Failure trước rename không đổi data/token. Failure sau rename (ví dụ chmod cuối) có thể commit nhưng trả lỗi: không hứa rollback giả; GET mới là authority, retry token cũ bị 412. Lock luôn release sau reject/throw.
6. Omitted `ai.apiKey` hoặc sentinel giữ secret; chuỗi rỗng là xóa chủ động; chuỗi mới thay secret. Không ghi sentinel thành secret. `ai` null/array và body array/null bị 400 thay vì normalize lặng lẽ. Unknown top-level vẫn giữ hợp đồng shallow; reserved metadata trong body bị 400. Legacy `aiApiKey` cũng cần sentinel/empty semantics an toàn, không tự di chuyển schema AI trong phase này.
7. Legacy file chưa token: khởi tạo token một lần dưới lock, persist cùng file trước khi GET phát token. Hai GET bootstrap nhận cùng token; restart không reset. File JSON hỏng hoặc metadata sai kiểu: báo lỗi, không reset về defaults và không ghi đè. Backup/restore data phải bảo toàn metadata hoặc cấp epoch mới offline để vô hiệu token cũ.
8. `writeSettings` dùng cho trusted internal/fixture không là HTTP bypass: audit caller; mỗi ghi đều cấp token mới, không cho input tự đặt metadata. Route chỉ đi qua CAS transaction. Giới hạn hỗ trợ single writer process phải được ghi rõ; multi-process sharing cần gate triển khai riêng, không được quảng cáo đã giải quyết.
9. Không log request body, secret hoặc raw diff; lỗi contract trả trực tiếp trong route để giữ `code`, không thay global middleware ngoài scope. 412 không cần mang bản settings mới: UI GET mới có mask và token.

## Rollout tương thích — không silent bypass

- Schema additive, response body vẫn flat. **Không có giai đoạn server chấp nhận PUT thiếu If-Match.** Phase 02 và 03 ship cùng release; nếu server mới lên trước, client cũ GET được nhưng Save nhận 428 rõ ràng, cần reload/upgrade.
- Client mới gặp server cũ thiếu protocol/strong ETag: đọc được nhưng **khóa Save**, thông báo server cần nâng cấp; không coi Express weak ETag là support CAS. Pair compatibility: old/old chỉ baseline không được dùng làm release evidence; old/new fail closed 428; new/old read-only; new/new CAS.
- Rollback ưu tiên giữ backend enforce revision, chỉ rollback UI với write disabled. Không downgrade backend writable về bản không CAS. Nếu buộc khôi phục full release: maintenance/read-only, backup settings, giữ token metadata, xác minh format rồi mới mở ghi với build tương thích. Không xóa token để né conflict, không restore secret fixture vào production.

## TDD: Tests Before / Refactor / Tests After

1. **RED — Tests Before:** chạy baseline các test có sẵn; thêm deferred barrier để A giữ commit, B đã gửi cùng revision. Chứng minh test mới fail vì thiếu precondition/transaction, không vì mock sai CJS hay sai environment. Thiết lập temp DATA_DIR trước import; teardown env/cache/fs trong finally.
2. **GREEN:** triển khai token persisted và CAS storage nhỏ nhất; giữ atomic writer hiện tại; cập nhật route, mask, structured errors và fixtures GET→PUT. Thêm failure injection tại writeJson/rename, không mock mất behavior lock cần chứng minh.
3. **REFACTOR:** gom thuần merge/mask/parse vào proposed contract file, kiểm tra không recursive lock; giữ contract IDs. Tách test theo layer <200 LOC/file; không đổi shape response thành envelope.
4. **Tests After:** chạy targeted mới/cũ, cross-route/AI/storage, full suite, lint/build; thực nghiệm hai tab và API-client cũ/new server. Ghi fail/pass/skip riêng, không coi POSIX skip trên Windows là mode evidence.

## Ma trận kiểm thử (13 case, ID duy nhất)

| ID | Ưu tiên | Layer | Input / interleaving | Expected assertion |
|---|---|---|---|---|
| S02-01 | P0 | HTTP | GET R; PUT If-Match R | 200, body mask, R2 khác R, disk data tương ứng R2 |
| S02-02 | P0 | HTTP + disk | A/B cùng R, barrier trước A commit | đúng một 200/412, không mixed snapshot; loser không đổi file |
| S02-03 | P0 | HTTP | old client PUT không header | 428 + code, bytes/token không đổi |
| S02-04 | P0 | contract/HTTP | weak, wildcard, list, malformed token | 400, không gọi persistence |
| S02-05 | P0 | HTTP | client stale R sau restart server với R2 | 412; restart không reset token |
| S02-06 | P0 | contract | omit/sentinel/empty/new ai key | giữ/giữ/xóa/thay chính xác; response không lộ secret |
| S02-07 | P1 | contract | shallow unknown key + partial ai | top-level replace, ai subkey chưa gửi vẫn giữ |
| S02-08 | P1 | HTTP | array/null ai, reserved metadata injection | 400, token và dữ liệu bất biến |
| S02-09 | P0 | HTTP | secret A→B, public body mask giống nhau | ETag đổi, R cũ bị 412; không raw/hash secret trong header/body |
| S02-10 | P0 | disk | rename fail trước commit rồi PUT khác | file/token cũ nguyên vẹn, tmp cleanup, lock không kẹt |
| S02-11 | P1 | disk | hai GET file legacy chưa token | cùng token persisted, legacy key mask, quyền POSIX 0600 |
| S02-12 | P1 | HTTP | no-op PUT + proxy/Express headers | R đổi, strong ETag/protocol/no-store đủ; old client không bypass |
| S02-13 | P0 | disk/HTTP | lỗi sau rename rồi client đọc lại | GET thấy commit/token mới hoặc state authority xác định; không ghi lại với stale R |

## Lệnh thực thi sau này — không chạy trong lượt lập kế hoạch

Root scripts đã xác minh. `npm test` gọi `scripts/vitest/run-vitest-suite.mjs`, **tự refresh test inventory trước mỗi run**, rồi `vitest run` với paths; không cần chạy inventory riêng chỉ để thấy file mới. Nếu inventory lỗi phải sửa nguyên nhân, không bỏ wrapper.

```bash
# Tests Before — paths có thật
npm test -- server/routes/settings-merge.test.js server/routes/api-surface.test.js server/services/storage.test.js
# RED/GREEN/Tests After — ba path mới chỉ dùng sau khi tạo
npm test -- server/services/settings-contract.test.js server/routes/settings-revision.test.js server/services/settings-atomic.test.js
npm test -- server/routes/settings-merge.test.js server/routes/api-surface.test.js server/services/storage.test.js server/routes/ai.test.js
npm test
npm run lint
npm run build
```

Build sinh client/dist/manifest; kiểm tra diff, không commit artifact ngoài policy phase 01. `npm run format` sửa toàn repo nên không dùng làm verification.

## Implementation checklist và exit evidence

- [ ] Rescout writers/schema/deployment và ký contract với phase 03.
- [ ] Thêm RED có barrier, snapshot disk/token trước/sau, test legacy mask.
- [ ] Implement storage CAS + route precondition + compatibility gate; giữ atomic write hiện hữu.
- [ ] Refactor nhỏ, cập nhật mọi test PUT đã tìm thấy để lấy revision thật, không hardcode token.
- [ ] Chạy Tests After, lint/build/full regression và rehearsal rollout/rollback.
- [ ] Exit: mapping đủ S02-01…13 → tên test/lệnh/commit; log RED đúng nguyên nhân rồi GREEN, platform và skips, diff audit không lộ secret, biên bản matrix old/new client-server và xác nhận hai-tab chỉ một writer thắng. Phase vẫn pending đến khi có evidence thật.

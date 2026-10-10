---
phase: 15
title: "Documentation drift và contract truth"
status: "blocked: upstream qualification open; current machine facts and edited docs build passed"
priority: P2
effort: ""
dependencies: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14]
---

# Phase 15: Documentation drift và contract truth

## Goal
Tài liệu tiếng Anh/Việt, kiến trúc và claim phát hành khớp executable owners; chỉ tự động kiểm tra các sự thật máy đọc được.

## Context và bằng chứng
CLAUDE.md:7 workspace electron trái package.json:12–17 website. README reveal 6.0.1 drift theo attachment; scout thêm README_vi/TipTap drift cần đối chiếu manifests, không auto replace số theo report cũ. Runtime pins ở runtime-versions.json.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [02](phase-02-settings-atomic-revision.md), [03](phase-03-settings-ui-draft.md), [04](phase-04-ci-required-summary.md), [05](phase-05-scanner-evidence.md), [06](phase-06-history-autosave.md), [07](phase-07-pptx-publication.md), [08](phase-08-pptx-concurrency.md), [09](phase-09-pptx-recovery.md), [10](phase-10-pptx-portable.md), [11](phase-11-container-runtime.md), [12](phase-12-windows-office-qualification.md), [14](phase-14-navigator-optimization.md).

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Modify | `C:/Work/NavSlidesEditor/README.md` | runtime/version/workspace/fidelity claims |
| Modify | `C:/Work/NavSlidesEditor/README_vi.md` | đồng bộ cùng facts tiếng Việt |
| Modify | `C:/Work/NavSlidesEditor/CLAUDE.md` | sửa factual workspace description, không đổi philosophy |
| Modify | `C:/Work/NavSlidesEditor/docs/export-fidelity-and-limits.md` | three export modes + portability/recovery limits |
| Modify | `C:/Work/NavSlidesEditor/docs/system-architecture.md` | atomic settings/revisions và publication boundaries |
| Modify | `C:/Work/NavSlidesEditor/docs/deployment-guide.md` | single operator, external dependencies, qualification runbook |
| Modify | `C:/Work/NavSlidesEditor/docs/project-changelog.md` | verified outcomes đúng SHA, chưa release |
| Create | `C:/Work/NavSlidesEditor/scripts/verify-documentation-facts.mjs` | machine facts verifier/CLI |
| Create | `C:/Work/NavSlidesEditor/scripts/verify-documentation-facts.test.js` | semantic mismatch tests |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Lập facts catalog: root version/workspace từ package.json, reveal runtime từ owner manifest/vendor output, runtime browser/Node/TipTap pins từ runtime-versions.json và actual manifests, element count từ ELEMENT_DEFAULTS. Không hardcode cả prose vào snapshot tests.
2. Chỉ cập nhật factual context/workspace claim; không tự thay project principles hoặc product strategy. README_vi phải đồng bộ, website pages có cùng claim được tìm/ghi inventory trước sửa.
3. Đưa machine facts vào small marked data/table hoặc link canonical owner; CLI parse semantic facts và so owner. Mutated fixture wrong version/workspace/asset/element count phải fail; đổi prose không liên quan phải pass.
4. Gắn verifier vào existing CI quality gate chỉ khi command chạy thực, cập nhật package scripts và workflow owner một lần ở integration owner. Không test source string contains raw path thay runtime existence/digest checks.
5. Phân biệt live presenting vs collaborative editing, self-hosted vs offline functions, Host/Origin/CORS vs authorization, trusted HTML vs untrusted isolation, atomic rename vs multi-file transaction. Không claim public exposure finding thiếu evidence.
6. Ghi history verified/fixed chính xác; corpus chỉ fixture evidence; Windows policy configured khác qualified/released. Docs trước final qualification ghi pending, phase 16 append report links không biến code SHA đã kiểm chứng thành source khác mà không requalify shipped change.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P15-01 | H | Manifest version/workspace thay nhưng docs facts cũ | Verifier nonzero |
| P15-02 | H | Reveal/vendor/runtime asset thiếu hoặc pin drift | Fail facts/closure, không silently patch docs theo sai source |
| P15-03 | H | Element count canonical thay | Fail semantic count |
| P15-04 | M | Prose/nội dung ví dụ đổi không ảnh hưởng fact | Verifier vẫn pass |
| P15-05 | H | README tiếng Việt khác canonical facts | Flag đúng vị trí |
| P15-06 | H | Report historical/current claims | Không transplant coverage/scan/corpus sang new SHA |
| P15-07 | H | PPTX modes mô tả availability | Edited reject không quảng cáo fallback/lossless |
| P15-08 | H | Release pending thiếu signing/Office | Docs không ghi qualified/released |
| P15-09 | M | External AI/sync khi offline | Nêu dependency, không claim mọi chức năng offline |
| P15-10 | M | File context factual fix | Không đổi convention/philosophy ngoài yêu cầu |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npx vitest run scripts/verify-documentation-facts.test.js client/src/data/element-defaults.test.js
node scripts/verify-documentation-facts.mjs
npm run docs:build
```

## Runtime smoke bắt buộc
Chạy verifier CLI trên facts thật và temporary mismatched fixture; mở docs build/Markdown links, kiểm tra EN/VI runtime tables và export limits. Không gọi prose snapshot là behavioral regression.

## Deliverables / checklist
- [x] 15.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [x] 15.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [x] 15.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [x] 15.4 Focused regression và runtime smoke đạt, receipt gắn SHA/artifact/fixture identity (`scripts/verify-documentation-facts.test.js`, `scripts/verify-documentation-facts.mjs`).
- [x] 15.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

Execution: Đã xác minh catalog sự thật máy đọc (`verify-documentation-facts.mjs`) kiểm tra version (1.17.0), workspaces (server,client,shared,website), node.minimum (22.13.0), reveal (6.0.2), tiptap (3.31.3), canonical elements (19). Đã đồng bộ hoàn toàn giữa README.md và README_vi.md, cập nhật mô tả workspaces trong CLAUDE.md. Đã chuẩn hóa 3 chế độ export (Portable `.navslides.json`, Immutable Original PPTX, Validated Edited PPTX) trong `docs/export-fidelity-and-limits.md`. Đã cập nhật draft notes trong `docs/project-changelog.md` cho Phase 14 và Phase 15. Tests `verify-documentation-facts.test.js` và `element-defaults.test.js` đạt 32/32 tests GREEN; `npm run docs:build` hoàn tất thành công; runtime closure verify `npm run runtime:verify` đạt 100% (1,672 vendor files, client artifact identity matched).

## Exit gate
Machine facts đồng bộ, semantic drift gate fail đúng negative fixture; claims có source/evidence trạng thái. Không ghi release-ready trước phase 16.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
CI gate phải tránh regex brittle trên mọi prose; chỉ nhỏ facts catalog có owner rõ. Docs là artifact, không thay qualification.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.

---
title: "Phase 05 — Scanner evidence fail-closed và CVE triage"
status: pending
priority: P0
dependencies: [phase-04]
---

# Phase 05 — Scanner evidence fail-closed và CVE triage

## Mục tiêu, scout và inventory

PLAN-only, chưa chạy scanner/test/build, chưa sửa policy hoặc lock. Phase 04 phải bảo đảm scan không skipped mà summary vẫn green. Giữ policy HIGH/CRITICAL, `ignore-unfixed: false`, Linux/container và Windows NSIS/portable với mọi signing/physical gate. Không làm báo cáo sạch giả để vượt gate.

| File đã đọc / đề xuất | Dòng / byte hiện hữu | Impact dự kiến |
|---|---:|---|
| `scripts/verify-container-supply-chain.js` | 117 / 4365 | Validate schema, scope và binding trước khi đếm CVE |
| `scripts/verify-container-supply-chain.test.js` | 106 / 3832 | Thay happy path giả bằng capture thật, thêm mutations |
| `tests/unit/container-supply-chain-workflow-contract.test.js` | 40 / 1958 | Giữ pins và nguồn artifact; thêm fail-closed contract |
| `.github/workflows/reusable-container-supply-chain.yml` | 44 / 3026 | Thu metadata scanner/DB, image và receipt source |
| `config/container-vulnerability-policy.json` | 5 / 87 | HIGH/CRITICAL; exceptions hiện rỗng, không tự sửa |
| `.github/workflows/electron-server-lock-refresh.yml` | 64 / 2970 | Resolution riêng, yêu cầu approval; không coi workflow tồn tại là phép chạy |
| `scripts/ci/release-receipt-workflow.mjs` | 199 / 7849 | Consumer đang hash receipt file; phối hợp phase 12 validate trước hash |
| `scripts/container-scan-evidence.js` (mới đề xuất) | Chưa tồn tại; 100–180 dòng | Validator tách nếu cần giữ code dưới 200 LOC |
| `tests/fixtures/container-supply-chain/` (mới đề xuất) | Chưa có capture được xác minh; dự kiến 4–8 file, size đo khi capture | Raw Trivy/Syft/browser/metadata, manifest provenance; không ước lượng như số đã đo |

Gap tĩnh: `(report?.Results ?? [])` và `(result.Vulnerabilities ?? [])` biến thiếu evidence thành zero CVE. SBOM chỉ kiểm tra tên format và nonempty inventory. Exception hiện chỉ match CVE và optional package, chưa bind target/version. Test hiện tạo `{SchemaVersion: 2, Results: []}` và package đơn: đây là unit scaffolding, không chứng minh image scan sạch. Workflow pin Syft v1.52.0 và Trivy v0.74.0; Trivy exit-code 0 có chủ ý để verifier quyết định vulnerability policy, không phải bằng chứng scan thành công.

## Hợp đồng evidence đề xuất (chưa implementation)

1. Parse đúng top-level object/schema Trivy của version pin. Validate Metadata, Results array, class/type/target và mọi finding: CVE ID, package, installed version, severity enum; field optional phải theo output thật, không tự bắt tool sinh field không có. Missing/null/malformed khác `Vulnerabilities` vắng hợp lệ trên target scan sạch: chỉ chấp nhận latter nếu schema/tool capture chứng minh cùng target inventory đầy đủ.
2. Không coi `Results: []` tự động sạch. Image này có OS và application inventory; phải chứng minh scan coverage OS/application với capture thực. Schema variant mới hoặc inventory thiếu => fail/blocked, không fallback [] hay downgrade severity. Nếu scan thật có findings, positive parser test kiểm tra parse được nhưng qualification vẫn reject đúng policy.
3. Tool run metadata sidecar: scanner/SBOM versions, flags, started/completed, exit code, DB update/download metadata theo khả năng tool thật; nguồn run ID/attempt, subject SHA, artifact ID/name, raw file SHA256. Thiếu khả năng chứng minh freshness => blocked để định nghĩa freshness threshold có review, không bịa timestamp. Tool exit 0 không thay schema validation.
4. Receipt chỉ xuất passed sau schema + scope + image + policy + CVE checks. Ghi policy hash, raw report/SBOM/browser hashes và validator version; phân biệt hash raw bytes với canonical JSON hash hiện tại. Có version migration rõ ràng; không âm thầm đổi ý nghĩa field cũ. CLI lỗi phải không để receipt passed cũ bị consumer đọc nhầm: test output tồn tại trước run.
5. Namespace digest: `docker image inspect ... {{.Id}}` là **image config digest**, không registry manifest/index digest. `docker-image-digest.txt` từ artifact qualification là expected config digest; `actual-image-digest.txt` từ image sau docker load là actual. Trivy `Metadata.ImageID` đối chiếu theo schema thật cùng config namespace. Registry `RepoDigests` chỉ so cùng namespace khi có; không bắt image local chưa push có registry digest, không so config với registry. SHA256 image tar dùng attestation là namespace thứ ba.
6. SBOM source image identity, target inventory và browser Playwright 1.63.0 / Chromium revision 1243 phải gắn đúng image; đường executable phải có trong container như workflow capture. Không chỉ tin filename hoặc hai string digest do caller đưa tùy ý.

## CVE triage và lock-refresh: quyết định có kiểm soát

- [ ] Mỗi finding lưu CVE/package/installed/fixed version, target/layer, severity nguồn, advisory, image digest, reachability đánh giá riêng, owner, phương án và ngày review. Không có fixed version vẫn bị HIGH/CRITICAL gate theo policy.
- [ ] Ưu tiên patch base image/dependency; không xóa package khỏi report, giảm severity, tăng ignore hay bớt target để green. Unknown/malformed severity phải reject, không rơi ngoài filter.
- [ ] Exception nếu thật sự cần phải được người có thẩm quyền duyệt riêng, scope exact CVE + package + version + target, reason/owner/expiry; hết hạn hoặc rộng mơ hồ => reject. Không tự thêm exception; current empty exceptions vẫn là baseline.
- [ ] `npm run electron:lock` mặc định metadata-only khác `npm run electron:lock -- --resolve`. Resolve tải/chọn dependency mới cần explicit permission, kể cả schedule workflow đang có. Workspace lock refresh và `npm audit fix` cũng không tự chạy. Sau approved resolve phải review lock diff, prepare-electron, audit và full qualification lại.
- [ ] Workflow lock có contents/PR write và force-push branch ổn định; settings cho GITHUB_TOKEN tạo PR, PAT/App, privileges hoặc dispatch phải approval riêng. Nếu không được phép thì blocked và nêu phương án manual được review, không workaround bằng tăng quyền.

## Re-scout → RED → GREEN → Refactor

- [ ] Re-read workflow docker/scan, verifier/tests, actual policy và tool output schema; ghi HEAD, versions, sizes. Tìm capture thật đã có trước; nếu không có, yêu cầu approved capture trên exact image, chưa có fixture thì blocked cho positive integration.
- [ ] RED: thêm cases dưới đây trước sửa validator; fixture raw output có source URL/run/attempt, command/version/digest, hash manifest. Negative fixture là mutation có nhãn của raw capture, không trình bày là output tool thật.
- [ ] GREEN tối thiểu: schema guards + identity/coverage checks, rồi exact scoped exception validation; không nâng tool versions đồng thời trừ khi triage chứng minh cần và được duyệt.
- [ ] Refactor: tách validator thuần khỏi CLI/I/O nếu vượt 200 LOC, giữ error codes ổn định và deterministic clock cho expiry/freshness tests.

| ID | Layer / severity | Setup / thao tác | Expected / oracle |
|---|---|---|---|
| S05-01 | parser integration / P0 | Raw output Trivy/Syft thật của exact image | Parse đúng; qualification outcome bằng CVE policy thực, không mặc định pass |
| S05-02 | unit / P0 | Report undefined, null, {}, missing Results | Reject evidence thiếu |
| S05-03 | CLI / P0 | JSON truncated, sai schema/version/type | Exit != 0, không passed receipt |
| S05-04 | unit / P0 | Results [] hoặc thiếu OS/app target trên image có inventory | Reject coverage thiếu |
| S05-05 | unit / P0 | Finding thiếu severity/package/version hoặc severity lạ | Reject schema, không zero CVE |
| S05-06 | policy / P0 | HIGH và CRITICAL thật, có/không fixed version | Fail khi không có approved exact exception |
| S05-07 | policy / P0 | Exception expired, sai package/version/target | Reject; fake clock xác nhận boundary expiry |
| S05-08 | policy / P0 | Exception exact được duyệt trong fixture, còn hạn | Chỉ finding đúng scope được miễn; policy production không tự đổi |
| S05-09 | image integration / P0 | Config digest scan khác saved-image config | Fail binding dù report không CVE |
| S05-10 | identity / P0 | Registry digest hợp lệ khác config; local image không RepoDigests | Không so chéo namespace; config vẫn bắt buộc |
| S05-11 | SBOM/browser / P0 | Empty inventory, image sai, browser revision/path drift | Reject từng mutation, nguồn docker capture là oracle |
| S05-12 | CLI / P0 | Scanner lỗi/DB evidence thiếu hoặc quá hạn theo rule đã duyệt | Failed/blocked, tuyệt đối không passed |
| S05-13 | receipt integration / P0 | Receipt passed cũ tồn tại, run mới malformed | Consumer không chấp nhận file cũ; output invalidated/atomic |
| S05-14 | provenance / P0 | Artifact run/attempt/SHA sai, raw file bị sửa sau receipt | Reject hash/source; không chỉ tin artifact name |

## Tests After — lệnh dự kiến, không thực thi ở PLAN

```bash
npx vitest run scripts/verify-container-supply-chain.test.js tests/unit/container-supply-chain-workflow-contract.test.js
npx eslint scripts/verify-container-supply-chain.js scripts/verify-container-supply-chain.test.js tests/unit/container-supply-chain-workflow-contract.test.js
node scripts/verify-container-supply-chain.js --policy config/container-vulnerability-policy.json --report container-trivy.json --sbom container-sbom.spdx.json --browser container-browser-inventory.json --image-digest actual-image-digest.txt --expected-image-digest "$(cat container-evidence/docker-image-digest.txt)" --playwright-version 1.63.0 --chromium-revision 1243 --out container-supply-chain-receipt.json
npm run lint
npm run build
npm run test
npm run test:coverage
```

CLI trên là invocation thật hiện có trong workflow, chỉ chạy ở staged evidence directory chứa output thật; không tự tạo file clean để chạy. Nếu thêm sidecar flags phải cập nhật command contract ở RED trước. Runtime smoke không thay scan exact-image; scan pass không thay release qualification. Release phải rescan cùng saved image, đối chiếu receipt mới với source run và đưa vào DAG phase 12.

## Exit và rollback

- [ ] Cases có RED/GREEN, focused/full gates có logs; missing scanner/DB/network/runner => blocked, không pass.
- [ ] Triage unresolved HIGH/CRITICAL giữ release blocked; không được ghi “đã sạch” từ synthetic fixture.
- [ ] Rollback chỉ code change hẹp sau review; giữ evidence lỗi để điều tra, không phục hồi verifier permissive thành đường publish. Patch image/lock tạo subject mới, phải qualify lại.
- [ ] Handoff phase 12 schema/version, namespace map, provenance receipt source, CVE register và danh sách approval chưa có.

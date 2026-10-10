---
phase: 14
title: 'Sandbox HTML và Download portable không phụ thuộc mạng'
status: in_progress
priority: P1
dependencies: [4, 5, 6, 7, 8, 9, 10, 11, 13]
---

# Phase 14 — Sandbox và portable HTML

## Execution progress

Sandbox/portable closure implementation đã có. Actual native archive/import smoke giữ exact media bytes khi originals unavailable; archive publication receipt: `.playwright/native-media-smoke/publication-proof.json` trong worktree. Integration-owner observation của imported portable file với denied network đã load nested native images và có empty socket list; chưa là final per-cell file receipt. Bounded smoke không đóng full closure/isolation/CSP/provider/size-limit hoặc all-game/plugin/simulation surfaces. Plugin-boundary journeys đã được báo cáo riêng, không phải release receipts. Cần final actual file và Electron/package receipts đúng subject theo checklist; [root progress](./plan.md#execution-progress) giữ qualification open.

## Goal

Giữ HTML do tác giả viết có thể chạy script trong iframe cách ly; Download tạo tài liệu file:// thực sự chơi được, hoặc thất bại có chẩn đoán tài nguyên cụ thể.
Không đổi 19 canonical element types, không biến local classroom mode thành multiplayer offline và không sửa nội dung HTML người dùng bằng migration.

## Context/evidence

- Hợp đồng cố định: `reports/execution-contracts.md:18-26,29-43`; đọc lại trước khi triển khai.
- Canvas dùng `srcDoc` với quyền same-origin tại `client/src/components/canvas/canvas-element-wrapper.jsx:622-634`; đây là lỗ hổng isolation cần sửa.
- `shared/src/element-renderers.js:357-383` có ba đường authored HTML: PDF blob, Mermaid srcdoc, HTML data URL. Data URL đã opaque-origin; không được tuyên bố nó mặc nhiên có quyền top document.
- `shared/src/htmlGenerator.js:744-749` khởi tạo PDF blob; sửa renderer nhưng bỏ qua bước khởi tạo vẫn chưa chứng minh an toàn.
- `client/src/utils/offlineExport.js:189-260,368-408,457-470` đã xử lý iframe static; thiếu closure tổng quát, không phải chưa hỗ trợ iframe.
- Fetch external đang best-effort tại `client/src/utils/offlineExport.js:38-62,551-555`; normal Download chưa portable tại `client/src/hooks/use-export-actions.js:192-214`.
- Plugin canvas kiểm tra source nhưng không nonce/schema tại `client/src/plugins/plugin-sandbox.jsx:46-71`; export bridge chỉ xử lý ready tại `shared/src/htmlGenerator.js:165-192`.
- Nested STEM embed cấp thêm quyền tại `client/src/utils/stem-embed-presets.js:47-65`; modal đã nhận diện online-only tại `client/src/components/stem-simulation-preset-modal.jsx:45-51`.
- Electron CSP cố ý không cho dynamic evaluation: `electron/content-security-policy.js:3-15`; không thêm unsafe-eval để cứu runtime.
- Đọc thêm `research/sandbox-offline-research.md:31-43`: origin/base/CORS/CSP là lớp khác nhau; sandbox không tự chặn network/exfiltration.
- Compatibility/helper UI và Apply có sẵn tại `client/src/components/HtmlEditorModal.jsx:55-74`; `use-element-creation.js:227-244` hiện commit content/Mermaid riêng, phải persist dependency/network metadata cùng transaction.

## Deep scout gate

- Re-glob/re-grep từng path/symbol trên; trace canvas → renderer → generated HTML → offline rewrite → iframe cuối cùng.
- Liệt kê thêm iframe builders thực tế, PDF capture và plugin assets; ghi file:line, src/base resolution và effective permissions của mỗi nhánh.
- Trace Download callers: `use-export-actions.js:192-214`, `generateHTML.js:16-17`, `shared/src/htmlGenerator.js:518-527`, ribbon file menu và project archive export.
- Xác nhận những caller đã tồn tại: `TransitionPreview.jsx:64`, `export-project.js:160-164`; preview vẫn strict, archive không được quảng cáo HTML portable nếu attachment thất bại.
- Chụp RED trên fixture riêng trước sửa; không dùng kết quả 246 tests cũ làm baseline của file:// hoặc sandbox.
- Phụ thuộc chỉ mở khi phases 04–13 đã bàn giao runtime/capabilities; integration owner độc quyền sửa shared chokepoints tuần tự.

## Requirements

- Sandbox mặc định chính xác `allow-scripts`: không same-origin, top navigation, forms, popups; áp dụng canvas, Mermaid, export, HTML forPrint và offline blob/srcdoc. Built-in PDF viewer mở PDF thật là surface khác, kiểm compatibility riêng.
- Script nội bộ vẫn chạy; parent DOM/storage và Electron APIs không tiếp cận được. Nested iframe không được thoát restriction của ancestor.
- Mỗi embed có network capability rõ: local mặc định không network qua per-embed CSP; hosted network-dependent simulation chỉ dùng dependency/origin declarations và thông báo compatibility, không hứa chống exfiltration bằng sandbox token.
- Plugin messages phải khớp `event.source`, token theo instance/document generation, hướng message và schema giới hạn; không dựa riêng vào origin `null`.
- Migrate BOTH hosts and shipped Animated Counter peer atomically: trusted parent sends schema-valid init on iframe load; peer accepts only event.source===window.parent, binds the fresh document token, echoes it on ready/update-data and validates all later parent messages against source/token/direction/schema. Reload rotates token; no tokenless update-data compatibility path. Fresh scout identifies/rebuilds source if sandbox.html is generated.
- Static closure gồm nested src/srcdoc/data HTML, CSS @import/url, scripts, fonts, images/srcset, audio/video/source/track/poster, question media và plugin asset tree.
- Editable archives need the SAME native media discovery/restoration closure: schema-driven question/option/matching images, memory/flashcard sides and authored layout media must travel as actual bytes and get new upload URLs on import. HTML-only closure is not editable-project roundtrip proof.
- Dynamic assets builtins có manifest hữu hạn; undeclared fetch/script/worker/socket hoặc arbitrary network yêu cầu portable validation thất bại, không xuất file hỏng rồi báo success.
- Download HTML dùng một portable pipeline; Share/hosted URL là lựa chọn online riêng, không tải nhầm hosted-document dưới tên portable.
- Thông báo compatibility cho authored HTML cần parent DOM/storage/online APIs; không âm thầm thêm quyền, bỏ script hay thay content.

## Architecture/contracts

Data vào: deck JSON đã chuẩn hóa → generated Reveal HTML + dependency declarations → graph tài nguyên → fetch/verify/inline → standalone HTML + receipt hoặc structured errors.
Graph node lưu URL canonical theo base của document/CSS, MIME, byte size và reference chain; deduplicate bằng URL, phát hiện vòng lặp và giới hạn depth/bytes có báo lỗi.
Srcdoc opaque vẫn resolve relative URL theo parent base; classic script, fetch/font/module có CSP/CORS khác nhau, xác minh từng asset thay vì suy luận mọi /vendor đều lỗi.
Portable ưu tiên inline packaged JS/CSS; Electron policy hiện chặn data: script và data:/blob: stylesheet. Không blanket đổi mọi resource thành data URL hoặc nới CSP.
Đóng JSON/bootstrap/script/style theo đúng HTML context, escape ký tự < trong JSON; safe serializer phải xử lý closing tags mixed-case, không dựa chỉ esbuild escaping.
Parser DOM/CSS xử lý cấu trúc; không kéo dài regex iframe hiện tại để đoán HTML lồng nhau. Không thực thi user JS trong exporter để tìm tài nguyên.
Scripted arbitrary HTML cần khai báo dependency contract/khả năng offline; thiếu khai báo không được chứng nhận portable chỉ vì static scan sạch.
Manifest builtins nêu resource list và dynamic capability; tài nguyên local được rewrite bằng URL đã embed, không nối lại localhost từ file://.
Offline local mount không tạo Socket.IO/WebSocket/HTTP bootstrap; live-only controls hiện lý do và local alternative đã hỗ trợ, không reconnect loop.
Local answers có thể đọc trong file; đó không phải secrecy guarantee. Public question boundary03 và audience serializer04 giữ Live HTML public;12/13 hoàn tất typed authority/player projection. Tuyệt đối không nhúng host capability vào file.
Plugin bridge giữ token trong lifetime của iframe; remount/reload đổi token, destroy gỡ listeners và revoke blob URLs; sibling frame không sửa được pluginData.
One proposed shared `game-media-references.js` traverses validated native schema fields through parent/vertical/layout authored config; returns explicit media paths/URLs and rewrites those same references from a URL map. Archive manifest discovery, client restoration, server import and native portable config rewriting consume it; preserve existing ordinary media/background behavior and never execute arbitrary HTML/JS.
Không đặt network proxy server mới để vượt CORS; lỗi cross-origin yêu cầu upload/local asset hoặc hosted Share, bảo toàn trust boundary.

## File inventory

Mọi CREATE sau đây là đề xuất, chưa có trên baseline; production module mới <200 LOC, shared contracts đặt dưới shared/.

| Full path                                                                          | Operation / trạng thái | Owner, kích thước và tác động test                                                                                            |
| ---------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| C:/Work/NavSlidesEditor/shared/src/education/html-sandbox-policy.js                | CREATE / proposed      | Security owner; policy/document metadata <200 LOC                                                                             |
| C:/Work/NavSlidesEditor/shared/src/education/plugin-message-contract.js            | CREATE / proposed      | Security owner; message validator <200 LOC                                                                                    |
| C:/Work/NavSlidesEditor/shared/src/education/portable-resource-contract.js         | CREATE / proposed      | Portable owner; manifest/errors/bounds <200 LOC                                                                               |
| C:/Work/NavSlidesEditor/shared/src/education/game-media-references.js              | CREATE / proposed      | Shared owner14; schema-driven native media enumeration/remapping, <200 LOC; not a second config normalizer                    |
| C:/Work/NavSlidesEditor/shared/src/index.js                                        | MODIFY / known         | Integration owner; shared media traversal export for client/server consumers                                                  |
| C:/Work/NavSlidesEditor/client/src/utils/portable-resource-graph.js                | CREATE / proposed      | Portable owner; browser parsing/fetch adapter <200 LOC                                                                        |
| C:/Work/NavSlidesEditor/client/src/utils/portable-document-rewriter.js             | CREATE / proposed      | Portable owner; recursive serialization <200 LOC                                                                              |
| C:/Work/NavSlidesEditor/client/src/utils/offlineExport.js                          | MODIFY / known         | Integration owner; thin adapter, giữ public entry                                                                             |
| C:/Work/NavSlidesEditor/shared/src/element-renderers.js                            | MODIFY / known         | Integration owner; chỉ iframe emission branches                                                                               |
| C:/Work/NavSlidesEditor/shared/src/htmlGenerator.js                                | MODIFY / known         | Integration owner; plugin/PDF final-frame init                                                                                |
| C:/Work/NavSlidesEditor/client/src/components/HtmlEditorModal.jsx                  | MODIFY / known         | Security owner; compatibility/network/dependency controls, giữ script content                                                 |
| C:/Work/NavSlidesEditor/client/src/hooks/use-element-creation.js                   | MODIFY / known         | Integration owner; Apply/save/reopen metadata không mất                                                                       |
| C:/Work/NavSlidesEditor/shared/src/types/presentation.js                           | MODIFY / known         | Integration owner; typed dependency/network contract, schema consumers re-scout                                               |
| C:/Work/NavSlidesEditor/client/src/components/canvas/canvas-element-wrapper.jsx    | MODIFY / known         | Integration owner; authored HTML isolation                                                                                    |
| C:/Work/NavSlidesEditor/client/src/plugins/plugin-sandbox.jsx                      | MODIFY / known         | Security owner; token lifecycle/schema                                                                                        |
| C:/Work/NavSlidesEditor/plugins/animated-counter/dist/sandbox.html                 | MODIFY / known :48-59  | Shipped peer source/token/init cutover with hosts; re-scout authoritative source/build if generated, no dist-only hidden fork |
| C:/Work/NavSlidesEditor/client/src/utils/stem-embed-presets.js                     | MODIFY / known         | Security owner; nested permissions/online contract                                                                            |
| C:/Work/NavSlidesEditor/client/src/hooks/use-export-actions.js                     | MODIFY / known         | Integration owner; single Download path                                                                                       |
| C:/Work/NavSlidesEditor/client/src/components/ribbon/ribbon-file-dropdown-menu.jsx | MODIFY / known         | Integration owner; bỏ duplicate hosted Download                                                                               |
| C:/Work/NavSlidesEditor/client/src/utils/generateHTML.js                           | MODIFY / known         | Integration owner; retire obsolete direct Download wrapper                                                                    |
| C:/Work/NavSlidesEditor/client/src/utils/export-project.js                         | MODIFY / known :69-86  | Archive branch/media bytes follows shared native discovery; attachment failure cannot be concealed                            |
| C:/Work/NavSlidesEditor/client/src/utils/project-media-utils.js                    | MODIFY / known :52-104 | Manifest discovery/client URL restoration invokes shared native paths, including layout media                                 |
| C:/Work/NavSlidesEditor/server/services/project-import-presentation.js             | MODIFY / known :7-32   | Same native URL map rewrites imported config to new uploaded placements                                                       |
| C:/Work/NavSlidesEditor/shared/tests/education-native-media-roundtrip.test.js      | CREATE / proposed      | Nested-only quiz/cards/matching/layout discovery + restored URLs/bytes; no copy/wiring assertions                             |
| C:/Work/NavSlidesEditor/tests/e2e/export/education-project-media-roundtrip.spec.js | CREATE / proposed      | Isolated source/target project export/import renders restored nested images in editor/Present/portable file                   |
| C:/Work/NavSlidesEditor/client/src/components/editor/editor-page-chrome.jsx        | MODIFY / known         | Integration owner; migrate named Download props                                                                               |
| C:/Work/NavSlidesEditor/client/src/components/ribbon/ribbon-header-bar.jsx         | MODIFY / known         | Integration owner; migrate named Download props                                                                               |
| C:/Work/NavSlidesEditor/client/src/pages/EditorPage.jsx                            | MODIFY / known         | Integration owner; migrate callback exposure                                                                                  |
| C:/Work/NavSlidesEditor/shared/tests/education-plugin-isolation.test.js            | CREATE / proposed      | Schema/source/token transitions                                                                                               |
| C:/Work/NavSlidesEditor/client/src/utils/portable-resource-closure.test.js         | CREATE / proposed      | Recursive closure/errors, real fixture bytes                                                                                  |
| C:/Work/NavSlidesEditor/tests/e2e/export/education-sandbox-security.spec.js        | CREATE / proposed      | Chromium parent access/message attack behavior                                                                                |
| C:/Work/NavSlidesEditor/tests/e2e/export/education-portable-file.spec.js           | CREATE / proposed      | Chromium actual downloaded file, network abort                                                                                |
| C:/Work/NavSlidesEditor/client/src/utils/offlineExport.test.js                     | MODIFY / known         | Replace string-only proof bằng closure behavior                                                                               |
| C:/Work/NavSlidesEditor/client/src/hooks/use-export-actions.test.js                | MODIFY / known         | Delete forwarding-only old Download test                                                                                      |
| C:/Work/NavSlidesEditor/client/src/utils/generateHTML.test.js                      | MODIFY / known         | Remove obsolete wrapper echo assertions                                                                                       |
| C:/Work/NavSlidesEditor/docs/export-fidelity-and-limits.md                         | MODIFY / known         | Sau smoke: portable/isolation compatibility                                                                                   |
| C:/Work/NavSlidesEditor/docs/project-changelog.md                                  | MODIFY / known         | Sau smoke: working-tree evidence, không release claim                                                                         |

## Tests Before — RED scenarios

1. Trong canvas, authored script thử đọc/sửa parent document; assertion là parent không đổi nhưng local button vẫn tăng counter.
2. Lặp attack trong Mermaid/PDF/blob/srcdoc/file; sandbox DOM token đơn thuần không đủ proof.
3. Plugin A gửi patch cho B, wrong token, old generation, unknown fields, oversized/prototype payload: plugin B và deck giữ nguyên.
   Actual Animated Counter must initialize/update on canvas, generated hosted output and portable file after token migration; sibling/old-document init/patch cannot change it and valid parent updates continue.
4. Nested CSS/font/media/plugin/question images có tham chiếu relative; không thiếu resource sau Download và mở file.
5. Missing asset, CORS denied, unsupported scheme, large asset budget và unknown dynamic fetch: không phát download success; report URL + owner slide/element + remedy.
6. File chứa quiz/poll/word-cloud/matching/countdown: response, score, pause/resume/reset chạy khi mọi HTTP(S) bị abort; không socket attempted.
7. Fixtures chứa </script>, </ScRiPt>, </SCRIPT >, </style>, quotes/backslash/ampersand/Unicode trong question/vendor/frame: text đúng, grading/reset đúng, injected parent marker không chạy.
8. Script local thử fetch/img/beacon/socket tới endpoint kiểm soát: per-embed CSP chặn thực; online declared dependency chỉ chạy trên hosted boundary, không bị gọi là portable.
9. Nested-only uploads: source installation exports actual image bytes into editable ZIP, target isolated installation imports under new URLs; question/option/matching/card/layout references rewrite and render in editor/Present/file without contacting source origin.
   Chưa chạy các scenarios này lúc lập kế hoạch; RED là yêu cầu triển khai, không là kết quả quan sát.

## Implementation steps

1. Tạo proposed tests và fixtures isolated; capture request/pageerror/parent sentinel, reproduce baseline failure theo surface.
2. Thêm shared sandbox/message/resource contracts; dùng bounds có unit tests và phân loại lỗi không nuốt exception.
3. Cắt resource graph và rewriter khỏi monolith thành modules <200 LOC; close CSS/HTML recursion với visited set và reference chains.
4. Kết nối authored HTML/Mermaid/PDF/plugin tuần tự; resolve absolute assets online, embed offline, giữ same isolation trên final frames.
   Migrate both plugin hosts and shipped Animated Counter peer together; implement parent-load init/token rotation and source/token/schema validation on BOTH directions, no tokenless fallback.
   Connect shared native media traversal to editable archive discovery plus client/server URL restoration; preserve actual nested-only bytes and layout references across isolated-installation roundtrip.
5. Thêm manifest support cho builtins và question media; arbitrary undeclared dynamic resources fail closed, không whitelist toàn bộ Internet.
6. Integration owner hợp nhất normal Download/old Offline choice thành portable, migrate toàn bộ prop chain đã liệt kê; hosted Share vẫn riêng.
7. Chạy focused RED→GREEN và browser journeys; sau thành công mới cập nhật docs/changelog và tháo scaffolds không còn dùng.

## Refactor

Xóa callback/aliases/path hosted Download đã obsolete; giữ generateRevealHTML cho hosted Present/Share, không tạo generator thứ hai.
Không dùng sandbox same-origin fallback khi Mermaid lỗi; sửa asset loading. Không sửa unrelated Electron CSP hoặc arbitrary authored HTML body.

## Tests After — GREEN và behavior matrix

| Mức      | Hành vi                                            | Unit / integration / E2E proof                          |
| -------- | -------------------------------------------------- | ------------------------------------------------------- |
| Critical | Isolation trên mọi final iframe                    | Schema tests + generated HTTP/PDF/file parent sentinel  |
| Critical | Recursive asset closure và unknown-network failure | Real resource fixture graph + actual file network abort |
| Critical | Plugin isolation và stale message rejection        | Validator + hai iframe cùng document thực               |
| High     | Local game response/score/reset không socket       | Actual file interaction, socket/request observers       |
| High     | CORS/unresolved/large assets actionable            | Real failing endpoint, UI không báo thành công          |
| Medium   | Compatibility notice/Download vs Share             | User nhìn cảnh báo, chọn hosted link hoặc portable      |

## Executable focused commands

Chỉ chạy lúc triển khai, từ C:/Work/NavSlidesEditor; tạo các proposed test files trước, xác nhận runner discovery trong fresh scout.

```powershell
npx vitest run shared/tests/education-plugin-isolation.test.js client/src/utils/portable-resource-closure.test.js client/src/utils/offlineExport.test.js
npx vitest run shared/tests/education-native-media-roundtrip.test.js
npm run vendor
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'
npx playwright test tests/e2e/export/education-sandbox-security.spec.js tests/e2e/export/education-portable-file.spec.js --project=chromium --workers=1
npx playwright test tests/e2e/export/education-project-media-roundtrip.spec.js --project=chromium --workers=1
```

Dùng current-phase JS/CSS vừa publish và dev-server lane ở trên, không reuse prerequisite build; phase này không chạy toàn suite. Không thay genuine network tests bằng fetch mocks.

## ACTUAL browser smoke journey

Author sandbox counter + Mermaid + plugin pair + nested resource fixture và ít nhất hai native blocks; save/reload; Try rồi mở generated Present và Share thật trên localhost.
Bấm Download, `download.saveAs(testInfo.outputPath(...))`, mở bằng `pathToFileURL()` trong Chromium context mới; abort mọi HTTP(S), quan sát WebSocket attempts, không dùng disable-web-security.
Tương tác local submit/reveal/score/reset, play audio/video với user gesture, load font/question image; ghi output state và screenshot, không chỉ window.Reveal ready.
Mở HTML forPrint/PDF export kiểm chart/diagram không merged pages và parent unchanged; tách smoke built-in PDF viewer mở PDF thật nếu repo có surface đó, không nới HTML sandbox cho viewer. Phase16 exercise Electron CSP thật: inline IIFE/CSS chạy, eval và undeclared network không chạy.
Export editable deck whose ONLY local media is in native question/card/matching/layout fields; import on isolated source/target installations with distinct uploads, remove source availability, then observe restored images in editor, generated Present and portable file. Repeat builtin Animated Counter init/update across canvas/hosted/file and reject sibling/stale-document messages without breaking valid updates.

## Success criteria + unchecked actionable checklist

- [ ] Counter trong authored frame chạy nhưng parent/storage/navigation attack không tác động trên canvas, Present, Share, PDF và file.
- [ ] Local per-embed CSP chặn network/exfiltration attempts và serializer mixed-case giữ payload đúng; hosted network declarations có compatibility feedback, không dựa sandbox để chặn request.
- [ ] Download closure fixture chạy không HTTP(S)/socket; mọi missing/CORS/oversize/undeclared resource chặn xuất với reference chain có thể xử lý.
- [ ] Shipped Animated Counter and both hosts share token/schema lifecycle; actual init/update succeeds and forged/sibling/stale-document messages cannot alter deck.
- [ ] Poll/word-cloud/matching/quiz local hoàn tất và reset offline; live không tự chuyển sang local scoring lúc disconnect.
- [ ] Compatibility notice và hai lựa chọn portable/hosted có hành vi đúng; docs chỉ cập nhật sau artifact smoke được lưu.
- [ ] Editable nested-only media roundtrip carries real ZIP bytes, imports under new upload URLs and renders restored native/layout images without source installation.

## Security/risks and failure protocol

High (likelihood cao × impact cao): unknown user JS không thể chứng minh closure bằng regex; yêu cầu manifest/capability declaration và fail closed khi không chứng nhận được.
High (vừa × cao): opaque srcdoc thay đổi asset loading/plugin APIs; giữ isolation, cung cấp compatibility notice và sửa resource contract, không phục hồi same-origin.
High (vừa × cao): media/font payload lớn làm exhaustion; bounded graph/byte budget, lỗi có URL/size/remedy; không cắt mất tài nguyên rồi báo thành công.
Rollback: revert code checkpoint + published runtime pair/manifest đồng bộ; không đụng saved decks, không re-enable insecure permissions. Nếu an toàn chưa đạt, chặn qualification portable thay vì phát bản lỗi.
Khi smoke fail, giữ failing fixture/receipt, xác định owning phase và sửa đủ trước approval; không mở phase15 khi closure/isolation chưa green. Unchecked: proxy CSP, CORS từng provider và packaged Windows execution chỉ được kết luận từ môi trường thật.

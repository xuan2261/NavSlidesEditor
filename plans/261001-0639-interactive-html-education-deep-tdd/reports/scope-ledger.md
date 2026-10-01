# Scope ledger — HOLD SCOPE

Không có đề xuất nào bị bỏ khỏi phạm vi. Claim review sai được sửa theo evidence, không biến thành production task vô nghĩa.

| ID | Review item / outcome | Phases | Nghiệm thu hành vi |
|---|---|---|---|
| R01 | Game tĩnh trong Present/Share/Export | 01,04,05,14 | Normal Present và downloaded file thực sự chơi được, không chỉ React test |
| R02 | Hot Potato chỉ preview câu1 | 03,05,12,13 | Soạn >=2 câu, chơi/next/answer/timer/score/reset local và live |
| R03 | Thiếu authoring nhiều game | 03,05 | Jeopardy categories/questions; corners; relay teams/questions; trivia rounds; scatter categories/teams lưu/undo/reload được |
| R04 | 4 game thiếu live player | 12,13 | Host+2 learners: corners/relay/trivia/scatter có submission và scoreboard thống nhất |
| R05 | HTML sandbox / prior top-privileges claim | 01,14 | Opaque data URL không bị cáo buộc sai; srcdoc/PDF/blob/Mermaid không đọc parent/storage/topnav nhưng simulation vẫn chạy |
| R06 | Normal Download không portable | 04,14 | Download path portable, file:// mạng bị chặn vẫn có JS/CSS/media/native modules; dependency không đóng gói được báo đúng asset |
| R07 | Format align multislection | 01,02 | Các x/width khác nhau được căn theo selection bounds, single theo slide edges; không dịch cả cụm thay cho align |
| R08 | Fanout longDescription / font attrs inference | 01,02 | Long description tất cả ảnh compatible được cập nhật; text font/lineheight thực sự do TipTap, không thêm controls dư |
| R09 | Shape properties bị review nhầm thiếu | 01,02,16 | Existing label/text size/color giữ nguyên và soạn/render/export được; shape-kind change chỉ thêm nếu thiếu edit path |
| R10 | Jeopardy score local/server divergence inference | 01,05,12 | Cùng event/action không tăng điểm hai lần; ghi source authority và negativePoints policy hiện hành |
| R11 | Timer parent globals | 04,05,13 | Countdown chạy đúng ngoài iframe parent, slide leave/replay cleanup; live theo server |
| R12 | Questions images/reorder; replay/reset | 03,05,06 | Đổi order giữ IDs/đáp án; ảnh alt; replay không giữ timer/answer/score cũ ngoài cấu hình explicit |
| R13 | Audio source label nhẹ | 02 | Audio controls rõ ràng, nhập URL lưu/mở lại/play được; không test chỉ placeholder text |
| R14 | Weighted picker inert | 03,05,08 | Positive per-item weights thay đổi selection threshold; không lặp hoạt động local/server; zero/invalid validation |
| P01 | Native quiz blocks | 03,06,12,13 | Single/multi choice, TF, fill blank, ordering, matching, image hotspot: author/play/feedback/score |
| P02 | Click triggers + variables | 07,08 | Show/hide/toggle current section, score-add/subtract + bound scoreboard, reset defined; edit mode inert |
| P03 | Lucky wheel + countdown + teams scoreboard | 08 | Chỉnh labels/weights/time/teams, chơi/pause/reset/tăng trừ điểm offline |
| P04 | Memory + flashcards | 09 | Text/image cards, mismatch/match/flip/next/replay, keyboard/touch, không duplicate score |
| P05 | Drag-drop matching + sorting | 10 | Pointer/touch và click/keyboard alternatives; bucket/mapping IDs ổn định, feedback và reset |
| P06 | Crossword + word-search | 11 | Vietnamese NFC/graphemes, valid bounded grid, không impossible false success, nhập/selection/check/reset |
| P07 | Interactive image hotspot | 06,07 | Normalized rect/circle regions, aspect scaling correct, keyboard/text alternative, safe references |
| P08 | Portable runtime integration | 04,14 | Runtime JS không React/remote CDN/eval, vendor hash closure, offline assets, desktop path |
| P09 | Library + 5 quiz builtins migration | 15 | Known template IDs preserved, native controls không raw-code editing, Insert/duplicate/undo references remapped |
| P10 | Runnable simulation modules | 14,15 | Logic Gate/RLC/PID/Bode/3phase/Gear có controls thay đổi mô hình output trong Try/Present/file offline |
| P11 | Full UI/control/element correctness | 02,16 | 19 canonical type authoring/canvas/present/export parity có behavior evidence, mixed/locked/vertical variants |
| P12 | PPTX/PDF honest static policy + docs/matrix | 16 | Snapshot nội dung thật, answer reveal explicit, unsupported interactions warning; README/capability reports chỉ nói phần đã chứng minh |

## Representation counts

Canonical element discriminators remain 19. Game subtypes: existing10 + new9 (`quiz`, `lucky-wheel`, `countdown`, `scoreboard`, `memory`, `flashcards`, `sorting`, `crossword`, `word-search`) = 19. Dạng câu hỏi là schema kind, không thêm discriminators vào count. Các block library presets không được đếm như type mới.

## Accepted boundaries

- Offline HTML cho tương tác local, không multiplayer không-server. Poll/cloud offline là hoạt động một máy, có controls thực; Live nhận submissions học viên.
- Native module config và runtime progress tách nhau. Arbitrary user HTML không bị parse/chuyển sang quiz schema.
- Existing simulation formulas/models giữ nguyên; không mở thêm ngành vật lý hoặc xây generic simulation scripting engine.
- Offline answer keys inspectable là tính chất file client-side, không phải lời hứa anti-cheat. Live payloads phải không chứa answer keys trước reveal.
- Không có authorization triển khai code, commit/deploy; đây là plan có execution gates.

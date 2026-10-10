# Durable task map

Plan files là authority; runtime todos là projection theo phiên. Mỗi phase có năm items `NN.1`–`NN.5`; unchecked là acceptance chưa được đóng, không mặc định implementation chưa chạy. Phase chỉ complete khi exit gate có evidence, không do subagent báo xong. Sau đổi session hydrate từ phase và [execution ledger](evidence-ledger.md#execution-ledger-reconciliation), không từ trạng thái chat.

## Phase work items

| ID | Deliverable / source | Depends on | Ownership | Status |
|---|---|---|---|---|
| 01 | [Baseline revision, evidence và môi trường](phase-01-start.md) | — | Phase owner 01; shared files qua integration owner | completed |
| 02 | [Settings: atomic update và revision precondition](phase-02-settings-atomic-revision.md) | 01 | Phase owner 02; shared files qua integration owner | blocked: actual Linux permissions |
| 03 | [Settings UI: bảo toàn draft và conflict UX](phase-03-settings-ui-draft.md) | 02 | Phase owner 03; shared files qua integration owner | blocked: joint POSIX permission gate; local tests/browser passed |
| 04 | [CI summary: chỉ success mới vượt gate](phase-04-ci-required-summary.md) | 01 | Phase owner 04; shared files qua integration owner | blocked: authorized remote graph smoke |
| 05 | [Scanner report: schema và binding evidence](phase-05-scanner-evidence.md) | 01 | Phase owner 05; shared files qua integration owner | in-progress: genuine reduced scan CLI passed; exact candidate-image qualification open |
| 06 | [History, autosave, rich text và selection](phase-06-history-autosave.md) | 01 | Phase owner 06; shared files qua integration owner | in-progress: semantic 17/17 passed; new five-journey native harness RED under counsel |
| 07 | [PPTX publication, visibility và template authority](phase-07-pptx-publication.md) | 01 | Phase owner 07; shared files qua integration owner | in-progress: native source-bound HTTP passed; current reader repairs need final binding |
| 08 | [PPTX concurrency, retry và compensation](phase-08-pptx-concurrency.md) | 07 | Phase owner 08; shared files qua integration owner | in-progress: P08-07/12 now evidenced; final source-bound joint exit open |
| 09 | [PPTX durable recovery và cleanup ownership](phase-09-pptx-recovery.md) | 08 | Phase owner 09; shared files qua integration owner | in-progress: implemented; real process-death/startup HTTP passed; final scenario binding open |
| 10 | [Portable archive: revision, blob, media và authority](phase-10-pptx-portable.md) | 09 | Phase owner 10; shared files qua integration owner | in-progress: seven local browser journeys and 86 archive/store/HTTP tests passed; final current-input binding open |
| 11 | [Container, runtime closure và supply-chain qualification](phase-11-container-runtime.md) | 04, 05, 10 | Phase owner 11; shared files qua integration owner | blocked: exact Linux/container scan/runtime/backup target unavailable |
| 12 | [Windows NSIS/portable, OfficeCLI và PowerPoint](phase-12-windows-office-qualification.md) | 10, 11 | Phase owner 12; shared files qua integration owner | in-progress: local producer/adapter/native-caller contracts passed; genuine physical/signing/download/attestation blocked |
| 13 | [Navigator baseline 50/100/300 slides](phase-13-navigator-baseline.md) | 06, 07 | Phase owner 13; shared files qua integration owner | blocked: historical sample collection complete; retained noise oracle invalidates qualification |
| 14 | [Navigator optimization có điều kiện và accessibility](phase-14-navigator-optimization.md) | 13 | Phase owner 14; shared files qua integration owner | blocked: valid measured phase 13 baseline required; no no-change decision |
| 15 | [Documentation drift và contract truth](phase-15-documentation-drift.md) | 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 14 | Phase owner 15; shared files qua integration owner | in-progress: facts/render evidence exists; final source/evidence alignment open |
| 16 | [Final integration, CI evidence và release closeout](phase-16-release-closeout.md) | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15 | Phase owner 16; shared files qua integration owner | in-progress: local integration underway; exact final clean-SHA qualification blocked |

## Quy tắc thi hành

- Chạy phase theo dependency graph, không phải mọi row cùng lúc. Kế hoạch không --parallel; chỉ mở independent lane khi owner/file contracts không overlap.
- Các item `.1` baseline → `.2` RED/existing GREEN → `.3` implementation/verification → `.4` regression+smoke → `.5` documentation. Definition of done nằm ở từng phase.
- Một integration owner tích hợp shared package scripts/workflows/test inventory/docs. Phases 07–10 tuần tự vì chung package store/outbox/session state.
- Phase 01 completed with observed baseline/inventory and explicit external blockers. Downstream local checkpoints do not close the required qualification gates.
- External capability blocked giữ trong phase và ledger. Không complete toàn chương trình khi required gate chưa đạt.
- Phase 13/14 no-change chỉ hợp lệ khi baseline và acceptance measured chứng minh không cần tối ưu; không coi không sửa code là no-op deliverable.
- Khi phase 15 docs chuẩn bị và phase 16 final evidence lệch SHA, phase 16 phải freeze/requalify trước khi đóng release.

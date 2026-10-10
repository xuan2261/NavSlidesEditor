---
title: "NavSlides: toàn bộ reliability, PPTX lifecycle và release qualification"
description: "Kế hoạch deep TDD toàn bộ chặng 0–5, có 16 phase và ma trận hành vi, không phải chứng nhận đã triển khai."
status: in-progress
priority: P1
effort: ""
branch: main
tags: [bugfix, frontend, backend, infra, docs, critical]
blockedBy: []
blocks: []
created: 2026-10-09
---

# Kế hoạch toàn bộ NavSlides reliability — deep TDD

## Outcome và scope
Hoàn thành toàn bộ chặng 0–5: evidence đúng revision; Settings correctness; fail-closed CI/security; history verification; PPTX publication/concurrency/recovery/portable archive; Linux/Windows/Office qualification; navigator có đo lường và documentation drift. **Không thu hẹp vào đợt Settings, không triển khai mã trong phiên plan.**

Baseline quan sát: `main`, `aa19b59cd5bd5de2510f9bc4edd2ef2311ce9131`. CI/số test/scan lịch sử từ attachment không chứng minh candidate này. Giữ nguyên mọi file untracked có trước, gồm bản nháp kế hoạch khác. Quyết định dưới đây là đề xuất thiết kế, không ghi nhận approval ngoài hội thoại.

## Roadmap và dependencies
Tất cả trạng thái là **triển khai**, không phải trạng thái soạn tài liệu. Mỗi phase có files/ownership, Tests Before, matrix C/H/M, implementation steps, Refactor, Tests After, commands, smoke, checklist và failure protocol.

| Phase | Deliverable | Dependencies | Priority | Status |
|---|---|---|---|---|
| 01 | [Baseline revision, evidence và môi trường](phase-01-start.md) | — | P1 | completed |
| 02 | [Settings: atomic update và revision precondition](phase-02-settings-atomic-revision.md) | 01 | P1 | blocked: P02-14 Linux permissions |
| 03 | [Settings UI: bảo toàn draft và conflict UX](phase-03-settings-ui-draft.md) | 02 | P1 | blocked: joint P02-14 POSIX permission gate; local tests/browser passed |
| 04 | [CI summary: chỉ success mới vượt gate](phase-04-ci-required-summary.md) | 01 | P1 | blocked: remote graph authorization |
| 05 | [Scanner report: schema và binding evidence](phase-05-scanner-evidence.md) | 01 | P1 | in-progress: genuine reduced scan CLI passed; exact candidate-image qualification open |
| 06 | [History, autosave, rich text và selection](phase-06-history-autosave.md) | 01 | P1 | in-progress: restored lifecycle focused40/native5 passed; P06-13 manual/unload native oracle open |
| 07 | [PPTX publication, visibility và template authority](phase-07-pptx-publication.md) | 01 | P1 | in-progress: finding #6 destination admission/owned compensation closed with affected139 and source-bound HTTP; phase-wide reader binding open |
| 08 | [PPTX concurrency, retry và compensation](phase-08-pptx-concurrency.md) | 07 | P1 | in-progress: P08-07/12 now evidenced; final source-bound joint exit open |
| 09 | [PPTX durable recovery và cleanup ownership](phase-09-pptx-recovery.md) | 08 | P1 | in-progress: implemented; real process-death/startup HTTP passed; final scenario binding open |
| 10 | [Portable archive: revision, blob, media và authority](phase-10-pptx-portable.md) | 09 | P1 | in-progress: native final04 seven journeys passed; current-input process/browser binding open |
| 11 | [Container, runtime closure và supply-chain qualification](phase-11-container-runtime.md) | 04, 05, 10 | P1 | blocked: exact Linux/container scan/runtime/backup target unavailable |
| 12 | [Windows NSIS/portable, OfficeCLI và PowerPoint](phase-12-windows-office-qualification.md) | 10, 11 | P1 | in-progress: producers verified locally; physical/signing/download/attestation blocked |
| 13 | [Navigator baseline 50/100/300 slides](phase-13-navigator-baseline.md) | 06, 07 | P2 | blocked: historical collection complete; retained noise oracle invalidates qualification |
| 14 | [Navigator optimization có điều kiện và accessibility](phase-14-navigator-optimization.md) | 13 | P2 | blocked: candidate receipt fails stability/budget/comparison; controlled rerun required |
| 15 | [Documentation drift và contract truth](phase-15-documentation-drift.md) | 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 14 | P2 | blocked: current machine facts and edited docs build passed; upstream performance/physical qualification open |
| 16 | [Final integration, CI evidence và release closeout](phase-16-release-closeout.md) | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15 | P1 | in-progress: nine audit findings repaired; source-matched affected222/native smoke passed; full/performance/external qualification open |

Các lanes sau 01: Settings `02→03`; CI `04` và scanner `05`; editor `06`; PPTX `07→08→09→10`. Lane setup release `11→12`, navigator `13→14`, docs `15`, final qualification `16`. Đây không phải --parallel execution mode; owner chung/phụ thuộc vẫn bắt buộc. Phases 11/12 có thể tạo evidence trung gian, phase 16 phải bind final inputs.

## Tài liệu thi hành
- [Verification strategy và evidence schema](verification-strategy.md): RED/GREEN/characterization, deterministic race/crash, runtime smoke, không hạ gate.
- [Decisions, architecture và ownership](decisions-and-boundaries.md): revision/API key, PPTX authority, portable consumers, trust boundaries.
- [Evidence ledger](evidence-ledger.md): observed/read-only/historical/not-run tách biệt.
- [Review và artifact validation](review-report.md): red-team dispositions, kiểm tra consistency và giới hạn.
- [Task mapping](task-map.md): unchecked work items và phase dependencies, dùng hydrate lại khi đổi session.

## Acceptance toàn chương trình
- [ ] Chặng 0: candidate/evidence/tool/fixture/policy/artifact identities không bị trộn.
- [ ] Chặng 1: Settings atomic + revision + draft preservation; required jobs success-only; valid clean scan pass, malformed/incomplete scan fail.
- [ ] Chặng 2: history/autosave/rich-text/selection được kiểm chứng, không sửa lại redo đã đúng.
- [ ] Chặng 3: PPTX visibility/loser compensation/restart/full archive closure đúng; Original immutable truy xuất được.
- [ ] Chặng 4: Linux/container và Windows NSIS/portable đủ scan/runtime/Office/PowerPoint/signing/download/attestation trên exact final identities; không hạ gate.
- [ ] Chặng 5: baseline 50/100/300, optimization hoặc justified no-change có dữ liệu hợp lệ, không regression a11y/navigation; facts EN/VI đúng owner. Candidate performance oracle hiện chưa đạt.

## Handoff
Bắt đầu phase 01, đọc toàn bộ phase liên quan trước thi hành và rescout mỗi phase theo --deep. `blocked/skipped/not-run` không là passed. Thiếu Office/signing/permission không cản việc độc lập nhưng chặn qualification; quyền implement không ngầm cấp quyền publish/tag/GitHub settings. Kế hoạch không ước lượng lịch khi môi trường chưa chốt.

```text
/ak:cook C:/Work/NavSlidesEditor/plans/261009-0901-navslides-full-reliability-deep-tdd/plan.md
```

Không thêm --auto trừ khi người dùng yêu cầu tự động triển khai. Chỉ sau review/consistency gate không còn contradiction mới dùng handoff này.

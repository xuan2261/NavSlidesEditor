---
date: 2026-05-17
type: journal
topic: parallax-port-finalization
---

# Parallax Port Finalization

## Context

Session chốt port Parallax sau WIP checkpoint `3566903b` và finalize commit `75170384`.

## What Happened

- Refactored timeline renderer thành `timeline-element.jsx`, `timeline-element-utils.js`, và `timeline-expanded-details.jsx`.
- Mở rộng timeline test suite lên 13 cases để cover render, state, và expanded details.
- Sync lại `plans/parallax-features-port` status/checklists và cập nhật `docs/project-changelog.md`.
- Ghi rõ quyết định `Ctrl+K`: giữ `Command Palette`, không port upstream link modal.
- Code review bắt ra `docs-only Ctrl+K` stale pseudo-tests; đã gỡ để tránh tài liệu nói một kiểu, code làm một kiểu.

## The Brutal Truth

Phần khó không còn là code nữa mà là dọn rác nhận thức. Nếu để pseudo-tests và decision note lệch nhau, session này sẽ trông “xong” nhưng thật ra chỉ là một đống nợ kỹ thuật được bôi đẹp. Cảm giác khá mệt vì phải xác nhận lại cùng một sự thật qua code, tests, plan, và changelog.

## Technical Details

- `npm run lint` PASS
- `npm run build` PASS
- `npm run test` PASS: 118 files / 1036 tests
- `npm run test:e2e` PASS: 169 tests
- `npm run test:corpus` PASS: 4 PPTX files, avg semantic 98.0%, avg round-trip 99.0%
- `k6` load test blocked: binary not installed in `PATH`

## What We Tried

- Tách renderer để giảm coupling và làm timeline logic dễ test hơn.
- Mở rộng unit coverage thay vì chỉ dựa vào snapshot hoặc docs.
- Rà lại plan/changelog sau review để bắt lệch trạng thái.

## Root Cause Analysis

Vấn đề gốc là port này đi qua nhiều lớp artifact: code, plan, changelog, và pseudo-tests. Chỉ cần một lớp stale là cả session trông sai. Quyết định giữ `Command Palette` cho `Ctrl+K` là đúng vì nó giữ hành vi nhất quán với editor hiện tại và tránh nhét thêm modal upstream không cần thiết.

## Lessons Learned

- Không để docs-only test text sống sót sau review.
- Refactor UI renderer phải đi kèm test count tăng thật, không phải cảm giác an toàn.
- Quyết định product-level shortcut phải được ghi rõ trong changelog/plan, không để truyền miệng.

## Next Steps

- `k6` cần được cài trên máy/CI nếu muốn mở load gate.
- Nếu roadmap tiếp tục port upstream, owner tiếp theo phải giữ plan, changelog, và test intent đồng bộ ngay từ đầu.

## Unresolved Questions

- `k6` sẽ được cài ở local hay CI path trước lần verify tiếp theo?

**Status:** DONE  
**Summary:** Đã ghi journal cho session finalization Parallax port, bao gồm refactor, verify, quyết định `Ctrl+K`, và blocker `k6`.  
**Concerns/Blockers:** `k6` chưa có trong `PATH`, nên load test vẫn blocked.

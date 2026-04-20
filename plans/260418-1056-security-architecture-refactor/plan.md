# NavSlides Editor — Security Patches & Architecture Refactor

> **Created:** 2026-04-18  
> **Status:** ✅ Complete (All 4 Phases)  
> **Priority:** Critical → High → Medium  
> **Scope:** Full-stack (client + server + shared)  
> **Based on:** Consolidated Adversarial Code Review (Antigravity + Gemini 3.1 Pro)

---

## Overview

Kế hoạch tổng thể để fix các lỗ hổng bảo mật và giảm technical debt từ kết quả code review. Chia 4 phases, thực hiện tuần tự — phase sau phụ thuộc phase trước.

## Phases

| Phase | Title | Status | Priority | Effort | Dependencies |
|-------|-------|--------|----------|--------|--------------|
| 01 | [Security Patches](./phase-01-security-patches.md) | `[x]` | 🔴 Critical | 1-2 days | None |
| 02 | [DRY Cleanup & Quick Wins](./phase-02-dry-cleanup.md) | `[x]` | 🟠 High | 2-3 days | Phase 01 |
| 03 | [Component Decomposition](./phase-03-component-decomposition.md) | `[x]` | 🟠 High | 5-7 days | Phase 02 |
| 04 | [Infrastructure & Long-term](./phase-04-infrastructure.md) | `[x]` | 🟡 Medium | 5-10 days | Phase 03 |

## Key Constraints

- **960×540 canvas** — hard constraint, không thay đổi
- **JSON file storage** — giữ nguyên (YAGNI)
- **No breaking API changes** — client API wrapper phải tương thích ngược
- **Single `index.css`** — Phase 4 mới tách, các phase trước chỉ sửa nội dung
- **Tests phải pass** — mỗi phase kết thúc bằng verify E2E + unit tests

## Success Criteria

1. **Phase 1:** Không còn XSS vector qua share links. Password không lộ trong URL.
2. **Phase 2:** EditorPage giảm ≥500 dòng. Không còn code trùng lặp.
3. **Phase 3:** EditorPage ≤1500 dòng. Zustand stores active. Modals tách file riêng.
4. **Phase 4:** Request validation (Zod). CSS Modules. icon-paths lazy-loaded.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Break existing presentations | Medium | High | JSON migration function, snapshot trước khi refactor |
| TipTap editor desync | Medium | High | Keep single Editor instance pattern, chỉ move vào hook |
| E2E tests flaky after refactor | High | Medium | Run full suite sau mỗi sub-task |
| CSS selector conflicts khi tách | Medium | Medium | Prefix component classes, review trước khi merge |

---
phase: 5
title: "Worker Env Allowlist Warnings Budget Timeout Honesty"
status: completed
priority: P1
effort: "2d"
dependencies: [3]
---

# Phase 5: Worker Env Allowlist, Warnings Budget, Timeout Honesty

## Overview

Hardening micro-bundle: allowlist parser worker environment (audit P1.8), enforce global warning count/byte budget at accumulate time (P2.3), fix timeout message to use actual `timeoutMs` (P2.6). Reuse OfficeCLI process-contract pattern.

## Context Links

- `server/services/pptx-import/worker-runner.js` `buildParserWorkerEnv` spreads `...baseEnv`
- OfficeCLI allowlist: `server/services/pptx-import/officecli/process-contract.js`
- Timeout hardcode `"60s"`: `worker-runner.js` timeout branch
- Phase 3 `buildBoundedImportReport` — share omittedCount semantics
- EMF converter also full env: note residual; optional same allowlist if low cost

## Requirements

### Functional

**Worker env**

- Allowlist keys needed for Node parse worker (document exact set). Minimum candidates: `PATH` (or none on Windows if not required), `SystemRoot`, `TEMP`/`TMP`, `TMPDIR`, `LANG`/`LC_*` as needed, `NODE_PATH`, electron-related if present in current builder.
- **Deny** by omission: `API_KEY`, `TOKEN`, `SECRET`, `PASSWORD`, `AWS_*`, `GITHUB_*`, and arbitrary parent secrets.
- Strip `NODE_OPTIONS` unless explicitly required and reviewed.
- Tests: parent env with fake `API_KEY=...` must not appear in worker env.

**Timeout message**

- Message includes actual timeout seconds from `timeoutMs` (e.g. `after 90s` when options.timeoutMs=90000).

**Warning budget (accumulate-time — required)**

- Constants: `MAX_IMPORT_WARNINGS` (e.g. 500) and/or `MAX_IMPORT_WARNING_BYTES` (e.g. 256 KiB).
- **Hard requirement:** shared `pushImportWarning(context, warning)` or array proxy so peak `warnings.length` cannot exceed cap **during map** (not only final bind). Test with 10k synthetic pushes → peak length ≤ cap; omittedCount increments.
- Final report builder may apply tighter durable caps (phase 3).

**EMF residual**

- Prefer same allowlist on `emf-wmf-sandbox` spawn env in this phase if LOC allows; else document residual secret inherit in phase 7 sandbox eval and demote global “all converter children” claim.

### Non-functional

- Electron packaged import still works (NODE_PATH).
- No OS sandbox in this phase (phase 7 eval only).

## Architecture

```text
buildParserWorkerEnv(baseEnv) -> pick(allowlist) + required NODE_PATH
context.warnings via pushImportWarning -> hard cap mid-map
timeout error message uses timeoutMs
```

## File Inventory

| Path | Action |
| --- | --- |
| `worker-runner.js` | Allowlist + timeout message |
| `worker-runner.test.js` | Secret inheritance + timeout string |
| `officecli/process-contract.js` | Pattern reference (maybe extract shared allowlist util if DRY without coupling) |
| `constants.js` | Warning budget constants |
| `import-report.js` / new `warning-budget.js` | Shared bound |
| mapper/importer | Wire bound |
| `emf-wmf-sandbox.js` | Optional env strip |

## Dependency Map

- Soft dep on phase 3 for report omittedCount shape.
- Independent of phase 1–2 for worker env/timeout.

## Tests Before (TDD)

1. `buildParserWorkerEnv` with poisoned parent env → no secret keys.
2. Required NODE_PATH retained.
3. Custom timeoutMs=120000 → message contains `120` not hardcode-only `60` if timeout differs.
4. 10k `pushImportWarning` calls → peak array length ≤ cap; omittedCount ≥ 10000−cap.
5. Electron flag path still covered (existing test).
6. Poison parent `API_KEY` / `GITHUB_TOKEN` absent from worker env object.

## Refactor / Implementation Steps

1. Implement allowlist; update tests.
2. Fix timeout message.
3. Add warning budget constants + bind function.
4. Apply at importer output and report builder.
5. Optionally EMF env strip.

## Tests After

- Existing worker-runner suite green.
- Importer tests with many synthetic warnings.

## Regression Gate

```bash
npx vitest run server/services/pptx-import/worker-runner.test.js server/services/pptx-import/importer.test.js server/services/pptx-import/import-report.test.js
```

## Test Scenario Matrix

| ID | Scenario | Priority |
| --- | --- | --- |
| E1 | Secret not inherited | Critical |
| E2 | NODE_PATH kept | Critical |
| E3 | Timeout message actual ms | High |
| E4 | Warning omittedCount | Critical |
| E5 | Zero warnings | Medium |

## Function / Interface Checklist

- [ ] `buildParserWorkerEnv` allowlist
- [ ] Timeout message template
- [ ] `boundImportWarnings` / budget helper

## Success Criteria

- [ ] E1–E4 green
- [ ] No full parent env spread remains in parser worker builder

## Risk Assessment

| Risk | Mitigation |
| --- | --- |
| Over-strip breaks Windows parse | Explicit allowlist from OfficeCLI + NODE_PATH tests on win |
| Mapper rewrite scope creep | Final bind first; helper optional |

## Security Considerations

- Primary goal: reduce secret exposure if parser dependency compromised.
- Not a full sandbox.

## Todo

- [ ] Tests Before env + timeout + budget
- [ ] Implement allowlist + message + budget
- [ ] Regression gate

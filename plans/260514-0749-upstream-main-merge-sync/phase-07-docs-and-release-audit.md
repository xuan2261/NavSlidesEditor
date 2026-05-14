# Phase 07 - Docs And Release Audit

## Context Links

- [Plan](./plan.md)
- [Research 02](./research/researcher-02-project-validation-and-risk.md)

## Overview

- Priority: P2
- Status: Pending
- Goal: update docs only where merge changed project behavior, commands, dependencies, or roadmap status.

## Key Insights

- Project docs live in `docs/`.
- Docs update is required after significant dependency, workflow, feature, or bugfix changes.
- Keep docs concise; do not rewrite unrelated sections.

## Requirements

- Functional:
  - Audit changed files.
  - Update changelog/roadmap/architecture/code standards only if impacted.
  - Record validation results.
- Non-functional:
  - Do not create duplicate enhanced docs.
  - Update existing files directly.

## Architecture

```text
merge diff -> docs impact analysis -> minimal docs update -> docs verification
```

## Related Code Files

- Modify as needed:
  - `docs/project-changelog.md`
  - `docs/project-roadmap.md`
  - `docs/code-standards.md`
  - `docs/system-architecture.md`
  - `docs/codebase-summary.md`
- Create:
  - Optional journal under `docs/journals/` if implementation session needs handoff.
- Delete: none expected.

## Implementation Steps

1. Inspect final diff:
   ```powershell
   git diff --stat master...HEAD
   git diff --name-status master...HEAD
   ```
2. Decide docs impact:
   - none: no docs update.
   - minor: changelog only.
   - major: changelog + roadmap + architecture/code standards as needed.
3. Update docs if needed.
4. Manual smoke checklist:
   - Dashboard opens.
   - Editor opens existing/new presentation.
   - Insert menu opens.
   - Properties panel updates selected element.
   - Export/share dialogs open if touched.
5. Re-run quick verification if docs/source changed:
   ```powershell
   npm run build
   ```

## Verification And Tests

- Docs links are valid relative links.
- Changelog entry matches actual merge.
- Manual smoke checklist completed.
- `npm run build` still passes if any source changed during docs/audit phase.

## Todo List

- [ ] Inspect final diff.
- [ ] Classify docs impact.
- [ ] Update existing docs if needed.
- [ ] Run manual smoke checklist.
- [ ] Re-run build if source changed.

## Success Criteria

- Documentation reflects actual merge impact.
- No stale or misleading release notes.

## Risk Assessment

- Risk: docs claim upstream changes not actually integrated.
  - Mitigation: base docs only on `git diff` and test results.
- Risk: over-documenting low-level merge details.
  - Mitigation: keep changelog user/developer focused.

## Security Considerations

- If upstream changes dependency/security posture, document it.
- Do not include credentials or private URLs in docs.

## Next Steps

- Proceed to Phase 08.

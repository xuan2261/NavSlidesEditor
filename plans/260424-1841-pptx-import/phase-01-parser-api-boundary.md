---
phase: 1
title: Parser API Boundary
status: completed
effort: M
---

# Phase 1: Parser API Boundary

## Context Links

- Decision: `plans/20260424-1508-pptx-parser-benchmark-hard/reports/final-parser-decision.md`
- Server entry: `server/index.js`
- Upload pattern: `server/routes/upload.js`

## Overview

Create dedicated server API boundary for `.pptx` import. Reject invalid package shapes before parser execution. Run parser in isolated child process with timeout and sanitized diagnostics.

## Requirements

- `POST /api/pptx/import`, multipart `file`.
- Accept `.pptx` only.
- Guard: ZIP signature, `[Content_Types].xml`, `ppt/presentation.xml`.
- Budget: 100MB file, 5000 ZIP entries, 500MB decompressed bytes.
- Child parser worker: 60s timeout, SIGTERM then kill grace.
- Delete temp upload in success and failure paths.

## Related Code Files

- Create: `server/routes/pptx-import.js`
- Create: `server/services/pptx-import/constants.js`
- Create: `server/services/pptx-import/diagnostics.js`
- Create: `server/services/pptx-import/pptx-guards.js`
- Create: `server/services/pptx-import/worker-runner.js`
- Create: `server/services/pptx-import/parse-worker.js`
- Modify: `server/index.js`

## Implementation Steps

1. Add temp upload route with `.pptx` extension filter.
2. Validate ZIP/package shape before parser.
3. Enforce size, entry, decompression budgets.
4. Fork parser worker with timeout and forced kill grace.
5. Return only normalized public error taxonomy.
6. Ensure temp file cleanup in `finally`.

## Todo List

- [x] Route and registration
- [x] Package guard
- [x] Child process runner
- [x] Sanitized diagnostics
- [x] Cleanup guarantee

## Tests

- Missing file rejected.
- `.pdf`, `.ppt`, renamed non-ZIP, ZIP without PPTX entries rejected.
- Timeout returns sanitized `parse-failed`.
- Late child success cannot mark import successful.
- Diagnostics omit raw XML/text.
- `node --check` new server PPTX files.

## Success Criteria

- Invalid packages fail before parser worker.
- Worker crash/timeout does not crash server.
- API response contains no raw parser output.

## Risk Assessment

- Large IPC payload from media extraction. Mitigation: worker timeout and file/ZIP budgets.
- Parser dependency breakage. Mitigation: structured taxonomy and package version stats.

## Security Considerations

- No raw XML/text in diagnostics.
- Temp file deletion on all paths.
- No client-provided path usage.

## Next Steps

- Feed successful parser output into intermediate adapter and mapper.

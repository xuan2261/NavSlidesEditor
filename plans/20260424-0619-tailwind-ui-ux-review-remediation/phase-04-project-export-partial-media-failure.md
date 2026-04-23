---
phase: 4
title: "Project Export Partial Media Failure"
status: complete
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 04: Project Export Partial Media Failure

## Context Links

- `client/src/utils/export-project.js`
- `client/src/utils/project-media-utils.js`

## Overview

Ensure `.navslides` export still succeeds when one or more local media files cannot be fetched.

## Requirements

- Functional: include successful media, skip failed media, keep presentation JSON exportable.
- Non-functional: no breaking manifest shape for imports.

## Architecture

Fetch media through settled results, build manifest from included entries, and log skipped-media warnings.

## Related Code Files

- Modify: `client/src/utils/export-project.js`
- Create: `client/src/utils/export-project.test.js`

## Implementation Steps

1. Replace media `Promise.all` with settled fetch result handling.
2. Include only successful media entries in `manifest.media`.
3. Add `skippedMedia` warnings to manifest if any media fails.
4. Keep no-media `.navslides.json` path unchanged.
5. Add mixed success/failure unit test.

## Todo List

- [ ] Partial fetch failures do not abort.
- [ ] Manifest media count matches included files.
- [ ] Warnings are observable.

## Success Criteria

- [ ] Export ZIP includes valid media and presentation JSON.
- [ ] Missing media emits warning and does not throw.

## Risk Assessment

Risk: import expects media count to match files. Mitigation: manifest count should reflect included media only.

## Security Considerations

Do not broaden media fetch scope beyond existing local upload detection.

## Next Steps

Reduce PPTX module risk and add coverage.

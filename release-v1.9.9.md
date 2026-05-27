# NavSlides Editor v1.9.9

Release date: 2026-05-27

## Highlights

- Fixed installed Electron app startup crash when PPTX import loaded the server sanitizer.
- Replaced server relative imports into `shared/src` with the packaged runtime dependency `revealjs-shared`.
- Hardened the same package boundary for server PPTX export renderers to avoid a matching packaged-app failure path.

## Verification

- Tests intentionally skipped for this release per release command.
- Prior focused verification before release prep passed for PPTX sanitizer, mapper, server renderers, build, lint, and Electron prepare.

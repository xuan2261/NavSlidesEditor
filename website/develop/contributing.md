# Contributing

Conventions for contributing to NavSlides Editor. The internal reference is [`docs/code-standards.md`](https://github.com/xuan2261/NavSlidesEditor/blob/master/docs/code-standards.md).

## Code style

- **File size**: keep individual code files under ~200 LOC. Split large components; extract utilities and services.
- **Naming**: kebab-case file names with descriptive, self-documenting names.
- **YAGNI / KISS / DRY**: don't over-engineer; prefer composition over inheritance; shared logic lives in `shared/src/`, never duplicated across client and server.
- **Match existing patterns**: read neighboring code and follow its conventions rather than introducing new ones.

## Shared code rule

Any logic used by both the client and the server belongs in the `shared/` workspace. When you add or change something there, both sides pick it up through the workspace symlink — so keep it pure Node.js with no client- or server-only assumptions.

## Adding an element type

The 19 element types are defined in `client/src/data/element-defaults.js` — that file is the canonical source. When adding a type, update it first, then the renderer registry, then keep the README count in sync (a unit test guards the match).

## Commits & pre-push

- Use **conventional commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Keep messages focused on the change; no AI references.
- Run **lint** before committing: `npm run lint` (and `npm run format` to apply Prettier).
- Run **tests** before pushing: `npm run test`. Don't ignore failing tests to get a build green.
- Never commit secrets — `.env`, credentials, or tokens.

## Keeping docs accurate

This site mirrors the product. When you change UI labels, shortcuts, counts, or features, update the matching pages — accuracy guard tests pin the most error-prone facts (chart types, preset count, present shortcut). If you change editor UI that appears in a screenshot, re-run the screenshot capture script so the images stay current.

## Security model

NavSlides Editor is a single-user, self-hosted tool where rich programmable content (HTML embeds, custom CSS, inline SVG) is **trusted author content** by design — author-controlled HTML/CSS/JS execution is intentional, not a bug. Still review anything that crosses a trust boundary: untrusted uploads/imports, public share links exposing editor capabilities, cross-session content bleed, credential leakage, path traversal, SSRF, or command injection. For internet-facing or multi-user deployments, place an external auth layer in front.

See also: [Building from Source](/develop/building-from-source) · [Architecture](/develop/architecture).

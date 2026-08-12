---
phase: 2
title: "Portable HTML and GitHub Export"
status: pending
priority: P1
effort: "5-7 engineer-days"
dependencies: [1, 3]
---

# Phase 2: Portable HTML and GitHub Export

<!-- Updated: Validation Session 1 - fixed CDN/SRI profile, inline transitive assets, stable identity folders -->

## Context Links

- [Plan overview](./plan.md)
- [Portable export research](./research/portable-export-and-game-research.md)
- [Debug baseline](./reports/debug-verification-baseline.md)
- `C:\Work\NavSlidesEditor\docs\system-architecture.md`
- `C:\Work\NavSlidesEditor\website\features\export.md`

## Overview

Introduce explicit same-origin and portable HTML generation contracts. Repair
downloaded HTML and GitHub-pushed decks without regressing Present, share,
preview, PDF, Offline HTML, or trusted author content.

## Requirements

### Functional

- `generateRevealHTML()` defaults to unchanged `same-origin` behavior.
- `portable` output contains no root-relative framework dependency, no `/ws`
  live bootstrap, and no mandatory NavSlides API/plugin dependency.
- Portable runtime assets use exact lockfile versions and checked-in SHA-384 SRI.
- Standard client download and server `/export` select portable mode.
- Saved-deck `/present`, share, preview, print/PDF, and Offline HTML input remain
  same-origin.
- GitHub export commits portable HTML, JSON, README, and all verified local upload
  assets referenced by horizontal or vertical slides.
- Local paths are rewritten in a cloned DTO only. Stored presentation/package
  authority is never mutated.
- External HTTP(S) media remains external and is never server-fetched.
- Missing/unsafe/over-budget required local media fails before any Git commit tree
  or reference mutation.
- Empty-repository bootstrap performs no `.gitkeep` or branch mutation until the
  complete artifact set has passed validation.
- GitHub deck folders include stable presentation identity, not title alone, so
  equal/sanitized-colliding titles cannot overwrite each other.
- Every SVG copied into a portable/GitHub artifact is re-sanitized with Phase 3's
  server policy (or rasterized/rejected). Legacy SVG is never copied raw.
- rclone/sync HTML uses portable mode with an explicit `/uploads -> ./_uploads`
  resolver so its existing copied media directory is actually usable.

### Non-functional

- Fixed CDN manifest is application-owned, not presentation/user controlled.
- Every transitive CSS/runtime resource is enumerated. Fonts and other resources
  that cannot carry browser SRI are inlined from exact verified package bytes;
  portable output must not perform an unverified subordinate fetch.
- Theme/code-theme values are allowlisted before URL construction.
- Portable output remains trusted-author programmable; do not add blanket CSP
  that breaks authored inline HTML/CSS/JS.
- Artifact construction is deterministic and bounded by file count, per-file bytes,
  and aggregate bytes.
- Existing GitHub response keeps current folder URL and adds a stable `viewUrl`.

## Architecture

### Generator profiles

```js
generateRevealHTML(presentation, {
  mode: 'same-origin', // default
  mediaBaseUrl,
  mediaUrlResolver
})
```

| Concern | same-origin | portable |
|---|---|---|
| Reveal/KaTeX/highlight | `/vendor/...` | pinned HTTPS + SRI |
| overrides | `/reveal-overrides.css` | inline |
| live Socket.IO bootstrap | included where current contract requires | omitted |
| plugins needing app API | current runtime | static fallback/explicit unsupported marker |
| `/uploads` media | app origin | trusted resolver or validated absolute base |
| trusted author HTML | preserved | preserved, root URLs documented as author-owned |

Create one small shared manifest/resolver module. Do not duplicate URL rules
between `htmlGenerator.js`, `element-renderers.js`, and `presenterTools.js`.

### GitHub artifact builder

```text
authoritative presentation clone
  -> traverse slides + children + backgrounds + element media
  -> classify local / external / data / invalid
  -> validate and hash local files under UPLOADS_DIR
  -> re-sanitize SVG and rewrite clone to ./assets/<hash-prefix>-<safe-name>
  -> choose <safe-title>-<stable-presentation-id> deck folder
  -> generate portable HTML + JSON + README + blobs
  -> only then call Git Data API
```

Use deterministic collision handling. Reject path escape and symlink escape.
Preserve absolute external URLs without fetching them.

## File Inventory

| Action | File | Planned change | Test impact |
|---|---|---|---|
| Create | `C:\Work\NavSlidesEditor\shared\src\portable-export-assets.js` | Pinned asset/SRI manifest and URL policy | New pure unit tests |
| Modify | `C:\Work\NavSlidesEditor\shared\src\htmlGenerator.js` | Output mode, notes-option composition, portable head/runtime | Shared tests |
| Modify | `C:\Work\NavSlidesEditor\shared\src\element-renderers.js` | Resolver plumbing for media/nested runtimes | Renderer tests |
| Modify | `C:\Work\NavSlidesEditor\shared\src\presenterTools.js` | Mode-aware optional assets/runtime | Presenter tests |
| Modify | `C:\Work\NavSlidesEditor\shared\src\live-presenter-runtime.js` | Exclude live bootstrap in portable mode | Generator tests |
| Modify | `C:\Work\NavSlidesEditor\client\src\hooks\use-export-actions.js` | Select portable vs offline/same-origin modes | Hook tests |
| Verify | `C:\Work\NavSlidesEditor\client\src\utils\offlineExport.js` | Preserve same-origin input/inlining | Offline tests |
| Modify | `C:\Work\NavSlidesEditor\server\routes\presentations.js` | Portable `/export`, same-origin `/present` | Route/E2E tests |
| Create | `C:\Work\NavSlidesEditor\server\services\github-portable-export.js` | Bounded artifact/media builder | New service tests |
| Modify | `C:\Work\NavSlidesEditor\server\routes\github.js` | Consume complete artifact set | Route tests |
| Modify | `C:\Work\NavSlidesEditor\server\routes\sync.js` | Portable HTML with `_uploads` resolver at both generation sites | Sync route tests |
| Reuse | `C:\Work\NavSlidesEditor\server\services\svg-upload-sanitizer.js` | Re-sanitize legacy SVG during portable copy | Phase 3 + artifact tests |
| Modify | `C:\Work\NavSlidesEditor\client\src\components\GitHubPushModal.jsx` | Prefer returned `viewUrl` | Component/E2E tests |
| Modify | `C:\Work\NavSlidesEditor\shared\tests\htmlGenerator.test.js` | Same-origin/portable contracts | Focused unit gate |
| Modify | `C:\Work\NavSlidesEditor\shared\tests\element-renderers.test.js` | Resolver/media matrix | Focused unit gate |
| Create | `C:\Work\NavSlidesEditor\server\services\github-portable-export.test.js` | Artifact/path/budget tests | Focused unit gate |
| Modify | `C:\Work\NavSlidesEditor\server\routes\presentations.test.js` | Endpoint mode assertions | Server gate |
| Modify | `C:\Work\NavSlidesEditor\tests\e2e\export\html-export-and-present-endpoints-with-content-validation.spec.js` | Independent-origin execution | Browser gate |
| Modify | `C:\Work\NavSlidesEditor\tests\e2e\export\github-push-flow.spec.js` | Decode mocked tree and `viewUrl` | Browser gate |

## Function and Interface Checklist

- [ ] Enumerate every `generateRevealHTML` and `absoluteSrc` caller.
- [ ] Keep default same-origin behavior byte-compatible where practical.
- [ ] Validate every manifest version against `package-lock.json`.
- [ ] Generate and independently verify SRI for each external script/style.
- [ ] Enumerate CSS/runtime transitive fetches and inline any asset lacking a
  browser-enforceable integrity boundary.
- [ ] Cover root/child background, image, timeline, LaTeX fallback, poster,
  `src`, legacy `videoUrl`, and audio media.
- [ ] Define static fallback for Markdown, Chart, Mermaid, TikZ, QR, game and plugins.
- [ ] Exclude live bootstrap without removing Reveal navigation.
- [ ] Build all GitHub blobs before first outward Git API mutation.
- [ ] Build and validate artifacts before empty-repository bootstrap mutation.
- [ ] Include stable presentation identity in GitHub folder collision policy.
- [ ] Enumerate both `sync.js` HTML generation sites and use the `_uploads` resolver.
- [ ] Re-sanitize/rasterize/reject every exported SVG independent of source age.
- [ ] Preserve current server response fields; add `viewUrl` additively.

## Dependency Map

```text
portable asset manifest
  -> generator/renderers/presenter tools
  -> client download + server /export
  -> GitHub artifact builder
  -> mocked Git Data publication

same-origin generator
  -> /present + share + preview + offline inliner
```

Phase 3 provides the server SVG sanitizer consumed by artifact construction.
Phase 1 provides the notes option in shared `htmlGenerator.js`. Apply Phase 2
after both and compose the options in one stable object.

## Tests Before (RED)

| Scenario | Expected portable contract |
|---|---|
| Minimal deck | pinned runtime URLs + SRI; zero `/vendor`/`/ws` refs |
| Invalid theme/code theme | known fallback, no URL injection |
| Root and vertical-child local media | rewritten/resolved |
| Video poster/legacy URL/audio/timeline/background | all classified |
| Live/game/plugin content | no mandatory app backend; explicit fallback |
| `/api/presentations/:id/export` | portable |
| `/api/presentations/:id/present` | same-origin local vendor |
| Standard downloaded file on independent origin | Reveal initializes |
| Offline HTML | no remote runtime dependency |
| GitHub missing/path-escaping local media | no Git API mutation |
| GitHub valid local media | deterministic assets and decoded HTML refs |
| Empty repository + invalid/missing media | zero GitHub mutation calls |
| Two decks with colliding sanitized titles | distinct stable folders |
| Legacy active SVG referenced by deck | sanitized/rasterized artifact, no active script |
| rclone sync with local root/child media | HTML points to `./_uploads/...` |
| KaTeX/icon/plugin transitive asset graph | no unverified subordinate request |

Use Playwright request interception or a controlled local mirror for CDN assets.
Do not make required CI tests depend on public internet availability.

## Implementation Steps

1. Add failing generator profile and manifest/SRI tests.
2. Add failing comprehensive media resolver/traversal tests.
3. Implement small shared manifest and resolver; thread explicit mode.
4. Switch standard client/server HTML surfaces to portable mode.
5. Preserve and regression-test same-origin Present/share/offline paths.
6. Add bounded GitHub artifact builder and path containment.
7. Replace empty-repository bootstrap ordering and add identity-stable folder names.
8. Integrate Phase 3 SVG sanitization and rclone `_uploads` portable resolution.
9. Update GitHub route/modal while keeping mocked, credential-free tests.
10. Add independent-origin browser execution and missing/transitive-resource assertions.
11. Correct README, architecture, standards, roadmap, changelog and EN/VI export docs.

## Refactor

- Extract helpers because existing generator/route files are hotspots.
- Do not restructure all renderers or merge Offline HTML into portable mode.
- Do not rewrite arbitrary trusted author HTML/CSS URLs.

## Tests After (GREEN)

- Every fixed manifest entry has version, URL, SRI and crossorigin assertions.
- Same-origin generator still exposes expected local assets and live runtime.
- Portable generator initializes without NavSlides origin.
- Offline output remains fully inlined according to its existing contract.
- GitHub tree includes required local media, with no SSRF or partial commit.
- Empty-repo failure produces no external GitHub mutation.
- Portable SVG and transitive runtime resources cannot escape artifact policy.
- rclone HTML resolves copied `_uploads` media correctly.

## Regression Gate

```powershell
npx vitest run shared/tests/htmlGenerator.test.js shared/tests/element-renderers.test.js client/src/utils/offlineExport.test.js client/src/hooks/use-export-actions.test.js server/routes/presentations.test.js server/services/github-portable-export.test.js server/routes/sync.test.js
npx playwright test --workers=1 tests/e2e/export/html-export-and-present-endpoints-with-content-validation.spec.js tests/e2e/export/client-side-download-flows-for-navslides-archive-and-offline-html-and-pdf-print.spec.js tests/e2e/export/github-push-flow.spec.js
npm run lint
npm run build
npm run docs:build
```

## Success Criteria

- [ ] Standard and GitHub HTML initialize away from the app origin.
- [ ] Portable artifacts contain no root runtime/API/live dependency.
- [ ] Same-origin Present/share and Offline HTML remain green.
- [ ] All local GitHub media is deterministic, contained and budgeted.
- [ ] Colliding deck titles, empty repositories, legacy SVG and rclone artifacts
  satisfy their explicit contracts.
- [ ] Remote media is never fetched.
- [ ] Docs accurately distinguish portable, offline and same-origin surfaces.

## Risk Assessment

| Risk / assumption | Observable signal | Pre-decided response |
|---|---|---|
| CDN path/SRI mismatch | Browser blocks resource | Stop release; verify exact package bytes and update manifest/tests |
| CSS/transitive resource lacks SRI | network trace shows subordinate fetch | Inline exact verified bytes or stop portable release |
| Plugin/live behavior implied portable | `/api` or `/ws` request observed | Static fallback or documented unsupported marker; no silent dependency |
| GitHub media API exceeds budget | Artifact builder reports bound | Fail before Git mutation; require Offline/archive alternative |
| Phase 1 option conflict | Generator options overwrite note flag | Merge explicit option normalization and rerun both phase gates |

## Security Considerations

- SRI protects framework assets, not trusted author content.
- Path containment and no remote fetch are mandatory.
- GitHub tests remain mocked; no token or outward push is part of this phase gate.

## Todo

- [ ] Write RED profile, SRI and media-resolution tests.
- [ ] Implement shared portable asset policy.
- [ ] Switch standard/server export surfaces.
- [ ] Implement bounded GitHub artifact builder.
- [ ] Add independent-origin browser tests.
- [ ] Correct export documentation and run regression gate.

---
title: "Portable Export and Game Control Research"
status: completed
created: 2026-08-10
---

# Portable Export and Game Control Research

## Findings

- `generateRevealHTML()` has one implicit same-origin mode and emits root-local
  Reveal, highlight, KaTeX, override, plugin, and live runtime references.
- `downloadHTML()`, server `/export`, and GitHub push reuse that output unchanged.
- `/present` works precisely because the app serves those root paths. Offline
  export is a separate post-processor and must continue receiving same-origin HTML.
- GitHub pushes only HTML/JSON/README. Documentation claiming uploaded assets is
  false. Local media references also vary between browser and Node generation.
- Generic `GameControls` has no click handler, but the current production Present
  pipeline uses the shared static game fallback. Removing the dead branch is safer
  than inventing a second control protocol.

## Selected Design

1. Add explicit `same-origin` and `portable` generation modes, defaulting to
   current same-origin behavior.
2. Centralize a lockfile-versioned CDN/SRI manifest. Portable output inlines local
   overrides, excludes live bootstrap, validates themes, and resolves media through
   a trusted resolver.
3. Standard client/server HTML export selects portable mode. Present/share/preview
   and Offline HTML input remain same-origin.
4. Build GitHub artifacts before mutation, copy verified local uploads to
   deterministic relative paths, preserve external HTTP(S) URLs, never fetch them,
   and fail before commit when required local assets are missing or over budget.
5. Remove only the unreachable generic `GameControls` declaration and invocation.

## Rejected Alternatives

- Rewriting every generated path globally, because it breaks `/present`.
- Reusing Offline HTML for standard export, because the advertised surfaces have
  different runtime/network and artifact contracts.
- Fetching remote media for GitHub, because it creates SSRF and non-determinism.
- Broad game architecture or giant renderer refactoring.

## Test Strategy

- Pure generator tests for both modes, SRI, themes, nested dependencies and live
  runtime exclusion.
- Route tests proving `/export` portable and `/present` same-origin.
- Artifact tests decoding Git blobs and verifying local-media rewrite/failure.
- Playwright on an independent static origin with controlled CDN interception.
- Characterization tests proving real canvas/shared presentation paths remain
  functional after dead-control removal.

## Unresolved Questions

None.

---
phase: 4
title: "VI i18n and Translation"
status: completed
priority: P2
effort: "2-3d"
dependencies: [1, 2, 3]
---

# Phase 4: VI i18n and Translation

## Overview

Layer a Vietnamese locale onto the site: EN stays at root URLs (`/...`), VI at `/vi/...`. Refactor `config.mjs` into the `locales` API and translate all end-user + Develop pages into Vietnamese. Last phase so VI always mirrors accurate EN content (Phase 1+2) and reuses the same locale-agnostic `/img/` assets (Phase 3). This is the heaviest phase (≈32 pages to translate) and a permanent maintenance ×2 commitment — accepted by user.

## Requirements

- Functional: VI locale browsable at `/vi/`; automatic language switcher in navbar; VI nav + sidebar point to `/vi/...`; local search works across both locales with VI UI labels; `npm run docs:build` green; GitHub Pages deploy serves both.
- Non-functional: EN markdown files do NOT move; `base`/`cleanUrls`/`lastUpdated`/`ignoreDeadLinks` stay top-level; existing config markers preserved so guard tests stay green.

## Architecture

Refactor `website/.vitepress/config.mjs` to the verified `locales` shape (i18n research, VitePress 1.x — stable since 1.0):

- **Top-level (shared):** `base`, `cleanUrls`, `lastUpdated`, `ignoreDeadLinks`, `themeConfig.{siteTitle, socialLinks, footer, search}`. `search: { provider:'local', options:{ locales:{ vi:{ translations:{...} } } } }` indexes all locales + translates VI search UI.
- **Remove top-level** `lang`, `title`, `description` (move into `locales.root`) to avoid override confusion.
- **`locales.root`** = EN: `label:'English'`, `lang:'en-US'`, `title`, `description`, per-locale `head` (og tags), `themeConfig.{nav, sidebar}` — carrying the EN nav/sidebar **including the `/develop/` group from Phase 2**.
- **`locales.vi`** = VI: `label:'Tiếng Việt'`, `lang:'vi-VN'`, `link:'/vi/'`, translated `title`/`description`, `themeConfig.{nav, sidebar}` with `/vi/...` paths, plus VI theme labels (`docFooter`, `darkModeSwitchLabel`, `sidebarMenuLabel`, `returnToTopLabel`, `lastUpdatedText`).

Each locale needs its OWN full `nav` + `sidebar` (locale `themeConfig` shallow-merges with shared; defining `sidebar` overrides entirely). Directory `website/vi/` → `/vi/` URLs (root locale = EN).

## Related Code Files

- Modify:
  - `website/.vitepress/config.mjs` — refactor to `locales` (SHARED with Phase 2's Develop group; absorb it into `locales.root`). Keep markers `NavSlides`, `VITEPRESS_BASE`, `/NavSlidesEditor/`, and all EN sidebar path strings (guard tests assert these).
- Create (VI mirror, translated):
  - `website/vi/index.md` — translated home (hero + features).
  - `website/vi/guide/{getting-started,installation,keyboard-shortcuts}.md`
  - `website/vi/features/{overview,text-formatting,shapes,charts,latex,export,live-presentations,game-mode,ai-authoring,pptx-import-export,cloud-sync}.md`
  - `website/vi/tutorials/{first-presentation,text-typography,images,media,shapes-drawing,charts-tables,code-math,using-latex,animations,transitions,kinetic-text,html-embeds,academic-slides,presenting}.md`
  - `website/vi/develop/{architecture,monorepo-structure,building-from-source,contributing}.md`
  - `tests/unit/website-vi-locale-structure-and-config.test.js` — guards (see steps).
- Read (read-only): refreshed EN pages (translation source); i18n config skeleton in brainstorm/research.

## Implementation Steps

1. Refactor `config.mjs` into `locales` per the verified skeleton. Verify EN paths + markers still present (run existing 38 `website-*` tests immediately after — they must stay green).
2. Translate pages in dependency-safe order: home → guide (3) → features (11) → develop (4) → tutorials (14). Translate from the **refreshed** EN (post Phase 1/2), not the old content. Keep code blocks, shortcuts (`F5`, `Ctrl+...`), URLs, and `/img/...` refs unchanged; translate prose + UI labels. Reuse Phase-3 screenshots as-is (in-image text stays EN for v1 — documented limitation).
3. Build the VI `nav` + `sidebar` mirroring EN structure with `/vi/` prefixes (including Develop group). Add VI theme labels + search translations.
4. Add guard test `website-vi-locale-structure-and-config.test.js`:
   - every EN page has a `website/vi/<same-path>` counterpart.
   - `config.mjs` contains `locales`, `root:`, `vi:`, `/vi/guide/`, `/vi/features/`, `/vi/develop/`, `label: 'Tiếng Việt'`.
   - top-level `lang:` removed (moved into locale) — assert `locales` block present (tolerant check).
5. Decide on `ignoreDeadLinks`: now that both locales exist, optionally flip to `false` to catch broken cross-links. If too noisy, keep `true` and grep-verify VI internal links manually. (Decision at implementation; default keep `true` to avoid blocking deploy.)
6. `npm run docs:dev` — eyeball: language switcher present, VI pages render, search returns VI results, sidebar paths resolve. `npm run docs:build` green.
7. Full `npx vitest run tests/unit/website-*.test.js` green (existing 38 + 4 new phase guards: one each from phases 1-4).

## Success Criteria

- [ ] `/vi/` locale browsable; automatic language switcher works; VI nav/sidebar resolve.
- [ ] All ~32 end-user + Develop pages have accurate VI translations from refreshed EN.
- [ ] Local search returns results in both locales; VI search UI labels translated.
- [ ] EN files unmoved; top-level shared options intact; config markers preserved.
- [ ] `npm run docs:build` succeeds; existing 38 + new guard tests green.
- [ ] GitHub Pages deploy serves `/` and `/vi/` correctly (base `/NavSlidesEditor/`).

## Risk Assessment

- **Refactor to `locales` breaks existing guard tests** (they string-match EN sidebar paths + markers) → keep every EN path string and `NavSlides`/`VITEPRESS_BASE`/`/NavSlidesEditor/` marker; run the 38 tests right after step 1 before translating.
- **Translation drift / ×2 maintenance debt** → EN is canonical; VI mirrors. Add a contributing note: update EN first, then VI. (Optional future: translation-status table — deferred, YAGNI.)
- **Stale VI if EN changes later** → inherent to bilingual; accepted by user. Guard test ensures structural parity (file exists), not content sync.
- **`base` + `/vi/` interaction on GitHub Pages** → verified correct (`/NavSlidesEditor/vi/...`); confirm in deploy preview.
- **404 not locale-aware** → VitePress has no built-in localized 404; out of scope (would need custom theme component, which user rejected).
- **Heaviest phase** → can be split/paused per page group; each group (guide/features/tutorials/develop) is independently shippable.

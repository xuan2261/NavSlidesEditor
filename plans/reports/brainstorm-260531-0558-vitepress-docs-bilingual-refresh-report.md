# Brainstorm — VitePress Docs Bilingual Refresh

**Date:** 2026-05-31 · **Status:** Approved (design) · **Next:** `/ck:plan`
**Scope target:** `website/` VitePress site → align with product v1.14.0 + add contributor docs + EN/VI bilingual + scripted screenshots.

---

## Problem Statement

`website/` already contains a working VitePress site (v1.6.3), wired into the monorepo workspaces with `docs:dev/build/preview` scripts and an active GitHub Pages deploy workflow (`.github/workflows/website-deploy-github-pages.yml`, triggers on `website/**` push to master). Content (~28 pages) has **drifted** from product v1.14.0 — counts, shortcuts, and feature lists are stale. Task is NOT to scaffold a new site; it is to **refresh + extend** the existing one.

## Confirmed Requirements

1. **Expected output:** Updated `website/` VitePress site — corrected EN content matching v1.14.0, new Develop section for contributors, EN+VI bilingual (i18n), scripted screenshots embedded.
2. **Acceptance criteria:**
   - All drift items (table below) corrected; counts match canonical sources.
   - `npm run docs:build` passes; GitHub Pages deploy succeeds.
   - VI locale live at `/vi/...`; EN remains at root `/...`.
   - Develop section (architecture, monorepo, building, contributing) present, EN+VI.
   - Screenshots reproducible via Playwright script (no hand-captured rot).
3. **Scope boundary (OUT):** No IA redesign, no custom VitePress theme, no landing-page redesign. `docs/` internal files stay source-of-truth (website distills, not duplicates).
4. **Non-negotiable constraints:** Keep existing structure + theme; EN = root locale; file moves non-destructive (EN files stay in place); files under 200 LOC where applicable; no secrets.
5. **Touchpoints:** `website/.vitepress/config.mjs` (add `locales`), `website/{guide,features,tutorials}/*.md` (edit), `website/vi/**` (new), `website/develop/**` + `website/vi/develop/**` (new), `website/public/img/**` (new), new Playwright capture script, README v1.14.0 + `docs/*` (read-only sources).

## Decisions (locked)

| Decision | Choice |
|---|---|
| Direction | Refresh to match v1.14.0 (keep structure + theme) |
| Audience | End-user + Contributor |
| Language | Bilingual EN+VI |
| Root locale | EN at `/`, VI at `/vi/` |
| Develop section | Bilingual (EN+VI) |
| Screenshots | Yes — Playwright-scripted, reproducible |

## Information Architecture

Keep 3 existing groups + add **Develop** (NEW):

```
Guide      (end-user)   getting-started · installation · keyboard-shortcuts
Features   (end-user)   overview + 10 feature pages          ← fix drift
Tutorials  (end-user)   14 walkthroughs                      ← fix drift + screenshots
Develop    (NEW, dev)   architecture · monorepo-structure · building-from-source · contributing
```

Develop pages **distill** from existing `docs/` (system-architecture, codebase-summary, code-standards) — link back, do not copy (DRY).

## Bilingual Structure (non-destructive)

```
website/
├── guide/ features/ tutorials/ develop/   ← EN (root locale, unchanged paths)
├── vi/
│   ├── guide/ features/ tutorials/ develop/   ← VI mirror
└── .vitepress/config.mjs   ← add locales: { root: en, vi }
```

## Screenshot Strategy

Repo already has Playwright. Write a capture script that boots app → navigates → captures standard states → saves `website/public/img/`. Re-run on UI change → images auto-refresh. Priority ~15-20 shots: tutorials (first-presentation, images, shapes, charts, presenting) + overview hero.

## Drift Inventory (verified: README v1.14.0 vs site)

| Page | Current (wrong) | Fix to |
|---|---|---|
| getting-started, overview | "6 design presets" | **39 presets / 7 categories** |
| overview (element table) | 7 element types | **19 canonical** (`client/src/data/element-defaults.js`) |
| overview | charts: bar/line/scatter | bar, line, **pie, doughnut, radar, polar** |
| first-presentation | press `F` to present | **`F5`** |
| multiple | missing | first-class vertical slides, **8 FX backgrounds**, ribbon UI, status bar, **35 layouts**, game mode |

## Phasing (each ships independently)

1. **Phase 1 — EN refresh:** fix drift across ~28 pages + home/overview. Shippable immediately.
2. **Phase 2 — Develop (EN):** 3-4 contributor pages distilled from `docs/`.
3. **Phase 3 — Screenshots:** Playwright capture script + embed into tutorials/features.
4. **Phase 4 — VI i18n:** add `locales` config + translate all end-user + Develop pages (full bilingual).

Order can be reordered/stopped per priority. VI always translates from already-correct EN.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Bilingual maintenance debt (×2 every doc) | EN canonical; VI mirrors; phase VI last so never translating wrong content |
| Screenshot rot on UI change | Playwright-scripted, not hand-captured |
| Drift recurs next release | (optional, YAGNI-aware) add doc-sync line to release checklist OR a test asserting "39 presets" matches real count |
| `ignoreDeadLinks: true` hides broken links | consider disabling after VI added to catch link errors |

## Approaches Considered

- **Phased (chosen):** EN-canonical first, VI mirror last. Each phase shippable; VI always from correct EN. Lowest risk, fastest value.
- **Full parallel (rejected):** all at once → EN accuracy blocked behind VI translation; error-prone.
- **IA redesign (rejected by user):** custom theme + new landing → high effort, touches stable running infra.

## Success Metrics

- Zero drift items remaining vs v1.14.0.
- `docs:build` green + Pages deploy success.
- VI locale browsable at `/vi/`.
- Develop section answers "how is it built / how to contribute" for a new dev.

## Open Questions

None — all decisions locked. (Optional future: whether to add an automated drift-guard test; deferred per YAGNI unless requested.)

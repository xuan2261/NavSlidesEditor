---
title: "Design Applicability Research"
type: research
created: 2026-05-13
---

# Design Applicability Research

## Summary

`DESIGN.md` describes a Claude-inspired warm editorial system: parchment canvas, ivory cards, terracotta CTA, warm neutrals, serif headings, ring shadows. It fits dashboard/onboarding/modals. It does not fit the slide canvas itself because user-authored decks need independent themes.

## Findings

| Area | Apply | Avoid |
| --- | --- | --- |
| Dashboard | Parchment background, serif hero, ivory cards, terracotta CTA | Heavy page hero that delays primary actions |
| Editor shell | Warm charcoal/light parchment tokens, better rings, softer panels | Serif labels, decorative illustrations |
| Toolbar | Warm surfaces, better active/disabled states, consistent icon sizing | Large rounded controls that reduce density |
| Properties panel | Better spacing, larger labels, grouped controls | Marketing-style card nesting |
| Slide canvas | Neutral workspace only | Mutating slide content, templates, export HTML |
| Modals | Strong scrim, ring border, warm card, focus trap | Overuse of `shadow-2xl` and ad hoc z-index |

## UX Rules From Skill

- Accessibility first: contrast, aria labels, keyboard nav, focus states.
- Touch/interaction: click/tap feedback, min useful hit area, no hover-only critical actions.
- Performance: no layout shifts, lazy heavy previews, avoid unnecessary font downloads.
- Animation: 150-300ms, transform/opacity only, reduced-motion support.

## Recommendations

- Convert DESIGN colors into semantic tokens. Do not paste raw hex through components.
- Use one icon family: Lucide for UI controls.
- Replace emoji status/icons in app UI where practical.
- Reserve serif for dashboard welcome, empty states, modal titles if not too dense.

## Unresolved Questions

- Exact accent split: terracotta for CTA only vs global accent.
- External font policy for desktop/offline builds.

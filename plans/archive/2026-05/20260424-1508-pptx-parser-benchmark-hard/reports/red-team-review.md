---
title: 'PPTX Parser Benchmark Red-Team Review'
date: '2026-04-24'
status: complete
---

# PPTX Parser Benchmark Red-Team Review

## Summary

Main risk: building a "looks editable" importer that loses fidelity silently. Plan must force parser evidence and fallback policy before implementation.

## Findings

| Severity | Finding | Mitigation |
| --- | --- | --- |
| High | Semantic parsers may hide unsupported OOXML details. | Use `pptx2json` raw fallback and source refs. |
| High | Tables/groups/connectors may parse but map poorly. | Score mapper feasibility separately from parse success. |
| High | Fidelity-first conflicts with editability. | User decision says fallback uncertain objects to placeholder/snapshot. |
| Medium | Parser packages may be stale or browser-only. | Benchmark install/runtime separately and isolate dependencies. |
| Medium | 4 decks may not cover charts/SmartArt enough. | Add future fixture backlog before production rollout. |
| Medium | Imported HTML content can introduce XSS. | Sanitize all rich text before TipTap/render. |
| Low | Raw outputs may expose sensitive content. | Store plan-scoped; avoid committing raw full content if sensitive. |

## Required Plan Changes

- Include go/no-go threshold.
- Include unsupported object list.
- Include parser failure taxonomy.
- Include intermediate model before direct NavSlides mapping.

## Verdict

Plan is viable if benchmark remains read-only and implementation is blocked until final decision report.

## Unresolved Questions

- Whether sample decks are safe to store derived raw JSON artifacts in git.


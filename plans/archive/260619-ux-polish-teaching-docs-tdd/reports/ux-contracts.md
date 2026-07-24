# UX Contracts

Date: 2026-06-20

## Contracts Implemented

- Insert teaching controls expose role/name reachability and helper descriptions:
  - `Add Mermaid diagram`
  - `Add STEM simulation`
  - `Add LaTeX / TikZ`
  - `Technical symbols`
  - `More advanced insert options`
- Enter/Space activate Insert controls and game/symbol choices.
- Selection from game and technical-symbol popups restores focus to the trigger.
- HTML/Mermaid warning is associated with the dialog; Mermaid length errors use `role="alert"`.
- LaTeX/TikZ helper and parse feedback are associated with the dialog; parse errors use `role="alert"`.
- STEM warning is associated with the dialog and source input; validation error uses `role="alert"`, `aria-invalid`, and `aria-describedby`.
- Game join empty-name validation is keyboard-submit reachable and announced with `role="alert"`.
- Dashboard/template empty states are distinct for loading, no built-in category results, marketplace no-results, no custom templates, trash empty, and no presentations.

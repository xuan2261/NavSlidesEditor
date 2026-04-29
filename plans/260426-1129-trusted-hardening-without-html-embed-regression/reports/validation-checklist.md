# Validation Checklist

## Decisions Locked
- HTML embed remains trusted programmable content.
- No generic full-presentation sanitizer.
- No blanket `allow-scripts` removal.
- No custom CSS removal.
- No auth/database migration.

## Phase Validation Questions

| Phase | Question | Expected Answer |
|---|---|---|
| 1 | Does plan preserve HTML embed? | Yes, tests enforce it. |
| 2 | Does analytics protection require auth? | No, use minimal share-token gate unless user decides otherwise. |
| 3 | Can room code alone become presenter? | No. Presenter token required. |
| 4 | Can custom endpoint call internal IP? | No, blocked unless explicit allowlist. |
| 5 | Can numeric inputs persist NaN? | No. |
| 6 | Are partial imports visible? | Yes, warnings/errors surfaced. |
| 7 | Does content safety touch HTML embed? | No. Text/markdown/svg only. |
| 8 | Do tests hit real endpoints? | Yes, env-configurable defaults match app. |
| 9 | Are docs updated? | Yes, policy/changelog/roadmap synced. |

## Final Verification Gate
- `npm run lint`
- `npm run test`
- `npm run build`
- focused `npm run test:e2e`
- k6 load tests when installed and server running.

## Unresolved Questions
- Analytics token policy exact UX.
- Local LLM allowlist policy.
- Electron sandbox follow-up scope.

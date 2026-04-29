# Red Team Review

## Summary
- Plan is implementable.
- Main risk: accidentally breaking HTML embed while fixing adjacent XSS surfaces.
- Second risk: live presenter token flow breaks existing live links if token is placed in shared URL.

## Findings

### 1. HTML embed regression risk
- If shared `element-renderers.js` gets a generic sanitizer, core product value breaks.
- Required guard: explicit tests proving HTML embed script still runs in editor/export.

### 2. Analytics protection could imply auth
- Project has no auth by design.
- Do not invent auth.
- Minimal viable rule: require valid share token for analytics read, or keep local-only admin route behind future decision.

### 3. Live presenter token propagation is tricky
- Room code cannot be presenter secret because it is shared.
- Token must not appear in viewer/remote/speaker link fields.
- If presenter page reload loses token, creating a new live room is acceptable unless user requires reconnect continuity.

### 4. AI SSRF vs local LLM conflict
- Blocking localhost protects servers but breaks local custom endpoints.
- Need env allowlist if local LLM is a supported use case.

### 5. File lock helpers can deadlock
- Avoid nested same-file locks.
- Keep locked callbacks simple and single-file.

### 6. Test phase can become a dumping ground
- Each implementation phase must add its own tests.
- Phase 8 only repairs global harness and cross-phase regression.

## Required Plan Adjustments
- Keep HTML embed preservation in every content safety phase.
- Mark Electron sandbox as decision/follow-up unless build verified.
- Keep auth/database out of scope.

## Unresolved Questions
- Is local custom AI endpoint officially supported?
- Should analytics be share-token gated or disabled in public mode until auth exists?

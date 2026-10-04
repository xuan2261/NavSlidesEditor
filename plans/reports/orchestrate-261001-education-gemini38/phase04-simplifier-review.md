1. **Low priority — render dice once per update.**  
   `shared/src/education/browser/games/name-picker.js:26–32,44`, `presentNamePicker.render`: entering dice mode calls `dice(...)` at line 31, then immediately rebuilds and replaces that entire subtree at line 44. Keep wheel/button initialization in the mode-change block; use line 44 as the sole dice-rendering path.

   **Preservation rationale:** `picker-visuals.js:26–38` builds deterministic DOM from the same arguments, without listeners or state changes. The first dice subtree is immediately discarded. Removing that construction preserves the final SVGs, accessible labels, reducer state, and scheduling while avoiding duplicate DOM allocation. No new abstraction or API change.

No correctness/security defect identified in the inspected phase04 paths.

**Scope/limits:** Reviewed current standalone runtime, host transport/bindings/session/commands, identity/config boundaries, bootstrap/timer support, and named HTML/Try/build/offline integration portions. Read selected tests and existing proof receipts; did not execute or independently reproduce them. No edits, nested tasks, tests, build, browser, or git execution. Scope came from the supplied gate and current source—not a freshly obtained diff. Same-model review, not a model-family-independent audit.
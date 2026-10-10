# JeikCode — per-task registry model routing (planning only)

Date: 2026-10-07
Status: PROPOSED / HOST_IMPLEMENTATION_NOT_AUTHORIZED / EDUCATION_DISPATCH_NOT_AUTHORIZED
Host scope: C:/Work/JeikCode. This planning artifact is stored in coordinator plans; no host source/config/binary changes.

## 1. Outcome
Allow the current coordinator to assign one subtask to `local8045/gemini-3.8-flash-high` without changing coordinator/global defaults or relying on a prompt assertion. Engine receipt must show requested and effective registry/provider/API-model identities. A registry declaration alone does not prove live model selection or runtime policy.

### Observed boundary
- Public `functions.task` currently supports description/difficulty/prompt/scope/subagent_type, not per-task model/provider.
- Installed user registry has target model. Existing `[subagent]` fields observed: enabled,initial_turns,max_turns,max_concurrent,timeout_secs,max_rounds; no supported separate model-pin field established.
- Actual schema-review task receipt observed `model=gpt-6.1-sol`, not Gemini. These research tasks are not education producer.
- JeikCode CLI binary supports --provider/--model; separate bounded startup did not prove effective subagent route. Do not repeat CLI startup/registry loops as substitute.
- Host source and compiled running binary equivalence not established. Local source is dirty; preserve concurrent work. The checked source locations below are anchors, not a promise every proposed type name already exists.

## 2. Minimal additive API
Add optional **model_id** to each object of `tasks`, not to top-level batch:

```json
{
  "tasks": [{
    "description": "Native new-subject implementation",
    "subagent_type": "worker",
    "difficulty": "hard",
    "model_id": "local8045/gemini-3.8-flash-high",
    "scope": ["tests/e2e/education/<approved-helper-files>"],
    "prompt": "<separately authorized bounded implementation>"
  }]
}
```

This is proposed syntax, NOT a currently callable tool invocation or education execution authorization.

Rules:
1. Missing model_id => existing difficulty/default routing unchanged, including existing context/budget behavior.
2. Present model_id => exact model registry lookup; overrides model choice only, not task type/write scope/concurrency/cancellation/timeout.
3. Empty/whitespace-only, unknown, malformed ID or nonexistent provider => reject before agent/provider construction/inference; no silent inherited fallback.
4. Use existing registry naming rules. Prefer fully qualified provider/model for explicit routing. If aliases supported elsewhere, do not accidentally accept ambiguous bare IDs via fuzzy/display-name lookup. Decide alias policy once and test.
5. If both difficulty and explicit model exist, difficulty remains scheduling/cost metadata; must not override model. No heuristic routing by prompt keywords.
6. Do not accept raw endpoint/API key/auth headers/provider JSON in tool args. Authorized registered providers only.
7. Check tool capability/permissions/budget before spawn; error instead of stripping tool requirements or upgrading privileges.

No new global config model fields required for MVP. Later defaults/difficulty pools would be a separate feature, not added to unblock one producer.

## 3. Resolve once and carry a task-scoped route
At dispatch snapshot config registry and parent execution context. Resolve explicit ID once through existing config resolver into a proposed immutable `ResolvedTaskRoute` containing only necessary nonsecret route identity plus existing authorized provider handle/factory references.

Proposed route identity (new design, not existing struct assertion):
- requested_model_id: Option<String>
- effective_registry_id: String
- provider_id: String
- api_model: String
- selection_source: explicit_task | legacy_difficulty | inherited
- registry/config generation identifier if existing machinery supports it (otherwise snapshot digest of nonsecret routing fields only)

Flow to inspect/modify at implementation:
`task schema -> parsed task -> request/runner boundary -> registry resolve -> task-local provider+agent creation -> execution lifecycle -> terminal receipt`.

Avoid half-binding bug: overriding only display/model string while retaining parent provider/client endpoint is invalid. Provider/auth/tool mode and effective API model must originate from the SAME resolved registry entry, preserving normal provider construction. Never copy secrets into the request/receipt or plan.

Do not mutate shared coordinator config or ModelConfig. Each concurrent task owns its route; reload cannot reselect explicit ID during a run. Resolve/auth/provider construction must use one consistent config generation or immutable snapshot; reading model and credentials from different generations is forbidden. Existing authorization/allowed-provider restrictions still apply: explicit model_id never grants access to a registry/provider the task was not otherwise permitted to use. Invalid model in one batch task should follow existing batch admission/error semantics; no neighboring task side effects. Decide fail-whole-batch vs per-task error from existing behavior, not silently invent new atomicity.

## 4. Source anchors and implementation reconnaissance
Already inspected directories/files:
- `crates/jeikcode-capabilities/src/tools/task.rs`: tool input schema, task parsing, difficulty, dispatch/result formatting and offline tests are primary anchors.
- `crates/jeikcode-config/src/config/mod.rs`: registry/provider resolution and SubagentConfig boundary.
- `crates/jeikcode-coding/src/parts.rs`: coding runner/context/provider construction wiring anchor.
- `crates/jeikcode-coding/src/config.rs`: task-scoped CodingConfig and inherited/default context boundary.
- `crates/jeikcode-tuix/src/`: UI runtime runner registration/receipt emission must be inspected if this is the live task path.
- CLI `crates/jeikcode-cli/src/main.rs`: relevant only if same capability wiring also serves CLI; no need to change CLI flags or defaults.

Do not treat earlier hypothesized names (e.g. SubAgentRunRequest/TUICodingSubAgentRunner) as verified public types without source lookup. The actual trait/request/result/selector names must be documented from the implementation snapshot before patch. Source matches varied across investigation, and code graph queries did not give an authoritative live-binary graph. No stale line-number edits.

Implementation entry gate: read host AGENTS.md, exact full relevant files and status/diff; identify concrete runtime runner/resolver/types/call sites; check dirty edits/collisions. If actual runner path cannot be identified, STOP instead of modifying only JSON schema. No broad host refactor.

## 5. Engine receipt / auditability
Add backward-compatible machine-readable route fields to each task result at admission and completion. Preserve existing task IDs/state/text/pagination/output limits.

Example NEW requested design:
```json
{
  "route": {
    "requested_model_id": "local8045/gemini-3.8-flash-high",
    "effective_registry_id": "local8045/gemini-3.8-flash-high",
    "provider_id": "local8045",
    "api_model": "gemini-3.8-flash-high",
    "selection_source": "explicit_task"
  }
}
```

Route values come from engine resolution and the actual provider request, never model self-report. For preflight failure requested ID may be shown; effective fields absent/status unresolved, not fabricated. For cancellation/spawn error retain last proven binding. Redact credentials, headers, userinfo/querystrings and avoid raw endpoint leakage. Field absence unknown, not default PASS.

Admission receipt distinguishes requested/resolved route from an actual dispatched request; before a request exists do not label the resolved API model as remotely served/verified. Completion receipts must preserve this distinction, and unobserved remote/gateway serving identity remains unknown. Extend machine-readable and bounded text rendering together; all lifecycle emitters must use the same task-local binding.

Never label `no_retry/no_fallback=true` simply because ID pinned. Registry binding guarantees no alternate MODEL/PROVIDER selection within task only if selection path enforces it. Same-provider SDK/gateway retries are separate.

## 6. Policy and non-goals
- Preserve current coordinator model/default configuration.
- Do NOT increase/change task timeouts, max turns, retries, assertions, fallback budgets or error classification.
- Do not implement hidden model fallback for explicit selection on429/tool failure/unknown ID. Return actual failure.
- Host existing automatic retry policy remains independently measured; this feature does NOT certify end-to-end no-retry. If explicit pin currently would enter alternate-model failover, fail closed or stop at scope decision; do not retrofit broad retry policy under this task.
- No setting edits, config reload, credential writing, gateway reconfiguration, deployments, installed binary replacement or live provider probes in planning/implementation tests.
- No D access, recovery, transcript receipt reconstruction or education source implementation.

## 7. TDD matrix — proposed, not executed
Use offline/mock provider/runner; no credentials or live inference.

### Red tests first
1. JSON schema model_id optional string; old task input accepted.
2. Parser preserves explicit qualified ID and detects empty/malformed/unknown ID without provider calls.
3. Explicit Gemini task binds provider local8045 AND API-model gemini-3.8-flash-high even when coordinator defaults GPT.
4. With model omitted legacy simple/hard/inheritance selection unchanged.
5. Explicit model wins over difficulty but scheduling/write scope stays unchanged.
6. Two concurrent tasks, different providers/models, no cross-task/parent mutations.
7. Config reload during run does not change task-bound explicit route.
8. Invalid task error follows prior batch isolation semantics, zero provider calls for invalid task.
9. Missing provider/tool capability/auth returns clear existing-safe error; no silent inherited/fallback call.
10.429/failure produces failure receipt retaining requested/effective route; zero alternate-model calls. Same-provider retry counts tested against existing policy, not quietly changed.
11. Context/token budgets/model capabilities from resolved entry, not coordinator model metadata.
12. Receipt derives engine values even if mock model says “I am GPT/Gemini”; aliases canonical identity preserved.
13. Admission/spawn/cancellation/timeout errors do not fabricate effective fields or leak auth.
14. Redaction tests: endpoint userinfo/query/header/api-key never appears in output/result/log fixtures.
15. Worker scope and explore read-only gates unaffected by explicit model.
16. Registry model ID containing slash routes exact qualified entry, no substring matching.
17. Capability/tool schema served to ACTIVE dispatcher includes new argument after updated build; unit schema alone not enough to claim installed feature.

### Focused closure
After all related authorized edits: run exact crate test targets determined by actual workspace metadata, plus formatting/lint/typecheck covering touched code. Commands must respect host AGENTS.md. This plan does not guess package names/target flags or require broad rebuild/deploy.

Optional integration later with explicit authority: one genuine pinned route request receipt, not a cost-free inference probe assumed safe. Live SDK/gateway no-retry evidence remains separately required. No permission for education acceptance54cells.

## 8. Incremental implementation scope proposal
Phase A: code/type/schema + resolver/runner mapping + offline tests/receipts only; no binaries installed. Before tests, verify Cargo toolchain/cache/output directories do not traverse D:, and budget C: build artifacts. If dependencies are absent, offline checks may be blocked; do not download/install/repoint caches without authority. Existing host dirty edits must be reviewed and preserved, not used as an implicit mandate to fix unrelated failures.
Phase B: review and build targeted host binary after approval, still do not replace current running application automatically.
Phase C: explicit operator-approved activation and check actual tool schema/engine receipt; app may need restart/new session (configreload cannot add a compiled tool argument).
Phase D: only after Gemini route/policy verified, seek separate bounded authority for fresh C education candidate26helpers;12caller/TDD/runtime/cutover/qualification scope stays separate.

No educational GREEN claim or hypothetical deployment completion. No commits/push/merge unless asked.

## 9. Stop conditions
- Exact live runner/registry wiring unavailable or host concurrent edits conflict.
- Proposed explicit selection requires changing coordinator or writing provider credentials.
- Tests need live API/D evidence or installed binary replacement without separate scope.
- Retry/fallback requirements require broad host/gateway redesign; split and seek decision rather than hide it.
- Active tool interface remains old after code/tests: report NOT_ACTIVE, not usable pin.

## Next user decision
Approve **Phase A implementation + offline tests only in hostJeikCode**, not host activation/deploy or education source. Expected deliverable: actual per-task model_id plumbing, failclosed validation, engine route receipt, offline test evidence, review of touched changes, no global configuration changes.

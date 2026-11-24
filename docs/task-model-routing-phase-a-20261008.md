# Task model routing — Phase A execution report (2026-10-08)

## Status

**IMPLEMENTED/PARTIALLY VERIFIED IN SOURCE; NOT_ACTIVE; Main review required. Do not declare Phase A complete from this report.** No host binary replacement, deployment, branch/rebase/commit, global configuration edit, live inference, API call, installation, education implementation, or D-drive access was performed. PR9 was not pursued.

Read coordinator AGENTS.md → CLAUDE.md, host C:/Work/JeikCode/AGENTS.md, and plans/jeikcode-per-task-model-routing-plan-20261007.md. Host source was already dirty on entry; the previous worker had implemented most of the chain. This continuation preserved it rather than rewriting it.

## Files and ownership

Host paths below are relative to C:/Work/JeikCode.

Directly edited by **this continuation**:
- crates/jeikcode-capabilities/src/tools/task.rs: terminal engine route progress event; executable test names use `per_task_model` or `explicit_model_id`; cancellation-before-request and unchanged worker scope admission tests.
- crates/jeikcode-coding/src/provider_factory.rs: explicit route ChatOptions no longer inherit coordinator sampling/tool-choice overrides; renamed executable routing tests; recording factory now returns an offline fake provider; new registry → resolver → TaskTool → actual child Agent runner → engine receipt integration test covering Gemini/GPT account separation and parent invariance.

Existing related dirty implementation reviewed/preserved:
- crates/jeikcode-capabilities/src/tools/mod.rs: exports TaskModelBinding/TaskModelResolver/validation.
- crates/jeikcode-capabilities/src/tools/task.rs: optional schema/parser field, admission validation and resolver, task-local provider/options, observed request boundary, receipts, failure isolation.
- crates/jeikcode-coding/src/config.rs: task_model_routing state/default.
- crates/jeikcode-coding/src/parts.rs: actual TaskTool registration receives resolver; session binding.
- crates/jeikcode-coding/src/provider_factory.rs: TaskModelRouting registry snapshot, exact resolution, cross-provider factory construction, refresh/install.
- crates/jeikcode-coding/src/runtime.rs: routing handle carried across provider reassembly.

Unrelated entry changes left untouched: crates/jeikcode-config/src/util.rs and docs/remote-portability-validation-2026-10-07.md.

**Important full-check side effects:** after `cargo check --offline --workspace`, additional asset differences appeared that were not present in initial status. Host AGENTS documents CLI build.rs synchronization from installed assets; these changes are consistent with that mechanism, but concurrent ownership is not proven. They were **not reverted**, to avoid losing another session's work. Main must review/isolate them; they are not feature edits:
- crates/jeikcode-capabilities/assets/.codegraphignore
- crates/jeikcode-capabilities/assets/builtin-tools.txt
- crates/jeikcode-capabilities/assets/teaches/00_overview_index.md
- crates/jeikcode-capabilities/assets/teaches/01_prompts_and_context.md
- crates/jeikcode-capabilities/assets/teaches/02_models_and_providers.md
- crates/jeikcode-capabilities/assets/teaches/03_mcp_and_skills.md
- crates/jeikcode-capabilities/assets/teaches/04_thesaurus_and_retrieval.md
- crates/jeikcode-capabilities/assets/teaches/06_directories_and_system.md
- crates/jeikcode-capabilities/assets/teaches/07_project_constraints_and_rules.md
- crates/jeikcode-capabilities/assets/teaches/08_updates_and_releases.md
- crates/jeikcode-cli/assets/config_teachs.md
- crates/jeikcode-coding/assets/prompts/root_docs_prompts.md
- crates/jeikcode-coding/assets/prompts/root_docs_内置工具.yaml
- crates/jeikcode-coding/assets/prompts/rules.yaml

Report written at C:/Work/NavSlidesEditor/docs/task-model-routing-phase-a-20261008.md. Verification logs/metadata are ignored build artifacts in C:/Work/JeikCode/target, not deliverable source edits.

## Actual code chain (not hypothetical runner names)

1. `TaskTool::parameters_schema` exposes optional per-item string `model_id`; `SubTask` and `parse_task_args` preserve it. Omitted is None; explicit null is rejected. Existing repair-aware scope/type risk checks remain.
2. `TaskTool::execute` checks worker scope before resolution, preserves simple/hard factories when omitted, and calls its `TaskModelResolver` when explicit. Unknown/invalid/unavailable/mismatched binding is a per-task error, never inherited fallback. Existing partial-batch semantics remain: overall error only if all subtasks fail.
3. Actual production `TaskTool::new` registration found in `jeikcode-coding/src/parts.rs` (`prepare_with_plugin_hooks_reusing_lease`); no separate `SubAgentRunner` implementation was found. All child execution is through TaskTool's `Agent::builder` and `run_child_to_completion`, not a hypothesized UI runner trait.
4. `CodingAgentConfig::from_config` captures `subagent_config`; daemon live_api also supplies that registry. `CodingRuntime::start` installs routing using the runtime's `CodingProviderFactory`. `install_subagent_tiers` creates TaskModelRouting; runtime reassembly carries it and refresh updates a complete generation.
5. `TaskModelRouting::resolve` clones the locked factory/base/registry generation, uses qualified ID exact `logical_models().get(id)` (no fuzzy/display-name/bare aliases), requires matching account and known provider preset, then `Config::resolve_model(Some(id))`. It derives model/protocol/context/token/reasoning metadata, overwrites endpoint and API key (missing key becomes empty rather than parent key), and builds using the same runtime factory/authentication seam. Provider model-name consistency is checked. The per-task Arc survives later refresh.
6. TaskTool builds each child with the bound provider and ChatOptions, same worker/explore tools/persona/middleware, concurrency semaphore, max rounds, cancellation, and tool-loop policy. No retry/fallback policy was changed.
7. `ObservedTaskProvider::chat_stream` marks the actual local provider request boundary. Admission `<task_route>` has resolved IDs but null effective model. Completion emits the task-local route to progress and `<route>` JSON inside existing task result/error blocks. Effective API model is populated only after local provider call. `remote_serving_identity` remains null even on success. Provider failure retains proven binding, with generic safe diagnostics; unresolved IDs do not fabricate effective fields.

Actual receipt keys are `requested_model_id`, `resolved_registry_id`, `provider_id` (account identity), `resolved_api_model`, `selection_source`, `status`, `effective_api_model`, `remote_serving_identity`. These differ intentionally from the proposed plan example's names; no claim of remote service verification is made.

## Offline verification — actual counts, not zero-test filter success

Working directory C:/Work/JeikCode. Executable for every command: `C:/Users/Z10PAD8C_Xuan2261/.cargo/bin/cargo.exe` (cargo 1.93.0). First ran `metadata --offline --no-deps --format-version 1` successfully, output target/task-routing-metadata.json; observed builds/tests use C:/Work/JeikCode/target. Prior Main C-drive toolchain verification was accepted; no cache install/repoint was performed.

Final commands and results:

```text
cargo.exe test --offline -p jeikcode-capabilities -p jeikcode-coding --lib per_task_model
  capabilities: 7 passed, 0 failed, 1475 filtered out
  coding: 2 passed, 0 failed, 373 filtered out
cargo.exe test --offline -p jeikcode-capabilities -p jeikcode-coding --lib explicit_model_id
  capabilities: 3 passed, 0 failed, 1479 filtered out
  coding: 1 passed, 0 failed, 374 filtered out
cargo.exe test --offline -p jeikcode-capabilities --lib tools::task::tests
  33 passed, 0 failed, 872 filtered out
cargo.exe check --offline --workspace
  exit 0, Finished dev profile in 1m19s
 git diff --check
  exit 0
```

**13 unique focused routing tests** (9 per_task_model + 4 explicit_model_id), plus 33-test TaskTool regression run (overlaps focused tests; do not sum as unique). All commands exit 0; no compile/test errors. Existing unused import/variable/dead-code warnings emitted in config/capabilities; not repaired out of scope. No whole-worktree formatter executed.

Final logs:
- target/task-routing-per-task-tests.log
- target/task-routing-explicit-tests.log
- target/task-routing-task-tests.log
- target/task-routing-workspace-check.log

Focused names:
- per_task_model_schema_and_parse_are_additive
- per_task_model_forwards_bound_options_and_engine_receipt
- per_task_model_omitted_preserves_difficulty_factories
- per_task_model_provider_error_retains_binding_without_fallback
- per_task_model_concurrent_routes_override_difficulty_and_isolate_failures
- per_task_model_cancel_before_request_retains_only_resolved_binding
- per_task_model_worker_scope_admission_unchanged
- per_task_model_binds_cross_provider_and_survives_refresh
- per_task_model_registry_to_fake_runner_receipts_and_parent_invariance
- explicit_model_id_without_resolver_never_inherits
- explicit_model_id_binding_mismatch_rejected_before_spawn
- explicit_model_id_invalid_or_unknown_never_mounts_or_falls_back
- explicit_model_id_invalid_registry_never_constructs_provider

Mocks do not call APIs. Integration test runs genuine child Agent lifecycle with fake providers, not merely schema checks. Barrier-based concurrent task test verifies two different identities can execute simultaneously without crossing bindings. Registry refresh test proves an already-bound provider remains on original API model. Error receipt test covers nonretryable provider failure; cancellation test proves no effective API model is fabricated before a request. Scope/risk test preserves worker scope gate and existing TaskTool tests cover inherited scope/middleware behavior.

## Limits / remaining Main review gates

- NOT_ACTIVE: installed/running host schema and receipt were not changed or probed. Workspace typecheck does not certify activation.
- Source central runner chain identified; no per-frontend live dispatcher invocation was performed. No independent frontend runtime test added; central shared registration and workspace compile are evidence, not live CLI/TUI/daemon equivalence proof.
- No new offline test for actual HTTP 429 retry counts, spawn panic, timeout, or missing tool capability/authentication failure. Existing factory authentication seam is retained; this does not establish every allowed-provider/capability policy permutation.
- Terminal routes now emit through progress and task output. Outer JoinSet panic accounting still uses existing behavior; not reworked. Production panic=abort limits crash receipt claims.
- No public registry generation/digest appears in receipt; snapshot consistency is internal. Concurrent config refresh vs resolution not stress-tested beyond retaining an earlier binding after refresh.
- No teaches feature paragraph was manually added. Full workspace check altered embedded teaches/assets through existing build synchronization (or concurrent session); Main must resolve provenance before treating docs as final.
- No end-to-end no-retry/no-fallback certification for SDK/gateway; explicit route bypasses legacy model selection but preserves normal same-provider retry machinery.
- Report and final changes need Main review; additional gates and unintended asset diffs prevent an unconditional Phase A completion declaration.

# Host per-task model routing — PhaseA settlement (2026-10-08)

**Source implementation + bounded offline validation complete; FULL RUNTIME ACCEPTANCE UNRESOLVED; NOT ACTIVE.**

Source anchors: task.rs (TaskModelBinding/TaskModelResolver and per-taskmodel_id), coding/provider_factory.rs, coding/parts.rs.
Preserve original dirty/concurrent changes; this report is not hunk ownership or byte-baseline certification.

Actual final offline checks: [[["test", "--offline", "-p", "jeikcode-capabilities", "tools::task", "--lib"], [["38", "0"]], 0], [["test", "--offline", "-p", "jeikcode-coding", "task_model", "--lib"], [["3", "0"]], 0], [["test", "--offline", "-p", "jeikcode-coding", "provider_factory", "--lib"], [["9", "0"]], 0], [["check", "--offline", "-p", "jeikcode", "-p", "jeikcode-tuix"], [], 0]].
Task module38passed, task_model3passed, provider_factory9passed; CLI/TUI consumer compilecheck exit0. These sets may overlap with earlier filters: do not sum earlier per_task_model11 or initial33/5 into a unique total. Whitespace diff check0.

Independent review reported no blocking source bug in inspected scope. Mock/snapshot/adapter tests still do not demonstrate actualproviderreassembly and running/queued completion across realreload. Full remaining evidence included in phase-a-settlement.json from persisted/runtime reports; no fictional closed criteria.

Current running task interface still has no model_id. No host activation/install, config/retry/timeout change, remote provider call, education producer/source/candidate/test, D access, PR9 branch action or merge/commit/push/deploy.

## Next
Close the narrow actual runtime-reassembly/reload harness gap before activating. If necessary seam extends beyond current small patch, present exact design/scope, not permission loops or liveAPIprobe. Then separately approve hostbuild/activation. Only after effective Gemini/policy proof consider freshC education candidate authority; NF-A4excluded/unresolved and54/0/0 remain.

"""Record actual PhaseA source/test limits; no provider call or activation."""
import hashlib
import json
import pathlib
import subprocess

OUT = pathlib.Path(__file__).parent
HOST = pathlib.Path('C:/Work/JeikCode')
checks = json.loads((OUT / 'closure-check-results.json').read_text(encoding='utf-8'))
review = json.loads((OUT / 'independent-review.json').read_text(encoding='utf-8'))
runtime = json.loads((OUT / 'runtime-offline-integration.json').read_text(encoding='utf-8'))
persisted = json.loads((OUT / 'persisted-route-tests.json').read_text(encoding='utf-8'))
assert all(check['exitCode'] == 0 for check in checks['checks'])
assert all(int(failed) == 0 for check in checks['checks'] for passed, failed in check['counts'])
assert not review['blockingFindings']
files = ['crates/jeikcode-capabilities/src/tools/task.rs',
         'crates/jeikcode-coding/src/provider_factory.rs',
         'crates/jeikcode-coding/src/parts.rs']
current = []
for rel in files:
    p = HOST / rel
    if p.is_file():
        current.append({'path': rel, 'sha256ObservedCurrentBytes': hashlib.sha256(p.read_bytes()).hexdigest()})
snapshots = []
for root in [HOST, pathlib.Path('C:/Work/NavSlidesEditor'), pathlib.Path('C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001')]:
    snapshots.append({'root': root.as_posix(),
                      'branch': subprocess.check_output(['git', '-C', str(root), 'branch', '--show-current'], text=True).strip(),
                      'HEAD': subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip(),
                      'stagedPaths': subprocess.check_output(['git', '-C', str(root), 'diff', '--cached', '--name-only'], text=True).splitlines(),
                      'status': subprocess.check_output(['git', '-C', str(root), 'status', '--porcelain=v1', '--untracked-files=normal'], text=True).splitlines()})
whitespace = subprocess.run(['git', '-C', str(HOST), 'diff', '--check'], capture_output=True, text=True)
assert whitespace.returncode == 0
report = {
    'kind': 'HOST_PHASE_A_PARTIAL_ACCEPTANCE_SETTLEMENT',
    'date': '2026-10-08',
    'status': 'SOURCE_IMPLEMENTATION_AND_BOUNDED_OFFLINE_CHECKS_COMPLETE_FULL_RUNTIME_ACCEPTANCE_UNRESOLVED_NOT_ACTIVE',
    'meaning': 'No claim that every planned acceptance criterion or live model routing has passed. Source feature exists with passing bounded offline tests; precise remaining runtime proof is retained below.',
    'implemented': ['Optional per-task model_id input/schema and task-local binding/resolver',
                    'Explicit registry resolution/provider factory plumbing and engine-generated route data',
                    'Coding runtime resolver injection and offline task/provider/snapshot mocks'],
    'sourceAnchors': current,
    'ownershipLimit': 'Host had preexisting dirty changes/concurrent edits. Current source hashes and Git diff are not a claim all touched-file hunks originated in this request. No reset/staging/commit performed.',
    'observedOfflineChecks': checks,
    'independentSourceReview': review,
    'runtimeOfflineAcceptance': runtime,
    'persistedSnapshotCoverage': persisted,
    'remainingAcceptanceMeaning': 'Actual provider reassembly and running/queued binding completion under real reload are not proven by the subset/snapshot mocks. Installed tool schema and remote serving/retry policy also remain unverified. Retain original report detail, do not replace with an all-GREEN summary.',
    'activeToolStillOld': 'Current tool functions.task schema has no model_id; no binary replacement/activation attempted. Do not invoke proposed parameter or claim Gemini producer ran.',
    'policy': {'coordinatorAndGlobalConfigEditedByAgent': False, 'retryTimeoutPolicyChangedByAgent': False,
               'hostBinaryInstalledOrActivated': False, 'remoteProviderCalledForFeatureTests': False,
               'educationProducerInvoked': False, 'educationSourceEdited': False,
               'educationCandidateCreated': False, 'educationAcceptanceExecuted': 0,
               'DReadIntendedOrPerformedByAgent': False, 'PR9Action': 'User withdrew request; no fetch/rebase/PR action performed.',
               'NF_A4': 'EXCLUDED_SOURCE_MECHANISM_CONFIRMED_SCOPE_APPLICABILITY_UNRESOLVED'},
    'whitespaceDiffCheckExit': whitespace.returncode,
    'gitObservedFinal': snapshots,
    'nextRecommendation': 'Before activation, close the actual provider-reassembly/running-queued reload acceptance using a minimal offline runtime harness if an existing safe injection seam is available. If new architectural testability seam is necessary, present exact scope and rationale first; do not substitute live inference or inflate limits. After full source acceptance separately approve build/activation of host tool schema. Education implementation remains separate authority.',
    'notNext': ['No automatic install/deploy', 'No pinned-producer substitution', 'No repetitive registry/CLI startup proof loops',
                'No user-config model override guesses', 'No education smoke/qualification or historical PASS']
}
with (OUT / 'phase-a-settlement.json').open('x', encoding='utf-8', newline='') as stream:
    json.dump(report, stream, ensure_ascii=False, indent=2)
counts = [(check['command'], check['counts'], check['exitCode']) for check in checks['checks']]
summary = f'''# Host per-task model routing — PhaseA settlement (2026-10-08)

**Source implementation + bounded offline validation complete; FULL RUNTIME ACCEPTANCE UNRESOLVED; NOT ACTIVE.**

Source anchors: task.rs (TaskModelBinding/TaskModelResolver and per-taskmodel_id), coding/provider_factory.rs, coding/parts.rs.
Preserve original dirty/concurrent changes; this report is not hunk ownership or byte-baseline certification.

Actual final offline checks: {json.dumps(counts, ensure_ascii=False)}.
Task module38passed, task_model3passed, provider_factory9passed; CLI/TUI consumer compilecheck exit0. These sets may overlap with earlier filters: do not sum earlier per_task_model11 or initial33/5 into a unique total. Whitespace diff check0.

Independent review reported no blocking source bug in inspected scope. Mock/snapshot/adapter tests still do not demonstrate actualproviderreassembly and running/queued completion across realreload. Full remaining evidence included in phase-a-settlement.json from persisted/runtime reports; no fictional closed criteria.

Current running task interface still has no model_id. No host activation/install, config/retry/timeout change, remote provider call, education producer/source/candidate/test, D access, PR9 branch action or merge/commit/push/deploy.

## Next
Close the narrow actual runtime-reassembly/reload harness gap before activating. If necessary seam extends beyond current small patch, present exact design/scope, not permission loops or liveAPIprobe. Then separately approve hostbuild/activation. Only after effective Gemini/policy proof consider freshC education candidate authority; NF-A4excluded/unresolved and54/0/0 remain.
'''
with (OUT / 'phase-a-summary.md').open('x', encoding='utf-8', newline='') as stream:
    stream.write(summary)
print('Saved partial-acceptance settlement. Final tests38/3/9 and consumer check0 verified; not activated, remaining full runtime acceptance explicit.')

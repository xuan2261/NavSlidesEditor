"""Settle blocked build honestly, without source fixes or installed-binary edits."""
import hashlib
import json
import pathlib
import subprocess

OUT = pathlib.Path(__file__).parent
before = json.loads((OUT / 'before.json').read_text(encoding='utf-8'))
build = json.loads((OUT / 'build-result.json').read_text(encoding='utf-8'))
schema = json.loads((OUT / 'schema-source-corrected.json').read_text(encoding='utf-8'))
root = pathlib.Path(before['host'])
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assert build['exitCode'] != 0
assert schema['exitCode'] == 0 and schema['counts'] == [['1', '0']]
source_changes = [f for f, fingerprint in before['source'].items() if sha(root / f) != fingerprint]
assert not source_changes
installed = pathlib.Path(before['installedExecutable']['path'])
assert sha(installed) == before['installedExecutable']['sha256']
assert not (OUT / 'candidate/jeikcode.exe').exists()
branch = subprocess.check_output(['git', '-C', str(root), 'branch', '--show-current'], text=True).strip()
head = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
assert branch == before['branch'] and head == before['HEAD']
staged = subprocess.check_output(['git', '-C', str(root), 'diff', '--cached', '--name-only'], text=True).splitlines()
assert not staged
status = subprocess.check_output(['git', '-C', str(root), 'status', '--porcelain=v1', '--untracked-files=all'], text=True).splitlines()
check = subprocess.run(['git', '-C', str(root), 'diff', '--check'], capture_output=True, text=True)
assert check.returncode == 0
assert any('persona.rs' in f for f in before['status']), 'Do not classify defect as preexisting without status evidence'
report = {
    'date': '2026-10-08', 'status': 'BUILD_BLOCKED_NO_CANDIDATE_NOT_ACTIVE',
    'blocker': {'code': 'E0599', 'path': 'crates/jeikcode-coding/src/persona.rs',
                'detail': 'Locale::Vi referenced in dirty preexisting persona source; crates/jeikcode-config/src/locale.rs defines only Locale::Zh and Locale::En.',
                'sourceRepairApplied': False,
                'whyNotAutoRepair': 'Current request authorizes artifact build/verification, not unrelated Vietnamese locale design or deleting preexisting source edits. Adding a new enum variant may require exhaustive matches/translations/config/tests; removing the branch would discard preexisting changes.'},
    'buildEvidence': build,
    'schemaEvidence': schema,
    'schemaLimit': 'One compiled capabilities source test passed. No CLI candidate exists and active host schema is unchanged; this is NOT artifact or activation verification.',
    'initialIncorrectFilter': 'schema-source-check.json ran zero tests, retained and explicitly excluded from verification credit.',
    'preservation': {'selectedSourceFingerprintsUnchanged': True, 'sourceBaselineIsSelectedNotFullFreeze': True,
                     'installedExecutableUnchanged': True, 'installedPath': installed.as_posix(), 'installedSHA256': sha(installed),
                     'branchUnchanged': branch, 'HEADUnchanged': head, 'staged': staged, 'diffCheckExitCode': check.returncode,
                     'gitStatusUnchanged': status == before['status'], 'finalStatus': status},
    'buildIsolation': {'homeSandbox': build['homeSandbox'], 'realUserHomeSyncAvoided': True,
                       'sandboxFilesObserved': [str(p.relative_to(OUT / 'build-home')) for p in (OUT / 'build-home').rglob('*') if p.is_file()],
                       'candidateDirectoryEmpty': not any((OUT / 'candidate').iterdir()),
                       'debugTargetCacheUsed': True, 'noReleaseBuildOrInstall': True,
                       'temporaryLongCommandKeywordRemovedSeparately': True},
    'effects': {'coordinatorModelChanged': False, 'globalConfigEdited': False, 'retryTimeoutPolicyChanged': False,
               'sourceEditedByThisRequest': False, 'providerInference': False, 'DReadByAgent': False,
               'binaryActivated': False, 'educationSourceOrCandidateChanged': False,
               'educationAcceptanceExecuted': 0, 'commitPushMergeDeploy': False},
    'nextDecision': {'recommended': 'Reconcile the preexisting Vietnamese-locale changes with their owner; after coherent source and offline tests, rebuild the separate artifact. Keep activation and education execution separate.',
                     'authorizationIfAgentFixRequested': 'Authorize a separate bounded Locale::Vi consistency fix preserving the preexisting Vietnamese persona, with full locale/exhaustive-match/config tests; first survey exact affected paths. Do not blindly delete the branch or add the enum solely to get GREEN.',
                     'alternative': 'Use an explicitly selected coherent source snapshot/worktree after authorization; do not reset/stash dirty source or pretend a clean HEAD contains the routing patch.',
                     'notRecommended': 'No arbitrary checkout, retry/timeout change, assertion reduction, older artifact substitution or live startup probe.'}
}
with (OUT / 'settlement.json').open('x', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
with (OUT / 'summary.md').open('x', encoding='utf-8') as f:
    f.write('''# Artifact build — blocked settlement (2026-10-08)

**BUILD_BLOCKED_NO_CANDIDATE_NOT_ACTIVE**

Offline debug candidate build failed with E0599: preexisting dirty `persona.rs` references `Locale::Vi` while current enum defines only Zh/En. No unrelated locale repair/deletion performed. The build home was sandboxed on C: because CLI build.rs otherwise syncs user-home assets. Installed executable and selected source fingerprints unchanged; branch/HEAD preserved, no staged paths, diff-check0.

One genuine compiled capabilities schema test (`per_task_model_schema_and_parse_are_additive`) passed. Initial incorrect filter ran0tests and is preserved without completion credit. This proves only source-schema coverage, NOT a CLI artifact or active tool schema. No candidate executable created; no activation/provider inference/education execution.

## Next decision
Reconcile preexisting Vietnamese locale source with its owner. If agent repair is desired, authorize a bounded locale-consistency survey/fix preserving current changes and exhaustive locale tests, then repeat artifact build from the coherent source. Do not blindly delete a branch, add an enum just to get GREEN, reset the worktree or substitute an old binary. Activation requires a separate deliberate step after artifact exists.
''')
print('BLOCKED settlement saved. Installed executable/source unchanged; schema source test1passed, candidate absent.')

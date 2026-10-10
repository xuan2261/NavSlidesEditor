"""Preparation-only: inventory C: input text and write draft documents, never dispatch."""
import datetime
import hashlib
import json
import os
import pathlib
import re
import stat
import subprocess

ROOT = pathlib.Path('C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001')
DEST = pathlib.Path(__file__).parent
OLD = ROOT / 'plans/reports/education-partial11-settlement-20261007'
PREFIX = 'D:/NavSlidesQualification/edu-resume-261004/pending-substrate-candidate-11-partial/'


def save(name, data):
    text = json.dumps(data, ensure_ascii=False, indent=2) if not isinstance(data, str) else data
    with (DEST / name).open('x', encoding='utf-8', newline='') as stream:
        stream.write(text)


def scan(root):
    files, links, errors = [], [], []
    stack = [root]
    while stack:
        p = stack.pop()
        try:
            s = p.lstat()
            if s.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                links.append({'path': p.as_posix(), 'target': os.readlink(p).replace(chr(92), '/'), 'followed': False})
                continue
            with os.scandir(p) as entries:
                for item in entries:
                    q = pathlib.Path(item.path)
                    st = item.stat(follow_symlinks=False)
                    if st.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                        links.append({'path': q.as_posix(), 'target': os.readlink(q).replace(chr(92), '/'), 'followed': False})
                    elif item.is_dir(follow_symlinks=False):
                        stack.append(q)
                    elif item.is_file(follow_symlinks=False):
                        files.append(q)
        except OSError as exc:
            errors.append({'path': p.as_posix(), 'error': str(exc)})
    return files, links, errors


scans = {}
source_files = []
for name in ['shared', 'tests', 'client', 'server', 'scripts', 'config', 'electron', 'vendor-overrides', 'website', 'node_modules']:
    files, links, errors = scan(ROOT / name)
    scans[name] = {'regularFiles': len(files), 'links': links, 'errors': errors, 'noReparseTraversed': True}
    if name != 'node_modules':
        source_files.extend(files)

integrated = json.loads((OLD / 'native11-integrated-report.json').read_text(encoding='utf-8'))
required38 = integrated['readEvidence']['helpers'] + integrated['readEvidence']['callers']
current_presence = []
for item in required38:
    rel = 'tests/e2e/education/' + item['file']
    p = ROOT / rel
    exists = p.is_file()
    current_presence.append({'relativePath': rel, 'present': exists,
                             'sha256CurrentCBytes': hashlib.sha256(p.read_bytes()).hexdigest() if exists else 'NOT_PRESENT',
                             'equivalentToFrozen11': 'NOT_ESTABLISHED'})

historical_index = json.loads((OLD / 'retained-transcript-outputs/Partial11NativeSalvage/index.json').read_text(encoding='utf-8'))
comparison = []
for item in historical_index['files']:
    original = item['originalPath']
    if not original.startswith(PREFIX):
        continue
    rel = original[len(PREFIX):]
    p = ROOT / rel
    comparison.append({'originalRecordedPath': original, 'currentRelativePath': rel,
                       'presentCurrentC': p.is_file(), 'contentEqualityToFrozen11': 'NOT_ESTABLISHED',
                       'meaning': 'Presence comparison only; transcript text and current source are distinct subjects.'})

pkg = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
lock = json.loads((ROOT / 'package-lock.json').read_text(encoding='utf-8'))
versions = []
for name in ['@playwright/test', 'playwright', 'playwright-core', 'vite', 'vitest', 'esbuild', 'electron', 'reveal.js']:
    p = ROOT / 'node_modules' / name / 'package.json'
    installed = json.loads(p.read_text(encoding='utf-8'))['version'] if p.is_file() else 'NOT_PRESENT'
    locked = lock.get('packages', {}).get('node_modules/' + name, {}).get('version', 'NOT_PRESENT')
    versions.append({'package': name, 'declared': pkg.get('devDependencies', {}).get(name, pkg.get('dependencies', {}).get(name, 'TRANSITIVE')),
                     'locked': locked, 'installedManifest': installed, 'lockedInstalledMatch': locked == installed,
                     'executableHealth': 'NOT_EXECUTED'})

browsers = json.loads((ROOT / 'node_modules/playwright-core/browsers.json').read_text(encoding='utf-8'))
cache = pathlib.Path('C:/Users/Z10PAD8C_Xuan2261/AppData/Local/ms-playwright')
cache_files, cache_links, cache_errors = scan(cache)
cache_names = [p.name for p in cache.iterdir()]
static_d_refs = []
for p in source_files:
    if p.suffix.lower() not in ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.yml', '.yaml', '.html']:
        continue
    try:
        text = p.read_text(encoding='utf-8')
    except (UnicodeError, OSError):
        continue
    for n, line in enumerate(text.splitlines(), 1):
        if re.search(r'(?i)\bD:[/\\]|NavSlidesQualification', line):
            static_d_refs.append({'path': p.relative_to(ROOT).as_posix(), 'line': n, 'text': line[:300],
                                  'meaning': 'Literal static reference; not proof of executed access. Exclude this script from future D-free execution unless reviewed.'})

fingerprint_paths = sorted(set([ROOT / x['relativePath'] for x in current_presence if x['present']] +
                              [p for p in source_files if p.suffix.lower() in ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.html', '.css', '.vue']] +
                              [ROOT / 'package.json', ROOT / 'package-lock.json', ROOT / 'playwright.config.js', ROOT / 'runtime-versions.json']))
fingerprints = [{'relativePath': p.relative_to(ROOT).as_posix(), 'sizeBytes': p.stat().st_size,
                 'sha256CurrentCBytes': hashlib.sha256(p.read_bytes()).hexdigest()} for p in fingerprint_paths]
head = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], text=True).strip()
branch = subprocess.check_output(['git', '-C', str(ROOT), 'branch', '--show-current'], text=True).strip()
status = subprocess.check_output(['git', '-C', str(ROOT), 'status', '--porcelain=v1', '--untracked-files=all'], text=True).splitlines()
prior_status = [x for x in status if not any(t in x for t in ['education-partial11-settlement-20261007/', 'education-partial11-access-diagnostic-20261007/', 'education-c-only-correction-preparation-20261007/'])]

legacy = json.loads((OLD / 'retained-transcript-outputs/Partial11NativeSalvage/014-pending-substrate-11-dispatch-authority.json-read-001.txt').read_text(encoding='utf-8'))
native = json.loads((OLD / 'native11-complete-settlement-v2.json').read_text(encoding='utf-8'))

save('c-only-readiness.json', {
    'date': '2026-10-07', 'scope': 'PREPARATION_ONLY_NO_DISPATCH',
    'verdict': 'C_SOURCE_READABLE_NEW_SUBJECT_FEASIBLE_CONDITIONAL_NOT_EXECUTION_READY',
    'DProbedOrReadThisRequest': False, 'sourceEdited': False, 'projectImportedOrExecuted': False,
    'codegraph': 'Four C-directory code_explore calls found no index; no init or index creation. Static grep/read tracing used.',
    'git': {'branch': branch, 'HEAD': head, 'preexistingStatus': prior_status, 'staged': False},
    'reparseSafety': scans,
    'currentRequired38Presence': {'required': 38, 'present': sum(x['present'] for x in current_presence),
                                'missing': sum(not x['present'] for x in current_presence), 'files': current_presence},
    'recordedFrozenPathPresenceComparison': comparison,
    'meaning': 'Current C baseline is not frozen11. Missing helpers/callers must be freshly implemented/authored only with new authority; no transcript-to-source reconstruction.',
    'dependencies': versions,
    'browserCache': {'root': cache.as_posix(), 'directoryNames': cache_names,
                     'expectedFromInstalledPlaywright': browsers['browsers'],
                     'regularFiles': len(cache_files), 'linksNotFollowed': cache_links, 'errors': cache_errors,
                     'usableBrowserExecution': 'NOT_TESTED', 'archiveQualification': 'NOT_ESTABLISHED'},
    'staticDReferences': static_d_refs,
    'capacity': {'reportedCFreeBytes': 12284583936, 'reportedCSizeBytes': 256057651200,
                 'copiedCandidateBudgetVerified': False, 'meaning': 'About11.4GiB free; no guarantee of capacity for snapshot/build/browser/desktop artifacts. Budget before candidate creation; no deletion approved.'},
    'toolMetadata': {'nodePath': 'C:/nvm4w/nodejs/node.exe',
                     'nodeDirectoryTarget': 'C:/Users/Z10PAD8C_Xuan2261/AppData/Local/nvm/v22.22.0',
                     'nodeExecutableFileVersion': '22.22.0', 'nodeExecution': False,
                     'nodeOptionsEnvironment': 'NOT_SET', 'nodePathEnvironment': 'NOT_SET',
                     'playwrightBrowsersPathEnvironment': 'NOT_SET',
                     'PATHCaution': 'PATH has legacy D entries; no executable resolution should search D. Future allowed execution must use verified explicit C executable and reviewed C-only environment.'},
    'executionHazards': [
        'Playwright globalSetup sends DELETE /api/test/cleanup and fixtures create/update/delete data; preparation does not authorize these.',
        'Playwright config webServer launches builds and server/client; testing is not read-only.',
        'qualificationReporters creates output directory when loaded. No config import was performed.',
        'Default artifact root still contains prior labels; new environment must explicitly bind outputs/data/temp to unique C paths.',
        'Generated education runtime assets and source equivalence not verified by manifest/source reads.',
        'Installed-lock package agreement does not certify native binaries, browser dependencies or reproducibility.',
        'Historical producer429/auto_retry evidence does not certify present quota or no-retry/no-fallback enforcement. No inference to probe it.'
    ],
    'flags': {'admission': False, 'sourceReady': False, 'qualification': False, 'passClaimed': False,
              'producerInvoked': False, 'sourceEdited': False, 'runtimeExecuted': False,
              'declaredCells': 54, 'admittedCells': 0, 'executedCells': 0}
})
save('current-c-input-fingerprints.json', {
    'kind': 'PREPARATION_CURRENT_C_INPUT_FINGERPRINTS_NOT_FROZEN_SUBJECT',
    'root': ROOT.as_posix(), 'hashMeaning': 'Fresh hashes of explicitly readable current C inputs, never historical frozen11 hash.',
    'completeRecursiveFreeze': False, 'nodeModulesImmutable': False,
    'excluded': ['D evidence', 'node_modules bodies/junction targets', 'Git metadata', 'data', 'dist/build artifacts', 'reports'],
    'files': fingerprints
})

candidate = 'C:/Work/NavSlidesQualification/education-new-subject-20261007'
authority = {
    'status': 'DRAFT_NOT_AUTHORIZED_NOT_DISPATCHED',
    'name': 'C_ONLY_NEW_SUBJECT_CORRECTION_PROPOSAL',
    'correctionNumber': 'UNASSIGNED_PENDING_USER_APPROVAL',
    'proposal': 'Fresh pending-round substrate implementation from current C baseline in isolated regular candidate; not Native11 retry/resume or byte reconstruction.',
    'authorizedThisRequest': ['Read-only current C source/dependency preparation', 'Write new preparation reports and draft authority/prompts'],
    'notAuthorizedThisRequest': ['candidate creation/source copy', 'source edits', 'producer dispatch', 'dependency installs', 'build/import/test/server', 'runtime acceptance', 'caller cutover', 'smoke/qualification'],
    'model': 'local8045/gemini-3.8-flash-high',
    'reviewerLimitation': 'Current task tool GPT reviewers are not model-pinned substantive producer. Available API lacks model routing parameter; cannot silently substitute.',
    'canonicalBaseline': {'root': ROOT.as_posix(), 'HEAD': head, 'branch': branch, 'dirtyChangesMustBeIncludedAndPreserved': True,
                          'sourceVersion': 'CURRENT_C_NOT_FROZEN11', 'inputFingerprints': 'current-c-input-fingerprints.json'},
    'historicalReferenceOnly': {'failed11Settlement': '../education-partial11-settlement-20261007/combined-correction11-failure-settlement.json',
                              'receiptReconstruction': False, 'historicalPassCurrent': False,
                              'oldHashNeverNewHash': 'e8a558fc... is recorded frozen11 identity only.'},
    'candidateRootProposedNotCreated': candidate,
    'candidateCreationRequirements': [
        'Fresh unused C regular directory after budget approval; check every ancestry/reparse target. Never access D or copy linked targets blindly.',
        'Carry actual dirty/untracked baseline source, not git archive HEAD or clean assumption. Record inclusion/exclusion list and current source hashes.',
        'Exclude node_modules/build/data/reports by explicit plan; for dependencies exactC manifest/lock/target checks and immutability boundaries recorded; no silent install/update.',
        'Reserve storage headroom for candidate/logs/receipts and later gates; current11.4GiB free not full-build capacity certification.',
        'Use unique C outputs/temp/data; no shared cleanup or overwriting previous artifacts.'
    ],
    'gate0_preDispatch': {
        'required': ['Explicit new-subject and source-authoring authorization', 'Candidate scope/file ownership plus missing-caller phase decision',
                     'Compliant pinned producer route and current availability, no retries/fallback', 'Approved source-copy/storage budget',
                     'Reviewed C-only command/environment with no D PATH search', 'Deadline/capacity stop policy unchanged'],
        'historicalLimitsNotIncreased': {'producerMaxTime': '45m', 'hostTimeoutSeconds': 2760, 'retry': False, 'fallback': False},
        'missingRouteProof': True,
        'credentialRule': 'Do not read/write provider secrets or change active configuration to make dispatch work.'
    },
    'draftProducerWriteScope': {
        'native': ['tests/e2e/education/' + x for x in legacy['partitions']['native']['existing']],
        'evidence': ['tests/e2e/education/' + x for x in legacy['partitions']['evidence']['existing']],
        'note': 'Scope only inside proposed isolated candidate if approved.36 missing files require new implementation, so legacy allowedNew=[] cannot be reused as valid new authority.',
        'immutableCanonical': ['Current entire education/coordinator worktrees including callers, source, configs, reports, package/lock'],
        'productionRuntimeEdits': 'NOT_PROPOSED; if new inspection reveals production repair needed, stop and seek separate scope.',
        'phase2MissingCallerProposal': {'files': legacy['phase2ImmutableFiles'],
                                       'status': 'Separate later authoring authority required; cannot claim old immutable caller objects available.',
                                       'meaning': 'Newly authored cases must retain original54 criteria and full independent oracles, never rebuild old bytes from transcripts.'}
    },
    'sixInheritedRepairObligations': legacy['sourceFindings'],
    'five09FindingsRequiredRegressions': legacy['sourceDefects'],
    'two09ChronologyObligations': legacy['chronologyObligations'],
    'current11MechanismsToAvoid': native['remainingSourceMechanisms'],
    'mappingRequirement': 'Maintain original15+08six+09five+2chronology+6current dispositions with exact body/ID/location/provenance. Historical locations are not currentC locations; newly implemented seam has new actual source evidence.',
    'semanticLocks': [
        'Browser-observed occurrence order and identities survive evaluate/normalization; no invented observation-order+.01 timestamps.',
        'First recorder occurrence and recursive cause survive store replacement; no destructive object/array mutation.',
        'Capture/post state-before-UI siblings retained before genuine later root/document failure; matched eligible siblings cannot be lost on subsequent rejection.',
        'Common ledger deduplicates actual occurrences, stable exposed serialization, authoritative explicit wrapper phase in ALL3 paths, caller namespaces not globally sorted.',
        'Configured keyboard callbacks are not invoked with synthetic event as a read-only guard. Diagnose actual public/registered dispatcher evidence; do not invent public getBindings API.',
        'Initial slide/document sample atomic before early return; raw evidence retained before validation.',
        'Mandatory error sink, real production Page/document/root ownership, clocks/history/witness provenance and late finalization remain required.'
    ],
    'scopeExcluded': {'NF_A4': native['NF_A4Scope'], 'broaderUnconditionalKeyRejection': native['keypressScope'],
                      'seventhRepair': False, 'scoringPhysicsChanges': False},
    'tddStagesProposedNotExecuted': [
        'After specific test authority: design isolated focused contract tests for each inherited mechanism, capture authentic initial failures/errors without old PASS substitution.',
        'Pinned producer implements substrate in owned candidate files only; independent observation/error-exposure contracts agreed before parallel partition.',
        'Stop both writers before any verification; genuine terminal receipts state partial/missing results truthfully.',
        'Require explicit gate permission for focused test/import verification; no existing e2e wrapper that performs cleanup/server build by accident.',
        'Two independent full current-source audits read actual candidate/import owners plus all preserved finding contracts, verdicts/source refs not manifest.',
        'Only after both source gates and new authority may full54 case authoring/execution/caller integration be considered.'
    ],
    'receipts': {'genuineNewProducerDeliveryOnly': True, 'doNotRepairHistoricalReceipts': True,
                 'required': ['effective provider/model/route policy and terminal status', 'exact current candidate input/output identity',
                              'all34 disposition full bodies/source provenance/credits/unresolved', 'all original canonical NC11/RPC17/original9 maps and historical snapshots where available',
                              'actual file counts measured new subject, not 4327/4329 copied', 'full54 required/unexecuted scope and NF-A4 exclusion',
                              'commands executed/notexecuted and tests/errors/coverage limits', 'truthful failed/partial receipt if delivery fails; no retry without new authority']},
    'deferredScope': native['deferredScope'],
    'historicalTruncation': 'Unrecoverable original truncated explanation suffix remains explicitly bound; new criteria must not be silently invented or relaxed.',
    'flags': {'authorizedDispatch': False, 'candidateCreated': False, 'sourceModified': False, 'producerInvoked': False,
              'admission': False, 'sourceReady': False, 'qualification': False, 'passClaimed': False,
              'declaredCells': 54, 'admittedCells': 0, 'executedAcceptanceCells': 0,
              'NF_A4RepairAuthorized': False, 'callerCutover': False, 'smoke': False},
    'forbidden': ['D access/recovery/overwrite', 'historical receipt reconstruction', 'retry/resume11', 'automaticCorrection12dispatch',
                  'fallbackproducer', 'timeout/retries/assertions/scoring/physics manipulation', 'scratch/archive deletion',
                  'canonical integration/caller cutover/smoke/qualification', 'merge/commit/push/deploy']
}
save('new-subject-authority.draft.json', authority)
save('producer-prompt.draft.md', '''# DRAFT — C-only new subject; NOT AUTHORIZED FOR DISPATCH

This is a proposed education cook --auto --advice --tdd continuation, not permission to execute.
The substantive producer must remain **local8045/gemini-3.8-flash-high**. GPT reviewer tools cannot substitute.

## Identity and boundary
Read `new-subject-authority.draft.json`, `c-only-readiness.json` and currentC fingerprints first.
No D: access. Baseline is dirty current C education source at recorded HEAD, NOT frozen11.
Only2/38 prior required paths exist on C. Treat missing substrate/callers as newly authored work, never restore guessed source from transcript.
Preserve failed Native11/genuine Evidence11 receipts and all supplements as historical facts.

## Before work — STOP unless separately approved
User approval must cover new candidate creation, storage budget, source-authoring partitions and compliant pinned route.
Candidate path is only proposed; do not create it now. Do not touch canonical source/config/packages.
Caller authoring, builds/imports/tests, servers, acceptance and qualification require their own explicit gate scope.
Historical45m/2760 limits are ceilings to preserve, not newly granted deadlines. No retry/fallback.

## Substantive scope, if later approved
Implement a fresh pending-round substrate from actual C code APIs under26 owned helper paths in isolated candidate.
Read genuine current owner bodies/public APIs and keep architecture modular; ensure browser/Node common occurrence contract across partitions.
Preserve all34 inherited finding meanings with actual new evidence, not historical source defect assumptions.
Enforce six inherited repair obligations plus five09 and two chronology regressions and current11 mechanism locks.
Never execute configured callbacks with fabricated events to diagnose eligibility; do not assume a public binding accessor.
Never manufacture occurrence timestamps/order, sort unrelated order namespaces or replace caller-owned Error/array/wrapper objects.
Retain raw-before-validation, earliest genuine error, mandatory sink, all3 error-exposure paths and late finalization.

NF-A4 stays excluded/unresolved, no seventh repair; blanket ineligible-key rejection also applicability unresolved.
No changes to assertions/timeouts/retries/scoring/physics for GREEN. Production runtime edits outside this draft: stop if needed.

## Deliveries and gates
Actual producer terminal deliverable/receipt must be genuine for this new subject; no reconstruction of Native11.
Keep full receipt bodies with all mappings/dispositions/real counts, preservation exclusions and deferred54cells.
Receipt must state exactly which tests/commands ran; draft preparation has run none of the project checks.
Both writers stop before checks; sourceReady/admission remainfalse pending two independent full-source gates.
All54 declared acceptance cells are required,0 admitted,0 executed. Missing12 prior caller bodies are NOT executable acceptance.
Do not cut over, integrate, smoke, qualify, commit, merge, push or deploy.
''')
save('next-step-proposal.md', '''# C-only continuation preparation — 2026-10-07

**Kết luận: có tuyến tiếp tục không cần D:, nhưng đây là subject mới, chưa execution-ready.**

- Current C source/dependency manifests đọc được. Reparse inventory không follow links; observed dependency links đều C.
- Đối chiếu exact38 yêu cầu: chỉ `release-surfaces.js`, `present-offline-helpers.js` có;36 thiếu, gồm12 prior callers.
- Không nói currentC giống frozen11; transcript là historical reference, không source reconstruction.
- Installed/locked tooling manifests được đối chiếu; Chromium1409 cache không: xem revision thực trong report. Cache presence không browser health/qualification.
- C còn khoảng11.4GiB theo capacity probe, chưa đủ chứng nhận budget candidate/build.
- Không codegraph index; không tạo index. Current fingerprints là snapshot đọc C, không freeze đầy đủ/dependency immutability.
- Playwright setup có DELETE cleanup và auto build/server; không import configs hoặc chạy suite.
- PATH có legacyD entries; tương lai cần explicit verifiedC executable và environment reviewed, không resolution điD.
- Producer pin giữ nguyên, nhưng current quota/compliant no-retry route chưa chứng minh; lịch sử auto_retry429 vẫn blocker cần reconcile.

## Drafts
`new-subject-authority.draft.json` và `producer-prompt.draft.md` chỉ là dự thảo, chưa dispatch.
Sáu repair meanings và các09/chronology/current11 regressions giữ nguyên. NF-A4 excluded/unresolved; không seventh repair.
54 cells required/unexecuted,0admitted0executed; new genuine receipts không thay receipts failed11.

## Đề xuất tiếp theo
Ưu tiên một lượt **gate0 chỉ đọc**: xác minh route pinned/no-retry (không inference thử), budget C và chọn fresh isolated candidate scope; không phụ thuộc D.
Nếu route pin không thể được chứng minh qua công cụ hiện có, yêu cầu người dùng cung cấp route/config evidence đã redacted hoặc surface pin-aware. Không dùng GPT worker để thay producer.
Sau khi gate0 đủ và user chấp thuận authority mới: tạo subject mới từ current dirty C baseline, rồi author substrate trong candidate. Các12 callers, TDD runtime checks và54cell execution cần chốt authority riêng, không tự mở trong prompt chung.

Không source edit/candidatecopy/dependency install/build/test/server/producer invocation/D access/retry/cutover/smoke/qualification/merge/commit/push/deploy trong preparation này.
'''.replace('Chromium1409 cache không: xem revision thực trong report.', 'Browser cache revisions được ghi đúng từ manifests và tên directory trong report.'))
print('Prepared four reports/drafts plus producer prompt and next-step proposal; no candidate created, no project execution or D access.')

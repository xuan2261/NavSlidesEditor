"""Gate0: chỉ metadata C/explicit source hashes; không secrets, copy hoặc dispatch."""
import datetime
import hashlib
import json
import os
import pathlib
import stat
import subprocess
from collections import defaultdict

ROOT = pathlib.Path('C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001')
OUT = pathlib.Path(__file__).parent
SOURCE_DIRS = ['shared', 'client', 'server', 'tests', 'scripts', 'config', 'electron', 'vendor-overrides', 'website']
EXCLUDED = {'.git', '.playwright', '.omp', '.jeikcode', '.atomcode', '.claude', 'plans', 'node_modules',
            'data', 'dist', 'build', 'coverage', '.vite', 'test-results', 'playwright-report', 'exported-html',
            'release', 'archive', 'archives', 'scratch', '.cache', 'cache', 'logs'}
ROOT_FILES = ['package.json', 'package-lock.json', 'runtime-versions.json', 'playwright.config.js',
              'vite.config.js', 'vitest.config.js', 'vitest.config.ts', 'electron-builder.json',
              'README.md', 'AGENTS.md', 'CLAUDE.md', '.gitignore']


def save(name, value):
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2)
    with (OUT / name).open('x', encoding='utf-8', newline='') as stream:
        stream.write(text)


def walk(root, exclude):
    files, links, errors, skipped = [], [], [], []
    stack = [root]
    while stack:
        p = stack.pop()
        try:
            st = p.lstat()
            if st.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                links.append({'path': p.relative_to(ROOT).as_posix(), 'target': os.readlink(p).replace(chr(92), '/'), 'followed': False})
                continue
            with os.scandir(p) as entries:
                for e in entries:
                    q = pathlib.Path(e.path)
                    s = e.stat(follow_symlinks=False)
                    rel = q.relative_to(ROOT).as_posix()
                    if s.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                        links.append({'path': rel, 'target': os.readlink(q).replace(chr(92), '/'), 'followed': False})
                    elif e.is_dir(follow_symlinks=False):
                        if e.name in exclude:
                            skipped.append(rel)
                        else:
                            stack.append(q)
                    elif e.is_file(follow_symlinks=False):
                        if e.name == '.env' or e.name.startswith('.env.') or q.suffix.lower() in {'.pem', '.key', '.pfx', '.p12'}:
                            skipped.append(rel + ' [potential-secret filename; content not read]')
                        else:
                            files.append({'relativePath': rel, 'logicalBytes': s.st_size})
        except OSError as exc:
            errors.append({'path': p.as_posix(), 'error': str(exc)})
    return files, links, errors, skipped


source, links, errors, skipped = [], [], [], []
for name in SOURCE_DIRS:
    a, b, c, d = walk(ROOT / name, EXCLUDED)
    source.extend(a)
    links.extend(b)
    errors.extend(c)
    skipped.extend(d)
for name in ROOT_FILES:
    p = ROOT / name
    if p.is_file():
        st = p.lstat()
        if st.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            links.append({'path': name, 'target': os.readlink(p), 'followed': False})
        else:
            source.append({'relativePath': name, 'logicalBytes': st.st_size})
deps, dep_links, dep_errors, dep_skipped = walk(ROOT / 'node_modules', EXCLUDED - {'node_modules'})
# Inspect historical archive reparse metadata only; never enter linked targets or count archive as candidate.
_, historical_links, historical_errors, _ = walk(ROOT / '.playwright', {'node_modules', 'data'})
source.sort(key=lambda x: x['relativePath'])
deps.sort(key=lambda x: x['relativePath'])
source_bytes = sum(x['logicalBytes'] for x in source)
dep_bytes = sum(x['logicalBytes'] for x in deps)
# Hypothetical4KiB file rounding, not allocated size measured from NTFS.
rounded = sum(((x['logicalBytes'] + 4095) // 4096) * 4096 for x in source + deps)
free = 18594795520
GiB = 1024 ** 3
budget = {
    'capacityObserved': {'freeBytes': free, 'sizeBytes': 255382777856, 'time': '2026-10-07T20:47:56.7672036+07:00'},
    'sourceAllowlistFiles': len(source), 'sourceLogicalBytes': source_bytes,
    'regularDependenciesFiles': len(deps), 'dependenciesLogicalBytes': dep_bytes,
    'regularCopyLogicalBytes': source_bytes + dep_bytes,
    'hypothetical4KiBRoundingBytes': rounded,
    'hypothetical4KiBRoundingNotPhysicalAllocationMeasurement': True,
    'proposedCapsNotApproved': {'candidateAndOwnedNewSourcesBytes': 2 * GiB,
                              'focusedLogsReceiptsAndFutureContractArtifactsBytes': 4 * GiB,
                              'untouchedCFreeFloorBytes': 4 * GiB},
    'conservativeReservedTotalBytes': 10 * GiB,
    'observedSlackAfterProposedReservationsBytes': free - 10 * GiB,
    'boundedPreparationCapacityAssessment': 'OBSERVED_HEADROOM_FOR_PROPOSED_SOURCE_CANDIDATE_AND_BOUNDED_ARTIFACT_CAPS_ONLY',
    'notQualified': ['Full54 acceptance/artifact demand', 'desktop package/build/browser reinstall',
                     'actual filesystem allocation/compression/dedup', 'future capacity or memory/IO capacity'],
    'stopPolicyProposal': 'After future explicit authority, stop before write/copy if cap or4GiB floor threatened; no deletion/retry/reduced assertions. Do not auto-raise caps.',
    'copyPlan': 'Copy explicit dirty-current-C source allowlist and independently approved regular dependencies; no Git metadata, archives, data, reports, builds, credentials or linked-target traversal.',
    'dependencyPlan': 'Do not make canonical node_modules junction. Future approved candidate may copy regular dependencies and recreate only five reviewed internal candidate workspace links (or materialize); new candidate manifest/payload hashes and API closure still required. No npm install/ci now.',
    'reproducibilityLimit': 'Excluding generated assets/data means source-only candidate is not a runnable equivalent of current production. Generation/import/tests remain later-authority gates.'
}

route = {
    'requestedProvider': 'local8045', 'requestedModel': 'gemini-3.8-flash-high',
    'verdict': 'CURRENT_ROUTE_BINDING_NOT_PROVEN_PIN_AWARE_DISPATCH_SURFACE_NOT_EXPOSED',
    'currentPublicToolSchema': {'tool': 'functions.task', 'types': ['explore', 'worker'],
                              'providerModelRetryFallbackParameters': False,
                              'modelPinControllableByThisTool': False},
    'historicalEvidence': [
        {'file': 'plans/handoffs/education-producer-quota-20261005.md', 'meaning': 'Historical429 and auto_retry despite prompt retryfalse; not current availability.'},
        {'file': 'plans/journals/2026-10-05-education-pinned-route-policy-verified-capacity-unconfirmed.md',
         'meaning': 'Historical process-local overlay reportedly no-retry/no-fallback; journal says not durable or live execution state.'}
    ],
    'guideMeaning': 'jeikcode_config guide models/tools reads documentation, not current effective configured route. No reload or config read/write.',
    'processNamesObserved': ['jeikcode', 'omp'],
    'processMeaning': 'Name/PID metadata only, no command lines/config/env. Running OMP not proof tools can bind its session or that prior overlay persists.',
    'currentPolicyVerified': False, 'servingAvailabilityVerified': False,
    'producerInferenceRequestsSent': 0, 'providerSecretsRead': False,
    'minimumNextEvidence': {
        'kind': 'ONE_CURRENT_REDACTED_ROUTE_BINDING_RECEIPT_FROM_PIN_AWARE_SURFACE',
        'fields': ['requested/effective providerlocal8045 and modelgemini-3.8-flash-high',
                   'current intended execution surface/session/job binding (nonsecret identifiers)',
                   'effective retry/fallback at caller, clientSDK/OMP, gateway and provider layers or explicit unknown layers',
                   'whether process-only overlay or persistent policy; snapshot time/expiry/version',
                   'non-inference dry-run dispatch plan attestation if surface supports it; no assertion it does when unobserved'],
        'secretRule': 'No API keys/tokens/Authorization/cookies/raw user config/process commandlines. Redacted receipt can be pasted or supplied as regular readableC file.',
        'endpoint': 'Optional redacted route/base endpoint; never enough alone to prove effective model/retry.',
        'availabilityRule': 'Remain unknown until separately authorized legitimate dispatch. Do not probe, poll inference or change provider.'
    },
    'nextAction': 'Need operator or accessible pin-aware execution surface proof; not another same Gate0 run and not more generic authorization. Do not substitute GPT review worker as producer.'
}

head = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], text=True).strip()
status = subprocess.check_output(['git', '-C', str(ROOT), 'status', '--porcelain=v1', '--untracked-files=all'], text=True).splitlines()
prior = [x for x in status if not any(q in x for q in ['education-partial11-settlement-20261007/', 'education-partial11-access-diagnostic-20261007/', 'education-c-only-correction-preparation-20261007/', 'education-c-only-gate0-20261007/'])]
report = {
    'kind': 'GATE0_READ_ONLY_REPORT', 'date': '2026-10-07',
    'verdict': 'GATE0_COMPLETE_REPORT_DISPATCH_BLOCKED_BY_CURRENT_ROUTE_PROOF',
    'meaning': 'Read-only Gate0 work completed, not a producer GO or candidate permission.',
    'baselineHEAD': head, 'baselinePreexistingStatus': prior,
    'route': route, 'budget': budget,
    'safety': {'sourceReparseNotFollowed': links, 'dependencyReparseNotFollowed': dep_links,
               'historicalPlaywrightReparseNotFollowed': historical_links,
               'errors': errors + dep_errors + historical_errors,
               'exclusionCorrection': 'Prior focused source/dependency scan was not full root scan. Historical .playwright/runs has D targets; all remain excluded/unfollowed, not deleted.',
               'DProbedOrRead': False, 'candidateCreated': False, 'sourceEdited': False,
               'configEditedOrReloaded': False, 'secretsRead': False},
    'flags': {'producerInvoked': False, 'dispatchAuthorized': False, 'sourceReady': False,
              'admission': False, 'qualification': False, 'PASS': False,
              'declaredCells': 54, 'admittedCells': 0, 'executedCells': 0,
              'NF_A4RepairAuthorized': False, 'callerCutover': False, 'smoke': False},
    'next': 'Supply current redacted route binding evidence or pin-aware surface. After evidence review, seek explicit source-only candidate creation/authoring authority;12caller/tests separate. Do not request Gate0 again.',
    'frozen11StatusUnchanged': 'FAILED_DELIVERY_NOT_ADMITTED_SOURCE_REPAIR_REQUIRED'
}
save('source-copy-allowlist.proposed.json', {'status': 'PROPOSED_NOT_COPIED_NOT_FROZEN', 'roots': SOURCE_DIRS,
                                         'rootFiles': ROOT_FILES, 'exclusions': sorted(EXCLUDED),
                                         'potentialSecretFilesExcluded': True, 'files': source, 'skipped': skipped})
save('dependency-copy-inventory.proposed.json', {'status': 'PROPOSED_NOT_COPIED_NOT_IMMUTABLE', 'files': deps,
                                             'linksNotFollowed': dep_links, 'skipped': dep_skipped})
save('gate0-report.json', report)
save('gate0-summary.md', f'''# Gate0 C-only — 2026-10-07

**Gate0 report complete; DISPATCH BLOCKED — current pinned route binding chưa được chứng minh.**

Không cần phục hồiD để chuẩn bị subject mới. Không lặp Gate0 hay hỏi cấp phép chung thêm: prerequisite thực tế là một current redacted route-binding receipt hoặc execution surface cho phép pin thật.

## Route
`local8045/gemini-3.8-flash-high` giữ nguyên. `functions.task` hiện không có provider/model/retry/fallback params; GPT review không thay producer. Journal05/10 chỉ evidencehistorical process-local overlay; OMP đang chạy không chứng minh overlay còn hiệu lực hoặc có API dispatch hiện tại. Không đọc secrets/config, gọi inference, sửa settings/reload.

## Budget đo được
Allowlist source {len(source):,}files / {source_bytes:,}bytes; regulardependencies {len(deps):,}files / {dep_bytes:,}bytes.
Tổng logicalcopy {source_bytes + dep_bytes:,}bytes; hypothetical4KiBrounding {rounded:,}bytes, không allocatedsize certification.
Cfree lúc20:47+07 {free:,}bytes (~{free / GiB:.2f}GiB).
Proposed reserve:2GiBcandidate/new sources +4GiBboundedlogs/receipts/artifacts +4GiBuntouchedfloor, còn ~{(free - 10 * GiB) / GiB:.2f}GiB slack ở observation. Budget chưa userapproved, không đủ để chứng nhận full54/build/desktop.

## Copy boundaries
Candidate path chỉ proposed, chưa tạo. Copy allowlist không Git/archive/.playwright/data/credentials/dist/build/reports/node_modules junction targets. D-linked historical `.playwright/runs` đã phát hiện từ metadata, không follow/xóa.
Future source/dependency copy phải bảo toàn dirty baseline, kiểm internal candidate workspace links/hashes. Source-only subject chưa runtime-equivalent do generated assets/data excluded; không auto build/npmci/install.

## Bước tiếp theo thực tế
Cung cấp một current redacted pin-aware route receipt:requested/effectiveprovider+model, binding session/job, effectiveretry/fallback từng layer, time/expiry/scope; noninferencedryrun nếu surface hỗ trợ. Không tokens/rawconfig. Không cần tuyên bố quota/capacity trước legitimate authorized dispatch.
Sau proofroute mới trình authority tạo candidate và author26helpers;12missingcallers/test execution/cutover/smokequal vẫn separate. Nếu surface không có pin, không đổi producer hoặc cấu hình để lách.

54declared/0admitted/0executed;NF-A4excluded/unresolved; failed11settlement không đổi. Không Daccess/inference/candidate/source/config/test/server/commit/merge/push/deploy.
''')
print(json.dumps({'sourceFiles': len(source), 'sourceBytes': source_bytes, 'dependencyFiles': len(deps),
                  'dependencyBytes': dep_bytes, 'hypotheticalRoundedBytes': rounded,
                  'DLinkedHistoricalRunMetadataOnly': sum('D:' in x['target'].upper() for x in historical_links),
                  'errors': errors + dep_errors + historical_errors,
                  'routeVerdict': route['verdict']}, ensure_ascii=False, indent=2))

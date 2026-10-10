"""Đóng available authority body refs và validate tài liệu, không chạy source."""
import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path('C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001')
DEST = pathlib.Path(__file__).parent
OLD = ROOT / 'plans/reports/education-partial11-settlement-20261007'
AUTH_PATH = OLD / 'retained-transcript-outputs/Partial11NativeSalvage/014-pending-substrate-11-dispatch-authority.json-read-001.txt'
legacy = json.loads(AUTH_PATH.read_text(encoding='utf-8'))
ledger = json.loads((DEST / 'inherited-34-disposition-ledger.json').read_text(encoding='utf-8'))
for index in range(26, 34):
    group = 'chronologyObligations' if index < 28 else 'sourceFindings'
    n = index - 26 if index < 28 else index - 28
    entry = ledger['entries'][index]
    entry['historicalCanonicalBodyReadableC'] = legacy[group][n]
    entry['canonicalBodyResolvedReference'] = AUTH_PATH.as_posix() + '#/' + group + '/' + str(n)
ledger['unresolvedCanonicalBodyReferences'] = []
with (DEST / 'inherited-34-disposition-ledger.json').open('w', encoding='utf-8', newline='') as stream:
    json.dump(ledger, stream, ensure_ascii=False, indent=2)
auth = json.loads((DEST / 'new-subject-authority.draft.json').read_text(encoding='utf-8'))
auth['historicalDispositionLedger']['unresolvedBodyReferences'] = []
with (DEST / 'new-subject-authority.draft.json').open('w', encoding='utf-8', newline='') as stream:
    json.dump(auth, stream, ensure_ascii=False, indent=2)

readiness = json.loads((DEST / 'c-only-readiness.json').read_text(encoding='utf-8'))
fingerprints = json.loads((DEST / 'current-c-input-fingerprints.json').read_text(encoding='utf-8'))
assert readiness['currentRequired38Presence']['required'] == 38
assert readiness['currentRequired38Presence']['present'] == 2
assert readiness['currentRequired38Presence']['missing'] == 36
assert len(auth['draftProducerWriteScope']['native']) == 15
assert len(auth['draftProducerWriteScope']['evidence']) == 11
assert len(auth['draftProducerWriteScope']['phase2MissingCallerProposal']['files']) == 12
assert len(ledger['entries']) == 34
assert not ledger['unresolvedCanonicalBodyReferences']
# Verify all exact JSON-pointer canonical body bindings on C.
for entry in ledger['entries']:
    filepart, pointer = entry['canonicalBodyResolvedReference'].split('#', 1)
    value = json.loads(pathlib.Path(filepart).read_text(encoding='utf-8'))
    for part in pointer.lstrip('/').split('/'):
        part = part.replace('~1', '/').replace('~0', '~')
        value = value[int(part)] if isinstance(value, list) else value[part]
    assert value == entry['historicalCanonicalBodyReadableC'], entry['ordinal']
assert auth['status'] == 'DRAFT_NOT_AUTHORIZED_NOT_DISPATCHED'
assert auth['model'] == 'local8045/gemini-3.8-flash-high'
assert auth['scopeExcluded']['seventhRepair'] is False
assert auth['historicalRepairWordingSupersession']['id'] == 'N10B-01'
assert auth['flags']['authorizedDispatch'] is False
assert auth['flags']['sourceModified'] is False
assert auth['flags']['producerInvoked'] is False
assert auth['flags']['declaredCells'] == 54
assert auth['flags']['executedAcceptanceCells'] == 0
assert all(item['lockedInstalledMatch'] for item in readiness['dependencies'])
assert all(not item['errors'] for item in readiness['reparseSafety'].values())
assert all('D:' not in link['target'].upper() for item in readiness['reparseSafety'].values() for link in item['links'])
verified = 0
for entry in fingerprints['files']:
    p = ROOT / entry['relativePath']
    assert hashlib.sha256(p.read_bytes()).hexdigest() == entry['sha256CurrentCBytes'], entry['relativePath']
    verified += 1
assert sum(fingerprints['classificationCounts'].values()) == verified
candidate = pathlib.Path(auth['candidateRootProposedNotCreated'])
assert not candidate.exists(), 'Proposed candidate path exists; must not reuse it silently'

for path, branch, head in [(ROOT, 'feat/education-gemini38-cook-261001', 'c5b5e896d9f06859b21e19122f81c7613067c386'),
                          (pathlib.Path('C:/Work/NavSlidesEditor'), 'main', 'aa19b59cd5bd5de2510f9bc4edd2ef2311ce9131')]:
    assert subprocess.check_output(['git', '-C', str(path), 'branch', '--show-current'], text=True).strip() == branch
    assert subprocess.check_output(['git', '-C', str(path), 'rev-parse', 'HEAD'], text=True).strip() == head
    assert not subprocess.check_output(['git', '-C', str(path), 'diff', '--cached', '--name-only'], text=True).strip()
    status = subprocess.check_output(['git', '-C', str(path), 'status', '--porcelain=v1', '--untracked-files=all'], text=True).splitlines()
    if path == ROOT:
        remaining = [item for item in status if not any(q in item for q in ['education-partial11-settlement-20261007/', 'education-partial11-access-diagnostic-20261007/', 'education-c-only-correction-preparation-20261007/'])]
        assert remaining == readiness['git']['preexistingStatus'], 'Existing path/status baseline changed'
    else:
        assert status == ['?? plans/handoffs/education-partial11-resume-20261007.md']

validation = {
    'kind': 'DRAFT_DOCUMENT_AND_CURRENT_C_INPUT_VALIDATION_NOT_PROJECT_CHECK_OR_ADMISSION',
    'scope': 'C-only preparation; source/dependencies not imported or executed',
    'currentFingerprintsVerified': verified,
    'fingerprintClassificationCounts': fingerprints['classificationCounts'],
    'canonicalHistoricalFindingBodyReferencesResolved': 34,
    'exactRequiredPaths': 38, 'present': 2, 'absent': 36,
    'draftHelperPaths': 26, 'separatelyDeferredCallerPaths': 12,
    'manifestVersionMatches': 8,
    'reviewCorrectionsAdopted': ['GET-only current global setup', 'start/dev not auto-build', 'reporter selection not mkdir',
                               'fresh observed capacity not hardcoded budget', 'nested dependency/generated fingerprint classification',
                               'N10B-01 historical accessor supersession', 'full34historical body bindings', 'scope26helpers excludes12callers'],
    'DProbedOrRead': False, 'candidateCreated': False, 'sourceEdited': False, 'producerInvoked': False,
    'projectTestsRun': False, 'configImported': False, 'serverStarted': False,
    'callerCutover': False, 'smoke': False, 'qualification': False,
    'declaredCells': 54, 'admittedCells': 0, 'executedCells': 0,
    'branchHEADAndPreexistingStatusPreserved': True,
    'preservationLimit': 'Rechecked selected current C file hashes and exact path/status baseline; not complete freeze or full dependency immutability.',
    'remainingDispatchBlockers': ['No explicit new implementation/candidate creation authority', 'Pinned compliant route/current availability not proved',
                                  'Capacity budget not approved', 'Fresh isolated caller authoring and test gate scope not approved']
}
with (DEST / 'preparation-validation.json').open('x', encoding='utf-8', newline='') as stream:
    json.dump(validation, stream, ensure_ascii=False, indent=2)
print(json.dumps(validation, ensure_ascii=False, indent=2))

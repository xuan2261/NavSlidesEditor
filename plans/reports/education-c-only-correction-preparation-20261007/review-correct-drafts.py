"""Sửa factual claims chỉ trong draft/report của request này; không sửa source."""
import json
import pathlib
import re

ROOT = pathlib.Path('C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001')
DEST = pathlib.Path(__file__).parent
OLD = ROOT / 'plans/reports/education-partial11-settlement-20261007'


def load(name):
    return json.loads((DEST / name).read_text(encoding='utf-8'))


def replace_report(name, data):
    with (DEST / name).open('w', encoding='utf-8', newline='') as stream:
        json.dump(data, stream, ensure_ascii=False, indent=2)


def resolve_pointer(base, pointer):
    item = base
    for part in pointer.lstrip('/').split('/'):
        part = part.replace('~1', '/').replace('~0', '~')
        item = item[int(part)] if isinstance(item, list) else item[part]
    return item


readiness = load('c-only-readiness.json')
readiness['capacity'] = {
    'reportedCFreeBytes': 18847141888,
    'reportedCSizeBytes': 255382777856,
    'observedLocalTime': '2026-10-07T20:36:05.0911354+07:00',
    'copiedCandidateBudgetVerified': False,
    'meaning': 'About17.55GiB observed free, not future capacity/budget certification. No cleanup or candidate creation approved.',
    'supersedes': 'Initial hardcoded capacity draft was not a verified exact observation and is withdrawn.'
}
readiness['executionHazards'] = [
    'Current global-setup.js1-23 polls GET /presentations. It does NOT DELETE cleanup. Actual fixtures/test-fixtures.js41-83/105-114 create/update/delete including permanent deletion; executing suites mutates isolated test data.',
    'playwright.config.js135-153 starts npm start or npm run dev; default uses prebuilt client. package.json25 prestart verifies runtime closure, not a build. Server/dev startup still requires authorization.',
    'desktop-runtime-config.cjs23-30 selects reporter entries and does NOT create a directory on load. Reporter lifecycle/test execution can emit artifacts; no config import performed.',
    'Default Playwright config has existing retries and broad discovery; specific future tests, endpoints, data and C-only artifact/temp paths require explicit gate scope. Do not silently change configured retries/deadlines.',
    'Generated education runtime/source equivalence and browser/native binary health not established by static read.',
    'Installed-lock agreement is manifest agreement only, not reproducibility/full dependency immutability.',
    'Historical429/auto_retry does not prove current route compliance or current quota. No inference probe or settings edits authorized.'
]
for item in readiness['staticDReferences']:
    line = (ROOT / item['path']).read_text(encoding='utf-8').splitlines()[item['line'] - 1]
    matches = list(re.finditer(r'(?i)\bD:[/\\]|NavSlidesQualification', line))
    item['matchedContexts'] = [line[max(0, match.start() - 60):min(len(line), match.end() + 130)] for match in matches[:5]]
    item['classification'] = 'LITERAL_MATCH_NOT_CONFIRMED_FILESYSTEM_PATH'
    item['meaning'] = 'Regex lexical candidates; PDF bundled code and template D:\\quad formula can be false positives. Not evidence of live D access or an automatic script ban.'
readiness['staticScanMeaning'] = 'No confirmed D filesystem dependency in inspected runtime/config routes. Dynamic config/environment routes and all external links are not universally certified. PATH legacyD strings explicitly need bounded future command resolution.'
replace_report('c-only-readiness.json', readiness)

fp = load('current-c-input-fingerprints.json')
counts = {}
for item in fp['files']:
    path = item['relativePath']
    if '/node_modules/' in path:
        kind = 'NESTED_DEPENDENCY_REGULAR_FILE'
    elif any(part in path.split('/') for part in ['dist', 'build']):
        kind = 'GENERATED_OR_BUILD_OUTPUT_REGULAR_FILE'
    else:
        kind = 'CURRENT_REGULAR_INPUT_SELECTED'
    item['classification'] = kind
    counts[kind] = counts.get(kind, 0) + 1
fp['classificationCounts'] = counts
fp['excluded'] = ['D evidence', 'root node_modules content', 'all reparse-point traversals', 'Git metadata', 'reports', 'unselected extensions']
fp['coverageNote'] = 'Broad read inventory includes regular nested dependencies, generated outputs and selected data files under client/server. This is NOT a source-only freeze, full data snapshot or immutable dependency manifest.'
replace_report('current-c-input-fingerprints.json', fp)

native = json.loads((OLD / 'native11-complete-settlement-v2.json').read_text(encoding='utf-8'))
ledger = []
unresolved = []
for n, original in enumerate(native['originalFindingDispositions'], 1):
    entry = dict(original)
    fullref = entry.get('fullBody', '')
    text = 'OPERATIVE_CANONICAL_BODY_REFERENCE_UNRESOLVED'
    resolved = 'UNRESOLVED'
    if '#/' in fullref:
        filepart, pointer = fullref.split('#', 1)
        filepart = filepart.replace('historical/', 'retained-historical-authority-deliveries/').replace('nativeRaw/', 'retained-transcript-outputs/Partial11NativeSalvage/').replace('authority/', 'retained-original-authority-deliveries/')
        target = OLD / filepart
        if target.is_file():
            try:
                text = resolve_pointer(json.loads(target.read_text(encoding='utf-8')), pointer)
                resolved = target.as_posix() + '#' + pointer
            except (KeyError, IndexError, ValueError, TypeError):
                pass
    entry['historicalCanonicalBodyReadableC'] = text
    entry['canonicalBodyResolvedReference'] = resolved
    entry['ordinal'] = n
    entry['newSubjectDisposition'] = 'NOT_EVALUATED_NEW_SOURCE_NOT_AUTHORED'
    entry['meaning'] = 'Historical disposition and credit belong to frozen11 only; do not claim currentC/new subject corrected, reproduce old defects, or count34 as34 distinct repairs.'
    if resolved == 'UNRESOLVED':
        unresolved.append({'ordinal': n, 'alias': entry.get('alias', ''), 'reference': fullref})
    ledger.append(entry)
with (DEST / 'inherited-34-disposition-ledger.json').open('x', encoding='utf-8', newline='') as stream:
    json.dump({'count': 34, 'meaning': '34 preserved historical ledger entries, not34 distinct current defects or permissions.',
               'newSubjectEvidence': 'NONE_YET', 'entries': ledger, 'unresolvedCanonicalBodyReferences': unresolved}, stream, ensure_ascii=False, indent=2)

auth = load('new-subject-authority.draft.json')
auth['authorizedThisPreparationRequest'] = auth.pop('authorizedThisRequest')
auth['interpretation'] = 'Historical permissions for this completed preparation, not executable authority for reviewers/generator/future dispatch.'
auth['generatorUtilityStatus'] = 'Inspected preparation-only artifact. It is not a preapproved gate0 command; no automatic rerun.'
auth['draftProducerWriteScope']['note'] = 'Future helper scope26 =24 absent helpers +2 present helpers inside isolated candidate ONLY; all12 missing caller paths are outside writer scope.36 missing paths does not authorize36 creations.'
auth['draftProducerWriteScope']['phase2MissingCallerProposal']['historicalImmutableMeaning'] = 'Historical immutable callers are unavailable onC. This protects original criteria/objects as history, not claims current actual caller files are present; newly authored replacement callers need separate explicit authority.'
auth['historicalRepairWordingSupersession'] = {
    'id': 'N10B-01',
    'originalTextKeptForFidelity': True,
    'nonOperativeHistoricalClause': 'Use Reveal.getBindings()',
    'operativeRequirement': 'Passive actual dispatcher/config/public registration evidence from current inspected owner. No assumed public accessor, no synthetic keyboardCondition callback invocation. If private registrations are not safely observable, mark bounded unresolved and seek scope, do not fabricate API or change navigation policy.'
}
auth['historicalDispositionLedger'] = {'file': 'inherited-34-disposition-ledger.json', 'entries': 34,
                                     'unresolvedBodyReferences': unresolved,
                                     'meaning': 'Full historical finding bodies resolved separately where available.34 is preservation ledger, not distinct repairs. New subject current evidence not evaluated.'}
auth['gate0_preDispatch']['redactedRouteEvidenceOnly'] = 'Use explicit nonsecret/redacted current effective route evidence; do not inspect provider secrets, load user configuration, follow D paths, edit settings or perform inference availability probe. If no pin-aware tool surface is available stop; no GPT substitute.'
auth['gate0_preDispatch']['capacityObservation'] = readiness['capacity']
replace_report('new-subject-authority.draft.json', auth)

proposal = (DEST / 'next-step-proposal.md').read_text(encoding='utf-8')
proposal = proposal.replace('C còn khoảng11.4GiB theo capacity probe', 'C còn khoảng17.55GiB ở observation20:36+07, chưa bảo đảm headroom tương lai')
proposal = proposal.replace('Playwright setup có DELETE cleanup và auto build/server; không import configs hoặc chạy suite.', 'Current global setup chỉ GET readiness; fixtures có create/update/permanent delete. Config khởi động npm start/dev (không tự build), reporter chọn entry không mkdir; không import config hoặc chạy suite.')
proposal += '\n## Review corrections adopted\nFingerprints là broad regular-file inventory có nested dependencies/generated outputs, không source-only freeze. RegexD literal trong PDF/template không phải filesystem dependency đã xác nhận. N10B-01 getBindings historical clause đã superseded;34ledger phân biệt historical disposition với new-subject evidence. Missing12caller authoring vẫn ngoài draft helper scope26.\n'
with (DEST / 'next-step-proposal.md').open('w', encoding='utf-8', newline='') as stream:
    stream.write(proposal)
prompt = (DEST / 'producer-prompt.draft.md').read_text(encoding='utf-8')
prompt += '\n## Explicit historical wording supersession\nN10B-01 historical suggestion `Reveal.getBindings()` is NONOPERATIVE. Retain passive dispatcher diagnosis via actual current owner/public registration evidence only; if unobservable, STOP with bounded unresolved.\nRead `inherited-34-disposition-ledger.json`:34 are historical dispositions, not34 separate defects or authoring permissions. Future26helper scope contains24 absent +2 existing; all12caller creation/test authoring remains outside this draft.\n'
with (DEST / 'producer-prompt.draft.md').open('w', encoding='utf-8', newline='') as stream:
    stream.write(prompt)
print('Draft factual corrections adopted. Fingerprints classified:', counts)
print('Canonical body references still unresolved:', json.dumps(unresolved, ensure_ascii=False))

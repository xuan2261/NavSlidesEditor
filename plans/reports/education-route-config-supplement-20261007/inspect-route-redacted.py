"""Đọc config được user chỉ định; chỉ xuất whitelist, không secrets/inference."""
import hashlib
import json
import pathlib
import re
import subprocess
import tomllib
import urllib.parse

import yaml

DEST = pathlib.Path(__file__).parent
ROOT = pathlib.Path('C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001')
OMP = pathlib.Path('C:/Users/Z10PAD8C_Xuan2261/.omp/agent/models.yml')
JEIK = pathlib.Path('C:/Users/Z10PAD8C_Xuan2261/.jeikcode/config.toml')
j = tomllib.loads(JEIK.read_text(encoding='utf-8'))
o = yaml.safe_load(OMP.read_text(encoding='utf-8'))


def endpoint(block):
    for key in ['base_url', 'baseUrl', 'baseURL', 'endpoint', 'url']:
        if isinstance(block.get(key), str):
            parsed = urllib.parse.urlsplit(block[key])
            return {'scheme': parsed.scheme, 'host': parsed.hostname, 'port': parsed.port,
                    'userinfoPathQueryFragmentWithheld': True}
    return {'endpointDeclaration': 'NOT_IN_WHITELIST_FIELDS'}


secret_keys = {'apikey', 'token', 'secret', 'password', 'headers', 'authorization', 'credentials', 'auth'}
policy_keys = {'retry', 'retries', 'maxretries', 'maxattempts', 'autoretry', 'fallback', 'fallbackmodel', 'fallbackmodels'}


def policies(block, path):
    found = []
    if isinstance(block, dict):
        for key, value in block.items():
            normal = re.sub(r'[_-]', '', key).lower()
            if normal in secret_keys:
                continue
            if normal in policy_keys:
                found.append({'path': path + '/' + key,
                              'scalarPolicy': value if isinstance(value, (bool, int, float)) else 'VALUE_COMPLEX_OR_WITHHELD'})
            if isinstance(value, (dict, list)):
                found.extend(policies(value, path + '/' + key))
    elif isinstance(block, list):
        for index, value in enumerate(block):
            found.extend(policies(value, path + '/' + str(index)))
    return found


model = j.get('models', {}).get('local8045/gemini-3.8-flash-high', {})
subagent = j.get('subagent', {})
omp_provider = o.get('providers', {}).get('local8045', {})
omp_models = [m for m in omp_provider.get('models', []) if isinstance(m, dict) and m.get('id') == 'gemini-3.8-flash-high']
provider_entry = j.get('providers', {}).get('local8045', {})
report = {
    'kind': 'USER_SUPPLIED_ROUTE_CONFIG_REDACTED_SUPPLEMENT',
    'date': '2026-10-07',
    'verdict': 'TARGET_DECLARATIONS_CONFIRMED_BUT_CURRENT_PINNED_DISPATCH_AND_POLICY_NOT_ESTABLISHED',
    'meaning': 'Model exists in both registries. This corrects any assumption no usable registry exists; declaration is not active execution binding.',
    'configReadsAuthorizedByUser': True,
    'credentialHandling': 'Configurations parsed locally in memory. Credential/header/auth values never emitted, copied, hashed individually or used for HTTP/inference. Raw config not stored in reports.',
    'JeikCode': {
        'source': JEIK.as_posix(),
        'defaultProviderDeclared': j.get('default_provider', 'UNDECLARED'),
        'defaultModelDeclared': j.get('default_model', 'UNDECLARED'),
        'targetRegistryId': 'local8045/gemini-3.8-flash-high',
        'targetDeclared': bool(model),
        'targetModelFields': {key: model[key] for key in ['model', 'provider', 'api_model', 'tool_mode'] if key in model and isinstance(model[key], (str, bool, int, float))},
        'targetEndpointRedacted': endpoint(provider_entry),
        'subagentRouteFields': {key: subagent.get(key, 'UNDECLARED') for key in ['model_id', 'small_model_id', 'large_model_id']},
        'targetPolicyFields': policies(provider_entry, '$/providers/local8045') + policies(model, '$/models/local8045/gemini-3.8-flash-high'),
        'guideFacts': ['Registry id is provider/model. Default provider/model drive session route.',
                       'Guide documents changing defaults and config reload, but does not expose per-task model override in current task tool schema.'],
        'activeSessionModelOrOverlayVerified': False,
        'taskToolPerCallProviderModelParams': False,
        'processExecutableMetadata': 'C:/Work/JeikCode/target/release/jeikcode.exe',
        'configReloadedOrEdited': False
    },
    'OMP': {
        'source': OMP.as_posix(),
        'targetProvider': 'local8045', 'targetModel': 'gemini-3.8-flash-high',
        'matchingModelEntries': len(omp_models),
        'targetEndpointRedacted': endpoint(omp_provider),
        'explicitTargetPolicyFields': policies(omp_provider, '$/providers/local8045'),
        'declarationDoesNotDisableSDKGatewayRetry': True,
        'installedPackage': {'name': '@oh-my-pi/pi-coding-agent', 'versionObserved': '13.14.0',
                             'entrypoint': 'C:/Users/Z10PAD8C_Xuan2261/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/dist/cli.js'},
        'staticPinAwareSurfaceFound': True,
        'staticFlagsObserved': ['--provider', '--model', '--config', '--no-session', '--no-extensions', '--no-skills', '--no-prompt-templates'],
        'staticRPCObserved': ['get_state', 'set_model', 'set_auto_retry'],
        'staticPolicyCaution': 'Installed application declares retry.enabled defaulttrue, retry.maxRetries default5 and retry.fallbackOrder auto/auto/auto. SDK library constructors also declare retry defaults; actual custom provider callsite values not certified. Application retry disable alone is not end-to-end no-retry proof.',
        'liveSessionStarted': False, 'startupSideEffectsNotAuditedCompletely': True,
        'bundleSnapshotStability': 'One observed snapshot hash5a4e06836256c49c3a97db6a533290ec9cf363b2a47c231797cd9f89eae38dd523f6, bytes36556612, version13.14.0. Token contexts/offsets differed across reads; do not bind live process to this snapshot or treat old offsets as stable.',
        'noInferenceDryRunFeatureConfirmed': False
    },
    'policyInterpretation': {
        'absentRetryFallbackFields': 'UNDECLARED_NOT_FALSE',
        'registryExistence': 'CONFIRMED',
        'currentEffectiveProviderModelBinding': 'NOT_VERIFIED',
        'currentNoRetryNoFallbackAllLayers': 'NOT_VERIFIED',
        'gatewayOrProviderAvailability': 'NOT_TESTED',
        'historicalPolicyOverlay': 'Historical05/10journal only, no live enforcement claim.'
    },
    'nextActions': [
        {'recommended': True, 'action': 'Verify an isolated JeikCode or OMP session with explicit model selection and non-inference route-state output.',
         'boundary': 'Needs explicit process/session setup authority before launch because startup may read credentials/settings/extensions and create state. Use actual documented surface, no invented CLI flags. No project worker/inference/source edits.'},
        {'action': 'If choosing JeikCode, operator select local8045/gemini-3.8-flash-high in a separate session and provide redacted effective route/policy binding, or expose a supported pin-aware dispatch tool.',
         'boundary': 'Do not change main/global defaults or reload config automatically; registry existence does not force task model.'},
        {'action': 'After actual policy verification, approve C-only candidate/dependency closure and26helper implementation separately.',
         'boundary': '12caller/test gates separate; no retry/resume11, receipt reconstruction or seventh repair.'}
    ],
    'flags': {'producerInvoked': False, 'inferenceRequestsSent': 0, 'DRead': False,
              'configChanged': False, 'configReloaded': False, 'sessionModelChanged': False,
              'candidateCreated': False, 'sourceEdited': False, 'testsExecuted': False,
              'sourceReady': False, 'admission': False, 'qualification': False,
              'declaredCells': 54, 'admittedCells': 0, 'executedCells': 0,
              'NF_A4RepairAuthorized': False}
}
with (DEST / 'route-config-supplement.json').open('x', encoding='utf-8', newline='') as stream:
    json.dump(report, stream, ensure_ascii=False, indent=2)

# Preserve configurations byte-for-byte within the observation window without printing their hashes.
config_snapshots = {p: hashlib.sha256(p.read_bytes()).digest() for p in [OMP, JEIK]}
assert model.get('model', model.get('api_model')) == 'gemini-3.8-flash-high'
assert len(omp_models) == 1
assert not report['flags']['producerInvoked']
for root, branch, head in [(ROOT, 'feat/education-gemini38-cook-261001', 'c5b5e896d9f06859b21e19122f81c7613067c386'),
                          (pathlib.Path('C:/Work/NavSlidesEditor'), 'main', 'aa19b59cd5bd5de2510f9bc4edd2ef2311ce9131')]:
    assert subprocess.check_output(['git', '-C', str(root), 'branch', '--show-current'], text=True).strip() == branch
    assert subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip() == head
    assert not subprocess.check_output(['git', '-C', str(root), 'diff', '--cached', '--name-only'], text=True).strip()
    status = subprocess.check_output(['git', '-C', str(root), 'status', '--porcelain=v1', '--untracked-files=all'], text=True).splitlines()
    if root == ROOT:
        exclude = ['education-partial11-settlement-20261007/', 'education-partial11-access-diagnostic-20261007/',
                   'education-c-only-correction-preparation-20261007/', 'education-c-only-gate0-20261007/', 'education-route-config-supplement-20261007/']
        old = [row for row in status if not any(x in row for x in exclude)]
        assert len([x for x in old if x.startswith(' M')]) == 12
        assert len([x for x in old if x.startswith('??')]) == 9
    else:
        assert status == ['?? plans/handoffs/education-partial11-resume-20261007.md']
assert all(hashlib.sha256(p.read_bytes()).digest() == value for p, value in config_snapshots.items())
validation = {'kind': 'REDACTED_CONFIG_REPORT_VALIDATION_NOT_ACTIVE_ROUTE_OR_SOURCE_GATE',
              'twoRegistriesDeclareTarget': True, 'secretsNotEmittedOrCopied': True,
              'configBytesStableDuringFinalValidationWindow': True,
              'configNeverWrittenByThisRequest': True, 'configWindowLimit': 'Observation-window digest only; no initial config byte snapshot proof for entire request.',
              'gitBranchHEADAndObservedStatusVerified': True, 'stagedPaths': 0,
              'producerInvoked': False, 'inferenceRequests': 0, 'DRead': False,
              'candidateCreated': False, 'sourceEdited': False,
              'remainingBlocker': 'Actual isolated-session binding and end-to-end no-retry/no-fallback policy verification.'}
with (DEST / 'route-supplement-validation.json').open('x', encoding='utf-8', newline='') as stream:
    json.dump(validation, stream, ensure_ascii=False, indent=2)
print('Target model declared in both registries. Report written redacted. No inference/config changes. Actual current dispatch binding remains unverified.')
print('JEIKCODE_DEFAULTS', report['JeikCode']['defaultProviderDeclared'], report['JeikCode']['defaultModelDeclared'])
print('SUBAGENT_PIN_FIELDS', json.dumps(report['JeikCode']['subagentRouteFields']))

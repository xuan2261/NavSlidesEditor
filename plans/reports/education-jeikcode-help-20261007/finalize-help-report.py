"""Phân tích help artifact; không chạy CLI lần nữa."""
import json
import pathlib
import subprocess

ROOT = pathlib.Path('C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001')
OUT = pathlib.Path(__file__).parent
text = (OUT / 'jeikcode-help.stdout.txt').read_text(encoding='utf-8')
exit_report = json.loads((OUT / 'help-inspection.json').read_text(encoding='utf-8'))
assert exit_report['exitCode'] == 0
provider = next(line.strip() for line in text.splitlines() if '--provider' in line)
model = next(line.strip() for line in text.splitlines() if '--model' in line)
commands = []
if 'Commands:' in text:
    block = text.split('Commands:', 1)[1].split('Options:', 1)[0]
    commands = [line.strip().split()[0] for line in block.splitlines() if line.strip()]
flags = [line.strip() for line in text.splitlines() if line.strip().startswith('--')]
report = {
    'kind': 'ACTUAL_BINARY_PIN_FLAGS_CONFIRMED_NO_LIVE_ROUTE_PROOF',
    'date': '2026-10-07',
    'binary': 'C:/Users/Z10PAD8C_Xuan2261/.local/bin/jeikcode.exe',
    'helpExitCode': 0,
    'actualProviderFlag': provider,
    'actualModelFlag': model,
    'actualSubcommands': commands,
    'actualLongFlagLines': flags,
    'compiledBinaryDiffersFromPriorSourceAssumptions': 'Do not assume chat/models/RPC subcommands exist just because static source from another snapshot showed them; consult this actual help.',
    'possiblePinnedSessionLaunchProposedNotExecuted': "& 'C:/Users/Z10PAD8C_Xuan2261/.local/bin/jeikcode.exe' --provider local8045 --model gemini-3.8-flash-high",
    'launchMeaning': 'Provider-scoped model override is documented by binary. Check startup-selected effective registry identity, not default. Interactive launch without input can wait indefinitely and is NOT a shell-tool command to run synchronously.',
    'notProved': ['Live session effective model', 'Config loading/extension/telemetry startup effects', 'Application SDK gateway provider retries/fallback', 'Quota/availability', 'Source-ready or qualification'],
    'nextRecommendation': 'Use a separate interactive JeikCode session via verified flags and capture startup model status without submitting prompt, or authorize a bounded isolated background startup/state-inspection protocol before any model request. Current main/global defaults remain unchanged.',
    'approvalNeeded': 'Actual isolated session startup side effects; background lifetime/shutdown and route-state capture scope. No inference until effective binding and retry/fallback are addressed.',
    'noRepeatHelpNeeded': True,
    'commandsAccounting': 'Only executable invocation was --help, repeated for output inspection/capture. No subcommand/interactive/chat or model request. Repetition was not a producer retry.',
    'flags': {'inferenceRequested': False, 'sessionStarted': False, 'configEdited': False, 'candidateCreated': False, 'sourceEdited': False, 'DReadByAgent': False, 'acceptanceExecuted': 0}
}
for root, branch, head in [(ROOT, 'feat/education-gemini38-cook-261001', 'c5b5e896d9f06859b21e19122f81c7613067c386'),
                          (pathlib.Path('C:/Work/NavSlidesEditor'), 'main', 'aa19b59cd5bd5de2510f9bc4edd2ef2311ce9131')]:
    assert subprocess.check_output(['git', '-C', str(root), 'branch', '--show-current'], text=True).strip() == branch
    assert subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip() == head
    assert not subprocess.check_output(['git', '-C', str(root), 'diff', '--cached', '--name-only'], text=True).strip()
    status = subprocess.check_output(['git', '-C', str(root), 'status', '--porcelain=v1', '--untracked-files=all'], text=True).splitlines()
    if root == ROOT:
        exclude = ['education-partial11-settlement-20261007/', 'education-partial11-access-diagnostic-20261007/', 'education-c-only-correction-preparation-20261007/', 'education-c-only-gate0-20261007/', 'education-route-config-supplement-20261007/', 'education-pin-aware-session-procedure-20261007/', 'education-jeikcode-help-20261007/']
        remaining = [item for item in status if not any(name in item for name in exclude)]
        assert len([item for item in remaining if item.startswith(' M')]) == 12
        assert len([item for item in remaining if item.startswith('??')]) == 9
    else:
        assert status == ['?? plans/handoffs/education-partial11-resume-20261007.md']
report['gitBranchHEADAndExistingStatusVerified'] = True
with (OUT / 'verified-flags-and-next-step.json').open('x', encoding='utf-8', newline='') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print('Validated actual binary flags provider/model. No more help/source inspection needed. Separate session startup remains next scope, no model requests made.')

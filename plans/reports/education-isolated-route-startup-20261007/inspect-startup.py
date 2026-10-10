"""One bounded startup, no stdin prompt; retain only redacted observations."""
import datetime
import hashlib
import json
import os
import pathlib
import re
import subprocess
import time

ROOT = pathlib.Path('C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001')
OUT = pathlib.Path(__file__).parent
SANDBOX = OUT / 'startup-sandbox'
SANDBOX.mkdir(exist_ok=False)
EXE = 'C:/Users/Z10PAD8C_Xuan2261/.local/bin/jeikcode.exe'
CONFIGS = [pathlib.Path('C:/Users/Z10PAD8C_Xuan2261/.jeikcode/config.toml'),
           pathlib.Path('C:/Users/Z10PAD8C_Xuan2261/.omp/agent/models.yml')]
config_before = {p: hashlib.sha256(p.read_bytes()).digest() for p in CONFIGS}
command = [EXE, '--provider', 'local8045', '--model', 'gemini-3.8-flash-high']
env = os.environ.copy()
# Private child environment only: no executable search through D legacy PATH entries.
old_paths = env.get('PATH', '').split(os.pathsep)
kept = [item for item in old_paths if item and not re.search(r'(?i)(?:^|[\\/])D:', item) and not item.upper().startswith('D:')]
env['PATH'] = os.pathsep.join(kept)
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
started = time.monotonic()
proc = subprocess.Popen(command, cwd=str(SANDBOX), env=env,
                        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
# Leave stdin open without writing anything; do not submit prompt or CLI commands.
ended_naturally = False
try:
    proc.wait(timeout=12)
    ended_naturally = True
except subprocess.TimeoutExpired:
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=3)
stdout, stderr = proc.communicate(timeout=3)
elapsed = round(time.monotonic() - started, 3)
text = (stdout + b'\n' + stderr).decode('utf-8', errors='replace')
text = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', text)
# Store no raw startup log, auth, headers, config contents, full file paths or URLs.
indicators = []
patterns = {
    'target_model_token': r'gemini-3\.8-flash-high',
    'target_provider_token': r'local8045',
    'other_default_model_token': r'gpt-6\.1-sol-high',
    'stdin_not_terminal': r'(?i)(stdin|input).{0,60}(not.{0,10}terminal|not.{0,10}tty)',
    'terminal_unavailable': r'(?i)(not a terminal|not a tty|terminal.{0,35}(unavailable|failed|error)|console.{0,35}(failed|error))',
    'api_or_inference_error_token': r'(?i)(429|quota|rate.limit|stream_error|unauthorized|authentication.failed)',
    'provider_or_model_error': r'(?i)(unknown|invalid|unsupported|not.found).{0,50}(model|provider)',
    'retry_policy_token': r'(?i)(max.?retries|retry.enabled|fallbackOrder|auto.?retry)',
}
for name, pattern in patterns.items():
    hits = list(re.finditer(pattern, text))
    indicators.append({'indicator': name, 'count': len(hits), 'matchedTokensOnly': [m.group(0)[:100] for m in hits[:3]]})
# Match visible route-label lines and whitelist only known route tokens, not their surrounding text.
route_lines = []
for line in text.splitlines():
    if re.search(r'(?i)model|provider', line):
        tokens = re.findall(r'local8045|gemini-3\.8-flash-high|gpt-6\.1-sol-high', line)
        if tokens:
            route_lines.append({'knownTokens': tokens, 'labelContainsModel': bool(re.search(r'(?i)model', line)),
                                'labelContainsProvider': bool(re.search(r'(?i)provider', line))})
report = {
    'kind': 'ONE_ISOLATED_BOUNDED_STARTUP_NO_PROMPT',
    'startedUTC': start, 'elapsedSeconds': elapsed,
    'command': command, 'cwd': SANDBOX.as_posix(),
    'pid': proc.pid, 'endedNaturally': ended_naturally,
    'processExitCode': proc.returncode, 'processReaped': proc.poll() is not None,
    'stdinBytesWritten': 0, 'promptSubmitted': False,
    'stdoutBytes': len(stdout), 'stderrBytes': len(stderr),
    'rawOutputPersisted': False,
    'redactedIndicators': indicators, 'routeLabelTokens': route_lines,
    'modelPinRequested': 'local8045/gemini-3.8-flash-high',
    'liveRouteBindingProven': False,
    'retryFallbackAllLayersProven': False,
    'inferenceRequestedByAgent': False,
    'networkTrafficObserved': False,
    'noNetworkOrStartupInferenceCertified': False,
    'networkLimit': 'No prompt/API call sent by agent; startup executable network behavior was not independently captured. Do not equate zero prompt bytes with zero network traffic.',
    'configByteDigestsEqualAcrossStartup': {p.name: hashlib.sha256(p.read_bytes()).digest() == digest for p, digest in config_before.items()},
    'configEditedByAgent': False, 'globalModelSwitchedByAgent': False,
    'sandboxFiles': [p.relative_to(SANDBOX).as_posix() for p in SANDBOX.rglob('*') if p.is_file()],
    'sessionGlobalSideEffects': 'Not fully observed: startup may create caches/logs/session metadata outside sandbox. No cleanup or deletion performed.',
    'DPathsOpenedByAgent': False,
    'DPathsOpenedInternallyByExecutableCertifiedFalse': False,
    'childPATHLegacyDEntriesExcluded': len(old_paths) - len(kept),
    'sourceEdited': False, 'candidateCreated': False, 'testsExecuted': False,
    'declaredCells': 54, 'admittedCells': 0, 'executedCells': 0,
    'NF_A4RepairAuthorized': False,
}
report['verdict'] = ('STARTUP_TERMINAL_LIMIT_NO_ROUTE_PROOF' if any(x['count'] for x in indicators if x['indicator'] in ['stdin_not_terminal', 'terminal_unavailable'])
                     else 'STARTUP_OBSERVED_BUT_ROUTE_AND_POLICY_UNPROVEN')
with (OUT / 'startup-observation.json').open('x', encoding='utf-8', newline='') as stream:
    json.dump(report, stream, ensure_ascii=False, indent=2)
print(json.dumps(report, ensure_ascii=False, indent=2))

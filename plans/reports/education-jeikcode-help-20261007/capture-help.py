"""Capture only the authorized --help command; never chat/model inference."""
import json
import pathlib
import subprocess

out = pathlib.Path(__file__).parent
exe = 'C:/Users/Z10PAD8C_Xuan2261/.local/bin/jeikcode.exe'
result = subprocess.run([exe, '--help'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=20)
with (out / 'jeikcode-help.stdout.txt').open('x', encoding='utf-8', newline='') as f:
    f.write(result.stdout)
with (out / 'jeikcode-help.stderr.txt').open('x', encoding='utf-8', newline='') as f:
    f.write(result.stderr)
report = {'kind': 'ACTUAL_INSTALLED_BINARY_HELP_CAPTURE_NOT_ROUTE_EXECUTION_PROOF',
          'command': [exe, '--help'], 'exitCode': result.returncode,
          'stdoutArtifact': 'jeikcode-help.stdout.txt', 'stderrArtifact': 'jeikcode-help.stderr.txt',
          'configChangedByAgent': False, 'chatSessionStartedByAgent': False,
          'inferenceRequestedByAgent': False, 'candidateCreatedByAgent': False,
          'DPathsOpenedByAgent': False,
          'limit': 'Help output proves supported root CLI syntax only; not effective provider/model binding, remote retry policy or startup byte-level side-effect audit.'}
with (out / 'help-inspection.json').open('x', encoding='utf-8', newline='') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print('EXIT', result.returncode)
print(result.stdout)
if result.stderr:
    print('STDERR', result.stderr[:1000])

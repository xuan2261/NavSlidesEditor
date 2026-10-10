"""Offline candidate build; isolate user-home build effects, never install/activate."""
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import time

ROOT = pathlib.Path('C:/Work/JeikCode')
OUT = pathlib.Path(__file__).parent
SANDBOX = OUT / 'build-home'
ARTIFACT = OUT / 'candidate'
SANDBOX.mkdir(exist_ok=False)
ARTIFACT.mkdir(exist_ok=False)
before = json.loads((OUT / 'before.json').read_text(encoding='utf-8'))
installed = pathlib.Path(before['installedExecutable']['path'])
assert hashlib.sha256(installed.read_bytes()).hexdigest() == before['installedExecutable']['sha256']
assert shutil.disk_usage('C:/').free >= 12 * 1024**3, 'Build needs safe C reserve; no cleanup authorized'
env = os.environ.copy()
# CLI build.rs sync_user_home_assets_if_present and embedded-config probe use HOME/USERPROFILE.
# An empty sandbox contains neither user assets nor credentials and cannot modify real config.
env.update(HOME=str(SANDBOX), USERPROFILE=str(SANDBOX), JEIKCODE_HOME=str(SANDBOX),
           CARGO_HOME='C:/Users/Z10PAD8C_Xuan2261/.cargo',
           RUSTUP_HOME='C:/Users/Z10PAD8C_Xuan2261/.rustup',
           CARGO_NET_OFFLINE='true', CARGO_INCREMENTAL='0')
args = ['C:/Users/Z10PAD8C_Xuan2261/.cargo/bin/cargo.exe', 'build', '--offline', '-p', 'jeikcode', '--bin', 'jeikcode', '--locked', '--message-format=json-render-diagnostics']
started = time.time()
with (OUT / 'build-stdout.jsonl').open('x', encoding='utf-8') as stdout, (OUT / 'build-stderr.log').open('x', encoding='utf-8') as stderr:
    proc = subprocess.run(args, cwd=ROOT, env=env, stdout=stdout, stderr=stderr, text=True)
records = []
for line in (OUT / 'build-stdout.jsonl').read_text(encoding='utf-8').splitlines():
    try:
        row = json.loads(line)
    except json.JSONDecodeError:
        continue
    if row.get('reason') == 'compiler-artifact' and row.get('target', {}).get('name') == 'jeikcode' and row.get('executable'):
        records.append(row)
result = {'command': args, 'exitCode': proc.returncode, 'elapsedSeconds': round(time.time()-started, 2),
          'homeSandbox': SANDBOX.as_posix(), 'cargoHome': env['CARGO_HOME'], 'rustupHome': env['RUSTUP_HOME'],
          'incrementalDisabled': True, 'offline': True, 'profile': 'debug/development, not production release',
          'actualExecutableRecords': records, 'freeCAfterBytes': shutil.disk_usage('C:/').free,
          'installedExecutableUnchanged': hashlib.sha256(installed.read_bytes()).hexdigest() == before['installedExecutable']['sha256'],
          'activation': False, 'providerInference': False}
if proc.returncode == 0:
    assert len(records) == 1, 'Expected one executable artifact for requested bin'
    built = pathlib.Path(records[0]['executable'])
    candidate = ARTIFACT / 'jeikcode.exe'
    assert not candidate.exists()
    shutil.copy2(built, candidate)
    result['candidate'] = {'path': candidate.as_posix(), 'size': candidate.stat().st_size,
                           'sha256': hashlib.sha256(candidate.read_bytes()).hexdigest(),
                           'builtPath': built.as_posix(), 'copiedBytesMatch': hashlib.sha256(candidate.read_bytes()).hexdigest() == hashlib.sha256(built.read_bytes()).hexdigest()}
with (OUT / 'build-result.json').open('x', encoding='utf-8') as stream:
    json.dump(result, stream, ensure_ascii=False, indent=2)
print('BUILD_EXIT', proc.returncode, 'SECONDS', result['elapsedSeconds'], 'FREE_C', result['freeCAfterBytes'])
print('INSTALLED_UNCHANGED', result['installedExecutableUnchanged'])
if proc.returncode:
    print((OUT / 'build-stderr.log').read_text(encoding='utf-8')[-5000:])
else:
    print('CANDIDATE', result['candidate'])
assert proc.returncode == 0, 'Build failed; inspect actual error, do not fabricate candidate'
assert result['installedExecutableUnchanged']

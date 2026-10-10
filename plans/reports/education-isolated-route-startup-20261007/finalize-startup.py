"""Finalize one startup observation; no new process launch or inference."""
import json
import pathlib
import subprocess

ROOT = pathlib.Path('C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001')
OUT = pathlib.Path(__file__).parent
report = json.loads((OUT / 'startup-observation.json').read_text(encoding='utf-8'))
assert report['processReaped'] is True
assert report['stdinBytesWritten'] == 0
assert report['promptSubmitted'] is False
assert report['inferenceRequestedByAgent'] is False
assert all(report['configByteDigestsEqualAcrossStartup'].values())
assert report['sourceEdited'] is False
assert report['executedCells'] == 0
for root, branch, head in [(ROOT, 'feat/education-gemini38-cook-261001', 'c5b5e896d9f06859b21e19122f81c7613067c386'),
                          (pathlib.Path('C:/Work/NavSlidesEditor'), 'main', 'aa19b59cd5bd5de2510f9bc4edd2ef2311ce9131')]:
    assert subprocess.check_output(['git', '-C', str(root), 'branch', '--show-current'], text=True).strip() == branch
    assert subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip() == head
    assert not subprocess.check_output(['git', '-C', str(root), 'diff', '--cached', '--name-only'], text=True).strip()
    status = subprocess.check_output(['git', '-C', str(root), 'status', '--porcelain=v1', '--untracked-files=all'], text=True).splitlines()
    if root == ROOT:
        excludes = ['education-partial11-settlement-20261007/', 'education-partial11-access-diagnostic-20261007/',
                    'education-c-only-correction-preparation-20261007/', 'education-c-only-gate0-20261007/',
                    'education-route-config-supplement-20261007/', 'education-pin-aware-session-procedure-20261007/',
                    'education-jeikcode-help-20261007/', 'education-isolated-route-startup-20261007/']
        old = [row for row in status if not any(name in row for name in excludes)]
        assert len([row for row in old if row.startswith(' M')]) == 12
        assert len([row for row in old if row.startswith('??')]) == 9
    else:
        assert status == ['?? plans/handoffs/education-partial11-resume-20261007.md']
summary = {
    'kind': 'BOUNDED_STARTUP_COMPLETE_NOT_PIN_OR_NO_RETRY_GATE',
    'oneStartupOnly': True,
    'observedExitCode': report['processExitCode'],
    'elapsedSeconds': report['elapsedSeconds'],
    'terminationMeaning': 'Natural exit' if report['endedNaturally'] else 'Closed by the agent at the authorized12-second observation deadline; not a producer failure or inference timeout.',
    'stdoutBytes': report['stdoutBytes'], 'stderrBytes': report['stderrBytes'],
    'routeLabelTokens': report['routeLabelTokens'],
    'livePinProven': False, 'noRetryNoFallbackProven': False,
    'newProcessReaped': True, 'promptBytes': 0,
    'configDigestsUnchanged': True,
    'branchHEADAndExistingStatusPreserved': True,
    'noSourceEditsOrCandidate': True,
    'networkLimit': 'No prompt/inference initiated by agent; no independent network audit of startup internals. Never claim all startup networking disabled.',
    'DLimit': 'No D path deliberately opened by agent. Executable internal config/extension behavior not independently audited.',
    'remainingBlocker': 'Captured noninteractive startup did not provide verifiable effective provider/model and retry/fallback state.',
    'nextRecommendation': 'Use JeikCode in an actual separate interactive terminal/UI with the already-verified provider/model flags, inspect model selector/status without sending prompt, and expose redacted route-policy evidence. No further background startup retries or generic registry scans.',
    'alternativeWithoutUserTerminal': 'Seek a documented noninteractive route-state/diagnostic surface in this installed version. Such a surface is not currently demonstrated; do not invent --dry-run or send chat as a probe.',
    'currentAuthority': 'Startup observation complete, no source/producer/test execution permission added.',
    'acceptance': '54 declared /0 admitted /0 executed; NF-A4excluded/unresolved.'
}
with (OUT / 'startup-validation-and-next-step.json').open('x', encoding='utf-8', newline='') as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)
text = f'''# Isolated JeikCode startup — 2026-10-07

Đã chạy đúng một process với `--provider local8045 --model gemini-3.8-flash-high` trong sandbox C:, không ghi stdin hoặc gửi prompt. Process đã được reaped/đóng.

Elapsed: {report['elapsedSeconds']}s; exit: {report['processExitCode']}; naturalexit: {report['endedNaturally']}.
stdoutbytes: {report['stdoutBytes']}; stderrbytes: {report['stderrBytes']}. Rawlog không lưu nhằm tránh credential leakage; chỉ token whitelist giữ lại.

**Chưa chứng minh effective route/no-retry/no-fallback.** Route label tokens quan sát: {json.dumps(report['routeLabelTokens'], ensure_ascii=False)}.
Nếu bị đóng tại12-second bound, đó là kết thúc observation được phép, không producer retry/failure/inference timeout. Không tự tăng thời gian hoặc chạy lại.

Config byte digests trước/sau bằng nhau; Git branch/HEAD và12modified+9untracked có sẵn giữ nguyên,0staged. Sandbox file names: {json.dumps(report['sandboxFiles'], ensure_ascii=False)}.

Không có source/candidate/test execution. Agent không mởD hay gọi inference; network/extension behavior bên trong binary chưa independently captured nên không claim zero startup network/global side effects. Không xóa sandbox/log/cache tự phát.

## Next action cụ thể
Dùng một terminal tương tác/sessionJeikCode riêng với flags đã verified, chưa gửi prompt, kiểm model selector/status và lấy redactedeffective route/policy. Noninteractive shell của agent không cung cấp status chứng minh pin từ startup này.
Nếu muốn agent tiếp tục tự làm, cần một noninteractive diagnostic/RPC/state surface đúng version; hiện chưa quan sát được, không dựng fakeflag/dryrun hoặc gọi chat để thử.
Không lặpbackgroundstartup/registryGate0. Producer còn blocked theo policy/state;26helpercandidate/12caller/tests vẫn cần authority riêng. Model pin giữ nguyên, NF-A4excluded/unresolved,54/0/0.
'''
with (OUT / 'startup-summary.md').open('x', encoding='utf-8', newline='') as f:
    f.write(text)
print(json.dumps(summary, ensure_ascii=False, indent=2))

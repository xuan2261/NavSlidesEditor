"""Thu hồi primary source outputs của contributors; không chuyển kết luận giữa audits."""
import json
import pathlib
import re

SOURCE = pathlib.Path('C:/Users/Z10PAD8C_Xuan2261/.omp/agent/sessions/--C--Work-NavSlidesEditor--/2026-10-04T11-03-27-941Z_01a10695-43c5-7000-80a5-281eb32934b4')
DEST = pathlib.Path(__file__).parent / 'retained-contributor-primary-source'
DEST.mkdir(exist_ok=True)
records = []
for transcript in sorted(SOURCE.glob('Native11*Part.jsonl')):
    calls = {}
    for number, line in enumerate(transcript.read_text(encoding='utf-8').splitlines(), 1):
        item = json.loads(line)
        message = item.get('message', {})
        content = message.get('content', [])
        if not isinstance(content, list):
            continue
        for block in content:
            if block.get('type') == 'toolCall':
                calls[block.get('id')] = block
        if message.get('role') != 'toolResult' or message.get('toolName') != 'read':
            continue
        requested = calls.get(message.get('toolCallId'), {}).get('arguments', {}).get('path', '')
        if 'pending-substrate-candidate-11-partial/' not in requested:
            continue
        text = '\n'.join(block.get('text', '') for block in content if block.get('type') == 'text')
        if not text or any(marker in text for marker in ['EISDIR', 'path does not exist:', 'Path not found:', 'directory scan', '[... omitted', '[Output truncated']):
            continue
        match = re.match(r'^(D:/[^:]+)(.*)$', requested)
        if not match:
            continue
        filename = f'{transcript.stem}-row-{number}-{pathlib.PurePosixPath(match[1]).name}.txt'
        with (DEST / filename).open('x', encoding='utf-8') as stream:
            stream.write(text)
        records.append({'originalPath': match[1], 'requestedPath': requested,
                        'retainedOutput': filename, 'transcript': str(transcript),
                        'transcriptLine': number, 'timestamp': item.get('timestamp'),
                        'toolCallId': message.get('toolCallId'),
                        'primarySourceNotContributorConclusion': True,
                        'coverageCertified': False})
with (DEST / 'index.json').open('x', encoding='utf-8') as stream:
    json.dump(records, stream, ensure_ascii=False, indent=2)
print('Retained authentic contributor primary read outputs:', len(records))

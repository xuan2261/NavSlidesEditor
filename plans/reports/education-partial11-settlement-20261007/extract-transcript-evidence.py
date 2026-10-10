"""Thu hồi nguyên văn read/yield outputs; không tạo source hay producer receipt."""
import json
import pathlib
import re
from collections import defaultdict

SESSION = pathlib.Path(
    'C:/Users/Z10PAD8C_Xuan2261/.omp/agent/sessions/--C--Work-NavSlidesEditor--/'
    '2026-10-04T11-03-27-941Z_01a10695-43c5-7000-80a5-281eb32934b4'
)
DEST = pathlib.Path(__file__).parent / 'retained-transcript-outputs'
BRANCHES = ['Partial11NativeSalvage', 'Partial11EvidenceSalvage']


def save_new(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x', encoding='utf-8', newline='') as stream:
        stream.write(text)


for branch in BRANCHES:
    calls = {}
    records = defaultdict(list)
    deliveries = []
    transcript = SESSION / (branch + '.jsonl')
    for line_number, line in enumerate(transcript.read_text(encoding='utf-8').splitlines(), 1):
        item = json.loads(line)
        message = item.get('message', {})
        content = message.get('content', [])
        if not isinstance(content, list):
            continue
        for block in content:
            if block.get('type') == 'toolCall':
                calls[block['id']] = block
                if block.get('name') == 'yield':
                    deliveries.append({
                        'transcriptLine': line_number,
                        'timestamp': item.get('timestamp'),
                        'toolCallId': block['id'],
                        'data': block.get('arguments', {}).get('data'),
                    })
        if message.get('role') != 'toolResult' or message.get('toolName') != 'read':
            continue
        call = calls.get(message.get('toolCallId'), {})
        requested = call.get('arguments', {}).get('path', '')
        match = re.match(r'^(D:/[^:]+)(.*)$', requested)
        if not match:
            continue
        text = '\n'.join(block.get('text', '') for block in content if block.get('type') == 'text')
        if not text or any(marker in text for marker in [
            '[... omitted', '[... truncated', '[Output truncated', 'EISDIR',
            'path does not exist:', 'Error reading file',
        ]):
            continue
        suffix = match[2].replace(':raw', '')
        start_match = re.search(r':(\d+)', suffix)
        start = int(start_match[1]) if start_match else 1
        records[match[1]].append({
            'text': text,
            'requestedPath': requested,
            'transcriptLine': line_number,
            'timestamp': item.get('timestamp'),
            'toolCallId': message.get('toolCallId'),
            'rawRequested': ':raw' in requested,
            'requestedStart': start,
            'hasRangeContinuationMarker': '[Showing lines' in text,
        })
    inventory = []
    for ordinal, (original_path, candidates) in enumerate(sorted(records.items()), 1):
        full = [record for record in candidates if record['rawRequested']
                and record['requestedStart'] == 1
                and not record['hasRangeContinuationMarker']]
        # A retained output is not certified coverage: owners must inspect content/EOF.
        selected = [max(full, key=lambda record: len(record['text']))] if full else []
        if not selected:
            unique = {}
            for record in candidates:
                if record['rawRequested']:
                    unique.setdefault(record['text'], record)
            selected = list(unique.values())
        if not selected:
            selected = [max(candidates, key=lambda record: len(record['text']))]
        entry = {
            'originalPath': original_path,
            'candidateCompleteRawOutputAvailable': bool(full),
            'certifiedFullRead': False,
            'outputs': [],
        }
        for part, record in enumerate(selected, 1):
            filename = f'{ordinal:03d}-{pathlib.PurePosixPath(original_path).name}-read-{part:03d}.txt'
            save_new(DEST / branch / filename, record['text'])
            entry['outputs'].append({key: value for key, value in record.items() if key != 'text'} | {
                'retainedOutput': filename,
                'transcript': str(transcript).replace('\\', '/'),
                'provenanceKind': 'AUTHENTIC_RETAINED_TOOL_OUTPUT_NOT_LIVE_SOURCE_OR_RECEIPT',
            })
        inventory.append(entry)
    save_new(DEST / branch / 'index.json', json.dumps({
        'branch': branch,
        'logicalAudit': branch,
        'provenance': 'Exact read-result text from this audit transcript only; no cross-branch substitution.',
        'notCoverageCertification': True,
        'notProducerReceiptReconstruction': True,
        'currentDDriveAccessibilityUnresolved': True,
        'files': inventory,
    }, indent=2, ensure_ascii=False))
    for delivery in deliveries:
        save_new(DEST / branch / f"yield-{delivery['transcriptLine']}.json",
                 json.dumps(delivery, indent=2, ensure_ascii=False))
    print(branch, 'retained path groups:', len(inventory),
          'complete-raw candidates:', sum(entry['candidateCompleteRawOutputAvailable'] for entry in inventory),
          'authentic yields:', len(deliveries))

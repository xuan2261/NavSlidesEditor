"""Bảo toàn delivery contributors thật; không chứng nhận full-audit từ manifest."""
import json
import pathlib

SOURCE = pathlib.Path('C:/Users/Z10PAD8C_Xuan2261/.omp/agent/sessions/--C--Work-NavSlidesEditor--/2026-10-04T11-03-27-941Z_01a10695-43c5-7000-80a5-281eb32934b4')
DEST = pathlib.Path(__file__).parent / 'retained-native-contributors'
DEST.mkdir(exist_ok=True)
for name in ['Native11JourneysPart', 'Native11LedgerPart', 'Native11ObservationPart',
             'Native11RecorderClockPart', 'Native11StatePart', 'Native11SurfacePart']:
    transcript = SOURCE / (name + '.jsonl')
    deliveries = []
    for number, line in enumerate(transcript.read_text(encoding='utf-8').splitlines(), 1):
        item = json.loads(line)
        content = item.get('message', {}).get('content', [])
        if not isinstance(content, list):
            continue
        for block in content:
            if block.get('type') == 'toolCall' and block.get('name') == 'yield':
                deliveries.append({'transcript': str(transcript), 'transcriptLine': number,
                                   'timestamp': item.get('timestamp'), 'toolCallId': block['id'],
                                   'data': block.get('arguments', {}).get('data'),
                                   'notIndependentCompleteAudit': True})
    with (DEST / (name + '-authentic-yields.json')).open('x', encoding='utf-8') as stream:
        json.dump(deliveries, stream, ensure_ascii=False, indent=2)
    print(name, 'authentic deliveries', len(deliveries))
# Native coverage counsel was actually returned to the coordinator; preserve text unchanged.
transcript = SOURCE.parent / (SOURCE.name + '.jsonl')
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
    if message.get('role') == 'toolResult' and message.get('toolName') == 'read':
        requested = calls.get(message.get('toolCallId'), {}).get('arguments', {}).get('path', '')
        if 'pending-substrate-11-native-coverage-continuation-counsel.json' not in requested:
            continue
        text = '\n'.join(block.get('text', '') for block in content if block.get('type') == 'text')
        target = DEST / f'native-coverage-counsel-coordinator-row-{number}.txt'
        with target.open('x', encoding='utf-8') as stream:
            stream.write(text)
        with target.with_suffix('.provenance.json').open('x', encoding='utf-8') as stream:
            json.dump({'transcript': str(transcript), 'transcriptLine': number,
                       'timestamp': item.get('timestamp'), 'requestedPath': requested,
                       'toolCallId': message.get('toolCallId'),
                       'notLiveDAccess': True}, stream, indent=2)
        print('Coverage counsel retained', target.name)

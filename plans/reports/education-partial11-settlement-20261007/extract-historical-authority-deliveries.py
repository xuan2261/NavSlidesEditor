"""Giữ historical bodies để đọc scope, không áp verdict lịch sử cho source hiện tại."""
import json
import pathlib

SOURCE = pathlib.Path('C:/Users/Z10PAD8C_Xuan2261/.omp/agent/sessions/--C--Work-NavSlidesEditor--/2026-10-04T11-03-27-941Z_01a10695-43c5-7000-80a5-281eb32934b4')
DEST = pathlib.Path(__file__).parent / 'retained-historical-authority-deliveries'
DEST.mkdir(exist_ok=True)
for name in ['Native07SourceGate', 'Evidence07SourceGate', 'Native08SalvageAudit',
             'Evidence08SalvageAudit', 'Partial09NativeSalvage', 'Partial09EvidenceSalvage']:
    transcript = SOURCE / (name + '.jsonl')
    for number, line in enumerate(transcript.read_text(encoding='utf-8').splitlines(), 1):
        item = json.loads(line)
        content = item.get('message', {}).get('content', [])
        if not isinstance(content, list):
            continue
        for block in content:
            if block.get('type') == 'toolCall' and block.get('name') == 'yield':
                delivery = {'transcript': str(transcript), 'transcriptLine': number,
                            'timestamp': item.get('timestamp'), 'toolCallId': block['id'],
                            'provenance': 'AUTHENTIC_HISTORICAL_YIELD_NOT_CURRENT_SOURCE_PASS',
                            'data': block.get('arguments', {}).get('data')}
                path = DEST / f'{name}-yield-{number}.json'
                with path.open('x', encoding='utf-8') as stream:
                    json.dump(delivery, stream, indent=2, ensure_ascii=False)
                print(path.name)

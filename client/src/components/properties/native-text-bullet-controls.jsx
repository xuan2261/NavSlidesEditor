import { useState } from 'react'
import { normalizeTextProperties } from 'revealjs-shared/src/pptx-text-document.js'
import { NativeTextChoice, NativeTextNumber, NativeTextValue, withTextValue } from './native-text-fields'

export default function NativeTextBulletControls({ label, bullet, onValue }) {
  const [candidate, setCandidate] = useState(bullet)
  const update = (next) => {
    setCandidate(next)
    if (next === undefined) { onValue(undefined); return }
    let valid
    try { valid = normalizeTextProperties({ bullet: next }, 'paragraph').bullet } catch { return }
    onValue(valid)
  }
  return <div className="flex min-w-0 flex-col gap-2">
    <NativeTextChoice label={`${label} bullet kind`} value={candidate?.kind}
      options={['none', 'character', 'number']} onValue={(kind) => update(kind === undefined
        ? undefined : candidate?.kind === kind ? candidate : { kind })} />
    {candidate?.kind === 'character' && <NativeTextValue key="character"
      label={`${label} bullet character`} value={candidate.character} required
      hint="Enter exactly one Unicode character."
      parse={(character) => normalizeTextProperties({ bullet: { kind: 'character', character } }, 'paragraph').bullet.character}
      onValue={(character) => update(withTextValue(candidate, 'character', character))} />}
    {candidate?.kind === 'number' && <>
      <NativeTextValue key="scheme" label={`${label} bullet numbering scheme`} value={candidate.scheme} required
        hint="Enter a canonical OOXML numbering scheme, for example arabicPeriod or romanUcPeriod."
        parse={(scheme) => normalizeTextProperties({ bullet: { ...candidate, scheme } }, 'paragraph').bullet.scheme}
        onValue={(scheme) => update(withTextValue(candidate, 'scheme', scheme))} />
      <NativeTextNumber label={`${label} bullet start`} value={candidate.startAt}
        min={1} max={32767} onValue={(value) => update(withTextValue(candidate, 'startAt', value))} />
    </>}
  </div>
}

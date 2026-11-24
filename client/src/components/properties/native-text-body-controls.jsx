import { NativeTextChoice, NativeTextNumber, withTextValue } from './native-text-fields'

export default function NativeTextBodyControls({ body = {}, onValue }) {
  const setAutofit = (key, value) => onValue('autofit', withTextValue(body.autofit, key, value))
  return <fieldset className="flex min-w-0 flex-col gap-2 border border-border p-2">
    <legend className="text-xs">Native text body</legend>
    {['Left', 'Right', 'Top', 'Bottom'].map((side) => <NativeTextNumber key={side}
      label={`PPTX body ${side.toLowerCase()} inset (EMU)`} value={body[`inset${side}Emu`]}
      onValue={(value) => onValue(`inset${side}Emu`, value)} />)}
    <NativeTextChoice label="PPTX body autofit mode" value={body.autofit?.mode}
      options={['none', 'shape', 'normal']} onValue={(mode) => onValue('autofit', mode === undefined
        ? undefined : body.autofit?.mode === mode ? body.autofit : { mode })} />
    {body.autofit?.mode === 'normal' && <>
      <NativeTextNumber label="PPTX body font scale (1/1000%)" value={body.autofit.fontScale}
        min={0} max={100000} onValue={(value) => setAutofit('fontScale', value)} />
      <NativeTextNumber label="PPTX body line space reduction (1/1000%)" value={body.autofit.lineSpaceReduction}
        min={0} max={100000} onValue={(value) => setAutofit('lineSpaceReduction', value)} />
    </>}
    <p className="text-xs text-text-secondary">Native declarations are retained. Authoring does not establish renderer or native autofit support.</p>
  </fieldset>
}

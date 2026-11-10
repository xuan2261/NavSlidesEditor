import { useState } from 'react'
import timing from 'revealjs-shared/src/pptx-timing-document.js'
import { semanticDefinition, semanticInstance } from 'revealjs-shared/src/pptx-semantic-records.js'

const { resolveSlideTiming, activeTarget, TRIGGERS } = timing
const triggerLabels = { onClick: 'On click', withPrevious: 'With previous', afterPrevious: 'After previous' }
const controlClass = 'bg-card text-text-primary border border-border rounded px-1 py-0.5 text-xs'

export default function NativeSourceTimingControls({ document, slide, onOperation }) {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  if (!document || !slide) return null
  let resolved
  try { resolved = resolveSlideTiming(document, slide) } catch (cause) {
    return <p role="alert">{cause instanceof Error ? cause.message : 'Invalid source timing'}</p>
  }
  if (!resolved.nodes.length && !resolved.unsupported.length && !slide.hasSourceTiming) return null
  const send = async (node, command) => {
    setError('')
    setPending(true)
    try {
      await onOperation({ type: 'timing.edit', slideId: slide.id, definitionId: node.definitionId,
        nodeLocator: node.nodeLocator, command })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Source timing edit was rejected')
    } finally { setPending(false) }
  }
  const disabled = pending || slide.locked || typeof onOperation !== 'function'
  return <section aria-label="Native source timing" className="px-3 py-2 border-b border-border text-xs space-y-2">
    <h3 className="font-semibold">Native source timing</h3>
    <p className="text-text-muted">Source-bound browser overlay. Original timing remains unchanged; this is not native playback equivalence.</p>
    {error && <p role="alert">{error}</p>}
    {resolved.unsupported.length > 0 && <p role="status" className="text-text-secondary">
      Preserved timing not played: {resolved.unsupported.map(row => `${row.tag}: ${row.reason}`).join('; ')}
    </p>}
    {!resolved.nodes.length && !resolved.unsupported.length && <p role="status">Source timing is preserved but its source tree is unavailable for safe browser playback.</p>}
    {resolved.nodes.map((node, index) => {
      const label = `Source timing ${index + 1}`
      const partUri = semanticDefinition(document, node.definitionId)?.source?.partUri
      const targets = (slide.elements || []).filter(element => activeTarget(document, slide, element.pptxInstanceId, partUri))
      return <fieldset key={`${node.definitionId}:${node.nodeLocator.path.join('.')}`} disabled={disabled}
        className="flex flex-wrap items-center gap-2 border border-border rounded p-2">
        <legend>{label}: {node.effect} (source shape {node.sourceTarget.spid})</legend>
        {node.status !== 'ready' && <p role="status">Timing target unavailable: {node.reason}. Choose a same-source slide target to repair it.</p>}
        <label>Target <select aria-label={`${label} target`} className={controlClass} value={node.targetInstanceId || ''}
          onChange={event => send(node, { type: 'set-target', targetInstanceId: event.target.value })}>
          {!targets.some(target => target.pptxInstanceId === node.targetInstanceId) && <option value={node.targetInstanceId || ''}>Unresolved target</option>}
          {targets.map(target => <option key={target.pptxInstanceId} value={target.pptxInstanceId}>{target.name || target.type || target.id} ({semanticDefinition(document, semanticInstance(document, target.pptxInstanceId)?.definitionId)?.source?.nativeId})</option>)}
        </select></label>
        <label>Order <select aria-label={`${label} order`} className={controlClass} value={node.order}
          onChange={event => send(node, { type: 'set-order', order: Number(event.target.value) })}>
          {resolved.nodes.map((_, order) => <option key={order} value={order + 1}>{order + 1}</option>)}
        </select></label>
        <label>Trigger <select aria-label={`${label} trigger`} className={controlClass} value={node.trigger}
          onChange={event => send(node, { type: 'set-trigger', trigger: event.target.value })}>
          {TRIGGERS.map(trigger => <option key={trigger} value={trigger}>{triggerLabels[trigger]}</option>)}
        </select></label>
        <label>Duration (ms) <input aria-label={`${label} duration`} className={controlClass} type="number" min="0" step="50"
          value={node.durationMs}
          onChange={event => {
            const durationMs = Number(event.target.value)
            if (Number.isSafeInteger(durationMs) && durationMs >= 0) send(node, { type: 'set-duration', durationMs })
          }} /></label>
        <label>Delay (ms) <input aria-label={`${label} delay`} className={controlClass} type="number" min="0" step="50"
          value={node.delayMs}
          onChange={event => {
            const delayMs = Number(event.target.value)
            if (Number.isSafeInteger(delayMs) && delayMs >= 0) send(node, { type: 'set-delay', delayMs })
          }} /></label>
        <button type="button" className={controlClass} onClick={() => send(node, { type: 'reset' })}>Reset source overlay</button>
      </fieldset>
    })}
  </section>
}

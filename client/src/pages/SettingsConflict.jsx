import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui'
import { ConfirmDialog } from './home/confirm-dialog'

export default function SettingsConflict({ conflict, fields, choices, setChoices, reviewLatest, resolveConflict, cancelShortcutRecording, resolutionFocusRef }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const reviewFocusRef = useRef(null)
  const firstConflictRef = useRef(null)
  const rebaseRef = useRef(null)
  const resolvingRef = useRef(false)
  useEffect(() => {
    if (!conflict && resolvingRef.current) {
      resolvingRef.current = false
      resolutionFocusRef?.current?.focus()
    }
    if (conflict?.latest && reviewFocusRef.current) {
      const previous = reviewFocusRef.current
      reviewFocusRef.current = null
      // Do not steal focus if the user moved elsewhere during the latest-settings GET.
      if (!previous.isConnected && document.activeElement === document.body) {
        (firstConflictRef.current || rebaseRef.current)?.focus()
      }
    }
  }, [conflict, resolutionFocusRef])
  const finishResolution = (reload = false) => {
    resolvingRef.current = true
    resolveConflict(reload)
  }
  if (!conflict) return null
  return <><section aria-label="Settings conflict" className="mb-6 border border-border rounded-md p-4">
    <h2>Resolve settings conflict</h2>
    {!conflict.latest ? <Button onClick={event => {
      reviewFocusRef.current = document.activeElement === event.currentTarget ? event.currentTarget : null
      reviewLatest()
    }}>Review latest</Button> : <>
      <p>Unchanged fields use the latest server values. Choose which changes to keep for each conflict.</p>
      {fields.map((field, index) => {
        const label = field === 'ai.apiKey' ? 'API key conflict' : `${field} conflict`
        return <label key={field} className="block my-3">{label}
          <select ref={index === 0 ? firstConflictRef : undefined} aria-label={label} value={choices[field] || ''}
            onChange={event => setChoices(previous => ({ ...previous, [field]: event.target.value }))}
            className="block border border-border rounded-md bg-secondary p-2">
            <option value="">Choose local or server</option>
            <option value="local">Apply my draft</option>
            <option value="server">Keep server value</option>
          </select>
        </label>
      })}
      <div className="flex gap-2">
        <Button ref={rebaseRef} onClick={() => finishResolution()} disabled={fields.some(field => !choices[field])}>Rebase draft</Button>
        <Button onClick={() => {
          cancelShortcutRecording()
          setConfirmDiscard(true)
        }}>Reload and discard draft</Button>
      </div>
    </>}
  </section>
    {confirmDiscard && conflict.latest && <ConfirmDialog
      dialog={{
        title: 'Reload latest settings?',
        message: 'Discard your unsaved draft and load the latest settings?',
        onConfirm: () => finishResolution(true),
      }}
      onClose={() => setConfirmDiscard(false)}
    />}
  </>
}

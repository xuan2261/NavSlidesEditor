import { useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../utils/api'

export default function NativePictureReplacementControl({
  document, instanceId, blocked, replacement, submit, setError, controlClass,
}) {
  const { id: presentationId } = useParams()
  const [uploading, setUploading] = useState(null)
  const pending = useRef(null)
  // Cancel when history, target, lock, or canonical data changes during upload.
  useLayoutEffect(() => () => {
    pending.current?.abort()
    pending.current = null
  }, [presentationId, instanceId, blocked, document])
  const upload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || blocked || !presentationId) return
    pending.current?.abort()
    const request = new AbortController()
    pending.current = request
    setUploading({ request, document, instanceId, presentationId })
    try {
      const result = await api.uploadFile(file, {
        presentationId, purpose: 'picture-replacement', signal: request.signal,
      })
      if (request.signal.aborted || pending.current !== request) return
      await submit(() => ({ type: 'replace', replacement: result.pictureReplacement,
        expectedReplacement: replacement }))
    } catch (rejected) {
      if (!request.signal.aborted) setError(rejected.message)
    } finally {
      if (pending.current === request) {
        pending.current = null
        setUploading(null)
      }
    }
  }
  return <>
    <label className="block text-xs">
      Replace picture file
      <input type="file" aria-label="Replace picture file" className={controlClass}
        accept=".png,.jpg,.jpeg,.gif,.webp,.bmp" disabled={blocked || !presentationId}
        onChange={upload} />
    </label>
    {uploading?.document === document && uploading.instanceId === instanceId &&
      uploading.presentationId === presentationId && !blocked &&
      !uploading.request.signal.aborted && <p role="status" className="text-xs">Uploading picture</p>}
    <button type="button" className={controlClass} disabled={blocked || !replacement}
      onClick={() => submit(() => ({ type: 'restore-source', expectedReplacement: replacement }))}>
      Restore source picture
    </button>
  </>
}

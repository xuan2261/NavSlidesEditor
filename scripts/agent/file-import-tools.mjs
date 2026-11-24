import { z } from 'zod'
import path from 'node:path'
import { tool, id, confirm, AgentError } from './contracts.mjs'
import { assertWritable, checkCancelled, readLocalFile } from './files.mjs'

export const localFile = z.string().min(1).max(4096).describe('Local file path inside NAVSLIDES_WORKSPACE; regular inputs are limited to 100 MiB.')
const capability = z.string().min(1).max(4096).regex(/^[\x21-\x7e]+$/).optional().describe('Capability returned by PPTX admission; passed only in the control header, never the URL.')

async function multipart(file, signal) {
  const input = await readLocalFile(file, { signal })
  const body = new FormData()
  body.append('file', new Blob([input.buffer]), input.name)
  return body
}

function invalidResponse(message) {
  return new AgentError('INVALID_SERVER_RESPONSE', message, 'Check the NavSlides server version and inspect its import recovery state before retrying.')
}

async function projectImport(args, api, signal, body) {
  body.append('trustedAuthorActiveContentAcknowledged', String(args.trustedAuthorActiveContentAcknowledged))
  checkCancelled(signal)
  // Admission is deliberately uncancelled so a created session never loses its handle.
  const session = await api.request('/api/project-imports/preflight', { method: 'POST', body, timeout: 120000 })
  const sessionId = id.safeParse(session?.sessionId)
  if (!sessionId.success || typeof session?.capability !== 'string' || !/^[\x21-\x7e]{1,4096}$/.test(session.capability)) {
    throw invalidResponse('Project preflight did not return a valid session handle and capability.')
  }
  const route = `/api/project-imports/${sessionId.data}`
  const headers = { 'X-NavSlides-Import-Capability': session.capability }
  try {
    if (!Number.isSafeInteger(session.mediaCount) || session.mediaCount < 0) throw invalidResponse('Project preflight did not return a valid media count.')
    checkCancelled(signal)
    if (session.mediaCount > 0) await api.request(`${route}/media`, { method: 'POST', headers, signal, timeout: 120000 })
    checkCancelled(signal)
    // Like admission, publication must return its definitive receipt despite consumer cancellation.
    const receipt = await api.request(`${route}/publish`, { method: 'POST', headers, body: { trustedAuthorActiveContentAcknowledged: args.trustedAuthorActiveContentAcknowledged }, timeout: 120000 })
    if (receipt?.status !== 'committed' || !id.safeParse(receipt.presentationId).success) throw invalidResponse('Project publication did not return a committed presentation receipt.')
    return receipt
  } catch (error) {
    let rollback
    try {
      const result = await api.request(route, { method: 'DELETE', headers, timeout: 15000 })
      rollback = `Rollback response: ${JSON.stringify(result)}.`
    } catch (rollbackError) {
      rollback = `Rollback failed (${rollbackError.code || 'OPERATION_FAILED'}); inspect the staged import in the server recovery log before retrying.`
    }
    throw new AgentError(error.code || 'PROJECT_IMPORT_FAILED', error.message, `${error.hint || 'Inspect the original import error.'} ${rollback}`, error.status)
  }
}

export const importTools = [
  tool('upload_media', 'Upload a sandboxed local media file (maximum 100 MiB) and return the server upload URL. Does not return local bytes; optional presentationId associates the asset with a deck.', {
    file: localFile, presentationId: id.optional(),
  }, async (args, api, signal) => {
    assertWritable(api)
    const body = await multipart(args.file, signal)
    if (args.presentationId) body.append('presentationId', args.presentationId)
    return api.request('/api/upload', { method: 'POST', body, signal, timeout: 120000 })
  }),
  tool('import_presentation', 'Import .pptx, .json or .navslides from the local sandbox (maximum 100 MiB). PPTX returns a job handle: call get_import_job explicitly. Projects preflight, stage media if needed and publish atomically; active content acknowledgement is never assumed.', {
    file: localFile, trustedAuthorActiveContentAcknowledged: z.boolean().default(false).describe('Set true only after the user acknowledges active content from a trusted author.'),
  }, async (args, api, signal) => {
    assertWritable(api)
    checkCancelled(signal)
    const suffix = path.extname(args.file).toLowerCase()
    if (!['.pptx', '.json', '.navslides'].includes(suffix)) throw new AgentError('UNSUPPORTED_IMPORT_FORMAT', 'File admission supports .pptx, .json and .navslides, not Markdown.', 'For Markdown authoring, read the approved .md as text and pass markdown to create_presentation; do not use file import admission.')
    const body = await multipart(args.file, signal)
    checkCancelled(signal)
    if (suffix !== '.pptx') return projectImport(args, api, signal, body)
    // Never abort admission: the durable job handle must be returned even after cancellation.
    const admission = await api.request('/api/pptx/import', { method: 'POST', body, timeout: 120000 })
    if (!id.safeParse(admission?.jobId).success) throw invalidResponse('PPTX admission did not return a valid jobId.')
    return { jobId: admission.jobId, ...(typeof admission.capability === 'string' ? { capability: admission.capability } : {}), guidance: `Call get_import_job with jobId and the returned capability to inspect progress and result.presentationId. To cancel, call cancel_import_job with the same handle and confirm:true.${signal?.aborted ? ' Cancellation arrived after admission; the job remains explicit and has not been silently cancelled.' : ''}` }
  }),
  tool('get_import_job', 'Read a PPTX import job, including progress, failure details or result.presentationId. Supply the capability returned at admission when required. This call does not wait or poll repeatedly.', {
    jobId: id, capability,
  }, (args, api, signal) => api.request(`/api/pptx/jobs/${args.jobId}`, { headers: args.capability ? { 'X-Pptx-Job-Capability': args.capability } : {}, signal }), { readOnly: true }),
  tool('cancel_import_job', 'Request cancellation of an active PPTX import. Requires explicit confirmation and its admission capability when required. Completed or too-late jobs remain subject to server authority.', {
    jobId: id, capability, confirm,
  }, async (args, api, signal) => {
    assertWritable(api)
    return api.request(`/api/pptx/jobs/${args.jobId}`, { method: 'DELETE', headers: args.capability ? { 'X-Pptx-Job-Capability': args.capability } : {}, signal })
  }, { destructive: true }),
]

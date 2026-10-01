import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { tool, id, AgentError } from './contracts.mjs'
import { assertWritable, checkCancelled, resolveLocalPath, writeLocalFile } from './files.mjs'
import { localFile } from './file-import-tools.mjs'
import { portableProject } from './file-project-export.mjs'

export const exportTools = [
  tool('export_presentation', 'Export HTML, immutable original PPTX, server-validated edited PPTX or portable .navslides.json to the sandbox. Never overwrites without overwrite:true; the output directory must exist. Edited PPTX requires a positive fidelity generation and never falls back or reconstructs. JSON references, rather than embeds, uploaded assets. PDF/native desktop export is not offered.', {
    presentationId: id,
    format: z.enum(['html', 'pptx-original', 'pptx-edited', 'json']),
    path: localFile.describe('Output file inside NAVSLIDES_WORKSPACE; its parent directory must exist. Use .navslides.json for JSON exports.'),
    overwrite: z.boolean().default(false),
  }, async (args, api, signal) => {
    assertWritable(api)
    checkCancelled(signal)
    const target = await resolveLocalPath(args.path, { write: true, overwrite: args.overwrite, readOnly: api.readOnly })
    const route = `/api/presentations/${args.presentationId}`
    let bytes
    let warnings = []
    if (args.format === 'json') {
      const presentation = await api.request(route, { signal })
      const portable = portableProject(presentation)
      bytes = portable.bytes
      warnings = portable.warnings
    } else if (args.format === 'html') {
      bytes = await api.request(`${route}/export`, { binary: true, signal })
    } else {
      const fidelity = await api.request(`${route}/pptx-fidelity`, { signal })
      const generation = fidelity?.aggregateGeneration
      const hasGeneration = Number.isSafeInteger(generation) && generation > 0
      if (args.format === 'pptx-edited' && !hasGeneration) {
        throw new AgentError('PPTX_GENERATION_REQUIRED', 'Edited PPTX export requires a positive safe aggregateGeneration from pptx-fidelity.', 'Inspect get_presentation and the server fidelity report; this tool cannot reconstruct or substitute another export.')
      }
      const headers = hasGeneration ? { 'If-Pptx-Generation': String(generation) } : {}
      const edited = args.format === 'pptx-edited'
      if (edited) headers['Idempotency-Key'] = randomUUID()
      bytes = await api.request(`${route}/${args.format}`, { method: edited ? 'POST' : 'GET', headers, binary: true, signal, timeout: edited ? 120000 : 30000 })
    }
    checkCancelled(signal)
    const saved = await writeLocalFile(target, bytes, { overwrite: args.overwrite, readOnly: api.readOnly, signal })
    return { ...saved, format: args.format, ...(warnings.length ? { warnings } : {}) }
  }, { destructive: true }),
]

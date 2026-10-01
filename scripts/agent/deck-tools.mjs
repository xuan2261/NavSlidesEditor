import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import schemas from '../../server/middleware/schemas.js'
import { buildSlidesFromOutline } from '../../client/src/utils/build-slides-from-outline.js'
import { markdownToSlidesWithWarnings } from '../../client/src/utils/markdown-import.js'
import { tool, id, object, confirm, AgentError } from './contracts.mjs'
import { editOperation, applyEdits, makeSlide, requireGeneration, validateSlideIdentities } from './edits.mjs'
import { summarize } from './read-tools.mjs'

const generation = z.number().int().positive().optional().describe('Optional fence from a previous get_presentation. Only package-backed decks have generations.')
const outlineItem = z.object({ title: z.string().max(500), bulletPoints: z.array(z.string().max(1000)).max(100).optional(), notes: z.string().max(5000).optional(), speakerNotes: z.string().max(5000).optional(), layout: z.enum(['title', 'content']).optional() }).strict()
const patchSchema = z.object({ title: z.string().max(500).optional(), theme: z.string().max(100).optional(), transition: z.string().max(100).optional(), description: z.string().max(10000).optional(), resolution: z.object({ width: z.number().positive().max(7680), height: z.number().positive().max(4320) }).strict().optional(), designTokens: object.optional(), footer: object.optional(), presenterTools: object.optional(), slides: z.array(object).max(500).optional(), layoutMasters: z.array(object).max(64).optional() }).strict()
const needsConfirm = (args) => { if (args.confirm !== true) throw new AgentError('CONFIRM_REQUIRED', 'This change removes or replaces slide content.', 'Obtain explicit user authorization, then supply confirm=true. A dry run needs no confirmation.') }

async function save(api, presentationId, patch, deck, signal) {
  const parsed = schemas.updatePresentationSchema.parse({ ...patch, ...(deck.layoutMasters && !patch.layoutMasters ? { layoutMasters: deck.layoutMasters } : {}) })
  const body = { ...parsed, ...(deck.aggregateGeneration ? { aggregateGeneration: deck.aggregateGeneration, idempotencyKey: randomUUID() } : {}) }
  return api.request(`/api/presentations/${presentationId}`, { method: 'PUT', body, signal })
}

export const deckTools = [
  tool('create_presentation', 'Create an editable deck from one source: outline, markdown, raw slides, templateId, or no source (welcome deck). Uses the existing editor builders. Do not supply credentials or package authority fields.', {
    title: z.string().max(500).optional(), theme: z.string().max(100).optional(), transition: z.string().max(100).optional(),
    templateId: id.optional(), outline: z.array(outlineItem).min(1).max(100).optional(), markdown: z.string().min(1).max(1000000).optional(), slides: z.array(object).max(500).optional(),
    resolution: patchSchema.shape.resolution, designTokens: object.optional(),
  }, async (args, api, signal) => {
    if (['templateId', 'outline', 'markdown', 'slides'].filter((key) => args[key] !== undefined).length > 1) throw new AgentError('INVALID_SOURCE', 'Choose only one deck content source.', 'Use outline, markdown, slides or templateId, not a combination.')
    const { outline, markdown, ...body } = args
    let warnings = []
    if (outline) body.slides = buildSlidesFromOutline(outline)
    if (markdown) { const built = markdownToSlidesWithWarnings(markdown); body.slides = built.slides; warnings = built.warnings }
    if (body.slides) { body.slides = body.slides.map(makeSlide); validateSlideIdentities(body.slides) }
    const value = await api.request('/api/presentations', { method: 'POST', body: schemas.createPresentationSchema.parse(body), signal })
    return { ...summarize(value, api), warnings }
  }),
  tool('update_presentation', 'Patch deck metadata or replace raw slides/layout masters. Content replacement requires confirm=true. Read current state first; dryRun validates without writing. No silent conflict retry.', {
    presentationId: id, patch: patchSchema, expectedGeneration: generation, dryRun: z.boolean().default(false), confirm: confirm.optional(),
  }, async (args, api, signal) => {
    if (!Object.keys(args.patch).length) throw new AgentError('EMPTY_PATCH', 'The patch has no fields.', 'Supply at least one editable field.')
    const deck = await api.request(`/api/presentations/${args.presentationId}`, { signal })
    requireGeneration(deck, args.expectedGeneration)
    const patch = { ...args.patch }
    if (patch.slides) { patch.slides = patch.slides.map(makeSlide); validateSlideIdentities(patch.slides) }
    schemas.updatePresentationSchema.parse({ ...patch, ...(deck.layoutMasters && !patch.layoutMasters ? { layoutMasters: deck.layoutMasters } : {}) })
    if (args.dryRun) return { dryRun: true, changes: patch, generation: deck.aggregateGeneration ?? null }
    if (patch.slides || patch.layoutMasters) needsConfirm(args)
    return summarize(await save(api, args.presentationId, patch, deck, signal), api)
  }, { destructive: true }),
  tool('edit_presentation', 'Apply a batch of slide/element edits with one save. Uses IDs for targets; add_slide.at and move_slide.to are 1-based within siblings. Elements use editor defaults. dryRun returns validated preview. Removal or elements/children replacement needs confirm=true. Package-backed saves are generation-fenced; ordinary decks remain last-writer-wins.', {
    presentationId: id, operations: z.array(editOperation).min(1).max(100), expectedGeneration: generation, dryRun: z.boolean().default(false), confirm: confirm.optional(),
  }, async (args, api, signal) => {
    const deck = await api.request(`/api/presentations/${args.presentationId}`, { signal })
    requireGeneration(deck, args.expectedGeneration)
    const slides = applyEdits(deck, args.operations)
    if (args.dryRun) return { dryRun: true, preview: summarize({ ...deck, slides }, api), slides }
    if (args.operations.some((op) => op.op.startsWith('remove_') || (op.op === 'update_slide' && (Object.hasOwn(op.properties, 'elements') || Object.hasOwn(op.properties, 'children'))))) needsConfirm(args)
    return summarize(await save(api, args.presentationId, { slides }, deck, signal), api)
  }, { destructive: true }),
  tool('duplicate_presentation', 'Duplicate a deck with new server-owned identities, preserving package-backed content.', { presentationId: id }, async (args, api, signal) => summarize(await api.request(`/api/presentations/${args.presentationId}/duplicate`, { method: 'POST', signal }), api)),
  tool('delete_presentation', 'Move a deck to trash (default) or irreversibly delete its deck, history, share links and PPTX package (permanent=true). Explicit user confirmation is required.', { presentationId: id, permanent: z.boolean().default(false), confirm }, (args, api, signal) => api.request(`/api/presentations/${args.presentationId}${args.permanent ? '/permanent' : ''}`, { method: 'DELETE', signal }), { destructive: true }),
  tool('restore_presentation', 'Restore a previously trashed deck.', { presentationId: id }, (args, api, signal) => api.request(`/api/presentations/${args.presentationId}/restore`, { method: 'POST', signal })),
  tool('save_template', 'Save a copy of a deck as a reusable template. Retains package ownership through the existing API.', { presentationId: id, title: z.string().trim().min(1).max(500).optional() }, async (args, api, signal) => summarize(await api.request(`/api/presentations/${args.presentationId}/save-as-template`, { method: 'POST', body: args.title ? { title: args.title } : {}, signal }), api)),
]

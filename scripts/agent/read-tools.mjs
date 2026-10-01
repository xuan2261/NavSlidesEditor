import { z } from 'zod'
import shared from 'revealjs-shared'
import { ELEMENT_DEFAULTS, DEFAULT_POSITIONS } from '../../client/src/data/element-defaults.js'
import { tool, id, page, paginate } from './contracts.mjs'

const strip = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
export function summarize(presentation, api) {
  const slides = presentation.slides || []
  return {
    id: presentation.id, title: presentation.title, theme: presentation.theme, transition: presentation.transition,
    slideCount: slides.length, updatedAt: presentation.updatedAt,
    ...(presentation.aggregateGeneration ? { aggregateGeneration: presentation.aggregateGeneration } : {}),
    editorUrl: `${api.baseUrl}/editor/${presentation.id}`, presentUrl: `${api.baseUrl}/api/presentations/${presentation.id}/present`,
    slides: slides.map((s, index) => ({ id: s.id, number: index + 1, title: strip(s.elements?.find((e) => e.type === 'text')?.content).slice(0, 120), childCount: s.children?.length || 0, elements: (s.elements || []).map((e) => ({ id: e.id, type: e.type, x: e.x, y: e.y, width: e.width, height: e.height, text: strip(e.content || e.text).slice(0, 160) })) })),
  }
}

export function authoringReference() {
  return { canvas: { width: 960, height: 540, unit: 'pixels', origin: 'top-left' },
    revealThemes: shared.SUPPORTED_REVEAL_THEMES, transitions: shared.TRANSITION_TYPES,
    designPresets: shared.THEME_PRESETS.map((p) => ({ id: p.id, name: p.name, tokens: p.tokens })),
    elementTypes: Object.keys(ELEMENT_DEFAULTS), elementDefaults: ELEMENT_DEFAULTS, defaultPositions: DEFAULT_POSITIONS,
    notes: 'presentation.theme takes a Reveal theme; design presets are tokens, not theme IDs. edit_presentation uses slide IDs, not indices; indices in preview_slide are 1-based. Read current state before editing. Package-backed decks use generation fences; other decks are last-writer-wins. Do not concurrently edit in the UI.' }
}

export const readTools = [
  tool('server_status', 'Check the local NavSlides app readiness. No autostart, file access or credential output.', {}, async (_, api, signal) => ({ url: api.baseUrl, readOnly: api.readOnly, health: await api.request('/health/ready', { signal }) }), { readOnly: true }),
  tool('authoring_reference', 'Read canonical element types/defaults, canvas size, themes, transitions and design tokens. Works without the app running.', {}, async () => authoringReference(), { readOnly: true }),
  tool('list_presentations', 'List deck summaries with local search and pagination. Set trash=true to inspect soft-deleted decks.', { ...page, search: z.string().max(500).default(''), trash: z.boolean().default(false) }, async (args, api, signal) => {
    const rows = await api.request(args.trash ? '/api/presentations/trash/list' : '/api/presentations', { signal })
    return paginate(rows.map(({ thumbnail: _thumbnail, ...row }) => row), args)
  }, { readOnly: true }),
  tool('get_presentation', 'Read slide/element IDs and short text outlines. detailed=true returns the editor JSON; use before editing. URLs use the backend port (dev editor also available on port 5173).', { presentationId: id, detailed: z.boolean().default(false) }, async (args, api, signal) => {
    const deck = await api.request(`/api/presentations/${args.presentationId}`, { signal })
    return args.detailed ? deck : summarize(deck, api)
  }, { readOnly: true }),
  tool('list_templates', 'List user templates or built-in marketplace templates (builtIn=true), without large slide payloads.', { ...page, search: z.string().max(500).default(''), builtIn: z.boolean().default(false) }, async (args, api, signal) => {
    const value = await api.request(args.builtIn ? '/api/marketplace/templates' : '/api/templates', { signal })
    const rows = args.builtIn ? value.templates : value
    return paginate(rows.map(({ slides: _slides, thumbnail: _thumbnail, ...row }) => row), args)
  }, { readOnly: true }),
  tool('get_template', 'Read a user or built-in template with its slide content.', { templateId: id, builtIn: z.boolean().default(false) }, (args, api, signal) => api.request(`${args.builtIn ? '/api/marketplace/templates' : '/api/templates'}/${args.templateId}`, { signal }), { readOnly: true }),
  tool('list_media', 'Search uploaded media; returns URLs suitable for image/video/audio src. Paginated.', { ...page, search: z.string().max(500).default(''), type: z.enum(['image', 'video', 'audio', 'document']).optional() }, async (args, api, signal) => {
    const query = new URLSearchParams({ search: args.search, ...(args.type ? { type: args.type } : {}) })
    return paginate(await api.request(`/api/media?${query}`, { signal }), args)
  }, { readOnly: true }),
]

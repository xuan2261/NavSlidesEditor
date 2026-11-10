/**
 * Zod schemas for API request validation.
 */
const { z } = require('zod')
const {
  normalizeSemanticPresentation,
} = require('revealjs-shared/src/pptx-semantic-presentation.js')
const { geometryLocalExtent } = require('revealjs-shared/src/pptx-geometry-style-resolution.js')
const { semanticInstance, semanticDefinition } = require('revealjs-shared/src/pptx-semantic-records.js')
const { admitGameElement } = require('./game-element-admission')
const {
  interactionVariablesSchema,
  elementActionSchema,
  admitPresentationInteractions,
} = require('./interaction-admission')

const builtInElementTypeSchema = z.enum([
  'text',
  'image',
  'shape',
  'code',
  'html',
  'chart',
  'table',
  'diagram',
  'video',
  'audio',
  'callout',
  'icon',
  'line',
  'drawing',
  'latex',
  'markdown',
  'svg',
  'qrcode',
  'timeline',
  'game',
  'divider',
])

const pluginElementTypeSchema = z
  .string()
  .regex(/^plugin:[a-z0-9][a-z0-9-]{0,63}$/, 'Invalid plugin element type')

// ─── Element Schema ──────────────────────────────────────────────────────────
const baseElementSchema = z
  .object({
    id: z.string().optional(),
    type: z.union([builtInElementTypeSchema, pluginElementTypeSchema]),
    x: z.number().default(0),
    y: z.number().default(0),
    width: z.number().positive().default(100),
    height: z.number().positive().default(100),
    zIndex: z.number().int().optional(),
    textVerticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
    action: elementActionSchema.optional(),
    initialVisibility: z.enum(['visible', 'hidden']).optional(),
  })
  .passthrough() // Allow type-specific fields like content, src, etc.

const elementSchema = baseElementSchema.transform(admitGameElement)
const layoutElementSchema = baseElementSchema
  .extend({ id: z.string().min(1).max(200) })
  .transform(admitGameElement)
const layoutPlaceholderSchema = z
  .object({
    id: z.string().min(1).max(200),
    type: builtInElementTypeSchema,
    role: z.enum(['title', 'subtitle', 'body', 'image', 'media', 'chart', 'footer', 'custom']),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    zIndex: z.number().int().optional(),
    locked: z.boolean().optional(),
    contentPolicy: z.object({}).passthrough().optional(),
  })
  .strict()
const layoutMasterSchema = z
  .object({
    id: z.string().min(1).max(200),
    name: z.string().trim().min(1).max(200),
    system: z.boolean().optional(),
    safeArea: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .strict()
      .optional(),
    tokens: z.object({}).passthrough().optional(),
    fixedElements: z.array(layoutElementSchema).max(128),
    placeholders: z.array(layoutPlaceholderSchema).max(64),
  })
  .strict()
  .superRefine((master, ctx) => {
    const ids = new Set()
    for (const item of [...master.fixedElements, ...master.placeholders]) {
      if (ids.has(item.id))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['id'],
          message: 'Layout element IDs must be unique',
        })
      ids.add(item.id)
    }
  })
const layoutOverridesSchema = z
  .object({
    hiddenElementIds: z.array(z.string().min(1).max(200)).max(256).optional(),
    elementPatches: z
      .record(
        z.string().min(1).max(200),
        z
          .object({})
          .passthrough()
          .refine(
            (patch) => !Object.hasOwn(patch, 'id') && !Object.hasOwn(patch, 'type'),
            'Layout patches cannot change identity or type'
          )
      )
      .refine((patches) => Object.keys(patches).length <= 256, 'Too many layout patches')
      .optional(),
    placeholderBindings: z
      .record(z.string().min(1).max(200), z.string().min(1).max(200))
      .refine((bindings) => Object.keys(bindings).length <= 256, 'Too many placeholder bindings')
      .optional(),
  })
  .strict()

function validatePresentationLayouts(presentation, ctx) {
  if (!Array.isArray(presentation.layoutMasters)) return
  const layouts = new Map(presentation.layoutMasters.map((layout) => [layout.id, layout]))
  if (layouts.size !== presentation.layoutMasters.length)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['layoutMasters'],
      message: 'Layout master IDs must be unique',
    })
  const visitSlides = (slides, path = ['slides']) =>
    (slides || []).forEach((slide, index) => {
      const slidePath = [...path, index]
      if (slide.layoutId) {
        const layout = layouts.get(slide.layoutId)
        if (!layout)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...slidePath, 'layoutId'],
            message: 'Layout reference must exist in registry',
          })
        else {
          const placeholders = new Set(layout.placeholders.map((placeholder) => placeholder.id))
          for (const placeholderId of Object.keys(
            slide.layoutOverrides?.placeholderBindings || {}
          )) {
            if (!placeholders.has(placeholderId))
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...slidePath, 'layoutOverrides', 'placeholderBindings', placeholderId],
                message: 'Binding must target a layout placeholder',
              })
          }
        }
      }
      visitSlides(slide.children, [...slidePath, 'children'])
    })
  visitSlides(presentation.slides)
}

function validatePresentationSemantic(presentation, ctx) {
  try {
    const normalized = normalizeSemanticPresentation(presentation)
    const visit = (slides, path = ['slides']) =>
      (slides || []).forEach((slide, index) => {
        const slidePath = [...path, index]
        ;(slide.elements || []).forEach((element, elementIndex) => {
          for (const [field, nativeField] of [
            ['width', 'cx'],
            ['height', 'cy'],
          ]) {
            if (element[field] !== 0) continue
            const instance = semanticInstance(normalized.pptxSemantic, element.pptxInstanceId)
            const definition = instance && semanticDefinition(normalized.pptxSemantic, instance.definitionId)
            const geometry = definition?.content.geometry
            const override =
              instance?.overrides.components?.[geometry?.componentId]?.geometryDocument
            const extent =
              [2, 3].includes(normalized.pptxSemantic?.schemaVersion) && instance
                ? geometryLocalExtent(normalized.pptxSemantic, instance.id)
                : override
                  ? { cx: override.width, cy: override.height }
                  : definition?.content.extent
            if (
              !instance ||
              instance.tombstoned ||
              definition.kind === 'group' ||
              extent?.[nativeField] !== 0
            )
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...slidePath, 'elements', elementIndex, field],
                message: 'Zero dimensions require a matching canonical leaf extent',
              })
          }
        })
        visit(slide.children, [...slidePath, 'children'])
      })
    visit(presentation.slides)
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pptxSemantic'],
      message: error.message,
    })
  }
}

// ─── Slide Schema ────────────────────────────────────────────────────────────
function createSlideSchema(entrySchema) {
  let schema
  const base = z
    .object({
      id: z.string().optional(),
      elements: z.array(entrySchema).optional().default([]),
      notes: z.string().optional(),
      speakerNotes: z.string().optional(),
      background: z.any().optional(),
      children: z
        .array(z.lazy(() => schema))
        .max(100)
        .optional(),
      layoutId: z.string().min(1).max(200).optional(),
      layoutOverrides: layoutOverridesSchema.optional(),
    })
    .passthrough()
    .superRefine((slide, ctx) => {
      const elementIds = new Set(
        (slide.elements || []).map((element) => element.id).filter(Boolean)
      )
      for (const [placeholderId, elementId] of Object.entries(
        slide.layoutOverrides?.placeholderBindings || {}
      )) {
        if (!elementIds.has(elementId))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['layoutOverrides', 'placeholderBindings', placeholderId],
            message: 'Placeholder binding must target a slide-owned element',
          })
      }
    })
  schema = base
  return schema
}
const slideSchema = createSlideSchema(elementSchema)
const semanticSlideSchema = createSlideSchema(
  baseElementSchema
    .extend({
      width: z.number().nonnegative().default(100),
      height: z.number().nonnegative().default(100),
    })
    .transform(admitGameElement)
)
// ─── Create Presentation ─────────────────────────────────────────────────────
const createPresentationSchema = z
  .object({
    title: z.string().max(500).optional(),
    theme: z.string().max(100).optional(),
    transition: z.string().max(100).optional(),
    templateId: z.string().min(1).max(200).optional(),
    slides: z.array(semanticSlideSchema).optional(),
    layoutMasters: z.array(layoutMasterSchema).max(64).optional(),
    interactionVariables: interactionVariablesSchema.optional(),
  })
  .passthrough()
  .superRefine(validatePresentationLayouts)
  .superRefine(validatePresentationSemantic)
  .transform(admitPresentationInteractions)

// ─── Update Presentation ─────────────────────────────────────────────────────
const updatePresentationSchema = z
  .object({
    title: z.string().max(500).optional(),
    theme: z.string().max(100).optional(),
    transition: z.string().max(100).optional(),
    slides: z.array(semanticSlideSchema).optional(),
    layoutMasters: z.array(layoutMasterSchema).max(64).optional(),
    interactionVariables: interactionVariablesSchema.optional(),
  })
  .passthrough()
  .superRefine(validatePresentationLayouts)
  .superRefine(validatePresentationSemantic)

// ─── Templates ───────────────────────────────────────────────────────────────
const createTemplateSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    theme: z.string().max(100).optional(),
    transition: z.string().max(100).optional(),
    slides: z.array(slideSchema).min(1),
  })
  .passthrough()

const updateTemplateSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    theme: z.string().max(100).optional(),
    transition: z.string().max(100).optional(),
    slides: z.array(slideSchema).min(1).optional(),
  })
  .passthrough()

const saveAsTemplateSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
  })
  .passthrough()

// ─── Share ───────────────────────────────────────────────────────────────────
const createShareSchema = z.object({
  presentationId: z.string().min(1),
  password: z.string().max(128).optional(),
})

const verifyShareSchema = z.object({
  password: z.string().max(128),
})

// ─── AI ──────────────────────────────────────────────────────────────────────
const aiGenerateSchema = z.object({
  outline: z
    .array(
      z.object({
        title: z.string().max(500),
        bulletPoints: z.array(z.string().max(1000)).optional(),
        layout: z.string().optional(),
        notes: z.string().max(5000).optional(),
        speakerNotes: z.string().max(5000).optional(),
      })
    )
    .min(1)
    .max(50),
})

const aiCopywriteSchema = z.object({
  text: z.string().min(1).max(10000),
  tone: z.string().max(50).optional(),
  action: z.string().max(50).optional(),
})

const aiTranslateSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string(),
        html: z.string(),
      })
    )
    .min(1)
    .max(500),
  targetLanguage: z.string().min(1).max(50),
})

module.exports = {
  createPresentationSchema,
  updatePresentationSchema,
  createTemplateSchema,
  updateTemplateSchema,
  saveAsTemplateSchema,
  createShareSchema,
  verifyShareSchema,
  aiGenerateSchema,
  aiCopywriteSchema,
  aiTranslateSchema,
  elementSchema,
  slideSchema,
}

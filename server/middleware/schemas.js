/**
 * Zod schemas for API request validation.
 */
const { z } = require('zod')
const { isProxy } = require('node:util').types
const {
  validateSemanticPresentationBindings,
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

function validatePresentationSemantic(presentation, ctx, semanticContext) {
  try {
    const document = validateSemanticPresentationBindings(presentation, semanticContext)
    const visit = (slides, path = ['slides']) =>
      (slides || []).forEach((slide, index) => {
        const slidePath = [...path, index]
        ;(slide.elements || []).forEach((element, elementIndex) => {
          for (const [field, nativeField] of [
            ['width', 'cx'],
            ['height', 'cy'],
          ]) {
            if (element[field] !== 0) continue
            const instance = semanticInstance(document, element.pptxInstanceId)
            const definition = instance && semanticDefinition(document, instance.definitionId)
            const geometry = definition?.content.geometry
            const override =
              instance?.overrides.components?.[geometry?.componentId]?.geometryDocument
            const extent =
              [2, 3].includes(document?.schemaVersion) && instance
                ? geometryLocalExtent(document, instance.id)
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
    if (document !== undefined) presentation.pptxSemantic = document
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
const createPresentationInputSchema = z
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
function updatePresentationInputSchemaWithCandidate(predecessor) {
  return z
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
  .superRefine((presentation, ctx) => validatePresentationSemantic(presentation, ctx, { predecessor }))
}
const updatePresentationInputSchema = updatePresentationInputSchemaWithCandidate()

// Request admission is not a semantic producer cache. Bind the exact raw root
// to a complete owned output only after every refinement/transform succeeds.
// Mutable parser roots must never acquire reusable semantic validation receipts.
const presentationAdmissions = new WeakMap()

// Inspect the original request before Zod's object reconstruction can erase
// hidden properties or invoke getters. This is a descriptor contract, not a
// JSON-value restriction: passthrough metadata may legitimately be undefined.
function auditPresentationDescriptors(value, ctx, path = [], ancestors = new Set()) {
  if (!value || typeof value !== 'object') return true
  if (isProxy(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'Expected plain own enumerable request data' })
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  if ((!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) ||
      ancestors.has(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'Expected plain own enumerable request data' })
    return false
  }
  ancestors.add(value)
  let valid = true
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    const childPath = [...path, String(key)]
    if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: childPath, message: 'Expected plain own enumerable request data' })
      valid = false
    } else if (!auditPresentationDescriptors(descriptor.value, ctx, childPath, ancestors)) valid = false
  }
  ancestors.delete(value)
  return valid
}

function ownedPresentationSchema(schema, receiptSchema = schema) {
  return z.any().transform((rawBody, ctx) => {
    if (!auditPresentationDescriptors(rawBody, ctx)) return z.NEVER
    const result = schema.safeParse(rawBody)
    if (!result.success) {
      for (const issue of result.error.issues) ctx.addIssue(issue)
      return z.NEVER
    }
    // Zod passthrough fields can still alias rawBody. Detach every editable
    // field before next()/any await, but retain the checked owned semantic root.
    const { pptxSemantic, ...editable } = result.data
    const owned = structuredClone(editable)
    const seal = (value) => {
      if (!value || typeof value !== 'object') return
      for (const child of Object.values(value)) seal(child)
      Object.freeze(value)
    }
    seal(owned)
    const body = Object.freeze({
      ...owned,
      ...(pptxSemantic !== undefined ? { pptxSemantic } : {}),
    })
    presentationAdmissions.set(body, { schema: receiptSchema, body })
    return body
  })
}

function admittedPresentationBody(body, schema) {
  const receipt = presentationAdmissions.get(body)
  // Replacement by later middleware must undergo whole-body admission again.
  // No receipt is ever read from a raw mutable identity.
  return receipt?.schema === schema ? receipt.body : ownedPresentationSchema(schema).parse(body)
}

function admittedCreatePresentationBody(body) {
  return admittedPresentationBody(body, createPresentationInputSchema)
}

function admittedUpdatePresentationBody(body) {
  return admittedPresentationBody(body, updatePresentationInputSchema)
}

const createPresentationSchema = ownedPresentationSchema(createPresentationInputSchema)
const updatePresentationSchema = ownedPresentationSchema(updatePresentationInputSchema)

function updatePresentationSchemaWithCandidate(predecessor) {
  return ownedPresentationSchema(
    updatePresentationInputSchemaWithCandidate(predecessor), updatePresentationInputSchema
  )
}

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
  admittedCreatePresentationBody,
  admittedUpdatePresentationBody,
  createPresentationSchema,
  updatePresentationSchema,
  updatePresentationSchemaWithCandidate,
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

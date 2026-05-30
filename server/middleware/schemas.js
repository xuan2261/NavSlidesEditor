/**
 * Zod schemas for API request validation.
 */
const { z } = require('zod')

const builtInElementTypeSchema = z.enum([
  'text',
  'image',
  'shape',
  'code',
  'html',
  'chart',
  'table',
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
const elementSchema = z
  .object({
    id: z.string().optional(),
    type: z.union([builtInElementTypeSchema, pluginElementTypeSchema]),
    x: z.number().default(0),
    y: z.number().default(0),
    width: z.number().positive().default(100),
    height: z.number().positive().default(100),
    zIndex: z.number().int().optional(),
  })
  .passthrough() // Allow type-specific fields like content, src, etc.

// ─── Slide Schema ────────────────────────────────────────────────────────────
const slideSchema = z
  .object({
    id: z.string().optional(),
    elements: z.array(elementSchema).optional().default([]),
    notes: z.string().optional().default(''),
    speakerNotes: z.string().optional(),
    background: z.any().optional(),
  })
  .passthrough()

// ─── Create Presentation ─────────────────────────────────────────────────────
const createPresentationSchema = z
  .object({
    title: z.string().max(500).optional(),
    theme: z.string().max(100).optional(),
    transition: z.string().max(100).optional(),
    templateId: z.string().uuid().optional(),
    slides: z.array(slideSchema).optional(),
  })
  .passthrough()

// ─── Update Presentation ─────────────────────────────────────────────────────
const updatePresentationSchema = z
  .object({
    title: z.string().max(500).optional(),
    theme: z.string().max(100).optional(),
    transition: z.string().max(100).optional(),
    slides: z.array(slideSchema).optional(),
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
  createShareSchema,
  verifyShareSchema,
  aiGenerateSchema,
  aiCopywriteSchema,
  aiTranslateSchema,
  elementSchema,
  slideSchema,
}

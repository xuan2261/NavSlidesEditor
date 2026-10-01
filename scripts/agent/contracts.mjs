import { z } from 'zod'

export const id = z.string().regex(/^[a-zA-Z0-9_-]+$/).max(200)
export const confirm = z.literal(true).describe('Explicit user authorization for this destructive action.')
export const object = z.record(z.string(), z.unknown())
export const page = { offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(100).default(20) }
export const resultSchema = z.object({ ok: z.boolean(), data: z.unknown().optional(), warnings: z.array(z.string()).optional(), error: z.object({ code: z.string(), message: z.string(), hint: z.string(), status: z.number().optional() }).optional() })

export class AgentError extends Error {
  constructor(code, message, hint, status) {
    super(message)
    this.code = code
    this.hint = hint
    this.status = status
  }
}

export function errorResult(error) {
  const invalid = error instanceof z.ZodError
  return { ok: false, error: {
    code: invalid ? 'INVALID_INPUT' : error.code || 'OPERATION_FAILED',
    message: invalid ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : error.message,
    hint: invalid ? 'Use the command help or MCP input schema; correct the named fields.' : error.hint || 'Check the NavSlides server log; do not retry a mutation without checking its result.',
    ...(error.status ? { status: error.status } : {}),
  } }
}

export function tool(name, description, shape, run, { readOnly = false, destructive = false } = {}) {
  return { name, description, schema: z.object(shape).strict(), run,
    annotations: { readOnlyHint: readOnly, destructiveHint: destructive, idempotentHint: readOnly, openWorldHint: false } }
}

export function paginate(items, { offset, limit, search = '' }) {
  const query = search.toLowerCase()
  const filtered = items.filter((p) => !query || String(p.title || p.originalName || p.filename || '').toLowerCase().includes(query))
  return { items: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit, nextOffset: offset + limit < filtered.length ? offset + limit : null }
}

export async function execute(operation, args, api, signal) {
  try {
    const input = operation.schema.parse(args)
    if (api.readOnly && !operation.annotations.readOnlyHint && input.dryRun !== true) {
      throw new AgentError('READ_ONLY', 'This operation has side effects and read-only mode is enabled.', 'Use a read tool or dryRun preview; enable writes only with user authorization.')
    }
    const data = await operation.run(input, api, signal)
    return { ok: true, data }
  } catch (error) {
    return errorResult(error)
  }
}

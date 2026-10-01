#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { tools, findTool } from './catalog.mjs'
import { createApi } from './client.mjs'
import { AgentError, execute, errorResult } from './contracts.mjs'
import { readLocalFile } from './files.mjs'

const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
const globals = {
  help: { type: 'boolean', short: 'h' },
  url: { type: 'string' },
  'read-only': { type: 'boolean' },
  input: { type: 'string' },
  'input-file': { type: 'string' },
}

function json(value) {
  try { return JSON.parse(value) } catch { throw new AgentError('INVALID_INPUT', 'Expected valid JSON input.', 'Quote JSON for your shell or use --input-file. Use --input - to read JSON from stdin.') }
}

async function stdinJson() {
  const chunks = []
  let bytes = 0
  for await (const chunk of process.stdin) {
    bytes += chunk.length
    if (bytes > 100 * 1024 * 1024) throw new AgentError('INVALID_INPUT', 'stdin JSON exceeds 100 MiB.', 'Use a smaller input document.')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function help(operation) {
  if (!operation) {
    return `NavSlides CLI — local presentation workflows\nUsage: node scripts/agent/cli.mjs <tool_name> [flags]\n\n${tools.map((t) => `  ${t.name.padEnd(24)} ${t.description}`).join('\n')}\n\nGlobal flags: --help, --url <loopback-origin>, --read-only, --input <JSON|->, --input-file <JSON-file>\nInput-field flags use kebab-case; objects and arrays take JSON strings. Output is JSON.\nExit codes: 0 success/help; 1 operation failure; 2 invalid input/usage; 3 server unreachable.\nFiles stay inside NAVSLIDES_WORKSPACE (default repository root).`
  }
  return `${operation.name}\n${operation.description}\n\nUsage: node scripts/agent/cli.mjs ${operation.name} [flags]\nGlobal flags: --url, --read-only, --input, --input-file, --help\nField flags (booleans are bare flags; objects/arrays take JSON):\n${Object.keys(operation.schema.shape).map((key) => `  --${kebab(key)}`).join('\n')}\n\nInput JSON Schema:\n${JSON.stringify(z.toJSONSchema(operation.schema, { io: 'input' }), null, 2)}`
}

async function main(argv) {
  const name = argv[0]
  if (!name || ['--help', '-h', 'help'].includes(name)) { console.log(help()); return }
  const operation = findTool(name)
  if (!operation) throw new AgentError('INVALID_INPUT', `Unknown command: ${name}.`, 'Run npm run navslides -- --help to list commands.')
  const schema = z.toJSONSchema(operation.schema, { io: 'input' })
  const fields = schema.properties
  const options = { ...globals }
  for (const [key, field] of Object.entries(fields)) options[kebab(key)] = { type: field.type === 'boolean' ? 'boolean' : 'string' }
  let values
  try { ({ values } = parseArgs({ args: argv.slice(1), options, allowNegative: true })) }
  catch (error) { throw new AgentError('INVALID_INPUT', error.message, `Run ${operation.name} --help for valid fields.`) }
  if (values.help) { console.log(help(operation)); return }
  if (values.input !== undefined && values['input-file'] !== undefined) throw new AgentError('INVALID_INPUT', 'Choose --input or --input-file, not both.', 'Use one input source; field flags can override it.')
  let args = {}
  if (values.input !== undefined) args = json(values.input === '-' ? await stdinJson() : values.input)
  if (values['input-file'] !== undefined) args = json((await readLocalFile(values['input-file'])).buffer.toString('utf8'))
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new AgentError('INVALID_INPUT', 'Tool input must be a JSON object.', 'Use an object keyed by the fields in the help schema.')
  for (const [key, field] of Object.entries(fields)) {
    const value = values[kebab(key)]
    if (value === undefined) continue
    args[key] = field.type === 'boolean' || field.type === 'string' ? value : json(value)
  }
  const result = await execute(operation, args, createApi({ url: values.url, readOnly: values['read-only'] }))
  console.log(JSON.stringify(result, null, 2))
  if (!result.ok) process.exitCode = result.error.code === 'SERVER_UNREACHABLE' ? 3 : result.error.code === 'INVALID_INPUT' ? 2 : 1
}

main(process.argv.slice(2)).catch((error) => {
  const result = errorResult(error)
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = ['INVALID_INPUT', 'INVALID_URL'].includes(result.error.code) ? 2 : result.error.code === 'SERVER_UNREACHABLE' ? 3 : 1
})

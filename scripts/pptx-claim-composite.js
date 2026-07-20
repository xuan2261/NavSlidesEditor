#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { aggregateCompositeRun } =
  require('../server/services/pptx-import/evidence/composite-run')
const { parseTrustedConfig } = require('../server/services/pptx-import/evidence/trusted-config')

function parseArgs(argv) {
  const args = {}
  const valueOptions = new Set(['--input', '--output', '--verify', '--trusted-config'])
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index]
    if (option === '--json') {
      args.json = true
      continue
    }
    if (!valueOptions.has(option) || !argv[index + 1] || argv[index + 1].startsWith('--')) {
      args.invalid = true
      continue
    }
    const key = option.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    args[key] = argv[++index]
  }
  if (args.input && args.verify) args.invalid = true
  return args
}

function stableJson(value) {
  const normalize = (item) => {
    if (Array.isArray(item)) return item.map(normalize)
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.keys(item).sort().map((key) => [key, normalize(item[key])]))
    }
    return item
  }
  return `${JSON.stringify(normalize(value), null, 2)}\n`
}

const MAX_INPUT_BYTES = 8 * 1024 * 1024
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024

function readJsonFile(filePath, limit) {
  const stat = fs.lstatSync(filePath)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) throw new Error('invalid-file')
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (args.invalid) {
    process.stderr.write('Composite arguments are invalid.\n')
    return 1
  }
  const source = args.verify || args.input
  if (!source) {
    process.stderr.write('Composite input is required.\n')
    return 1
  }
  if (!args.trustedConfig) {
    process.stderr.write('Trusted configuration is required.\n')
    return 1
  }
  let input
  let trustedConfig
  try {
    input = readJsonFile(path.resolve(source), MAX_INPUT_BYTES)
    trustedConfig = readJsonFile(path.resolve(args.trustedConfig), MAX_INPUT_BYTES)
  } catch {
    process.stderr.write('Composite evidence is missing or invalid.\n')
    return 1
  }
  const parsedTrustedConfig = parseTrustedConfig(trustedConfig)
  if (!parsedTrustedConfig) {
    process.stderr.write('Trusted configuration is invalid.\n')
    return 1
  }
  let result
  try { result = aggregateCompositeRun(input, parsedTrustedConfig) } catch {
    process.stderr.write('Composite evidence is unavailable.\n')
    return 1
  }
  const serialized = stableJson(result)
  if (Buffer.byteLength(serialized) > MAX_OUTPUT_BYTES) {
    process.stderr.write('Composite result exceeds size limit.\n')
    return 1
  }
  try {
    if (args.output) {
      const output = path.resolve(args.output)
      if (fs.existsSync(output)) {
        const stat = fs.lstatSync(output)
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('invalid-output')
      }
      fs.writeFileSync(output, serialized, { flag: 'w' })
    }
  } catch {
    process.stderr.write('Composite result cannot be written.\n')
    return 1
  }
  if (args.json || !args.output) process.stdout.write(serialized)
  return result.passed ? 0 : 1
}

if (require.main === module) process.exitCode = run()

module.exports = { parseArgs, run, stableJson }

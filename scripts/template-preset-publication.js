const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { validateGameConfig } = require('../shared/src/education/game-schema.js')
const { normalizeGameConfig } = require('../shared/src/education/normalize-game-config.js')
const ROOT = path.resolve(__dirname, '..')
const BUILT_IN_PATH = path.join(ROOT, 'server', 'data', 'built-in-templates.json')
function parsePublicationArgs(args) {
  const flags = {}
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]
    if (
      !['--input', '--output'].includes(key) ||
      flags[key] ||
      !args[i + 1] ||
      args[i + 1].startsWith('--')
    )
      throw new Error(
        'Usage: node script.js [--input fixture.json] [--output result.json]. Unknown, duplicate or missing flag values are not allowed.'
      )
    flags[key] = path.resolve(args[i + 1])
  }
  if (flags['--output'] && !flags['--input'])
    throw new Error('--output requires an explicit --input isolated fixture.')
  const input = flags['--input'] || BUILT_IN_PATH
  const output = flags['--output'] || input
  for (const file of [input, output]) {
    const data = path.relative(path.join(ROOT, 'server/data'), file)
    const uploads = path.relative(path.join(ROOT, 'server/uploads'), file)
    if (
      file !== BUILT_IN_PATH &&
      ((!data.startsWith('..') && !path.isAbsolute(data)) ||
        (!uploads.startsWith('..') && !path.isAbsolute(uploads)))
    )
      throw new Error(
        `Refusing user storage path ${file}. Use an isolated fixture outside server/data and server/uploads.`
      )
  }
  return { input, output }
}
function validateTemplates(records) {
  if (!Array.isArray(records)) throw new Error('Expected a template JSON array.')
  const ids = new Set()
  for (const record of records) {
    if (!record || typeof record.id !== 'string' || !record.id || ids.has(record.id))
      throw new Error(`${record?.id || 'Template'}: missing or duplicate template ID.`)
    ids.add(record.id)
    if (
      !Array.isArray(record.slides) ||
      record.slides.some((slide) => !slide || !Array.isArray(slide.elements))
    )
      throw new Error(`${record.id}: invalid lesson slide structure.`)
    for (const element of record.slides.flatMap((slide) => slide.elements)) {
      if (!element || typeof element.type !== 'string')
        throw new Error(`${record.id}: invalid element.`)
      if (element.type === 'game') {
        const config = Object.hasOwn(element, element.gameType)
          ? element[element.gameType]
          : normalizeGameConfig(element)
        const validation = validateGameConfig(element.gameType, config)
        if (!validation.isValid)
          throw new Error(
            `${record.id}: ${validation.errors.map((error) => `${error.path.join('.')}: ${error.message}`).join('; ')}`
          )
      }
      if (element.htmlDependencies) {
        const declaration = element.htmlDependencies
        if (
          typeof declaration.network !== 'boolean' ||
          typeof declaration.offlineCapable !== 'boolean'
        )
          throw new Error(`${record.id}: dependency capabilities must be boolean.`)
        for (const key of ['resources', 'dynamicResources']) {
          if (
            !Array.isArray(declaration[key]) ||
            declaration[key].some(
              (resource) =>
                !resource ||
                typeof resource.url !== 'string' ||
                !resource.url ||
                typeof resource.kind !== 'string' ||
                !resource.kind
            )
          )
            throw new Error(`${record.id}: ${key} must be a finite dependency manifest.`)
        }
      }
    }
  }
}
function publishTemplatePresets({ input, output, transform }) {
  if (!fs.statSync(input).isFile()) throw new Error(`Input is not a regular file: ${input}`)
  if (!fs.statSync(path.dirname(output)).isDirectory())
    throw new Error(`Output directory does not exist: ${path.dirname(output)}`)
  if (
    fs.existsSync(output) &&
    (!fs.statSync(output).isFile() || fs.lstatSync(output).isSymbolicLink())
  )
    throw new Error(`Output must be a regular, non-symlink file: ${output}`)
  const records = JSON.parse(fs.readFileSync(input, 'utf8'))
  const next = transform(records, {
    hashContent: (content) => crypto.createHash('sha256').update(content).digest('hex'),
  })
  validateTemplates(next)
  const bytes = JSON.stringify(next, null, 2)
  const nonce = crypto.randomUUID()
  const stage = `${output}.stage-${nonce}`
  const backup = `${output}.backup-${nonce}`
  let descriptor
  try {
    descriptor = fs.openSync(stage, 'wx')
    fs.writeFileSync(descriptor, bytes, 'utf8')
    fs.fsyncSync(descriptor)
    fs.closeSync(descriptor)
    descriptor = undefined
    fs.copyFileSync(fs.existsSync(output) ? output : input, backup, fs.constants.COPYFILE_EXCL)
    fs.renameSync(stage, output)
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor)
    if (fs.existsSync(stage)) fs.unlinkSync(stage)
  }
  return { output, backup }
}
function runTemplatePublication(transform, args = process.argv.slice(2)) {
  try {
    const result = publishTemplatePresets({ ...parsePublicationArgs(args), transform })
    console.log(`Published ${result.output}\nBackup: ${result.backup}`)
    return result
  } catch (error) {
    console.error(
      `Template publication failed: ${error.message}. Target was not partially published; restore from the reported backup if a completed publication must be undone.`
    )
    process.exitCode = 1
    return null
  }
}
module.exports = {
  BUILT_IN_PATH,
  parsePublicationArgs,
  validateTemplates,
  publishTemplatePresets,
  runTemplatePublication,
}

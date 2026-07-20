const path = require('node:path').posix
const JSZip = require('jszip')
const { guardNestedPackage } = require('./nested-package-guard')

function blockedResult(reason) {
  return {
    safe: false, editable: false, sheets: [], formulas: [], externalLinks: [],
    hasMacros: false, hasSignatures: false, reason,
  }
}

function relationshipTargets(rels) {
  return new Map([...rels.matchAll(/<Relationship\b([^>]*)\/?>/gi)].map((match) => {
    const attrs = match[1]
    return [
      attrs.match(/\bId=["']([^"']+)["']/i)?.[1],
      {
        target: attrs.match(/\bTarget=["']([^"']+)["']/i)?.[1],
        external: /\bTargetMode=["']External["']/i.test(attrs),
      },
    ]
  }))
}

async function inspectEmbeddedWorkbook(bytes, options = {}) {
  try {
    await guardNestedPackage(bytes, options)
  } catch (error) {
    return blockedResult(error.reason || 'nested-zip-invalid')
  }

  const result = blockedResult(null)
  let zip
  try {
    zip = await JSZip.loadAsync(bytes, { checkCRC32: true })
  } catch {
    return blockedResult('malformed-workbook')
  }
  const content = new Map()
  for (const file of Object.values(zip.files)) {
    if (!file.dir) content.set(file.name, await file.async('nodebuffer'))
  }
  const names = [...content.keys()]
  result.hasMacros = names.some((name) => /vbaProject|macrosheet/i.test(name))
  result.hasSignatures = names.some((name) => /_xmlsignatures|signature/i.test(name))
  result.externalLinks = names.filter((name) => /^xl\/externalLinks\//i.test(name))
  const workbook = content.get('xl/workbook.xml')?.toString() || ''
  const targets = relationshipTargets(content.get('xl/_rels/workbook.xml.rels')?.toString() || '')
  for (const match of workbook.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/?>/gi)) {
    const attrs = match[1]
    const relationship = targets.get(attrs.match(/\br:id=["']([^"']+)["']/i)?.[1])
    const part = relationship?.target && !relationship.external
      ? path.normalize(path.join('xl', relationship.target)) : null
    result.sheets.push({ name: attrs.match(/\bname=["']([^"']+)["']/i)?.[1] || '', part })
    const xml = part ? content.get(part)?.toString() || '' : ''
    result.formulas.push(...[...xml.matchAll(/<(?:\w+:)?f\b[^>]*>([\s\S]*?)<\/(?:\w+:)?f>/gi)]
      .map((formula) => formula[1].trim()))
  }
  result.safe = true
  if (result.hasMacros) result.reason = 'macro-workbook'
  else if (result.hasSignatures) result.reason = 'signed-workbook'
  else if (result.externalLinks.length || [...targets.values()].some((item) => item.external)) {
    result.reason = 'external-workbook-link'
  } else if (!result.sheets.length || result.sheets.some((sheet) => !sheet.part)) {
    result.reason = 'malformed-workbook'
  } else {
    result.editable = true
  }
  return result
}

module.exports = { inspectEmbeddedWorkbook }

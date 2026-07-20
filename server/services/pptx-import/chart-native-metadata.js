const path = require('node:path').posix

const refTag = '(?:strRef|numRef|multiLvlStrRef)'

function values(xml) {
  return [...String(xml || '').matchAll(
    /<(?:\w+:)?pt\b[^>]*\bidx=["'](\d+)["'][^>]*>[\s\S]*?<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/gi
  )].map((match) => ({ index: Number(match[1]), value: match[2].trim() }))
}

function references(xml) {
  return [...String(xml || '').matchAll(new RegExp(
    `<(?:\\w+:)?(${refTag})\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?\\1>`, 'gi'
  ))].map((match) => ({
    kind: match[1],
    formula: match[2].match(/<(?:\w+:)?f>([\s\S]*?)<\/(?:\w+:)?f>/i)?.[1]?.trim() || null,
    numberFormat: match[2].match(/<(?:\w+:)?formatCode>([\s\S]*?)<\/(?:\w+:)?formatCode>/i)?.[1]?.trim() || null,
    cache: values(match[2]),
  }))
}

function relationshipClosure(chartPath, relsXml) {
  const base = path.dirname(chartPath)
  return [...String(relsXml || '').matchAll(/<Relationship\b([^>]*)\/?>/gi)].map((match) => {
    const attrs = match[1]
    const target = attrs.match(/\bTarget=["']([^"']+)["']/i)?.[1]
    const external = attrs.match(/\bTargetMode=["']External["']/i) != null
    return {
      id: attrs.match(/\bId=["']([^"']+)["']/i)?.[1] || null,
      type: attrs.match(/\bType=["']([^"']+)["']/i)?.[1] || null,
      target: external || !target ? target || null : path.normalize(path.join(base, target)),
      external,
    }
  })
}

function nativeChartMetadata(xml, chartPath, relsXml = '') {
  return {
    nativeFamily: [...String(xml || '').matchAll(
      /<(?:\w+:)?(\w+Chart)\b/gi
    )].map((match) => match[1]),
    references: references(xml),
    relationshipClosure: relationshipClosure(chartPath, relsXml),
    opaqueExtensions: [...String(xml || '').matchAll(
      /<(?:\w+:)?extLst\b[\s\S]*?<\/(?:\w+:)?extLst>/gi
    )].map((match) => match[0]),
  }
}

module.exports = { nativeChartMetadata, references, relationshipClosure }

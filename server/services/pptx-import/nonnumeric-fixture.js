const fs = require('node:fs/promises')
const path = require('node:path')
const JSZip = require('jszip')
const PptxGenJS = require('pptxgenjs')

// Only disposable test archives are renamed. Production always receives their original bytes.
async function createNonnumericFixture(root, modes = ['slide', 'layout', 'master']) {
  const deck = new PptxGenJS()
  for (const text of ['FIRST', 'SECOND']) {
    deck.defineSlideMaster({
      title: text,
      objects: [{ text: { text: `LAYOUT ${text}`, options: { x: 1, y: 3, w: 3, h: 1 } } }],
    })
    const slide = deck.addSlide({ masterName: text })
    slide.addText(text, { x: 1, y: 1, w: 3, h: 1, fontFace: 'Arial', fontSize: 24 })
    slide.addNotes(`Notes ${text}`)
  }
  const zip = await JSZip.loadAsync(await deck.write({ outputType: 'nodebuffer' }))
  const presentation = await zip.file('ppt/presentation.xml').async('string')
  const ids = presentation.match(/<p:sldId\b[^>]*\/>/g)
  zip.file('ppt/presentation.xml', presentation.replace(ids.join(''), [...ids].reverse().join('')))
  for (let n = 1; n <= 2; n += 1) {
    const part = `ppt/slides/slide${n}.xml`
    const xml = await zip.file(part).async('string')
    zip.file(
      part,
      xml.replace(
        '</p:sld>',
        `<p:timing><p:animEffect filter="${n === 1 ? 'fade' : 'wipe'}"/></p:timing></p:sld>`
      )
    )
  }
  const shape = (await zip.file('ppt/slides/slide1.xml').async('string'))
    .match(/<p:sp>[\s\S]*?<\/p:sp>/)[0]
    .replace('>FIRST<', '>MASTER FOUNDATION<')
  const master = 'ppt/slideMasters/slideMaster1.xml'
  zip.file(master, (await zip.file(master).async('string')).replace('</p:spTree>', `${shape}</p:spTree>`))
  const renames = [
    ...(modes.includes('slide') ? [['slide1.xml', 'summary.xml'], ['slide2.xml', 'agenda.xml']] : []),
    ...(modes.includes('mixed') ? [['slide1.xml', 'summary.xml']] : []),
    ...(modes.includes('layout')
      ? [['slideLayout1.xml', 'overview.xml'], ['slideLayout2.xml', 'detail.xml']]
      : []),
    ...(modes.includes('master') ? [['slideMaster1.xml', 'foundation.xml']] : []),
  ]
  for (const part of Object.keys(zip.files)) {
    if (zip.files[part].dir) continue
    let content = await zip.file(part).async('string')
    let target = part
    for (const [before, after] of renames) {
      target = target.replace(before, after)
      content = content.replaceAll(before, after)
    }
    zip.file(target, content)
    if (target !== part) zip.remove(part)
  }
  const file = path.join(root, 'nonnumeric.pptx')
  const bytes = await zip.generateAsync({ type: 'nodebuffer' })
  await fs.writeFile(file, bytes)
  const parts = modes.includes('slide')
    ? ['ppt/slides/agenda.xml', 'ppt/slides/summary.xml']
    : ['ppt/slides/slide2.xml', modes.includes('mixed') ? 'ppt/slides/summary.xml' : 'ppt/slides/slide1.xml']
  const identities = await Promise.all(parts.map(async (part) => {
    const xml = await zip.file(part).async('string')
    const slash = part.lastIndexOf('/')
    const relationships = await zip.file(`${part.slice(0, slash)}/_rels/${part.slice(slash + 1)}.rels`).async('string')
    return { part, shapeIds: [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((match) => match[1]), relationships }
  }))
  return { file, bytes, parts, identities }
}

module.exports = { createNonnumericFixture }

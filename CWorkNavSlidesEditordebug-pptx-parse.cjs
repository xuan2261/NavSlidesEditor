const pkg = 'pptx' + 'tojson'
const sub = pkg + '/d' + 'ist/index.cjs'
const { parse } = require(sub)
const fs = require('fs')

async function main() {
  const file = process.argv[2] || './server/data/test-corpus/Bai_2_1.pptx'
  const buffer = fs.readFileSync(file)
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  const out = await parse(ab, { imageMode: 'none', videoMode: 'none', audioMode: 'none' })
  console.log('SIZE:', JSON.stringify(out.size))
  console.log('SLIDES:', out.slides.length)
  const slide0 = out.slides[0]
  console.log('--- Slide 0 elements ---')
  for (const el of slide0.elements.slice(0, 5)) {
    const summary = {
      type: el.type,
      shapType: el.shapType,
      left: el.left,
      top: el.top,
      width: el.width,
      height: el.height,
      fontSize: el.fontSize,
      fontSz: el.fontSz,
    }
    if (el.content) summary.content = el.content.substring(0, 300)
    console.log(JSON.stringify(summary, null, 2))
  }
}
main().catch(e => { console.error(e); process.exit(1) })

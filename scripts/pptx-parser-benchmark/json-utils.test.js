const fs = require('fs')
const os = require('os')
const path = require('path')
const { scrubRawValue, writeRawJson } = require('./json-utils')

describe('json-utils raw scrubbing', () => {
  it('redacts string values and binary payloads from raw output', () => {
    const secret = 'confidential slide text'
    const scrubbed = scrubRawValue({
      title: secret,
      nested: ['visible content'],
      media: Buffer.from('binary-data'),
    })
    const serialized = JSON.stringify(scrubbed)

    expect(serialized).not.toContain(secret)
    expect(serialized).not.toContain('visible content')
    expect(scrubbed.title).toMatchObject({ __type: 'String', length: secret.length })
    expect(scrubbed.media).toEqual({ __type: 'Buffer', byteLength: 11 })
  })

  it('writes scrubbed raw JSON without preserving slide text', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-raw-'))
    const outPath = path.join(dir, 'raw.json')
    writeRawJson(outPath, { text: 'sensitive body copy' })

    expect(fs.readFileSync(outPath, 'utf8')).not.toContain('sensitive body copy')
  })
})

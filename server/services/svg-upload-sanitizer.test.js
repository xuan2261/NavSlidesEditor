import { describe, expect, it } from 'vitest'
import { MAX_SVG_BYTES, sanitizeSvgBuffer } from './svg-upload-sanitizer.js'

describe('server SVG upload sanitizer', () => {
  it('removes active content while preserving safe SVG', () => {
    const safe = sanitizeSvgBuffer(Buffer.from('<svg><script>alert(1)</script><rect width="10" height="10" fill="red"/></svg>'))
    expect(safe.toString()).not.toContain('<script')
    expect(safe.toString()).toContain('<rect')
  })

  it('rejects oversized input before DOM construction', () => {
    expect(() => sanitizeSvgBuffer(Buffer.alloc(MAX_SVG_BYTES + 1, 'x'))).toThrowError(/5 MiB/)
  })

  it('rejects external executable and stylesheet references', () => {
    expect(() => sanitizeSvgBuffer(Buffer.from('<svg><image href="https://evil.example/x.svg"/></svg>')))
      .toThrowError(/unsafe external reference/)
    expect(() => sanitizeSvgBuffer(Buffer.from('<svg><image href="//evil.example/x.svg"/><style>@import url(//evil.example/x.css)</style></svg>')))
      .toThrowError(/unsafe external reference/)
  })
})

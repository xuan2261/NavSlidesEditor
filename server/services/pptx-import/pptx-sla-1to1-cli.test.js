import { describe, expect, it } from 'vitest'
import { main } from './pptx-sla-1to1-cli.js'

describe('pptx-sla-1to1-cli (T8.7)', () => {
  it('T8.7 exits 0 when engineering modules present', async () => {
    const code = await main(['--milestone', 'phase08_full', '--json'])
    expect(code).toBe(0)
  })
})

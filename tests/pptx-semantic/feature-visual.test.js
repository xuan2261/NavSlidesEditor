import { describe, expect, it } from 'vitest'
import { verifyVisualSummary } from '../../scripts/ci/pptx-semantic-feature-visual.mjs'

describe('typed feature native visual thresholds', () => {
  it('uses the existing fixed mean/minimum policy, not an alternate feature threshold', () => {
    expect(
      verifyVisualSummary(
        { failed: false, deckCount: 1, slideCount: 2, meanSsim: 0.995, minSsim: 0.98 },
        1
      ).valid
    ).toBe(true)
    expect(
      verifyVisualSummary(
        { failed: false, deckCount: 1, slideCount: 2, meanSsim: 0.989, minSsim: 0.98 },
        1
      ).valid
    ).toBe(false)
    expect(
      verifyVisualSummary(
        { failed: false, deckCount: 1, slideCount: 2, meanSsim: 0.995, minSsim: 0.969 },
        1
      ).valid
    ).toBe(false)
  })

  it.each([NaN, Infinity, undefined, '0.995'])(
    'rejects invalid comparison metric %s',
    (meanSsim) => {
      expect(
        verifyVisualSummary(
          { failed: false, deckCount: 1, slideCount: 2, meanSsim, minSsim: 0.98 },
          1
        ).valid
      ).toBe(false)
    }
  )

  it('does not accept an incomplete source deck domain even with high SSIM', () => {
    expect(
      verifyVisualSummary(
        { failed: false, deckCount: 1, slideCount: 2, meanSsim: 1, minSsim: 1 },
        2
      ).valid
    ).toBe(false)
  })
})

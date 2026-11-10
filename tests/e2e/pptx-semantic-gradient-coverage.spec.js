const { expect, test } = require('@playwright/test')
const { performance } = require('node:perf_hooks')
const {
  gradientPaintId,
  gradientSvgDefinition,
} = require('../../shared/src/pptx-geometry-gradient')
const { decodePng } = require('../../server/services/pptx-import/oracle/png-rgba')
const {
  gradientCoverageGeometry,
} = require('../pptx-semantic/geometry-gradient-coverage-fixtures.cjs')
const {
  recordGradientCoverage,
} = require('../pptx-semantic/geometry-gradient-coverage-evidence.cjs')

for (const background of [255, 0]) {
  for (const alpha of [100000, 50000]) {
    for (const width of [180, 181]) {
      test(`reflected constant field covers ${width} fractional partitions on ${background} at ${alpha}`, async ({
        page,
      }) => {
        const geometry = gradientCoverageGeometry({ width, alpha, constant: true })
        const before = structuredClone(geometry)
        const definition = gradientSvgDefinition(geometry, {
          width,
          height: 120,
          nativeStroke: false,
        })
        await page.setViewportSize({ width: 600, height: 400 })
        await page.setContent(
          `<style>body{margin:0;background:rgb(${background},${background},${background})}</style>` +
            `<svg width="600" height="400" viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">` +
            `<g transform="translate(12.375 15.625)">${definition}` +
            `<rect width="270" height="170" fill="url(#${gradientPaintId(geometry)})"/></g></svg>`
        )
        const capture = await page.screenshot({
          path: test.info().outputPath('fractional-partitions.png'),
        })
        const image = decodePng(capture)
        await test
          .info()
          .attach('fractional-partitions', { body: capture, contentType: 'image/png' })
        const opacity = Math.round((255 * alpha) / 100000) / 255
        const expected = [240, 30, 60].map(
          (channel) => opacity * channel + (1 - opacity) * background
        )
        const violations = []
        for (let y = 34; y < 368; y++) {
          for (let x = 28; x < 562; x++) {
            const offset = (y * image.width + x) * 4
            if (
              expected.some((value, channel) => Math.abs(image.data[offset + channel] - value) > 2)
            )
              violations.push({ x, y, actual: [...image.data.subarray(offset, offset + 3)] })
          }
        }
        expect(violations.length, JSON.stringify(violations.slice(0, 8))).toBe(0)
        expect(geometry).toEqual(before)
      })
    }
  }
}

for (const background of [255, 0]) {
  test(`hard alpha remains source-bound across reflected seams on ${background}`, async ({
    page,
  }) => {
    const geometry = gradientCoverageGeometry({ hard: true })
    const definition = gradientSvgDefinition(geometry, {
      width: 180,
      height: 120,
      nativeStroke: false,
    })
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.setContent(
      `<style>body{margin:0;background:rgb(${background},${background},${background})}</style>` +
        `<svg width="1920" height="1080" viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg">` +
        `<g transform="translate(340 180)">${definition}` +
        `<rect width="180" height="120" fill="url(#${gradientPaintId(geometry)})"/></g></svg>`
    )
    const capture = await page.screenshot({ path: test.info().outputPath('hard-alpha-frame.png') })
    const frame = decodePng(capture)
    await test.info().attach('hard-alpha-frame', { body: capture, contentType: 'image/png' })
    for (const [x, y, expected] of [
      [967, 464, [240, 30, 60]],
      [968, 464, [240, 30, 60]],
      [967, 495, [240, 30, 60]],
      [968, 495, [240, 30, 60]],
      [751, 443, [240, 30, 60]],
      [744, 521, [background, background, background]],
      [967, 520, [background, background, background]],
    ]) {
      const offset = (y * frame.width + x) * 4
      expected.forEach((value, channel) =>
        expect(
          Math.abs(frame.data[offset + channel] - value),
          `hard-alpha witness ${x},${y}, channel ${channel}`
        ).toBeLessThanOrEqual(2)
      )
    }
  })
}

for (const background of [255, 0]) {
  for (const alpha of [100000, 50000]) {
    test(`nonconcentric bands preserve interior coverage on ${background} at alpha ${alpha}`, async ({
      page,
    }) => {
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      const geometry = gradientCoverageGeometry({ alpha })
      const before = structuredClone(geometry)
      const generationStart = performance.now()
      const definition = gradientSvgDefinition(geometry, {
        width: geometry.width,
        height: geometry.height,
        nativeStroke: false,
      })
      const generationMs = performance.now() - generationStart
      expect(geometry).toEqual(before)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.setContent(
        `<style>body{margin:0;background:rgb(${background},${background},${background})}</style>` +
          `<svg width="360" height="240" viewBox="0 0 180 120" xmlns="http://www.w3.org/2000/svg">` +
          definition +
          `<rect width="180" height="120" fill="url(#${gradientPaintId(geometry)})"/></svg>`
      )
      const image = decodePng(await page.locator('body > svg').screenshot())
      await test.info().attach('phone-frame', {
        body: await page.screenshot({ path: test.info().outputPath('phone-frame.png') }),
        contentType: 'image/png',
      })
      expect([image.width, image.height]).toEqual([360, 240])
      // This rectangle lies strictly inside the outer circle for this source,
      // away from support/fold edges. Its green channel must remain in the
      // composited source palette, independent of subpixel band boundaries.
      const opacity = Math.round((255 * alpha) / 100000) / 255
      const minimum = opacity * 30 + (1 - opacity) * background - 2
      const maximum = opacity * 80 + (1 - opacity) * background + 2
      const violations = []
      for (let y = 20; y < 60; y++) {
        for (let x = 160; x < 200; x++) {
          const green = image.data[(y * image.width + x) * 4 + 1]
          if (green < minimum || green > maximum) violations.push({ x, y, green })
        }
      }
      expect(violations.length, JSON.stringify(violations.slice(0, 8))).toBe(0)
      expect(errors).toEqual([])

      // Match the native overlap frame, including its fractional pattern seam.
      await page.setViewportSize({ width: 1920, height: 1080 })
      const html =
        `<style>body{margin:0;background:rgb(${background},${background},${background})}</style>` +
        `<svg width="1920" height="1080" viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg">` +
        `<g transform="translate(340 180)">${definition}` +
        `<rect width="180" height="120" fill="url(#${gradientPaintId(geometry)})"/></g></svg>`
      const renderStart = performance.now()
      await page.setContent(html)
      const capture = await page.screenshot({ path: test.info().outputPath('native-frame.png') })
      const renderMs = performance.now() - renderStart
      const frame = decodePng(capture)
      const measurement = await recordGradientCoverage(page, definition, html, capture, {
        background,
        alpha,
        generationMs,
        renderMs,
      })
      expect(measurement.dpr).toBe(1)
      expect(measurement.patternId).toBe(gradientPaintId(geometry))
      expect(await page.locator('body > svg > g > rect').getAttribute('fill')).toBe(
        `url(#${measurement.patternId})`
      )
      expect([frame.width, frame.height]).toEqual([1920, 1080])
      for (const [x, y, rgb] of [
        [967, 464, [240, 30, 60]],
        [968, 464, [240, 30, 60]],
        [967, 495, [240, 30, 60]],
        [968, 495, [240, 30, 60]],
        [744, 521, [37, 80, 239]],
        [751, 443, [239, 31, 63]],
      ]) {
        const offset = (y * frame.width + x) * 4
        for (let channel = 0; channel < 3; channel++) {
          const expected = opacity * rgb[channel] + (1 - opacity) * background
          expect(
            Math.abs(frame.data[offset + channel] - expected),
            `native witness ${x},${y}, channel ${channel}`
          ).toBeLessThanOrEqual(2)
        }
      }
      const outside = (520 * frame.width + 967) * 4
      expect([...frame.data.subarray(outside, outside + 3)]).toEqual([
        background,
        background,
        background,
      ])
      expect(errors).toEqual([])
    })
  }
}

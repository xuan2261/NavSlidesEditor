import { expect } from '@playwright/test'
import jsQR from 'jsqr'
import { findFrame } from './release-surfaces.js'
import { playUtility } from './release-utility-interactions.js'

export async function inspectOrdinary(page, root, element, surface) {
  const type = element.type
  if (type === 'text') {
    await expect(root.locator('strong')).toHaveText('Bold term')
    await expect(root.locator('em')).toHaveText('Italic term')
    await expect(root.locator('li')).toContainText('Lesson link')
    await expect(root.getByRole('link', { name: 'Lesson link' })).toHaveAttribute(
      'href',
      'https://example.com/lesson'
    )
    return {
      text: await root.innerText(),
      typography: await root
        .locator('strong')
        .evaluate((node) => ({
          font: getComputedStyle(node).fontFamily,
          lineHeight: getComputedStyle(node).lineHeight,
        })),
    }
  }
  if (type === 'image') {
    const image = root.getByRole('img', { name: element.alt, exact: true })
    await expect(image).toHaveJSProperty('naturalWidth', 120)
    await expect(root).toContainText(element.citationText)
    return image.evaluate((node) => ({
      alt: node.alt,
      width: node.naturalWidth,
      fit: getComputedStyle(node).objectFit,
      filter: getComputedStyle(node).filter,
      border: getComputedStyle(node).borderWidth,
      transform: getComputedStyle(node).transform,
    }))
  }
  if (type === 'shape') {
    await expect(root).toContainText(element.text)
    await expect(root.locator('polygon')).toBeVisible()
    return {
      label: await root.innerText(),
      polygon: await root.locator('polygon').getAttribute('points'),
    }
  }
  if (type === 'code') {
    await expect(root).toContainText('const lesson = 19;')
    return {
      code: await root.innerText(),
      typography: await root
        .locator('code')
        .evaluate((node) => ({
          fontSize: getComputedStyle(node).fontSize,
          language: node.className,
        })),
    }
  }
  if (type === 'latex') {
    const rendered = surface === 'canvas' ? root.frameLocator('iframe') : root
    const math = rendered.locator('.katex')
    await expect(math).toBeVisible()
    await expect(math.locator('annotation')).toHaveText(element.content)
    await expect(math.locator('.katex-html')).toBeVisible()
    await math.evaluate(() => document.fonts.ready)
    const glyphs = await math.evaluate((node) => {
      const bounds = node.querySelector('.katex-html').getBoundingClientRect()
      return {
        width: bounds.width,
        height: bounds.height,
        fonts: [...document.fonts]
          .filter((font) => font.status === 'loaded')
          .map((font) => font.family),
      }
    })
    expect(glyphs.width).toBeGreaterThan(0)
    expect(glyphs.height).toBeGreaterThan(0)
    expect(glyphs.fonts.some((family) => family.includes('KaTeX_Main'))).toBe(true)
    expect(glyphs.fonts.some((family) => family.includes('KaTeX_Math'))).toBe(true)
    return { formula: await math.locator('annotation').textContent(), glyphs }
  }
  if (type === 'html') {
    if (surface === 'canvas') {
      await root.focus()
      if ((await root.getAttribute('data-selected')) !== 'true') await root.press('Enter')
      await expect(root).toHaveAttribute('data-selected', 'true')
      await expect(root.locator('iframe')).toHaveCSS('pointer-events', 'auto')
    }
    const frame = root.frameLocator('iframe').frameLocator('iframe#ns-sandbox-child')
    await expect(frame.getByRole('button', { name: 'Increment lesson', exact: true })).toBeVisible()
    await expect
      .poll(() => frame.locator('#increment').evaluate((node) => typeof node.onclick))
      .toBe('function')
    await expect(frame.locator('#isolation')).toHaveText('parent,storage')
    await frame.getByRole('button', { name: 'Increment lesson', exact: true }).click()
    await expect(frame.locator('#count')).toHaveText('1')
    await expect(frame.locator('#isolation')).toHaveText('parent,storage')
    expect(
      await page.evaluate(() => ({
        attacked: document.body.dataset.attacked ?? null,
        storage: localStorage.getItem('release-attack'),
      }))
    ).toEqual({ attacked: null, storage: null })
    return {
      counter: await frame.locator('#count').textContent(),
      isolation: await frame.locator('#isolation').textContent(),
    }
  }
  if (type === 'markdown') {
    const content =
      surface === 'canvas'
        ? root.locator('[data-element-content]')
        : (await findFrame(page, '#out h1')).locator('#out')
    await expect(
      content.getByRole('heading', { name: 'Authored markdown', exact: true })
    ).toBeVisible()
    await expect(content.locator('strong')).toHaveText('Bold term')
    await expect(content.locator('em')).toHaveText('Italic term')
    await expect(content.locator('code')).toHaveText('lesson()')
    return {
      text: await content.innerText(),
      headingFont: await content.locator('h1').evaluate((node) => getComputedStyle(node).fontSize),
    }
  }
  if (type === 'chart') {
    const frame = await findFrame(page, 'canvas#c')
    await frame.waitForFunction(() => window.Chart?.getChart(document.querySelector('canvas#c')))
    const plot = await frame.evaluate(() => {
      const chart = window.Chart.getChart(document.querySelector('canvas#c'))
      return {
        labels: chart.data.labels,
        values: chart.data.datasets[0].data,
        legend: chart.options.plugins.legend.position,
        category: chart.options.scales.x.title.text,
        value: chart.options.scales.y.title.text,
        stacked: chart.options.scales.y.stacked,
        plotted: chart.getDatasetMeta(0).data.map((item) => ({ x: item.x, y: item.y })),
      }
    })
    expect(plot).toMatchObject({
      labels: element.chartData.labels,
      values: element.chartData.datasets[0].data,
      legend: element.legendPosition,
      category: element.axisTitles.category,
      value: element.axisTitles.value,
      stacked: true,
    })
    expect(plot.plotted[0].y).toBeGreaterThan(plot.plotted[1].y)
    return plot
  }
  if (['audio', 'video'].includes(type)) {
    const media = root.locator(type)
    await expect(media).toHaveJSProperty('readyState', 4)
    await expect(root).toContainText(element.audioDescription)
    await root.locator('summary').click()
    await expect(root).toContainText(element.transcript)
    await media.click()
    await media.evaluate((node) => node.play())
    await expect.poll(() => media.evaluate((node) => node.currentTime)).toBeGreaterThan(0)
    const observed = await media.evaluate((node) => ({
      played: node.currentTime,
      rate: node.playbackRate,
      muted: node.muted,
      loop: node.loop,
      controls: node.controls,
    }))
    await media.evaluate((node) => node.pause())
    expect(observed).toMatchObject({ muted: true, loop: true, controls: true })
    if (type === 'video') expect(observed.rate).toBe(1.5)
    return { ...observed, transcript: element.transcript }
  }
  if (type === 'qrcode') {
    const frame = surface === 'canvas' ? null : await findFrame(page, 'canvas#c')
    const bitmap = frame ? frame.locator('canvas#c') : root.locator('img')
    await expect
      .poll(() =>
        bitmap.evaluate((node) =>
          node.tagName === 'IMG'
            ? node.complete && node.naturalWidth > 0
            : node
                .getContext('2d')
                .getImageData(0, 0, node.width, node.height)
                .data.some((value) => value !== 0)
        )
      )
      .toBe(true)
    const pixels = await (frame ? frame.locator('canvas#c') : root.locator('img')).evaluate(
      (node) => {
        const canvas = document.createElement('canvas')
        canvas.width = node.naturalWidth || node.width
        canvas.height = node.naturalHeight || node.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(node, 0, 0)
        return {
          pixels: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
          width: canvas.width,
          height: canvas.height,
        }
      }
    )
    const decoded = jsQR(new Uint8ClampedArray(pixels.pixels), pixels.width, pixels.height)
    expect(decoded?.data).toBe(element.qrData)
    return { decodedPayload: decoded.data, version: decoded.version }
  }
  if (type === 'table') {
    await expect(root.locator('th[colspan="2"],td[colspan="2"]')).toHaveText('Merged')
    await expect(root).toContainText('Authored cell')
    return {
      text: await root.innerText(),
      mergedSpan: await root.locator('[colspan="2"]').getAttribute('colspan'),
    }
  }
  if (type === 'icon') {
    await expect(root.locator('svg')).toHaveAttribute(
      'stroke-width',
      String(element.iconStrokeWidth)
    )
    return {
      glyph: await root.locator('svg').innerHTML(),
      stroke: await root.locator('svg').getAttribute('stroke-width'),
    }
  }
  if (type === 'callout') {
    await expect(root).toContainText(String(element.calloutNumber))
    return { label: await root.innerText() }
  }
  if (type === 'drawing' || type === 'line') {
    const path = root
      .locator('svg > path:not([data-line-hit-target]),svg > g > path:not([data-line-hit-target])')
      .last()
    await expect(path).toHaveAttribute('stroke-width', String(element.strokeWidth))
    await expect(path).toHaveAttribute('d', type === 'drawing' ? element.paths[0].d : /Q 160 0/)
    if (type === 'line') await expect(path).toHaveAttribute('stroke-dasharray', '8 4')
    return {
      path: await path.getAttribute('d'),
      stroke: await path.getAttribute('stroke-width'),
      dash: await path.getAttribute('stroke-dasharray'),
    }
  }
  if (type === 'svg') {
    const circle = root.locator('circle')
    const rgb = element.fillOverride
      .slice(1)
      .match(/../g)
      .map((value) => parseInt(value, 16))
    await expect(circle).toHaveCSS('fill', `rgb(${rgb.join(', ')})`)
    await expect(root.locator('script')).toHaveCount(0)
    expect(await page.evaluate(() => window.compromised === true)).toBe(false)
    return { fill: await circle.evaluate((node) => getComputedStyle(node).fill), escaped: false }
  }
  if (type === 'timeline') {
    await expect(root).toContainText('Authored event')
    await expect(root).toContainText('Authored event detail')
    return {
      event: await root.innerText(),
      ticks: await root.locator('svg text[transform]').allTextContents(),
    }
  }
  if (type === 'game') {
    if (surface === 'canvas') {
      await expect(root.getByRole('button')).toHaveCount(0)
      return { inertAuthoredNames: await root.innerText() }
    }
    return playUtility(root.locator('[data-ns-game]'), 'name-picker', element['name-picker'])
  }
  throw new Error(`Missing canonical observation for ${type}`)
}

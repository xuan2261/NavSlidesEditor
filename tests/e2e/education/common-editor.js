import { expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { gameFixture, deckWith } from './release-game-fixtures.js'
import { savedElements } from './release-author-history.js'
import { observe } from './release-observations.js'

export async function commonSession(page, request, id, overrides = {}, others = []) {
  const fixture = {
    ...gameFixture('name-picker'),
    name: 'Common picker',
    x: 160,
    y: 120,
    width: 300,
    height: 220,
    ...overrides,
  }
  await apiUpdatePresentation(request, id, deckWith([fixture, ...others]))
  const original = await savedElements(request, id)
  const editor = new EditorPage(page)
  await editor.gotoPresentation(id)
  const target = page.getByTestId(`slide-element-${fixture.id}`)
  await expect(target).toBeVisible()
  return { fixture, original, editor, target, read: () => savedElements(request, id) }
}

export async function selectCommon(target) {
  await target.focus()
  await target.press('Enter')
  await expect(target).toHaveAttribute('data-selected', 'true')
}

export async function commonInspector(page, width) {
  if (width < 1280) {
    await page.getByRole('button', { name: 'Open inspector', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Inspector', exact: true })).toBeVisible()
  }
  return page.getByRole('complementary', { name: 'Properties panel', exact: true })
}

export async function commonTry(page, panel) {
  const launcher = panel.getByRole('button', { name: 'Try game', exact: true })
  await launcher.scrollIntoViewIfNeeded()
  await launcher.click()
  const dialog = page.getByRole('dialog', { name: 'Try game', exact: true })
  const root = dialog.locator('[data-ns-game]')
  await expect(root).toBeVisible()
  return { launcher, dialog, root }
}

export async function geometry(target) {
  return target.evaluate((node) => ({
    x: parseFloat(node.style.left),
    y: parseFloat(node.style.top),
    width: parseFloat(node.style.width),
    height: parseFloat(node.style.height),
    rotation: Number(node.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0),
  }))
}

// DOM ancestry is not the overflow clipping chain for viewport-fixed descendants.
export async function targetable(target, minimum = 1) {
  await expect(target).toBeVisible()
  await target.scrollIntoViewIfNeeded()
  const measured = await target.evaluate((node) => {
    const identity = (element) => ({
      tag: element.tagName,
      id: element.id,
      testId: element.getAttribute('data-testid'),
      role: element.getAttribute('role'),
      label: element.getAttribute('aria-label'),
      className: element.getAttribute('class'),
    })
    const chain = []
    for (let p = node; p; p = p.parentElement) {
      const s = getComputedStyle(p),
        b = p.getBoundingClientRect()
      const properties = {
        position: s.position,
        overflowX: s.overflowX,
        overflowY: s.overflowY,
        transform: s.transform,
        translate: s.translate,
        rotate: s.rotate,
        scale: s.scale,
        perspective: s.perspective,
        filter: s.filter,
        backdropFilter: s.backdropFilter,
        contain: s.contain,
        willChange: s.willChange,
        contentVisibility: s.contentVisibility,
        containerType: s.containerType,
      }
      const containingBlockReasons = [
        'transform',
        'translate',
        'rotate',
        'scale',
        'perspective',
        'filter',
        'backdropFilter',
      ].filter((key) => properties[key] && properties[key] !== 'none')
      if (/(^|\s)(layout|paint|strict|content)(\s|$)/.test(s.contain))
        containingBlockReasons.push('contain')
      if (
        s.willChange
          .split(',')
          .some((value) =>
            [
              'transform',
              'translate',
              'rotate',
              'scale',
              'perspective',
              'filter',
              'backdrop-filter',
              'contain',
            ].includes(value.trim())
          )
      ) {
        containingBlockReasons.push('willChange')
      }
      if (s.contentVisibility === 'auto') containingBlockReasons.push('contentVisibility')
      if (s.containerType && s.containerType !== 'normal')
        containingBlockReasons.push('containerType')
      chain.push({
        identity: identity(p),
        bounds: {
          left: b.left,
          right: b.right,
          top: b.top,
          bottom: b.bottom,
          width: b.width,
          height: b.height,
        },
        properties,
        containingBlockReasons,
      })
    }
    const fixedBoundaries = chain.flatMap((entry, index) => {
      if (entry.properties.position !== 'fixed') return []
      const block = chain.findIndex(
        (ancestor, ancestorIndex) =>
          ancestorIndex > index && ancestor.containingBlockReasons.length > 0
      )
      return [
        {
          index,
          block,
          fixed: entry.identity,
          containingBlock: block < 0 ? 'viewport' : chain[block],
        },
      ]
    })
    const clips = []
    for (let index = 1; index < chain.length; index++) {
      const ancestor = chain[index]
      // Only the ancestors between a fixed box and its measured containing block are bypassed.
      const escape = fixedBoundaries.find(
        (boundary) => boundary.index < index && (boundary.block < 0 || index < boundary.block)
      )
      for (const [axis, property, start, end] of [
        ['x', 'overflowX', 'left', 'right'],
        ['y', 'overflowY', 'top', 'bottom'],
      ]) {
        if (!/^(hidden|clip|auto|scroll)$/.test(ancestor.properties[property])) continue
        clips.push({
          axis,
          start: ancestor.bounds[start],
          end: ancestor.bounds[end],
          ancestor,
          excludedReason: escape
            ? 'Fixed descendant containing block lies outside this overflow ancestor'
            : null,
          fixedBoundary: escape || null,
        })
      }
    }
    const r = node.getBoundingClientRect(),
      x = r.left + r.width / 2,
      y = r.top + r.height / 2
    // Probe beyond the one-pixel border/tolerance seam; clipping bounds remain unchanged.
    const insetX = Math.min(2, r.width / 4),
      insetY = Math.min(2, r.height / 4)
    const hitPoints = [
      ['center', x, y],
      ['left-interior', r.left + insetX, y],
      ['right-interior', r.right - insetX, y],
      ['top-interior', x, r.top + insetY],
      ['bottom-interior', x, r.bottom - insetY],
    ].map(([name, x, y]) => {
      const hit = document.elementFromPoint(x, y)
      return {
        name,
        x,
        y,
        hit: Boolean(hit && node.contains(hit)),
        hitElement: hit ? identity(hit) : null,
      }
    })
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
      viewport: { width: innerWidth, height: innerHeight },
      hit: hitPoints[0].hit,
      hitPoints,
      clips,
      ancestors: chain.slice(1),
      fixedBoundaries,
    }
  })
  expect(measured.left).toBeGreaterThanOrEqual(-1)
  expect(measured.right).toBeLessThanOrEqual(measured.viewport.width + 1)
  expect(measured.top).toBeGreaterThanOrEqual(-1)
  expect(measured.bottom).toBeLessThanOrEqual(measured.viewport.height + 1)
  expect(measured.width).toBeGreaterThanOrEqual(minimum)
  expect(measured.height).toBeGreaterThanOrEqual(minimum)
  expect(measured.hit, JSON.stringify(measured)).toBe(true)
  for (const point of measured.hitPoints)
    expect(point.hit, JSON.stringify({ point, measured })).toBe(true)
  for (const clip of measured.clips) {
    if (clip.excludedReason) continue
    expect(
      clip.axis === 'x' ? measured.left : measured.top,
      JSON.stringify(clip)
    ).toBeGreaterThanOrEqual(clip.start - 1)
    expect(
      clip.axis === 'x' ? measured.right : measured.bottom,
      JSON.stringify(clip)
    ).toBeLessThanOrEqual(clip.end + 1)
  }
  return measured
}

export async function commonObservation(info, page, scenario, expected, observed, artifacts = []) {
  await observe(
    info,
    page,
    { element: 'game', capabilityId: `education.${scenario}`, surface: 'editor' },
    scenario,
    expected,
    observed,
    artifacts
  )
}

export async function captureCommon(info, page, name) {
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true })
  return path
}

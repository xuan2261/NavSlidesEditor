import { test, expect } from '../fixtures/test-fixtures.js'
import {
  CONTENT_TYPES,
  contentFixture,
  setupContent,
  inspector,
  fillControl,
  reloadContent,
  readContent,
  fieldEvidence,
} from './release-content-fields.js'
import { illustration } from './release-ordinary-fixtures.js'
import { videoSource, audioSource } from './fixtures/media-sources.js'

const initial = {
  text: { content: '<p>Geometry lesson</p>' },
  image: { src: illustration },
  code: { content: 'const geometry = 19;' },
  latex: { content: 'x^2' },
  html: {
    content: '<h1>Geometry embed</h1>',
    htmlDependencies: { network: false, offlineCapable: true, resources: [], dynamicResources: [] },
  },
  markdown: { content: '# Geometry lesson' },
  chart: {},
  video: { src: videoSource },
  audio: { src: audioSource() },
}

for (const type of CONTENT_TYPES) {
  test(`${type} width height and zIndex change real geometry and overlapping layer order [cap:element.${type}.editor]`, async ({
    page,
    request,
    testPresentation,
  }, testInfo) => {
    const element = contentFixture(type, { ...initial[type], width: 400, height: 240, zIndex: 1 })
    const blocker = {
      id: 'content-cover',
      type: 'shape',
      shape: 'rect',
      name: 'Overlapping cover',
      x: 80,
      y: 60,
      width: 500,
      height: 340,
      fill: '#ef4444',
      zIndex: 2,
    }
    const target = await setupContent(page, request, testPresentation.id, element, [blocker])
    const before = await target.boundingBox()
    await fillControl(page, 'Width', 480)
    await fillControl(page, 'Height', 320)
    await reloadContent(page, request, testPresentation.id, element.id, { width: 480, height: 320 })
    const after = await target.boundingBox()
    expect(after.width / before.width).toBeCloseTo(480 / 400, 2)
    expect(after.height / before.height).toBeCloseTo(320 / 240, 2)
    const measured = await target.evaluate((node) => ({
      width: parseFloat(getComputedStyle(node).width),
      height: parseFloat(getComputedStyle(node).height),
    }))
    expect(measured).toEqual({ width: 480, height: 320 })
    await fieldEvidence(
      testInfo,
      page,
      type,
      ['width', 'height'],
      { width: 480, height: 320 },
      {
        before,
        after,
        measured,
        persisted: await readContent(request, testPresentation.id, element.id),
      }
    )
    const topLayer = () =>
      target.evaluate((target) => {
        const bounds = target.getBoundingClientRect()
        const wrappers = document
          .elementsFromPoint(bounds.x + 18, bounds.y + 18)
          .map((node) => node.closest('[data-element-id]')?.getAttribute('data-element-id'))
          .filter(Boolean)
        return [...new Set(wrappers)][0]
      })
    await expect.poll(topLayer).toBe(blocker.id)
    const savedLayer = () =>
      page.waitForResponse(
        (response) =>
          response.url().includes(`/api/presentations/${testPresentation.id}`) &&
          response.request().method() === 'PUT'
      )
    const forwardSave = savedLayer()
    await inspector(page).getByTestId('prop-layer-forward').click()
    await expect.poll(topLayer).toBe(element.id)
    expect((await forwardSave).ok()).toBe(true)
    const forward = await readContent(request, testPresentation.id, element.id)
    await reloadContent(page, request, testPresentation.id, element.id, { zIndex: forward.zIndex })
    await expect.poll(topLayer).toBe(element.id)
    await fieldEvidence(
      testInfo,
      page,
      type,
      ['zIndex'],
      { frontmost: element.id },
      { frontmost: await topLayer(), persistedZIndex: forward.zIndex }
    )
    const backwardSave = savedLayer()
    await inspector(page).getByTestId('prop-layer-backward').click()
    await expect.poll(topLayer).toBe(blocker.id)
    expect((await backwardSave).ok()).toBe(true)
    const backward = await readContent(request, testPresentation.id, element.id)
    await reloadContent(page, request, testPresentation.id, element.id, { zIndex: backward.zIndex })
    await expect.poll(topLayer).toBe(blocker.id)
  })
}

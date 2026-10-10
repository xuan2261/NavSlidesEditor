import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect } from '@playwright/test'
import { apiCreatePresentation, apiGetPresentation, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { expectOriginalPptxHash, importPptxWhenAvailable } from './pptx-import-api-helper.js'

export const SEED = 26100913
export const REPETITIONS = 5
export const SAMPLES = 20
export const VIEWPORT = Object.freeze({ width: 1440, height: 900 })
// Frozen before measurements. These are conservative engineering SLOs, not measured claims.
// 100ms preserves perceived direct manipulation; scroll gets ~3 frames at 60Hz;
// drop allows reconciliation; open allows parsing/rendering the large representative corpus.
export const BUDGET = Object.freeze({
  selection: { statistic: 'p95', ms: 100 }, input: { statistic: 'p95', ms: 100 },
  scroll: { statistic: 'p95', ms: 50 }, drop: { statistic: 'p95', ms: 200 },
  open: { statistic: 'median', ms: 2000 },
  maximumNoise: 0.05, maximumPairedRegression: 0.10,
})
export const hash = (value) => createHash('sha256').update(value).digest('hex')
export const contentHash = (value) => hash(JSON.stringify(value))
export function shuffled(values, seed) {
  let state = seed >>> 0
  const output = [...values]
  for (let index = output.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const other = state % (index + 1)
    ;[output[index], output[other]] = [output[other], output[index]]
  }
  return output
}

const diagram = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#162438"/><g stroke="#405470">${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${i * 30}H640M${i * 60} 0V360"/>`).join('')}</g><polyline fill="none" stroke="#38bdf8" stroke-width="6" points="${Array.from({ length: 64 }, (_, i) => `${i * 10},${180 + Math.round(Math.sin(i / 5) * 90)}`).join(' ')}"/><circle cx="420" cy="103" r="18" fill="#fbbf24"/><text x="30" y="45" fill="white" font-size="24">Regional learning outcomes</text></svg>`
const imageSrc = `data:image/svg+xml;base64,${Buffer.from(diagram).toString('base64')}`
function slide(id) {
  return {
    id, layoutId: 'navigator-brand', notes: `Review ${id}: compare chart and regional outcomes.`,
    background: { type: 'color', color: 'auto' },
    layoutOverrides: { placeholderBindings: { heading: `${id}-text` } },
    elements: [
      { id: `${id}-text`, type: 'text', x: 40, y: 60, width: 820, height: 125, zIndex: 2, fontSize: 24, textColor: 'auto', content: `<p><strong>Identity ${id}</strong></p><p>Regional learning outcomes: <em>compare evidence</em>, explain tradeoffs, and record a reproducible conclusion.</p>` },
      { id: `${id}-image`, type: 'image', x: 40, y: 220, width: 400, height: 240, zIndex: 2, src: imageSrc, alt: 'Synthetic regional outcomes diagram', objectFit: 'contain' },
      { id: `${id}-chart`, type: 'chart', x: 480, y: 220, width: 400, height: 240, zIndex: 2, chartType: 'bar', chartData: { labels: ['North', 'South', 'East', 'West', 'Central'], datasets: [{ label: 'Baseline', data: [42, 67, 58, 73, 61], color: '#38bdf8' }, { label: 'Target', data: [55, 75, 65, 80, 70], color: '#a78bfa' }] }, legendPosition: 'right' },
    ],
  }
}
export function syntheticDeck(parents, children) {
  const name = `${parents}x${children}`
  const deck = {
    title: `Navigator baseline ${name}`, theme: 'black', resolution: { width: 960, height: 540 },
    designTokens: { colors: { bg: '#142438', text: '#f1f5f9', accent: '#38bdf8' } },
    layoutMasters: [{ id: 'navigator-brand', name: 'Navigator evidence brand', tokens: { colors: { muted: '#94a3b8' } }, fixedElements: [{ id: 'brand', type: 'text', x: 40, y: 495, width: 820, height: 35, zIndex: 1, fontSize: 16, textColor: 'auto', content: '<p>Navigator measurement · deterministic corpus</p>' }], placeholders: [{ id: 'heading', type: 'text', role: 'title', x: 40, y: 60, width: 820, height: 125 }] }],
    slides: Array.from({ length: parents }, (_, index) => ({ ...slide(`${name}-parent-${index}`), children: Array.from({ length: children }, (_, child) => slide(`${name}-parent-${index}-child-${child}`)) })),
  }
  return { name, deck, fixtureHash: contentHash(deck), parentCount: parents, childCount: parents * children, flattenedCount: parents * (1 + children), imageHash: hash(diagram), provenance: 'synthetic deterministic test corpus; no Office qualification claim' }
}
export async function installSynthetic(request, fixture) {
  const created = await apiCreatePresentation(request, fixture.deck.title)
  fixture.id = created.id // Retained even if setup fails, so the caller can clean up.
  await apiUpdatePresentation(request, fixture.id, fixture.deck)
  const persisted = await apiGetPresentation(request, fixture.id)
  for (const key of ['slides', 'layoutMasters', 'designTokens', 'resolution']) expect(persisted[key]).toEqual(fixture.deck[key])
}
export async function installPackage(request, fixture) {
  const name = 'Bai_2_2.pptx'
  const bytes = await readFile(path.resolve('PPTX', name))
  fixture.packageHash = hash(bytes)
  const imported = await importPptxWhenAvailable(request, { file: { name, buffer: bytes, mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' } }, { maxAttempts: 1 })
  fixture.id = imported.presentationId
  fixture.deck = await apiGetPresentation(request, fixture.id)
  expect(fixture.deck.pptxSourceAvailable).toBe(true)
  expect(fixture.deck.aggregateGeneration).toBeGreaterThan(0)
  await expectOriginalPptxHash(request, fixture.id, fixture.packageHash, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
  fixture.parentCount = fixture.deck.slides.length
  fixture.childCount = fixture.deck.slides.reduce((sum, parent) => sum + (parent.children || []).length, 0)
  fixture.flattenedCount = fixture.parentCount + fixture.childCount
  fixture.fixtureHash = contentHash({ slides: fixture.deck.slides, layoutMasters: fixture.deck.layoutMasters, designTokens: fixture.deck.designTokens, resolution: fixture.deck.resolution })
  fixture.provenance = 'Existing repository PPTX/Bai_2_2.pptx; actual importer/package bytes, no Office qualification claim'
}

export async function restoreCanonical(request, fixture) {
  const current = await apiGetPresentation(request, fixture.id)
  const fields = ['title', 'theme', 'resolution', 'slides', 'layoutMasters', 'designTokens']
  const canonical = Object.fromEntries(fields.filter((key) => fixture.deck[key] !== undefined).map((key) => [key, fixture.deck[key]]))
  const response = await request.put(`${process.env.PLAYWRIGHT_API_BASE_URL}/presentations/${fixture.id}`, {
    headers: { 'Idempotency-Key': `navigator-${randomUUID()}` },
    data: { ...canonical, ...(current.aggregateGeneration ? { aggregateGeneration: current.aggregateGeneration } : {}) },
  })
  if (!response.ok()) throw new Error(`Canonical restore failed without retry: ${response.status()} ${await response.text()}`)
  const restored = await apiGetPresentation(request, fixture.id)
  for (const [key, value] of Object.entries(canonical)) expect(restored[key]).toEqual(value)
  return contentHash(canonical)
}

import { test, expect } from '../fixtures/test-fixtures.js'
import {
  visualSession,
  fillControl,
  colorControl,
  fieldEvidence,
  insideBounds,
} from './release-visual-fields.js'
import { illustration } from './release-ordinary-fixtures.js'

test.use({ timezoneId: 'UTC' })

async function readableTicks(root, expected) {
  const ticks = root.locator('svg text[transform]')
  await expect(ticks).toHaveText(expected)
  const bounds = await ticks.evaluateAll((nodes) =>
    nodes.map((node) => ({ text: node.textContent, ...node.getBoundingClientRect().toJSON() }))
  )
  for (let i = 1; i < bounds.length; i++) expect(bounds[i].x).toBeGreaterThan(bounds[i - 1].right)
  for (const tick of bounds) {
    expect(tick.width).toBeGreaterThan(0)
    expect(tick.height).toBeGreaterThan(0)
  }
  return bounds
}

test('timeline year range, readable tick geometry, colors and authored event/item aliases persist', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'timeline', {
    width: 780,
    height: 400,
    y: 50,
    events: [],
    items: [],
  })
  await fillControl(page, 'Timeline start year', 1990)
  await fillControl(page, 'Timeline end year', 2030)
  await page.getByLabel('Timeline tick spacing', { exact: true }).selectOption('10year')
  await colorControl(page, 'Timeline line color', '#1d4ed8')
  await colorControl(page, 'Timeline dot color', '#dc2626')
  await colorControl(page, 'Timeline text color', '#166534')
  await fillControl(page, 'Timeline font size', 16)
  await page.getByRole('button', { name: '+ Add Event', exact: true }).click()
  await fillControl(page, 'Timeline event 1 year', 2015)
  await fillControl(page, 'Timeline event 1 title', 'Event 37')
  await fillControl(page, 'Timeline event 1 description', 'Readable detail')
  await fillControl(page, 'Timeline event 1 image URL', illustration)
  await page.getByLabel('Timeline event 1 side', { exact: true }).selectOption('bottom')
  await fillControl(page, 'Timeline event 1 connector length', 10)
  const persisted = await s.reload({
    timelineStart: '1990',
    timelineEnd: '2030',
    startDate: '1990',
    endDate: '2030',
    tickSpacing: '10year',
    lineColor: '#1d4ed8',
    dotColor: '#dc2626',
    textColor: '#166534',
    fontSize: 16,
  })
  expect(persisted.events).toHaveLength(1)
  expect(persisted.items).toHaveLength(1)
  expect(persisted.events[0]).toMatchObject({
    date: '2015',
    title: 'Event 37',
    description: 'Readable detail',
    side: 'bottom',
    connectorLength: 10,
    imageUrl: illustration,
  })
  expect(persisted.items[0]).toMatchObject({
    date: '2015',
    label: 'Event 37',
    description: 'Readable detail',
    side: 'bottom',
    connectorLength: 10,
    image: illustration,
  })
  const ticks = await readableTicks(s.root, ['1990', '2000', '2010', '2020', '2030'])
  await expect(s.root.locator('[data-testid="timeline-line"]')).toHaveCSS(
    'stroke',
    'rgb(29, 78, 216)'
  )
  const dot = s.root.locator('circle')
  await expect(dot).toHaveCSS('fill', 'rgb(220, 38, 38)')
  await expect(dot).toHaveAttribute('cx', '480')
  await expect(dot).toHaveAttribute('cy', '200')
  const labels = s.root.locator('svg text:not([transform])')
  await expect(labels).toHaveText(['Event 37', 'Readable detail', '2015'])
  await expect(labels.first()).toHaveAttribute('font-size', '16')
  await expect(labels.first()).toHaveCSS('fill', 'rgb(22, 101, 52)')
  const labelBounds = await insideBounds(labels.first(), s.root)
  await expect(s.root.locator('image')).toHaveAttribute('href', illustration)
  await expect(s.root.locator('image')).toHaveAttribute('width', '80')
  const imageBounds = await insideBounds(s.root.locator('image'), s.root)
  await insideBounds(labels.last(), s.root)
  const eventY = Number(await labels.first().getAttribute('y'))
  expect(eventY).toBeGreaterThan(Number(await dot.getAttribute('cy')))
  await fieldEvidence(
    info,
    page,
    'timeline',
    [
      'timelineStart',
      'timelineEnd',
      'startDate',
      'endDate',
      'range',
      'tickSpacing',
      'ticks',
      'lineColor',
      'dotColor',
      'textColor',
      'fontSize',
      'colors',
      'events',
      'items',
      'dates',
    ],
    {
      range: ['1990', '2030'],
      readableTicks: ['1990', '2000', '2010', '2020', '2030'],
      eventDate: '2015',
      eventOnBottom: true,
      eventX: 480,
    },
    {
      persisted,
      ticks,
      eventLabels: await labels.allTextContents(),
      labelBounds,
      imageBounds,
      dot: {
        x: await dot.getAttribute('cx'),
        y: await dot.getAttribute('cy'),
        fill: await dot.getAttribute('fill'),
      },
      eventY,
    }
  )
})

test('timeline calendar date controls place month ticks and event between actual range endpoints', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'timeline', {
    width: 780,
    height: 300,
    tickSpacing: 'month',
    timelineStart: '2020-01-01',
    timelineEnd: '2020-04-01',
    startDate: '2020-01-01',
    endDate: '2020-04-01',
    events: [],
    items: [],
  })
  await fillControl(page, 'Timeline start date', '2024-01-01')
  await fillControl(page, 'Timeline end date', '2024-04-01')
  await page.getByRole('button', { name: '+ Add Event', exact: true }).click()
  await fillControl(page, 'Timeline event 1 date', '2024-02-01')
  await fillControl(page, 'Timeline event 1 title', 'Calendar event')
  const persisted = await s.reload({
    timelineStart: '2024-01-01',
    startDate: '2024-01-01',
    timelineEnd: '2024-04-01',
    endDate: '2024-04-01',
  })
  expect(persisted.events[0].date).toBe('2024-02-01')
  expect(persisted.items[0].date).toBe('2024-02-01')
  const labels = s.root.locator('svg text:not([transform])')
  await expect(labels).toHaveText(['Calendar event', '2024-02-01'])
  const dotX = Number(await s.root.locator('circle').getAttribute('cx'))
  expect(dotX).toBeCloseTo(30 + (720 * 31) / 91, 0)
  const ticks = await s.root.locator('text[transform]').allTextContents()
  expect(ticks).toHaveLength(4)
  const bounds = await insideBounds(labels.first(), s.root)
  await fieldEvidence(
    info,
    page,
    'timeline',
    ['dates', 'startDate', 'endDate', 'timelineStart', 'timelineEnd', 'events', 'items'],
    {
      calendarRange: ['2024-01-01', '2024-04-01'],
      calendarEvent: '2024-02-01',
      fractionalDatePlacement: 31 / 91,
    },
    { persisted, eventDate: await labels.last().textContent(), dotX, ticks, bounds }
  )
})

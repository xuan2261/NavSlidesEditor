import { test } from './fixtures/test-fixtures.js'
import { registerSemanticNegativeCases } from './helpers/pptx-semantic-negative-cases.js'
import { runJourney } from './helpers/pptx-semantic-lifecycle-journey.js'
import { textJourney, tableJourney, ommlJourney } from './helpers/pptx-semantic-content-journeys.js'
import { chartJourney, smartArtJourney } from './helpers/pptx-semantic-auxiliary-journeys.js'
import { geometryJourney, pictureJourney, inheritanceJourney, timingJourney } from './helpers/pptx-semantic-media-journeys.js'

// Full Cartesian matrix: desktop/mobile × pointer/keyboard × light/dark.
const environments = [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
].flatMap(viewport => ['pointer', 'keyboard'].flatMap(interaction =>
  ['light', 'dark'].map(theme => ({ viewport, interaction, theme }))))

const genuineJourneys = [
  textJourney,
  tableJourney,
  ommlJourney,
  inheritanceJourney,
  timingJourney,
  pictureJourney,
]

const auxiliaryJourneys = [
  chartJourney,
  smartArtJourney,
  geometryJourney,
]

for (const journey of genuineJourneys) {
  for (const env of environments) {
    const label = `${journey.family} ${journey.id} ${env.viewport.width}x${env.viewport.height} ${env.interaction} ${env.theme}`
    test(`genuine corpus semantic lifecycle ${label}`, async ({ page, request }, info) => {
      test.setTimeout(360000)
      info.annotations.push({ type: 'source', description: `${journey.source.id} sha256:${journey.source.sha256}` })
      info.annotations.push({ type: 'scope', description: 'Browser semantic lifecycle only; not native visual qualification' })
      await page.setViewportSize(env.viewport)
      await runJourney({ page, request, info, journey, interaction: env.interaction, theme: env.theme })
    })
  }
}

for (const journey of auxiliaryJourneys) {
  for (const env of environments) {
    const label = `${journey.family} ${journey.id} ${env.viewport.width}x${env.viewport.height} ${env.interaction} ${env.theme}`
    test(`auxiliary semantic lifecycle ${label}`, async ({ page, request }, info) => {
      test.setTimeout(360000)
      info.annotations.push({ type: 'source', description: `${journey.source.id} sha256:${journey.source.sha256}` })
      info.annotations.push({ type: 'scope', description: `Auxiliary ${journey.source.provenance}; not genuine-corpus or native visual qualification` })
      if (journey.family === 'diagram') info.annotations.push({ type: 'prerequisite',
        description: 'Pinned auxiliary source contains snake layout; each edit must pass the actual evaluator, never an unsupported fallback' })
      await page.setViewportSize(env.viewport)
      await runJourney({ page, request, info, journey, interaction: env.interaction, theme: env.theme })
    })
  }
}


test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => globalThis.localStorage.setItem('navSlidesTutorialSeen', 'true'))
})
registerSemanticNegativeCases()


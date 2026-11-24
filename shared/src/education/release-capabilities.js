const { GAME_CATALOG } = require('./game-registry.js')
const { QUESTION_KINDS } = require('./question-shape.js')
const { EDUCATION_PRESETS } = require('./presets/catalog.js')

const SCHEMA_VERSION = 1
const RELEASE_SCENARIOS = Object.freeze({
  ordinary: Object.freeze({
    editor: 'author-save-reload-undo-duplicate',
    canvas: 'render',
    present: 'render',
    share: 'render',
    file: 'offline-render',
    pdf: 'static-mapping',
    pptx: 'static-mapping',
  }),
  game: Object.freeze({
    editor: 'author-save-reload-undo-duplicate',
    try: 'complete-reset',
    present: 'complete-reset',
    share: 'complete-reset',
    file: 'offline-complete-reset',
    pdf: 'redacted-default',
    pptx: 'redacted-default',
  }),
  live: 'authority-redaction-replay',
  teacherReveal: 'teacher-reveal',
  desktop: 'native-local-csp',
  preset: Object.freeze({
    editor: 'insert-save-reload-undo-clone',
    present: 'interact-reset',
    file: 'offline-interact-reset',
  }),
  common: Object.freeze([
    'geometry-lock-hidden-fragments-actions-align-multiselect',
    'keyboard',
    'touch',
    'reduced-motion',
    'responsive-320',
    'responsive-768',
    'responsive-1280',
    'tuple-isolation',
    'sandbox-isolation',
    'variables-triggers',
    'portable-assets',
    'lifecycle-score-reset',
    'default-answer-redaction',
  ]),
})
const FIELD_OUTCOMES = Object.freeze({
  text: 'richMarks fontFamily lineHeight list link',
  image: 'src crop fit filters border flip alt decorative longDescription citation',
  shape: 'shapeKind geometry style text fontSize textColor rotation opacity',
  code: 'language font rounding walkthrough',
  latex: 'formula tikz font color offlineAssets',
  html: 'script mermaid forPrint finalFrame parentIsolation networkIsolation',
  markdown: 'heading list bold italic inlineCode link typography',
  chart: 'chartType data area stack legend axis',
  video: 'src poster fit controls muted loop start end rate tracks',
  audio: 'src controls loop muted captions transcript',
  table: 'cellData cellStyle header border padding rowSizes columnSizes mergedCells',
  icon: 'iconName color stroke bounds',
  callout: 'number colors font resize',
  qrcode: 'qrData colors errorLevel decodedPayload',
  drawing: 'paths stroke resize visibility',
  line: 'endpoints curve stroke arrows dash attachment',
  svg: 'content fillOverride strokeOverride unsafePayload',
  timeline: 'range ticks events items colors dates',
  game: 'config editInert tryPlayable',
})
const CELL_FIELDS = Object.freeze([
  'capabilityId',
  'element',
  'gameType',
  'questionKind',
  'presetId',
  'surface',
  'mode',
  'scenarioId',
  'lane',
])
function cellKey(cell) {
  return CELL_FIELDS.map((key) => cell[key] ?? '').join('|')
}
function buildRequiredCells({
  elementDefaults,
  gameCatalog = GAME_CATALOG,
  questionKinds = QUESTION_KINDS,
  presets = EDUCATION_PRESETS,
} = {}) {
  if (
    !elementDefaults ||
    Object.keys(elementDefaults).length !== 19 ||
    Object.keys(gameCatalog).length !== 19 ||
    questionKinds.length !== 7
  )
    throw new Error(
      'Qualification requires actual canonical 19 elements, 19 game subtypes and seven question kinds.'
    )
  const cells = []
  const add = (identity, surface, scenarioId, mode = 'local', lane = 'production-browser') => {
    const prefix = identity.presetId
      ? `preset.${identity.presetId}`
      : identity.gameType
        ? `game.${identity.gameType}`
        : `element.${identity.element}`
    cells.push({
      capabilityId: identity.capabilityId || `${prefix}.${surface}`,
      element: identity.element,
      gameType: identity.gameType ?? null,
      questionKind: identity.questionKind ?? null,
      presetId: identity.presetId ?? null,
      surface,
      mode,
      scenarioId,
      lane,
    })
  }
  for (const [element, defaults] of Object.entries(elementDefaults)) {
    for (const [surface, scenario] of Object.entries(RELEASE_SCENARIOS.ordinary))
      add({ element }, surface, scenario)
    const fields = new Set([
      ...(element === 'game' ? [] : Object.keys(defaults)),
      ...(FIELD_OUTCOMES[element] || '').split(' ').filter(Boolean),
    ])
    for (const field of fields) add({ element }, 'editor', `field:${field}`)
  }
  for (const [gameType, game] of Object.entries(gameCatalog)) {
    for (const questionKind of gameType === 'quiz' ? questionKinds : [null]) {
      const identity = { element: 'game', gameType, questionKind }
      for (const [surface, scenario] of Object.entries(RELEASE_SCENARIOS.game))
        add(identity, surface, scenario)
      for (const surface of ['pdf', 'pptx']) add(identity, surface, RELEASE_SCENARIOS.teacherReveal)
      if (game.plannedModes.live) add(identity, 'live', RELEASE_SCENARIOS.live, 'live')
      else if (gameType === 'name-picker') add(identity, 'live', 'broadcast-pick-reset', 'live')
      for (const lane of ['electron-dev', 'windows-packaged'])
        add(identity, 'desktop', RELEASE_SCENARIOS.desktop, 'local', lane)
    }
    for (const field of game.authoringFields)
      add({ element: 'game', gameType }, 'editor', `field:${field}`)
  }
  for (const preset of presets)
    for (const [surface, scenario] of Object.entries(RELEASE_SCENARIOS.preset))
      add({ element: preset.elements[0]?.type || 'html', presetId: preset.id }, surface, scenario)
  const commonSurfaces = {
    'tuple-isolation': 'present',
    'sandbox-isolation': 'share',
    'variables-triggers': 'present',
    'portable-assets': 'file',
    'lifecycle-score-reset': 'try',
    'default-answer-redaction': 'pdf',
  }
  for (const scenario of RELEASE_SCENARIOS.common)
    add(
      { element: 'game', capabilityId: `education.${scenario}` },
      commonSurfaces[scenario] || 'editor',
      scenario
    )
  const unique = new Set(cells.map(cellKey))
  if (unique.size !== cells.length)
    throw new Error('Canonical release policy contains duplicate cells.')
  return cells.sort((a, b) => cellKey(a).localeCompare(cellKey(b)))
}
module.exports = {
  SCHEMA_VERSION,
  RELEASE_SCENARIOS,
  FIELD_OUTCOMES,
  CELL_FIELDS,
  cellKey,
  buildRequiredCells,
}

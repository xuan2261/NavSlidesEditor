const { EXISTING_GAME_PRESETS } = require('./existing-games.js')
const { LEARNING_GAME_PRESETS } = require('./learning-games.js')
const { UTILITY_WORD_GAME_PRESETS } = require('./utility-word-games.js')
const { SIMULATION_PRESETS } = require('./simulations.js')
const { clonePresetElements } = require('./clone.js')
const { freezePreset } = require('./preset-factory.js')
const EDUCATION_PRESETS = freezePreset([
  ...EXISTING_GAME_PRESETS,
  ...LEARNING_GAME_PRESETS,
  ...UTILITY_WORD_GAME_PRESETS,
  ...SIMULATION_PRESETS,
])
const PRESET_CATEGORIES = freezePreset([
  { id: 'classroom', labels: { vi: 'Hoạt động lớp học', en: 'Classroom' } },
  { id: 'learning', labels: { vi: 'Học tập và ôn luyện', en: 'Learning' } },
  { id: 'utilities', labels: { vi: 'Công cụ lớp học', en: 'Utilities' } },
  { id: 'words', labels: { vi: 'Từ vựng', en: 'Word games' } },
  { id: 'simulations', labels: { vi: 'Mô phỏng', en: 'Simulations' } },
])
function searchText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
}
function listEducationPresets({ search = '', category = '', locale = 'vi' } = {}) {
  if (typeof search !== 'string' || typeof category !== 'string' || !['vi', 'en'].includes(locale))
    throw new Error('Preset search requires text, a category ID and locale vi/en.')
  const query = searchText(search.trim())
  return EDUCATION_PRESETS.filter(
    (preset) =>
      (!category || category === 'all' || preset.category === category) &&
      (!query ||
        searchText(
          [
            preset.labels[locale],
            preset.labels.vi,
            preset.labels.en,
            preset.id,
            ...preset.tags,
          ].join(' ')
        ).includes(query))
  )
}
function getEducationPreset(id) {
  return EDUCATION_PRESETS.find((preset) => preset.id === id) || null
}
function cloneEducationPreset(presetOrId, options) {
  const preset = typeof presetOrId === 'string' ? getEducationPreset(presetOrId) : presetOrId
  if (!preset) throw new Error(`Unknown education preset: ${String(presetOrId)}`)
  return clonePresetElements(preset, options)
}
module.exports = {
  EDUCATION_PRESETS,
  PRESET_CATEGORIES,
  listEducationPresets,
  getEducationPreset,
  cloneEducationPreset,
}

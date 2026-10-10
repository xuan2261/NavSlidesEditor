export const CONFIGURED_KEY = '***configured***'
export const DEFAULT_SETTINGS = {
  ai: { provider: 'openai', apiKey: '', model: 'gpt-4o-mini', customEndpoint: '', customModel: '' },
  defaultTheme: 'black', defaultTransition: 'slide',
}
export const editableSettings = (data) => ({
  defaultTheme: data.defaultTheme ?? DEFAULT_SETTINGS.defaultTheme,
  defaultTransition: data.defaultTransition ?? DEFAULT_SETTINGS.defaultTransition,
  ai: { ...DEFAULT_SETTINGS.ai, ...(data.ai || {}) },
})
export const settingsFields = ['defaultTheme', 'defaultTransition', ...Object.keys(DEFAULT_SETTINGS.ai).map(k => `ai.${k}`)]
export const fieldValue = (data, field) => field.startsWith('ai.') ? data.ai[field.slice(3)] : data[field]
export const setField = (data, field, value) => field.startsWith('ai.')
  ? { ...data, ai: { ...data.ai, [field.slice(3)]: value } } : { ...data, [field]: value }
export const keyIntent = (draft, baseline) => draft.ai.apiKey === baseline.ai.apiKey || draft.ai.apiKey === CONFIGURED_KEY
  ? 'unchanged' : draft.ai.apiKey === '' ? 'clear' : 'replace'
export const settingsDirty = (draft, baseline) => settingsFields.some(field => fieldValue(draft, field) !== fieldValue(baseline, field))
export function acceptedDraft(current, submitted, accepted) {
  return settingsFields.reduce((draft, field) => fieldValue(current, field) === fieldValue(submitted, field)
    ? setField(draft, field, fieldValue(accepted, field)) : draft, current)
}
export function conflictFields(draft, baseline, remote) {
  return settingsFields.filter(field => field === 'ai.apiKey'
    ? keyIntent(draft, baseline) !== 'unchanged'
    : fieldValue(draft, field) !== fieldValue(baseline, field)
      && fieldValue(remote, field) !== fieldValue(baseline, field)
      && fieldValue(draft, field) !== fieldValue(remote, field))
}
export function rebasedDraft(draft, baseline, remote, choices) {
  return settingsFields.reduce((result, field) => {
    const locallyChanged = field === 'ai.apiKey' ? keyIntent(draft, baseline) !== 'unchanged'
      : fieldValue(draft, field) !== fieldValue(baseline, field)
    return locallyChanged && choices[field] !== 'server' ? setField(result, field, fieldValue(draft, field)) : result
  }, remote)
}

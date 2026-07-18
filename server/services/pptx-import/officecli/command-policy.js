const COMMAND_CLASSIFICATIONS = Object.freeze({
  get: 'permitted-read',
  query: 'permitted-read',
  dump: 'permitted-read',
  raw: 'permitted-read',
  view: 'permitted-read',
  validate: 'permitted-validation',
  'raw-set': 'permitted-domain-mutation',
  'add-part': 'permitted-domain-mutation',
  batch: 'internal-only-escape-hatch',
})

const DEFAULT_ALLOWED = new Set(['permitted-read', 'permitted-validation'])

function classifyCommand(command) {
  if (typeof command !== 'string') return 'prohibited'
  return COMMAND_CLASSIFICATIONS[command.toLowerCase()] || 'prohibited'
}

function isCommandAllowed(command, enabledClasses = DEFAULT_ALLOWED) {
  return enabledClasses.has(classifyCommand(command))
}

module.exports = { COMMAND_CLASSIFICATIONS, classifyCommand, isCommandAllowed }

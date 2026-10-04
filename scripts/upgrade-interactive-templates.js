#!/usr/bin/env node
const { migrateSimulationTemplates } = require('../shared/src/education/presets/simulations.js')
const { runTemplatePublication } = require('./template-preset-publication.js')

// Exact six-ID annotation preserves the complete audited physics and extra lessons.
// No title matching, random replacement slides, user storage scan or runtime fetch.
if (require.main === module) runTemplatePublication(migrateSimulationTemplates)
module.exports = { migrateSimulationTemplates }

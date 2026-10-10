#!/usr/bin/env node
const {
  migrateKnownQuizTemplates,
} = require('../shared/src/education/presets/known-quiz-migration.js')
const { runTemplatePublication } = require('./template-preset-publication.js')

// Migrate only the five audited quiz IDs. All sim/viz and other lessons are retained.
// Default input is ../server/data/built-in-templates.json, never scripts/server/data.
if (require.main === module) runTemplatePublication(migrateKnownQuizTemplates)
module.exports = { migrateKnownQuizTemplates }

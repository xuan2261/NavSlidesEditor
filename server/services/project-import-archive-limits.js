const PROJECT_IMPORT_LIMITS = Object.freeze({
  maxCompressedBytes: 100 * 1024 * 1024,
  maxEntries: 10_000,
  maxPathLength: 240,
  maxNesting: 3,
  maxDeclaredBytes: 250 * 1024 * 1024,
  maxExpandedBytes: 250 * 1024 * 1024,
  maxEntryBytes: 100 * 1024 * 1024,
  maxCompressionRatio: 100,
  maxJsonBytes: 25 * 1024 * 1024,
  maxStringBytes: 1024 * 1024,
  maxSlides: 1000,
  maxElements: 50_000,
  maxMedia: 1000,
})

module.exports = { PROJECT_IMPORT_LIMITS }

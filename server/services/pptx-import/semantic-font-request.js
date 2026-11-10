const { createHash } = require('node:crypto')
const { collectSemanticFontRequests } = require('../../../shared/src/pptx-source-font-request')
const semanticFontSourceIdentity = (semantic) => createHash('sha256')
  .update(collectSemanticFontRequests(semantic).identity).digest('hex')

module.exports = { semanticFontSourceIdentity, collectSemanticFontRequests }

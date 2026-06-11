// Client-facing PPTX element rasterization (POST /api/presentations/raster-elements).
//
// This used to be a second, weaker headless engine (limited type set, no cache,
// no per-element try/catch, naive startsWith origin check, vendor-route network
// leak when baseUrl was absent). It now forwards to the resilient engine in
// server-raster.js so both the strict export path and the interactive client
// export path share one implementation:
//   - per-element try/catch (one failing element never aborts the batch)
//   - proper same-origin comparison (URL.origin, not startsWith)
//   - vendor route blocks external requests by default even when baseUrl is absent
//   - per-call cache (no cross-export race)
const { getServerRasters } = require('../utils/server-raster')

async function rasterizeComplexElements(sourcePresentation, { baseUrl = '' } = {}) {
  return getServerRasters(sourcePresentation, { baseUrl })
}

module.exports = {
  rasterizeComplexElements,
}

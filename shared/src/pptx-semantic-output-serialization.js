const { normalizePptxSemanticDocument } = require('./pptx-semantic-document')
const { validateSemanticOutputResources } = require('./pptx-semantic-output-resources')
const { PORTABLE_LIMITS } = require('./education/portable-resource-contract')
const { SEMANTIC_OUTPUT_ASSET_PATHS } = require('./reveal-runtime-assets')

// Serialized before the vendor script loads, so even a missing runtime rejects
// a discoverable handle rather than leaving the consumer waiting for Reveal.
function createPendingSemanticOutput(win) {
  let resolve, reject
  const handle = {
    state: 'loading', issues: [],
    ready: new Promise((yes, no) => { resolve = yes; reject = no }),
    dispose() { handle.state = 'disposed'; reject(new Error('Semantic output disposed')) },
  }
  handle.ready.catch(() => {})
  win.__navslidesSemanticOutput = handle
  return { handle, resolve, reject }
}
function semanticOutputBootstrap(semantic, resources, mounts, slides) {
  if (!semantic) return ''
  const navigation = (items) => items.map((slide) => ({ id: slide.id,
    ...(slide.children ? { children: navigation(slide.children) } : {}),
  }))
  const payload = {
    semantic: normalizePptxSemanticDocument(semantic),
    resources: resources == null ? null : validateSemanticOutputResources(resources),
    mounts,
    ...(slides ? { slides: navigation(slides) } : {}),
  }
  const json = JSON.stringify(payload).replace(/</g, '\\u003c')
  if (new TextEncoder().encode(json).byteLength > PORTABLE_LIMITS.maxTotalBytes)
    throw new TypeError('Semantic output document byte budget exceeded')
  return `<script type="application/json" data-navslides-semantic-payload>${json}</script>
  <script data-navslides-runtime="local">var semanticPending = (${createPendingSemanticOutput.toString()})(window);</script>
  <script src="${SEMANTIC_OUTPUT_ASSET_PATHS.runtimeJs}"></script>
  <script data-navslides-runtime="local">
    try {
      NavSlidesSemanticOutput.startSemanticOutput(document,
        JSON.parse(document.querySelector('[data-navslides-semantic-payload]').textContent), semanticPending);
    } catch (error) {
      semanticPending.handle.state = 'error';
      semanticPending.handle.issues = [{code:'semantic-output-bootstrap',message:error.message}];
      window.__navslidesExportError = {code:'semantic-output-bootstrap',issues:semanticPending.handle.issues};
      window.__navslidesExportReady = false;
      document.querySelectorAll('[data-pptx-semantic-mount]').forEach(function(node) {
        node.textContent = 'Canonical output runtime unavailable'; node.setAttribute('role','alert');
      });
      semanticPending.reject(error);
    }
  </script>`
}
function boundSemanticOutputHTML(html, semantic) {
  if (semantic && new TextEncoder().encode(html).byteLength > PORTABLE_LIMITS.maxTotalBytes)
    throw new TypeError('Semantic output document byte budget exceeded')
  return html
}
module.exports = { semanticOutputBootstrap, boundSemanticOutputHTML }

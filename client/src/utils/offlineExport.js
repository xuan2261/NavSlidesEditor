import { generatePortableDocument } from './portable-document-rewriter.js'
/**
 * Close a generated or authored HTML document before any download is saved.
 * options.baseUrl resolves relative document assets; options.htmlDependencies is
 * the explicit authored offline declaration. generatedDocument:true is reserved
 * for known generator callers and recognizes root data-navslides-runtime="local"
 * compiler scripts only; nested authored documents never inherit that authority.
 * options.limits overrides bounded byte/depth/resource limits. options.fetch can
 * supply the transport adapter. All unresolved resources reject, never fall back.
 */
export async function generateOfflineHTML(html, options = {}) {
  return (await generatePortableDocument(html, options)).html
}

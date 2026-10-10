import {
  collectNativeGameConfigMediaReferences,
  rewriteNativeGameConfigMediaUrls,
} from 'revealjs-shared/src/education/game-media-references.js'
import { serializeEducationConfig } from 'revealjs-shared/src/education/config-serialization.js'
import { validateGameConfig } from 'revealjs-shared/src/education/game-schema.js'
export async function closeNativeConfig(script, base, graph, context) {
  let config
  try {
    config = JSON.parse(script.textContent)
  } catch (error) {
    throw graph.error('parse', base, context, `Invalid native game config: ${error.message}`)
  }
  const root =
    script.closest('[data-ns-game-type]') ||
    script.previousElementSibling?.closest('[data-ns-game-type]') ||
    script.parentElement?.querySelector('[data-ns-game-type]')
  const type = root?.getAttribute('data-ns-game-type') || script.getAttribute('data-game-type')
  if (!type) throw graph.error('parse', base, context, 'Native config is missing its game subtype')
  const urlMap = new Map()
  const validation = validateGameConfig(type, config)
  if (!validation.isValid)
    throw graph.error(
      'parse',
      base,
      context,
      validation.errors.map((error) => `${error.path.join('.')}: ${error.message}`).join('; ')
    )
  for (const ref of collectNativeGameConfigMediaReferences(type, config)) {
    urlMap.set(
      ref.url,
      await graph.embed(ref.url, 'image', base, {
        ...context,
        chain: [...(context.chain || []), `native:${type}:${ref.path.join('.')}`],
      })
    )
  }
  script.textContent = serializeEducationConfig(
    rewriteNativeGameConfigMediaUrls(type, config, urlMap)
  )
}
export function assertNoLiveAuthority(document, graph, context) {
  if (
    document.querySelector(
      '[data-ns-live-bootstrap],[data-live-bootstrap],[data-host-capability],[data-ns-host-capability],[data-ns-education-view="audience"]'
    )
  ) {
    throw graph.error(
      'authority',
      graph.baseUrl,
      context,
      'Live/audience content cannot become local gameplay by removing its bootstrap'
    )
  }
  for (const script of document.querySelectorAll('script')) {
    if (
      /\b(?:hostCapability|hostToken|hostSessionToken)\b/.test(script.textContent) &&
      !script.hasAttribute('data-navslides-runtime')
    ) {
      throw graph.error(
        'authority',
        graph.baseUrl,
        context,
        'Host authority found in generated input'
      )
    }
  }
}

const PROVIDERS = {
  phet: {
    label: 'PhET',
    origins: ['https://phet.colorado.edu'],
    fromId: (id) =>
      `https://phet.colorado.edu/sims/html/${encodeURIComponent(id)}/latest/${encodeURIComponent(id)}_en.html`,
  },
  geogebra: {
    label: 'GeoGebra',
    origins: ['https://www.geogebra.org', 'https://geogebra.org'],
    fromId: (id) => `https://www.geogebra.org/material/iframe/id/${encodeURIComponent(id)}`,
  },
  desmos: {
    label: 'Desmos',
    origins: ['https://www.desmos.com', 'https://desmos.com'],
    fromId: (id) => `https://www.desmos.com/calculator/${encodeURIComponent(id)}`,
  },
  circuitjs: {
    label: 'CircuitJS / Falstad',
    origins: ['https://www.falstad.com', 'https://falstad.com'],
    fromId: (id) => `https://www.falstad.com/circuit/circuitjs.html?ctz=${encodeURIComponent(id)}`,
  },
}

export const STEM_SIMULATION_PROVIDERS = Object.entries(PROVIDERS).map(([id, provider]) => ({
  id,
  label: provider.label,
}))

function normalizeProvider(provider) {
  const key = String(provider || '')
    .trim()
    .toLowerCase()
  if (!PROVIDERS[key]) throw new Error('Choose a supported STEM provider.')
  return key
}

function toUrl(provider, input) {
  const raw = String(input || '').trim()
  if (!raw) throw new Error('Enter a simulation URL or ID.')
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) return new URL(PROVIDERS[provider].fromId(raw))
  const parsed = new URL(raw)
  if (parsed.protocol !== 'https:') throw new Error('STEM simulation URLs must use HTTPS.')
  return parsed
}

export function buildStemSimulationEmbed(providerInput, sourceInput) {
  const provider = normalizeProvider(providerInput)
  const sourceUrl = toUrl(provider, sourceInput)
  const allowed = PROVIDERS[provider].origins.includes(sourceUrl.origin)
  if (!allowed) throw new Error('This URL is not allowed for the selected STEM provider.')

  const label = PROVIDERS[provider].label
  const src = sourceUrl.toString()
  const content = `<iframe src="${src}" title="${label} simulation" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" allow="fullscreen; clipboard-read; clipboard-write" referrerpolicy="no-referrer" loading="lazy" style="width:100%;height:100%;border:0;background:#fff;"></iframe>`

  return {
    type: 'html',
    embedKind: 'stem-simulation',
    provider,
    sourceUrl: src,
    content,
    width: 560,
    height: 360,
  }
}

const TECHNICAL_SYMBOL_PACKS = [
  {
    id: 'uml',
    label: 'UML',
    symbols: [
      {
        id: 'uml-class',
        label: 'Class',
        elementType: 'svg',
        overrides: {
          content:
            '<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="108" height="78" rx="4" fill="#1e293b" stroke="#93c5fd" stroke-width="3"/><line x1="6" y1="30" x2="114" y2="30" stroke="#93c5fd" stroke-width="2"/><line x1="6" y1="56" x2="114" y2="56" stroke="#93c5fd" stroke-width="2"/><text x="60" y="23" text-anchor="middle" fill="#e0f2fe" font-size="14" font-family="sans-serif">Class</text></svg>',
        },
      },
      { id: 'uml-decision', label: 'Decision', elementType: 'shape', overrides: { shape: 'diamond' } },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    symbols: [
      { id: 'network-router', label: 'Router', elementType: 'icon', overrides: { iconName: 'Router' } },
      { id: 'network-wifi', label: 'Wi-Fi', elementType: 'icon', overrides: { iconName: 'Wifi' } },
    ],
  },
  {
    id: 'circuit',
    label: 'Circuit',
    symbols: [
      {
        id: 'circuit-resistor',
        label: 'Resistor',
        elementType: 'svg',
        overrides: {
          content:
            '<svg viewBox="0 0 140 40" xmlns="http://www.w3.org/2000/svg"><path d="M4 20h24l8-12 16 24 16-24 16 24 16-24 8 12h32" fill="none" stroke="#fbbf24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        },
      },
      { id: 'circuit-battery', label: 'Battery', elementType: 'icon', overrides: { iconName: 'BatteryCharging' } },
    ],
  },
  {
    id: 'cloud',
    label: 'Cloud',
    symbols: [
      { id: 'cloud-service', label: 'Cloud', elementType: 'shape', overrides: { shape: 'cloud' } },
      { id: 'cloud-database', label: 'Database', elementType: 'icon', overrides: { iconName: 'Database' } },
    ],
  },
]

export const TECHNICAL_SYMBOL_PACK_LABELS = TECHNICAL_SYMBOL_PACKS.map((pack) => pack.label)

export function getTechnicalSymbolPacks() {
  return TECHNICAL_SYMBOL_PACKS
}

export function findTechnicalSymbol(symbolId) {
  return TECHNICAL_SYMBOL_PACKS.flatMap((pack) => pack.symbols).find(
    (symbol) => symbol.id === symbolId
  )
}

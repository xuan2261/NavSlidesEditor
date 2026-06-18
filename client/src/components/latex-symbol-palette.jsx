import { LATEX_SNIPPETS, LATEX_SYMBOLS } from '../data/latex-snippets'

function PaletteButton({ item, type, onInsert }) {
  return (
    <button
      type="button"
      className="px-2 py-1 rounded-md border border-border bg-secondary text-xs hover:bg-accent"
      data-testid={`latex-${type}-${item.id}`}
      onClick={() => onInsert(item.value)}
      title={item.value}
    >
      {item.label}
    </button>
  )
}

export default function LatexSymbolPalette({ onInsert }) {
  return (
    <div className="w-[220px] border-r border-border bg-card/80 p-3 overflow-auto space-y-4">
      <section>
        <h3 className="text-xs font-semibold mb-2">Symbols</h3>
        <div className="flex flex-wrap gap-2">
          {LATEX_SYMBOLS.map((item) => (
            <PaletteButton key={item.id} item={item} type="symbol" onInsert={onInsert} />
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-xs font-semibold mb-2">Templates</h3>
        <div className="flex flex-col gap-2">
          {LATEX_SNIPPETS.map((item) => (
            <PaletteButton key={item.id} item={item} type="snippet" onInsert={onInsert} />
          ))}
        </div>
      </section>
    </div>
  )
}

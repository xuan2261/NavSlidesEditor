const fs = require('fs')
const file = 'client/src/components/SlidePanel.jsx'
let content = fs.readFileSync(file, 'utf8')

// slide-item
content = content.replace(
  /className=\{\`slide-item \$\{/g,
  'className={`group rounded-sm border-2 cursor-pointer relative transition-all hover:border-border-strong ${'
)
content = content.replace(/\? 'active' : ''\}/g, "? 'border-accent' : 'border-transparent'}")
content = content.replace(
  /\? 'multi-selected' : ''\}/g,
  "? 'outline outline-2 outline-accent outline-offset-[-2px]' : ''}"
)

// slide-number
content = content.replace(
  /className=\"slide-number\"/g,
  'className=\"absolute top-1 left-1 text-[10px] text-white/50 bg-black/40 px-1 py-[1px] rounded-[3px] z-10\"'
)

// slide-actions
content = content.replace(
  /className=\"slide-actions\"/g,
  'className=\"absolute top-1 right-1 flex gap-0.5 opacity-0 transition-opacity z-10 group-hover:opacity-100\"'
)

// slide-action-btn
content = content.replace(
  /className=\"slide-action-btn\"/g,
  'className=\"bg-black/60 border-none text-white p-[3px] rounded-[3px] cursor-pointer flex items-center justify-center hover:bg-accent/80\"'
)

// slide-thumbnail
content = content.replace(
  /className=\"slide-thumbnail\"/g,
  'className=\"aspect-video flex items-start p-1.5 overflow-hidden bg-bg-canvas-default relative\"'
)

// slide-thumbnail-text
content = content.replace(
  /className=\"slide-thumbnail-text\"/g,
  'className=\"text-[5px] leading-[1.3] text-[#1a1a2e] w-full max-h-full overflow-hidden\"'
)

// slide-panel-batch-footer
content = content.replace(
  /className=\"slide-panel-batch-footer\"/g,
  'className=\"flex items-center gap-2 py-1.5 px-3 border-t border-border bg-bg-surface text-xs text-muted\"'
)

// add-slide-btn
content = content.replace(
  /className=\"add-slide-btn\"/g,
  'className=\"w-full flex items-center justify-center gap-1.5 p-2 rounded-sm border border-dashed border-border text-muted text-xs transition-all cursor-pointer bg-transparent hover:border-accent hover:text-accent hover:bg-primary-light\"'
)
content = content.replace(
  /className=\"add-slide-btn w-full flex items-center justify-center gap-2\"/g,
  'className=\"w-full flex items-center justify-center gap-1.5 p-2 rounded-sm border border-dashed border-border text-muted text-xs transition-all cursor-pointer bg-transparent hover:border-accent hover:text-accent hover:bg-primary-light\"'
)

fs.writeFileSync(file, content)
console.log('SlidePanel replacement complete.')

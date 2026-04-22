const fs = require('fs')
const path = require('path')

const dir = 'client/src/components/properties'
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.jsx'))
  .map((f) => path.join(dir, f))

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')

  content = content.replace(
    /className=\"prop-row\"/g,
    'className=\"flex items-center justify-between mb-2.5\"'
  )
  content = content.replace(/<label>/g, '<label className=\"text-xs text-secondary\">')
  content = content.replace(/<label /g, '<label className=\"text-xs text-secondary\" ')
  content = content.replace(
    /className=\"color-row\"/g,
    'className=\"flex items-center gap-2 mb-2.5\"'
  )
  content = content.replace(
    /className=\"color-swatch-row\"/g,
    'className=\"flex flex-wrap gap-1.5 mb-2.5\"'
  )

  content = content.replace(/className=\{\`color-swatch \$\{[^\}]+\}\`/g, (match) => {
    return match.replace(
      'color-swatch',
      'w-6 h-6 rounded cursor-pointer border-2 transition-all hover:border-white hover:scale-110'
    )
  })

  content = content.replace(/className=\"layout-btns\"/g, 'className=\"flex gap-1\"')

  content = content.replace(/className=\{\`layout-btn \$\{[^\}]+\}\`/g, (match) => {
    return match.replace(
      'layout-btn',
      'flex-1 p-1.5 border rounded text-[10px] text-center cursor-pointer transition-all hover:border-border-strong hover:text-primary'
    )
  })

  content = content.replace(
    /\? 'active' : ''/g,
    "? 'border-accent bg-primary-light text-accent-light' : 'bg-card border-border text-muted'"
  )

  content = content.replace(
    /className=\"prop-input\"/g,
    'className=\"w-full bg-card border border-border text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-muted\"'
  )

  if (content.includes('className="w-full bg-card')) {
    if (!content.includes('import { Input')) {
      content = content.replace(
        /<input\s+className=\"w-full bg-card/g,
        '<Input className=\"w-full bg-card'
      )
      content = content.replace(
        /<select\s+className=\"w-full bg-card/g,
        '<Select className=\"w-full bg-card'
      )
      content = content.replace(/<\/select>/g, '</Select>')

      if (content.includes('<Input') || content.includes('<Select')) {
        content = "import { Input, Select } from '../../components/ui';\n" + content
      }
    }
  }

  content = content.replace(
    /<input\s+type=\"color\"/g,
    '<input type=\"color\" className=\"w-9 h-7 border border-border rounded cursor-pointer p-[1px] bg-card shrink-0\"'
  )
  content = content.replace(
    /<input\s+type=\"range\"/g,
    '<input type=\"range\" className=\"flex-1 accent-accent\"'
  )

  fs.writeFileSync(file, content)
}
console.log('Processed properties components.')

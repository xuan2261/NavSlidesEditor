const fs = require('fs')
const file = 'client/src/components/PropertiesPanel.jsx'
let content = fs.readFileSync(file, 'utf8')

content = content.replace(
  /className=\"properties-panel tour-step-properties\"/g,
  'className=\"w-60 shrink-0 bg-panel border-l border-border overflow-y-auto flex flex-col tour-step-properties\"'
)
content = content.replace(
  /<div className=\"prop-section\">\r?\n\s*<p style={{ color: 'var\\(--text-muted\\)', fontSize: 12 }}>No slide selected<\/p>\r?\n\s*<\/div>/g,
  '<div className=\"p-4 border-b border-border\">\n          <p className=\"text-xs text-muted\">No slide selected</p>\n        </div>'
)
content = content.replace(
  /<div className=\"prop-section\">\r?\n\s*<h3>Element<\/h3>/g,
  '<div className=\"p-4 border-b border-border\">\n          <h3 className=\"text-[11px] font-semibold text-muted uppercase tracking-[0.06em] mb-3\">Element</h3>'
)
content = content.replace(
  /<input\r?\n\s*className=\"prop-input\" type=\"number\" min=\"0\" step=\"1\"/g,
  '<Input\n                type=\"number\" min=\"0\" step=\"1\"'
)
content = content.replace(/<select\r?\n\s*className=\"prop-input\"/g, '<Select')
content = content.replace(/<\/select>/g, '</Select>')
content = content.replace(
  /className=\"notes-textarea\"/g,
  'className=\"w-full bg-card border border-border text-primary px-2.5 py-2 rounded-sm text-xs resize-y min-h-[80px] focus:outline-none focus:border-accent placeholder:text-muted\"'
)
content = content.replace(
  /<input\r?\n\s*className=\"prop-input\"\r?\n\s*type=\"text\"/g,
  '<Input\n          type=\"text\"'
)
content = content.replace(
  /className={\`bg-type-tab \$\{\(presentation\.footerMode \|\| 'basic'\) === mode \? 'active' : ''}\`}/g,
  "className={`flex-1 py-1 px-1 rounded text-[11px] text-center cursor-pointer border-none transition-all ${(presentation.footerMode || 'basic') === mode ? 'bg-accent text-white' : 'text-muted bg-transparent'}`}"
)
content = content.replace(
  /<input\r?\n\s*className=\"prop-input\" type=\"text\" value=\{sec\}/g,
  '<Input\n                type=\"text\" value={sec}'
)
content = content.replace(
  /<input\r?\n\s*className=\"prop-input\" type=\"number\" min=\"8\"/g,
  '<Input\n            type=\"number\" min=\"8\"'
)

fs.writeFileSync(file, content)
console.log('Replacements complete')

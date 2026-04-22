const fs = require('fs')
const path = require('path')

const files = ['client/src/components/Toolbar.jsx']

files.forEach((file) => {
  const filePath = path.join(__dirname, file)
  let content = fs.readFileSync(filePath, 'utf8')

  // Regex using non-greedy match to handle nested curly braces
  content = content.replace(
    /className={`btn-icon \$\{([\s\S]+?)\s*\?\s*'active'\s*:\s*''\}`}/g,
    "className={$1 ? 'bg-primary-light text-accent' : ''}"
  )

  fs.writeFileSync(filePath, content)
  console.log(`Updated ${file}`)
})

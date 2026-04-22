const fs = require('fs')
const path = require('path')

const cssMap = {
  // HomePage classes
  'home-page': 'h-full flex flex-col bg-bg-primary',
  'home-header':
    'flex items-center justify-between px-6 h-14 border-b border-border bg-bg-secondary shrink-0',
  'home-header-left': 'flex items-center gap-4',
  'home-logo': 'flex items-center gap-2 text-[17px] font-bold text-text-primary tracking-tight',
  'home-logo-icon':
    'w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-extrabold text-sm',
  'home-search': 'relative flex-[0_1_360px]',
  'home-search-input':
    'w-full bg-bg-hover border border-border text-text-primary py-2 pr-3 pl-9 rounded-md text-[13px] transition-colors focus:outline-none focus:border-accent focus:bg-bg-card placeholder:text-text-muted',
  'home-search-icon':
    'absolute left-[11px] top-1/2 -translate-y-1/2 text-text-muted pointer-events-none',
  'home-header-actions': 'flex items-center gap-2',
  'home-body': 'flex-1 flex overflow-hidden',
  'home-sidebar':
    'w-[var(--sidebar-width)] shrink-0 bg-bg-secondary border-r border-border flex flex-col overflow-y-auto py-3',
  'sidebar-section': 'px-3 mb-2',
  'sidebar-section-title':
    'text-[10px] font-semibold uppercase tracking-wider text-text-muted px-3 pt-2 pb-1.5',
  'sidebar-item':
    'flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-bg-hover hover:text-text-primary',
  'sidebar-item-count':
    'ml-auto text-[11px] text-text-muted bg-bg-hover px-[7px] py-[1px] rounded-[10px]',
  'sidebar-divider': 'h-px bg-border my-2 mx-3',
  'home-content': 'flex-1 overflow-y-auto pt-7 px-8 pb-7',
  'home-content-header': 'flex items-center justify-between mb-5',
  'home-content-title': 'text-lg font-bold text-text-primary',
  'home-content-controls': 'flex items-center gap-2',
  'sort-select':
    'bg-bg-card border border-border text-text-secondary py-1.5 px-2.5 rounded text-xs cursor-pointer focus:outline-none focus:border-accent',
  'view-toggle': 'flex bg-bg-card border border-border rounded overflow-hidden',
  'view-toggle-btn':
    'px-2.5 py-1.5 text-text-muted border-none bg-transparent cursor-pointer transition-colors hover:text-text-primary',
  'presentations-grid': 'grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5',
  'presentation-card':
    'group bg-bg-card border border-border rounded-lg overflow-hidden cursor-pointer transition-all hover:border-border-strong hover:-translate-y-[3px] hover:shadow-lg',
  'card-preview':
    'aspect-video flex items-center justify-center bg-surface-2 relative overflow-hidden text-[32px] text-text-muted',
  'card-info': 'px-4 py-3',
  'card-actions':
    'flex justify-end gap-1 px-3 py-2 border-t border-border opacity-0 transition-opacity group-hover:opacity-100',
  'new-card':
    'border-2 border-dashed border-border-light flex flex-col items-center justify-center gap-3 min-h-[200px] text-text-muted cursor-pointer transition-all rounded-lg hover:border-accent hover:text-accent hover:bg-primary-light',
  'presentations-list': 'flex flex-col gap-0.5',
  'presentation-list-item':
    'group flex items-center gap-4 px-4 py-3 rounded cursor-pointer transition-colors hover:bg-bg-hover',
  'list-item-preview': 'w-20 h-[45px] rounded flex-shrink-0 overflow-hidden',
  'list-item-info': 'flex-1 min-w-0',
  'list-item-actions': 'flex gap-1 opacity-0 transition-opacity group-hover:opacity-100',
  'empty-state': 'col-span-full text-center py-20 px-5 text-text-muted',
  'empty-state-title': 'text-[17px] font-semibold text-text-secondary mb-2',
  'empty-state-desc': 'text-sm text-text-muted mb-6',
  'welcome-screen': 'flex flex-col items-center justify-center py-20 px-10 text-center',
  'welcome-icon':
    'w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-white mb-6 text-[28px]',
  'welcome-title': 'text-2xl font-bold mb-2 tracking-tight',
  'welcome-subtitle': 'text-[15px] text-text-secondary mb-8 max-w-[420px]',
  'welcome-actions': 'flex gap-3 flex-wrap justify-center',
  'welcome-action-btn':
    'flex items-center gap-2.5 px-5 py-3.5 bg-bg-card border border-border-light rounded-md text-text-primary text-sm font-medium cursor-pointer transition-all hover:bg-bg-hover hover:border-accent hover:shadow-md hover:-translate-y-[1px]',
  'welcome-features': 'mt-10 text-[13px] text-text-muted',
  'template-gallery-header': 'flex items-center justify-between mb-4',
  'template-categories': 'flex flex-wrap gap-1.5 mb-5',
  'template-category-btn':
    'px-3.5 py-1.5 rounded-full text-xs font-medium bg-bg-card border border-border text-text-secondary cursor-pointer transition-all hover:border-border-strong hover:text-text-primary',

  // EditorPage classes
  'editor-page': 'h-full flex flex-col overflow-hidden',
  'editor-header':
    'flex items-center gap-y-2 gap-x-3 px-4 py-1.5 min-h-[44px] bg-bg-secondary border-b border-border shrink-0 flex-wrap',
  'title-input':
    'flex-1 max-w-[200px] bg-transparent border border-transparent text-text-primary text-sm font-semibold px-2 py-1 rounded transition-colors hover:border-border focus:outline-none focus:border-accent focus:bg-bg-card',
  'header-controls': 'flex items-center gap-1 ml-auto flex-wrap shrink min-w-0',
  'save-indicator': 'text-xs text-text-muted',
  'select-sm':
    'bg-bg-card border border-border text-text-primary px-2 py-1 rounded text-[13px] cursor-pointer focus:outline-none focus:border-accent',
  'editor-menu-bar': 'flex items-center gap-0.5 ml-auto shrink-0',
  'menu-bar-divider': 'w-px h-5 bg-border mx-1.5',
  'dropdown-menu-wrapper': 'relative',
  'menu-trigger':
    'px-2.5 py-1 text-[13px] font-medium text-text-secondary bg-transparent border-none rounded cursor-pointer transition-all whitespace-nowrap flex items-center gap-0.5 hover:bg-bg-hover hover:text-text-primary',
  'dropdown-panel':
    'absolute top-full left-0 mt-1 min-w-[220px] max-h-[480px] overflow-y-auto bg-bg-card border border-border-strong rounded-md p-1 shadow-lg z-[1000]',
  'dropdown-item':
    'flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-text-primary rounded cursor-pointer border-none bg-transparent w-full text-left transition-colors hover:bg-bg-hover disabled:opacity-40 disabled:cursor-default',
  'dropdown-separator': 'h-px bg-border my-1 mx-0',
  'dropdown-checkbox': 'cursor-pointer text-[13px]',
  'dropdown-select-row': 'justify-between cursor-default',
  'dropdown-custom': 'p-0',
  'insert-menu': 'relative',
  'insert-trigger':
    'flex items-center gap-1.5 px-3 py-1 text-[13px] font-semibold text-accent bg-primary-light border border-indigo-500/25 rounded cursor-pointer transition-all hover:bg-accent hover:text-white hover:border-accent',
  'insert-dropdown':
    'absolute top-[calc(100%+4px)] left-0 w-[240px] max-h-[520px] overflow-y-auto bg-bg-card border border-border-strong rounded-md p-1 shadow-lg z-[1000]',
  'insert-category':
    'text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 pt-2 pb-1',
  'insert-separator': 'h-px bg-border my-1 mx-0',
  'insert-item':
    'flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-text-primary rounded cursor-pointer bg-transparent border-none w-full text-left transition-colors hover:bg-bg-hover',
  'insert-sub-panel': 'my-1 ml-3 p-2 bg-bg-hover rounded border border-border',
  'shape-picker-grid': 'grid grid-cols-4 gap-1',
  'shape-pick-btn':
    'px-1 py-1 bg-bg-card border border-border rounded cursor-pointer text-base text-text-primary flex flex-col items-center gap-0.5 transition-colors hover:bg-accent hover:text-white',
  'icon-picker-panel': 'max-h-[220px] overflow-y-auto',
  'icon-search-input':
    'w-full px-2 py-1 bg-bg-card border border-border text-text-primary rounded text-xs mb-1.5 box-border',
  'icon-grid': 'grid grid-cols-5 gap-1',
  'icon-pick-btn':
    'p-1 bg-bg-card border border-border rounded cursor-pointer text-[10px] text-text-primary text-center transition-colors flex items-center justify-center aspect-square hover:bg-accent hover:text-white',
  'icon-show-more':
    'block w-full mt-1 p-1 bg-bg-card border border-border rounded cursor-pointer text-[11px] text-accent text-center hover:bg-accent hover:text-white',
  'table-size-picker': 'pt-1 px-0 pb-0',
  'table-size-label': 'text-center text-[11px] text-text-secondary mb-1.5 font-medium',
  'table-size-grid': 'grid grid-cols-[repeat(8,18px)] gap-0.5',
  'table-cell':
    'w-[18px] h-[18px] border border-border-strong rounded-sm cursor-pointer transition-all duration-75 hover:border-accent',
  'slide-context-overlay': 'fixed inset-0 z-[10000]',
  'slide-context-menu':
    'fixed bg-bg-card border border-border-strong rounded p-1 min-w-[180px] shadow-lg z-[10001]',
  'context-separator': 'h-px bg-border my-1 mx-0',
  'popover-overlay': 'fixed inset-0 z-[999]',
  'prompt-popover':
    'absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 min-w-[260px] bg-bg-card border border-border-strong rounded-md p-3 shadow-lg z-[1000]',
  'prompt-popover-title': 'text-xs font-semibold text-text-secondary mb-2',
  'prompt-popover-actions': 'flex justify-end gap-1.5 mt-2',
  'editor-body': 'flex-1 flex overflow-hidden',
  'back-btn':
    'flex items-center gap-1.5 text-text-secondary text-[13px] px-2.5 py-1.5 rounded-sm transition-colors hover:bg-bg-hover hover:text-text-primary',
}

const dynamicReplacements = [
  {
    regex: /className=\{`sidebar-item \$\{sidebarView === item\.key \? 'active' : ''\}`\}/g,
    replace:
      "className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-bg-hover hover:text-text-primary ${sidebarView === item.key ? 'bg-primary-light text-accent' : ''}`}",
  },
  {
    regex: /className=\{`sidebar-item \$\{sidebarView === 'templates' \? 'active' : ''\}`\}/g,
    replace:
      "className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-bg-hover hover:text-text-primary ${sidebarView === 'templates' ? 'bg-primary-light text-accent' : ''}`}",
  },
  {
    regex: /className=\{`sidebar-item \$\{sidebarView === 'my-templates' \? 'active' : ''\}`\}/g,
    replace:
      "className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-bg-hover hover:text-text-primary ${sidebarView === 'my-templates' ? 'bg-primary-light text-accent' : ''}`}",
  },
  {
    regex: /className=\{`sidebar-item \$\{sidebarView === 'marketplace' \? 'active' : ''\}`\}/g,
    replace:
      "className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-bg-hover hover:text-text-primary ${sidebarView === 'marketplace' ? 'bg-primary-light text-accent' : ''}`}",
  },
  {
    regex: /className=\{`sidebar-item \$\{sidebarView === 'trash' \? 'active' : ''\}`\}/g,
    replace:
      "className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-bg-hover hover:text-text-primary ${sidebarView === 'trash' ? 'bg-primary-light text-accent' : ''}`}",
  },
  {
    regex: /className=\{`template-category-btn \$\{templateCategory === cat \? 'active' : ''\}`\}/g,
    replace:
      "className={`px-3.5 py-1.5 rounded-full text-xs font-medium bg-bg-card border border-border text-text-secondary cursor-pointer transition-all hover:border-border-strong hover:text-text-primary ${templateCategory === cat ? '!bg-accent !border-accent !text-white' : ''}`}",
  },
  {
    regex: /className=\{`template-category-btn \$\{\!marketplaceCategory \? 'active' : ''\}`\}/g,
    replace:
      "className={`px-3.5 py-1.5 rounded-full text-xs font-medium bg-bg-card border border-border text-text-secondary cursor-pointer transition-all hover:border-border-strong hover:text-text-primary ${!marketplaceCategory ? '!bg-accent !border-accent !text-white' : ''}`}",
  },
  {
    regex:
      /className=\{`template-category-btn \$\{marketplaceCategory === cat\.id \? 'active' : ''\}`\}/g,
    replace:
      "className={`px-3.5 py-1.5 rounded-full text-xs font-medium bg-bg-card border border-border text-text-secondary cursor-pointer transition-all hover:border-border-strong hover:text-text-primary ${marketplaceCategory === cat.id ? '!bg-accent !border-accent !text-white' : ''}`}",
  },
  {
    regex: /className=\{`view-toggle-btn \$\{viewMode === 'grid' \? 'active' : ''\}`\}/g,
    replace:
      "className={`px-2.5 py-1.5 text-text-muted border-none bg-transparent cursor-pointer transition-colors hover:text-text-primary ${viewMode === 'grid' ? 'bg-accent text-white' : ''}`}",
  },
  {
    regex: /className=\{`view-toggle-btn \$\{viewMode === 'list' \? 'active' : ''\}`\}/g,
    replace:
      "className={`px-2.5 py-1.5 text-text-muted border-none bg-transparent cursor-pointer transition-colors hover:text-text-primary ${viewMode === 'list' ? 'bg-accent text-white' : ''}`}",
  },
  {
    regex: /className=\{`menu-trigger \$\{(.+?) \? 'open' : ''\}`\}/g,
    replace:
      "className={`px-2.5 py-1 text-[13px] font-medium text-text-secondary bg-transparent border-none rounded cursor-pointer transition-all whitespace-nowrap flex items-center gap-0.5 hover:bg-bg-hover hover:text-text-primary ${$1 ? 'bg-bg-hover text-text-primary' : ''}`}",
  },
  {
    regex: /className=\{`insert-trigger \$\{(.+?) \? 'open' : ''\}`\}/g,
    replace:
      "className={`flex items-center gap-1.5 px-3 py-1 text-[13px] font-semibold text-accent bg-primary-light border border-indigo-500/25 rounded cursor-pointer transition-all hover:bg-accent hover:text-white hover:border-accent ${$1 ? 'bg-accent text-white border-accent' : ''}`}",
  },
  {
    regex: /className=\{`table-cell \$\{(.+?) \? 'active' : ''\}`\}/g,
    replace:
      "className={`w-[18px] h-[18px] border border-border-strong rounded-sm cursor-pointer transition-all duration-75 hover:border-accent ${$1 ? 'bg-accent border-accent' : ''}`}",
  },
]

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')

  dynamicReplacements.forEach(({ regex, replace }) => {
    content = content.replace(regex, replace)
  })

  content = content.replace(/className="([^"]+)"/g, (match, classes) => {
    const classWords = classes.split(/\s+/)
    const newClasses = classWords.map((word) => cssMap[word] || word)
    return `className="${newClasses.join(' ').replace(/\s+/g, ' ').trim()}"`
  })

  fs.writeFileSync(filePath, content)
  console.log(`Migrated ${filePath}`)
}

const basePath =
  'd:/NCKH_2025/Para_WorkSpace/NavSlidesEditor/Projects/NavSlidesEditor/repo/client/src/pages'
const files = [
  'HomePage.jsx',
  'EditorPage.jsx',
  'SettingsPage.jsx',
  'ExplorePage.jsx',
  'RemoteControlPage.jsx',
]

files.forEach((file) => {
  const fp = path.join(basePath, file)
  if (fs.existsSync(fp)) {
    migrateFile(fp)
  }
})

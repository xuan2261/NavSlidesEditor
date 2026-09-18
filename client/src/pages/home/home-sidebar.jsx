import { useRef } from 'react'
import { BookOpen, FileUp, FolderOpen, Globe, Layout, LayoutTemplate, Sparkles, Trash } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { PRESET_THEMES } from './home-page-presets'
import { SIDEBAR_VIEWS } from './home-page-utils'

export function HomeSidebar({
  sidebarView,
  onSidebarViewChange,
  presentationsCount,
  templatesCount,
  trashCount,
  importProgress,
  importWarningSummary,
  onImportPptx,
  onImportPdf,
  onImportMarkdown,
  onImportProject,
}) {
  const navigate = useNavigate()
  const pptxInputRef = useRef(null)
  const pdfInputRef = useRef(null)
  const markdownInputRef = useRef(null)
  const projectInputRef = useRef(null)
  return (
        <nav className="w-full md:w-[var(--sidebar-width)] shrink-0 bg-secondary border-b border-border md:border-b-0 md:border-r flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto py-2 md:py-3">
          <div className="px-3 mb-2">
            {SIDEBAR_VIEWS.map((item) => (
              <Button
                variant="ghost"
                key={item.key}
                className={`flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary ${sidebarView === item.key ? 'bg-primary/10 text-primary' : ''}`}
                onClick={() => onSidebarViewChange(item.key)}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
                {item.key === 'all' && (
                  <span className="ml-auto text-[11px] text-text-muted bg-hover px-[7px] py-[1px] rounded-[10px]">
                    {presentationsCount}
                  </span>
                )}
              </Button>
            ))}
          </div>

          <div className="h-px bg-border my-2 mx-3" />

          <div className="px-3 mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-3 pt-2 pb-1.5">
              Templates
            </div>
            <Button
              variant="ghost"
              className={`flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary ${sidebarView === 'templates' ? 'bg-primary/10 text-primary' : ''}`}
              onClick={() => onSidebarViewChange('templates')}
            >
              <LayoutTemplate size={16} />
              <span>Built-in</span>
              <span className="ml-auto text-[11px] text-text-muted bg-hover px-[7px] py-[1px] rounded-[10px]">
                {PRESET_THEMES.length}
              </span>
            </Button>
            <Button
              variant="ghost"
              className={`flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary ${sidebarView === 'my-templates' ? 'bg-primary/10 text-primary' : ''}`}
              onClick={() => onSidebarViewChange('my-templates')}
            >
              <Layout size={16} />
              <span>My Templates</span>
              <span className="ml-auto text-[11px] text-text-muted bg-hover px-[7px] py-[1px] rounded-[10px]">
                {templatesCount}
              </span>
            </Button>
            <Button
              variant="ghost"
              className={`flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary ${sidebarView === 'marketplace' ? 'bg-primary/10 text-primary' : ''}`}
              onClick={() => onSidebarViewChange('marketplace')}
            >
              <Sparkles size={16} />
              <span>Marketplace</span>
            </Button>
          </div>

          <div className="h-px bg-border my-2 mx-3" />

          <div className="px-3 mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-3 pt-2 pb-1.5">
              Import
            </div>
            <Button
              type="button"
              data-testid="home-import-pptx-btn"
              variant="ghost"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary"
              onClick={() => pptxInputRef.current?.click()}
            >
              <FileUp size={16} />
              <span>Import PPTX</span>
            </Button>
            <input
              ref={pptxInputRef}
              data-testid="home-import-pptx-input"
              type="file"
              accept=".pptx"
              className="hidden"
              tabIndex={-1}
              onChange={(e) => {
                onImportPptx(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="ghost"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary"
              onClick={() => pdfInputRef.current?.click()}
            >
              <BookOpen size={16} />
              <span>Import PDF</span>
            </Button>
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              tabIndex={-1}
              onChange={(e) => {
                onImportPdf(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              data-testid="home-import-markdown-btn"
              variant="ghost"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary"
              onClick={() => markdownInputRef.current?.click()}
            >
              <BookOpen size={16} />
              <span>Import Markdown</span>
            </Button>
            <input
              ref={markdownInputRef}
              data-testid="home-import-markdown-input"
              type="file"
              accept=".md,.markdown,.txt"
              className="hidden"
              tabIndex={-1}
              onChange={(e) => {
                onImportMarkdown(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="ghost"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary"
              onClick={() => projectInputRef.current?.click()}
            >
              <FolderOpen size={16} />
              <span>Import Project</span>
            </Button>
            <input
              ref={projectInputRef}
              type="file"
              accept=".navslides,.json"
              className="hidden"
              tabIndex={-1}
              onChange={(e) => {
                onImportProject(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>

          <div className="h-px bg-border my-2 mx-3" />

          <div className="px-3 mb-2">
            <Button
              variant="ghost"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary"
              onClick={() => navigate('/explore')}
            >
              <Globe size={16} />
              <span>Explore</span>
            </Button>
          </div>

          <div className="h-px bg-border my-2 mx-3" />

          {/* Sticky Trash entry — always reachable at viewport bottom */}
          <div className="sticky bottom-0 bg-secondary z-10 px-3 mb-2 pt-2 border-t border-border/40">
            <Button
              variant="ghost"
              className={`flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary ${sidebarView === 'trash' ? 'bg-primary/10 text-primary' : ''}`}
              onClick={() => onSidebarViewChange('trash')}
            >
              <Trash size={16} />
              <span>Trash</span>
              {trashCount > 0 && (
                <span className="ml-auto text-[11px] text-text-muted bg-hover px-[7px] py-[1px] rounded-[10px]">
                  {trashCount}
                </span>
              )}
            </Button>
          </div>

          {/* Import progress / warnings — flow below Trash in normal order */}
          <div className="px-3 pb-2">
            {importProgress && (
              <div
                className="rounded border border-border bg-card px-2 py-1.5 text-[11px] text-text-secondary"
                role="status"
                aria-live="polite"
              >
                {importProgress}
              </div>
            )}
            {importWarningSummary && (
              <div
                className="mt-2 rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-[11px] text-text-secondary"
                role="alert"
              >
                {importWarningSummary}
              </div>
            )}
          </div>
        </nav>
  )
}


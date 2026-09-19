import { Moon, Plus, Search, Settings2, Sun, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Input } from '../../components/ui'

export function HomeHeader({ searchQuery, onSearchQueryChange, theme, onToggleTheme, onNewPresentation }) {
  const navigate = useNavigate()
  return (
      <div className="flex min-h-14 shrink-0 flex-col gap-3 border-b border-border bg-secondary px-4 py-3 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-0">
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
          <div className="flex items-center gap-2 text-[17px] font-bold text-text-primary tracking-tight">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand/30 bg-brand text-sm font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
              N
            </div>
            <span>NavSlides Editor</span>
          </div>
        </div>

        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1 sm:justify-end">
          {/* Search */}
          <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search
            size={15}
            className="absolute left-[11px] top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <Input
            className="w-full pl-9 pr-8"
            type="text"
            placeholder="Search presentations..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-0.5 rounded"
              onClick={() => onSearchQueryChange('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="icon"
            className="min-h-10 w-10 sm:min-h-8 sm:w-8"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          <Button
            variant="icon"
            className="min-h-10 w-10 sm:min-h-8 sm:w-8"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            title="Settings"
          >
            <Settings2 size={16} />
          </Button>
          <Button
            variant="primary"
            className="min-h-10 px-3 sm:min-h-8"
            onClick={onNewPresentation}
            aria-label="New presentation"
          >
            <Plus size={16} />
            <span className="hidden min-[360px]:inline sm:inline">New</span>
          </Button>
          </div>
        </div>
      </div>
  )
}


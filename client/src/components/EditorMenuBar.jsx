import { useState, useCallback } from 'react'
import PromptPopover from './PromptPopover'
import {
  Download,
  FileDown,
  Github,
  CloudUpload,
  History,
  Search,
  Clock,
  Code2,
  MessageSquare,
  Share2,
  Radio,
  BarChart3,
  Sparkles,
  FileText,
  Languages,
  Play,
  FolderOpen,
  LayoutGrid,
} from 'lucide-react'
import DropdownMenu from './DropdownMenu'
import { Button } from '../components/ui'

const THEMES = [
  'black',
  'white',
  'league',
  'beige',
  'sky',
  'night',
  'serif',
  'simple',
  'solarized',
  'moon',
  'dracula',
]
const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom']

export default function EditorMenuBar({
  presentation,
  setPresentation,
  // eslint-disable-next-line unused-imports/no-unused-vars
  presentationId,
  // File actions
  onExportPDF,
  onExportPPTX,
  onExportHTML,
  onExportOffline,
  onExportProject,
  onOpenProject,
  onGithub,
  onSync,
  onHistory,
  // View actions
  onFindReplace,
  onTimeline,
  onCssEditor,
  onSpeaker,
  onSlideSorter,
  // eslint-disable-next-line unused-imports/no-unused-vars
  showTimeline,
  // eslint-disable-next-line unused-imports/no-unused-vars
  showFindReplace,
  // Share actions
  onShare,
  onLive,
  onAnalytics,
  // AI actions
  onAICopywriter,
  onAIGenerator,
  onAITranslate,
  // Present
  onPresent,
  // Save status
  saveStatus,
  lastSavedAt,
}) {
  const [openMenu, setOpenMenu] = useState(null)
  const [customSizePrompt, setCustomSizePrompt] = useState(false)

  const toggle = useCallback((name) => {
    setOpenMenu((prev) => (prev === name ? null : name))
  }, [])
  const close = useCallback(() => setOpenMenu(null), [])

  const fileItems = [
    { type: 'button', label: 'Open Project...', icon: FolderOpen, onClick: onOpenProject },
    { type: 'separator' },
    { type: 'button', label: 'Export PDF', icon: Download, onClick: onExportPDF },
    { type: 'button', label: 'Export PPTX', icon: Download, onClick: onExportPPTX },
    { type: 'button', label: 'Export HTML', icon: Download, onClick: onExportHTML },
    { type: 'button', label: 'Export Offline HTML', icon: FileDown, onClick: onExportOffline },
    {
      type: 'button',
      label: 'Export Project (.navslides)',
      icon: FileDown,
      onClick: onExportProject,
    },
    { type: 'separator' },
    { type: 'button', label: 'Save to GitHub', icon: Github, onClick: onGithub },
    { type: 'button', label: 'Sync to Cloud', icon: CloudUpload, onClick: onSync },
    { type: 'separator' },
    { type: 'button', label: 'Version History', icon: History, onClick: onHistory },
  ]

  const viewItems = [
    {
      type: 'button',
      label: 'Find & Replace',
      icon: Search,
      shortcut: 'Ctrl+F',
      onClick: onFindReplace,
    },
    {
      type: 'button',
      label: 'Animation Timeline',
      icon: Clock,
      onClick: onTimeline,
    },
    { type: 'button', label: 'Custom CSS', icon: Code2, onClick: onCssEditor },
    { type: 'button', label: 'Speaker Notes', icon: MessageSquare, onClick: onSpeaker },
    { type: 'separator' },
    {
      type: 'button',
      label: 'Slide Sorter',
      icon: LayoutGrid,
      shortcut: 'Ctrl+Shift+S',
      onClick: onSlideSorter,
    },
  ]

  const settingsItems = [
    {
      type: 'select',
      label: 'Background',
      value: presentation.theme || 'black',
      onChange: (v) => setPresentation((p) => ({ ...p, theme: v })),
      options: THEMES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
    },
    {
      type: 'select',
      label: 'Slide Size',
      value: presentation.resolution
        ? `${presentation.resolution.width}x${presentation.resolution.height}`
        : '960x540',
      onChange: (v) => {
        if (v === 'custom') {
          setCustomSizePrompt(true)
        } else {
          const [w, h] = v.split('x').map(Number)
          setPresentation((p) => ({ ...p, resolution: { width: w, height: h } }))
        }
      },
      options: [
        { value: '960x540', label: '16:9 (960×540)' },
        { value: '960x720', label: '4:3 (960×720)' },
        { value: '540x960', label: 'Portrait (540×960)' },
        { value: '1920x1080', label: 'Full HD (1920×1080)' },
        { value: 'custom', label: 'Custom...' },
      ],
    },
    {
      type: 'select',
      label: 'Transition',
      value: presentation.transition || 'slide',
      onChange: (v) => setPresentation((p) => ({ ...p, transition: v })),
      options: TRANSITIONS.map((t) => ({
        value: t,
        label: t.charAt(0).toUpperCase() + t.slice(1),
      })),
    },
    { type: 'separator' },
    {
      type: 'checkbox',
      label: 'Show Grid (Present)',
      checked: presentation.showPresentGrid || false,
      onChange: (v) => setPresentation((p) => ({ ...p, showPresentGrid: v })),
    },
    {
      type: 'checkbox',
      label: 'Show Footer',
      checked: presentation.showFooter || false,
      onChange: (v) => setPresentation((p) => ({ ...p, showFooter: v })),
    },
    {
      type: 'checkbox',
      label: 'Show Page Numbers',
      checked: presentation.showPageNumbers || false,
      onChange: (v) => setPresentation((p) => ({ ...p, showPageNumbers: v })),
    },
    ...(presentation.showPageNumbers
      ? [
          {
            type: 'select',
            label: 'Page # Format',
            value: presentation.pageNumberFormat || 'c/t',
            onChange: (v) => setPresentation((p) => ({ ...p, pageNumberFormat: v })),
            options: [
              { value: 'c', label: '1' },
              { value: 'c/t', label: '1 / 10' },
            ],
          },
        ]
      : []),
    { type: 'separator' },
    {
      type: 'checkbox',
      label: 'Auto-advance',
      checked: !!presentation.autoSlide,
      onChange: (v) => setPresentation((p) => ({ ...p, autoSlide: v ? 5000 : 0 })),
    },
    ...(presentation.autoSlide
      ? [
          {
            type: 'custom',
            render: () => (
              <div className="flex items-center justify-between px-3 py-1.5 text-sm text-text-primary w-full">
                <span>Interval</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    className="w-12 rounded border border-border bg-secondary px-1 py-0.5 text-xs text-text-primary text-center focus:border-accent focus:outline-none"
                    value={Math.round((presentation.autoSlide || 5000) / 1000)}
                    onChange={(e) =>
                      setPresentation((p) => ({
                        ...p,
                        autoSlide: Math.max(1, parseInt(e.target.value) || 5) * 1000,
                      }))
                    }
                    min={1}
                    max={120}
                  />
                  <span className="text-[11px] text-text-muted">s</span>
                </div>
              </div>
            ),
          },
          {
            type: 'checkbox',
            label: 'Loop',
            checked: presentation.autoSlideLoop || false,
            onChange: (v) => setPresentation((p) => ({ ...p, autoSlideLoop: v })),
          },
          {
            type: 'checkbox',
            label: 'Kiosk Mode',
            checked: presentation.kioskMode || false,
            onChange: (v) => setPresentation((p) => ({ ...p, kioskMode: v })),
          },
        ]
      : []),
    { type: 'separator' },
    { type: 'label', label: 'Presenter Tools' },
    {
      type: 'checkbox',
      label: 'Dark / Light Toggle',
      checked: presentation.presenterTools?.themeToggle !== false,
      onChange: (v) =>
        setPresentation((p) => ({
          ...p,
          presenterTools: { ...p.presenterTools, themeToggle: v },
        })),
    },
    {
      type: 'checkbox',
      label: 'Font Size Zoom (A+/A-)',
      checked: presentation.presenterTools?.fontZoom !== false,
      onChange: (v) =>
        setPresentation((p) => ({
          ...p,
          presenterTools: { ...p.presenterTools, fontZoom: v },
        })),
    },
    {
      type: 'checkbox',
      label: 'Slide Menu & Tools',
      checked: presentation.presenterTools?.slideMenu || false,
      onChange: (v) =>
        setPresentation((p) => ({
          ...p,
          presenterTools: { ...p.presenterTools, slideMenu: v },
        })),
    },
    {
      type: 'checkbox',
      label: 'Pen / Chalkboard',
      checked: presentation.presenterTools?.chalkboard || false,
      onChange: (v) =>
        setPresentation((p) => ({
          ...p,
          presenterTools: { ...p.presenterTools, chalkboard: v },
        })),
    },
  ]

  const aiItems = [
    { type: 'button', label: 'AI Copywriter', icon: Sparkles, onClick: onAICopywriter },
    { type: 'button', label: 'AI Slide Generator', icon: FileText, onClick: onAIGenerator },
    { type: 'button', label: 'Translate', icon: Languages, onClick: onAITranslate },
  ]

  const shareItems = [
    { type: 'button', label: 'Share Link', icon: Share2, onClick: onShare },
    { type: 'button', label: 'Present Live', icon: Radio, onClick: onLive },
    { type: 'button', label: 'View Analytics', icon: BarChart3, onClick: onAnalytics },
  ]

  return (
    <div className="flex flex-1 items-center justify-end gap-2 tour-step-quick-access">
      {/* Save Status */}
      {saveStatus === 'saving' && <span className="text-[11px] text-text-muted">Saving...</span>}
      {saveStatus === 'saved' && <span className="text-[11px] text-success">Saved</span>}
      {!saveStatus && lastSavedAt && (
        <span className="text-[10px] text-text-muted" title={lastSavedAt.toLocaleString()}>
          {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}

      <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

      {/* Menu Dropdowns */}
      <DropdownMenu
        label="File"
        items={fileItems}
        isOpen={openMenu === 'file'}
        onToggle={() => toggle('file')}
        onClose={close}
        align="right"
      />
      <DropdownMenu
        label="View"
        items={viewItems}
        isOpen={openMenu === 'view'}
        onToggle={() => toggle('view')}
        onClose={close}
        align="right"
      />
      <DropdownMenu
        label="Settings"
        items={settingsItems}
        isOpen={openMenu === 'settings'}
        onToggle={() => toggle('settings')}
        onClose={close}
        align="right"
      />
      <DropdownMenu
        label={
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} />
            <span>AI Assistant</span>
          </div>
        }
        items={aiItems}
        isOpen={openMenu === 'ai'}
        onToggle={() => toggle('ai')}
        onClose={close}
        align="right"
      />
      <DropdownMenu
        label="Share"
        items={shareItems}
        isOpen={openMenu === 'share'}
        onToggle={() => toggle('share')}
        onClose={close}
        align="right"
      />

      <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

      {/* Primary CTA */}
      <Button variant="primary" onClick={onPresent} title="Present">
        <Play size={18} />
        Present
      </Button>

      {/* Custom size prompt */}
      {customSizePrompt && (
        <PromptPopover
          title="Custom Size (WxH, e.g. 960x540)"
          defaultValue={
            presentation.resolution
              ? `${presentation.resolution.width}x${presentation.resolution.height}`
              : '960x540'
          }
          placeholder="960x540"
          onSubmit={(val) => {
            const parts = val.split(/[x×,]/i).map(Number)
            if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
              setPresentation((p) => ({ ...p, resolution: { width: parts[0], height: parts[1] } }))
            }
            setCustomSizePrompt(false)
          }}
          onCancel={() => setCustomSizePrompt(false)}
          className="fixed top-[60px] left-1/2 -translate-x-1/2"
        />
      )}
    </div>
  )
}

// Conditional-render contract for the lifted EditorModals component: each
// store flag (or payload prop) true -> its modal mounts; false -> absent.
// Heavy child modals are stubbed to keep this focused on the mount wiring.
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useUIStore } from '../stores/ui-store'

vi.mock('./GitHubPushModal', () => ({ default: () => <div data-testid="m-github" /> }))
vi.mock('./SyncModal', () => ({ default: () => <div data-testid="m-sync" /> }))
vi.mock('./HistoryModal', () => ({ default: () => <div data-testid="m-history" /> }))
vi.mock('./SlideSorterView', () => ({ default: () => <div data-testid="m-sorter" /> }))
vi.mock('./HtmlEditorModal', () => ({ default: () => <div data-testid="m-html" /> }))
vi.mock('./CodeEditorModal', () => ({ default: () => <div data-testid="m-code" /> }))
vi.mock('./LatexEditorModal', () => ({ default: () => <div data-testid="m-latex" /> }))
vi.mock('./FindReplaceBar', () => ({ default: () => <div data-testid="m-find" /> }))
vi.mock('./AnimationTimeline', () => ({ default: () => <div data-testid="m-timeline" /> }))
vi.mock('./AnimationPreviewModal', () => ({ default: () => <div data-testid="m-animpreview" /> }))
vi.mock('./TransitionPreview', () => ({ default: () => <div data-testid="m-transition" /> }))
vi.mock('./ShareModal', () => ({ default: () => <div data-testid="m-share" /> }))
vi.mock('./AnalyticsModal', () => ({ default: () => <div data-testid="m-analytics" /> }))
vi.mock('./game-hud-overlay', () => ({
  GameHudOverlay: ({ visible }) => (visible ? <div data-testid="m-gamehud" /> : null),
}))
vi.mock('./game-leaderboard-overlay', () => ({
  GameLeaderboardOverlay: ({ visible, scores }) => (
    visible ? <div data-testid="m-gamelb" data-scores={JSON.stringify(scores)} /> : null
  ),
}))
vi.mock('./editor-modals-secondary', () => ({ default: () => <div data-testid="m-secondary" /> }))

import EditorModals from './EditorModals'

const baseProps = {
  presentationId: 'p1',
  presentation: { id: 'p1', slides: [{ id: 's1', elements: [] }] },
  currentSlide: { id: 's1', elements: [] },
  currentSlideIndex: 0,
  viewMode: 'normal',
  setViewMode: vi.fn(),
  setCurrentSlideIndex: vi.fn(),
  setPresentation: vi.fn(),
  htmlEditorState: null,
  setHtmlEditorState: vi.fn(),
  commitHtmlEdit: vi.fn(),
  codeEditorState: null,
  setCodeEditorState: vi.fn(),
  commitCodeEdit: vi.fn(),
  latexEditorState: null,
  setLatexEditorState: vi.fn(),
  commitLatexEdit: vi.fn(),
  showFindReplace: false,
  setShowFindReplace: vi.fn(),
  showTimeline: false,
  setShowTimeline: vi.fn(),
  updateElement: vi.fn(),
  currentGameType: null,
  showGameHud: false,
  setShowGameHud: vi.fn(),
  showGameLeaderboard: false,
  setShowGameLeaderboard: vi.fn(),
  selectedElementId: null,
  commands: [],
  liveRoomCode: null,
  livePresenterToken: null,
  galleryPreviewTemplate: null,
  setGalleryPreviewTemplate: vi.fn(),
  addSlide: vi.fn(),
  addImageElement: vi.fn(),
  insertEmbedHtml: vi.fn(),
  handleInsertFromFileBrowser: vi.fn(),
  buildSlidesFromOutline: vi.fn(() => []),
  applyTranslatedNotes: vi.fn(),
  getSlideNotesTranslationKey: vi.fn(),
}

function resetFlags() {
  useUIStore.setState({
    showGithubModal: false,
    showSyncModal: false,
    showHistoryModal: false,
    showAnimationPreview: false,
    showTransitionPreview: false,
    showShareModal: false,
    showAnalytics: false,
  })
}

beforeEach(resetFlags)
afterEach(cleanup)

describe('EditorModals conditional render', () => {
  it('mounts nothing modal-specific by default, but always renders the secondary group', () => {
    render(<EditorModals {...baseProps} />)
    expect(screen.queryByTestId('m-github')).toBeNull()
    expect(screen.queryByTestId('m-html')).toBeNull()
    expect(screen.getByTestId('m-secondary')).toBeTruthy()
  })

  it('renders GitHub modal when the store flag is set', () => {
    useUIStore.setState({ showGithubModal: true })
    render(<EditorModals {...baseProps} />)
    expect(screen.getByTestId('m-github')).toBeTruthy()
  })

  it('renders Share + Analytics when their store flags are set', () => {
    useUIStore.setState({ showShareModal: true, showAnalytics: true })
    render(<EditorModals {...baseProps} />)
    expect(screen.getByTestId('m-share')).toBeTruthy()
    expect(screen.getByTestId('m-analytics')).toBeTruthy()
  })

  it('renders payload modals from props (html/code/latex)', () => {
    render(
      <EditorModals
        {...baseProps}
        htmlEditorState={{ elementId: 'e', content: '' }}
        codeEditorState={{ elementId: 'e', content: '', language: 'js' }}
        latexEditorState={{ elementId: 'e', content: '' }}
      />
    )
    expect(screen.getByTestId('m-html')).toBeTruthy()
    expect(screen.getByTestId('m-code')).toBeTruthy()
    expect(screen.getByTestId('m-latex')).toBeTruthy()
  })

  it('renders the slide sorter when viewMode is sorter', () => {
    render(<EditorModals {...baseProps} viewMode="sorter" />)
    expect(screen.getByTestId('m-sorter')).toBeTruthy()
  })

  it('renders find/replace and timeline from props', () => {
    render(<EditorModals {...baseProps} showFindReplace showTimeline />)
    expect(screen.getByTestId('m-find')).toBeTruthy()
    expect(screen.getByTestId('m-timeline')).toBeTruthy()
  })

  it('renders game overlays and indicator when active', () => {
    render(
      <EditorModals
        {...baseProps}
        currentGameType="jeopardy"
        showGameHud
        showGameLeaderboard
        gameLeaderboardScores={[{ team: 'Blue', score: 42 }]}
      />
    )
    expect(screen.getByTestId('game-active-indicator')).toBeTruthy()
    expect(screen.getByTestId('m-gamehud')).toBeTruthy()
    expect(screen.getByTestId('m-gamelb')).toBeTruthy()
    expect(screen.getByTestId('m-gamelb').dataset.scores).toContain('Blue')
  })
})

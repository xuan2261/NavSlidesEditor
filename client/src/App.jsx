import { lazy, Suspense, useState, useEffect } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import { AppFeedbackProvider } from './components/ui'

const HomePage = lazy(() => import('./pages/HomePage'))
const EditorPage = lazy(() => import('./pages/EditorPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const LiveViewPage = lazy(() => import('./pages/LiveViewPage'))
const RemoteControlPage = lazy(() => import('./pages/RemoteControlPage'))
const SpeakerViewPage = lazy(() => import('./pages/SpeakerViewPage'))
const ExplorePage = lazy(() => import('./pages/ExplorePage'))
const GamePlayerPage = lazy(() => import('./pages/game-player-join-page'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function EditorRoute({ isTemplate = false }) {
  const { id } = useParams()
  const navigate = useNavigate()
  return <EditorPage presentationId={id} isTemplate={isTemplate} onGoHome={() => navigate('/')} />
}

function AppRoutes() {
  const [theme, setTheme] = useState(() => localStorage.getItem('editor-theme') || 'dark')
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
    localStorage.setItem('editor-theme', theme)
  }, [theme])

  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen bg-workspace text-text-primary flex items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-[0_8px_28px_rgba(0,0,0,0.18)]">
            Loading NavSlides…
          </div>
        </div>
      }
    >
      <Routes>
        <Route element={<MainLayout />}>
          <Route
            path="/"
            element={
              <HomePage
                onOpen={(id, template = false) =>
                  navigate(template ? `/template/${id}` : `/editor/${id}`)
                }
                theme={theme}
                onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              />
            }
          />
          <Route path="/editor/:id" element={<EditorRoute />} />
          <Route path="/template/:id" element={<EditorRoute isTemplate />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/explore" element={<ExplorePage />} />
        </Route>
        <Route path="/live/:roomCode" element={<LiveViewPage />} />
        <Route path="/remote/:roomCode" element={<RemoteControlPage />} />
        <Route path="/speaker/:roomCode" element={<SpeakerViewPage />} />
        <Route path="/player/:slideId/:elementId" element={<GamePlayerPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
        <AppFeedbackProvider />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

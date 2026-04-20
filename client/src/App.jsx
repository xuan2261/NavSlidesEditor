import { useState, useEffect } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import SettingsPage from './pages/SettingsPage'
import LiveViewPage from './pages/LiveViewPage'
import RemoteControlPage from './pages/RemoteControlPage'
import SpeakerViewPage from './pages/SpeakerViewPage'
import ExplorePage from './pages/ExplorePage'
import MainLayout from './components/layout/MainLayout'

function EditorRoute({ isTemplate = false }) {
  const { id } = useParams()
  const navigate = useNavigate()
  return (
    <EditorPage
      presentationId={id}
      isTemplate={isTemplate}
      onGoHome={() => navigate('/')}
    />
  )
}

function AppRoutes() {
  const [theme, setTheme] = useState(() => localStorage.getItem('editor-theme') || 'dark')
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
    localStorage.setItem('editor-theme', theme)
  }, [theme])

  return (
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
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

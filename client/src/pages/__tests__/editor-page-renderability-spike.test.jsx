// Phase 1 step-0 GATE: prove whether EditorPage mounts in jsdom with only
// api + global fetch + LiveSocketContext mocked. Outcome decides whether the
// characterization net exercises the real tree or needs child stubs.
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { LiveSocketContext } from '../../contexts/live-socket-context-provider.jsx'

const seededPresentation = {
  id: 'spike-1',
  title: 'Spike Deck',
  theme: 'black',
  slides: [
    {
      id: 'slide-1',
      background: '#111111',
      elements: [
        {
          id: 'el-1',
          type: 'text',
          x: 80,
          y: 100,
          width: 600,
          height: 180,
          zIndex: 1,
          content: '<p>Hello spike</p>',
        },
      ],
    },
  ],
}

vi.mock('../../utils/api', () => ({
  api: {
    getPresentation: vi.fn(() => Promise.resolve(structuredClone(seededPresentation))),
    getTemplate: vi.fn(() => Promise.resolve(structuredClone(seededPresentation))),
    updatePresentation: vi.fn(() => Promise.resolve({})),
    updateTemplate: vi.fn(() => Promise.resolve({})),
    getShareStatus: vi.fn(() => Promise.resolve({ shared: false, token: null })),
    uploadFile: vi.fn(() => Promise.resolve({ url: '/uploads/x.png' })),
  },
}))

import EditorPage from '../EditorPage.jsx'

beforeEach(() => {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  )
})

describe('EditorPage renderability spike', () => {
  it('mounts with a seeded presentation (no child stubs)', async () => {
    render(
      <LiveSocketContext.Provider value={null}>
        <EditorPage presentationId="spike-1" onGoHome={() => {}} />
      </LiveSocketContext.Provider>
    )
    // Loads async -> title input should appear once presentation resolves.
    await waitFor(() => {
      expect(screen.getByDisplayValue('Spike Deck')).toBeTruthy()
    })
  })
})

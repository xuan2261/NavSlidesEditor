import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ getPptxFidelity: vi.fn() }))

vi.mock('../utils/api', () => ({ api: { getPptxFidelity: h.getPptxFidelity } }))

import { usePptxFidelity } from './use-pptx-fidelity'

describe('usePptxFidelity', () => {
  beforeEach(() => {
    h.getPptxFidelity.mockReset()
    h.getPptxFidelity.mockResolvedValue({ presentationId: 'deck', exports: {} })
  })

  it('loads fidelity for a package-backed presentation without legacy original metadata', async () => {
    const { result } = renderHook(() => usePptxFidelity({
      id: 'deck',
      pptxSourceAvailable: true,
    }))

    await waitFor(() => expect(result.current.contract).toEqual({
      presentationId: 'deck',
      exports: {},
    }))
    expect(h.getPptxFidelity).toHaveBeenCalledWith('deck')
  })
})

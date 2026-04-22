import { describe, it, expect, vi } from 'vitest'
import { callAI } from './ai-provider.js'

// Mock global fetch
global.fetch = vi.fn()

describe('AI Provider', () => {
  it('should throw if no config provided', async () => {
    await expect(callAI(null, '', '')).rejects.toThrow('AI not configured')
  })

  it('should route to OpenAI and format request correctly', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Mocked OpenAI response' } }] }),
    })

    const config = { provider: 'openai', apiKey: 'test-key', model: 'gpt-4o-mini' }
    const res = await callAI(config, 'system', 'user')

    expect(res).toBe('Mocked OpenAI response')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    )
  })

  it('should route to Gemini and format request correctly', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Mocked Gemini response' }] } }],
      }),
    })

    const config = { provider: 'gemini', apiKey: 'test-key' }
    const res = await callAI(config, 'system', 'user')

    expect(res).toBe('Mocked Gemini response')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('generativelanguage.googleapis.com'),
      expect.objectContaining({
        method: 'POST',
      })
    )
  })

  it('should throw on API mismatch or failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Invalid API key' } }),
    })

    const config = { provider: 'openai', apiKey: 'bad-key' }
    await expect(callAI(config, 'system', 'user')).rejects.toThrow(
      'OpenAI API Error: Invalid API key'
    )
  })
})

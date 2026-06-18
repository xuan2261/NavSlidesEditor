import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MatchingCard } from './game-player-join-page.jsx'

describe('MatchingCard', () => {
  const matchingState = {
    prompt: 'Match terms',
    prompts: [
      { id: 'p-http', text: 'HTTP' },
      { id: 'p-tls', text: 'TLS' },
    ],
    targets: [
      { id: 't-security', text: 'Security' },
      { id: 't-protocol', text: 'Protocol' },
    ],
  }

  it('[cap:element.game depth:behavior] submits prompt-target ids through the click fallback', () => {
    const onSubmit = vi.fn()
    render(<MatchingCard matchingState={matchingState} matchingResult={null} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByText('HTTP'))
    fireEvent.click(screen.getByText('Protocol'))
    fireEvent.click(screen.getByText('TLS'))
    fireEvent.click(screen.getByText('Security'))
    fireEvent.click(screen.getByText('Submit matches'))

    expect(onSubmit).toHaveBeenCalledWith([
      { promptId: 'p-http', targetId: 't-protocol' },
      { promptId: 'p-tls', targetId: 't-security' },
    ])
  })

  it('[cap:element.game depth:behavior] renders revealed answer mappings by label', () => {
    render(
      <MatchingCard
        matchingState={{
          ...matchingState,
          answerKey: [
            { promptId: 'p-http', targetId: 't-protocol' },
            { promptId: 'p-tls', targetId: 't-security' },
          ],
        }}
        matchingResult={{ score: 1, total: 2 }}
        onSubmit={() => {}}
      />
    )

    expect(screen.getByText('Revealed answers')).toBeTruthy()
    expect(screen.getByText('HTTP → Protocol')).toBeTruthy()
    expect(screen.getByText('TLS → Security')).toBeTruthy()
  })

  it('[cap:element.game depth:behavior] disables targets already mapped to another prompt', () => {
    render(<MatchingCard matchingState={matchingState} matchingResult={null} onSubmit={() => {}} />)

    fireEvent.click(screen.getByText('HTTP'))
    fireEvent.click(screen.getByText('Protocol'))
    fireEvent.click(screen.getByText('TLS'))

    expect(screen.getByText('Protocol').disabled).toBe(true)
    expect(screen.getByText('Security').disabled).toBe(false)
  })
})

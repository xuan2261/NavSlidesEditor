import React, { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import SortingProperties from './sorting-properties'

const initial = {
  title: 'Sort',
  buckets: [
    { id: 'fruit', label: 'Fruit' },
    { id: 'veg', label: 'Vegetable' },
  ],
  items: [
    { id: 'apple', text: 'Apple' },
    { id: 'carrot', text: 'Carrot' },
  ],
  answerKey: {
    assignments: [
      { itemId: 'apple', bucketId: 'fruit' },
      { itemId: 'carrot', bucketId: 'veg' },
    ],
  },
  attemptLimit: 2,
  points: 7,
}
function Harness() {
  const [config, setConfig] = useState(initial)
  return (
    <>
      <SortingProperties
        config={config}
        onChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
      />
      <output data-testid="config">{JSON.stringify(config)}</output>
    </>
  )
}
const saved = () => JSON.parse(screen.getByTestId('config').textContent)
afterEach(cleanup)

describe('sorting authoring stable identities', () => {
  it('keeps answers stable while reordering and renaming duplicate item labels', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Sorting item 1 text'), { target: { value: 'Same' } })
    fireEvent.change(screen.getByLabelText('Sorting item 2 text'), { target: { value: 'Same' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move sorting item 1 down' }))
    expect(saved().items).toEqual([
      { id: 'carrot', text: 'Same' },
      { id: 'apple', text: 'Same' },
    ])
    expect(saved().answerKey).toEqual(initial.answerKey)
    fireEvent.change(screen.getByLabelText('Sorting item 1 correct bucket'), {
      target: { value: 'fruit' },
    })
    expect(saved().answerKey.assignments).toEqual([
      { itemId: 'carrot', bucketId: 'fruit' },
      { itemId: 'apple', bucketId: 'fruit' },
    ])
  })
  it('removes deleted item references and requires an explicit replacement for a deleted bucket', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete sorting item 2' }))
    expect(saved().answerKey.assignments).toEqual([{ itemId: 'apple', bucketId: 'fruit' }])
    fireEvent.click(screen.getByRole('button', { name: 'Delete bucket 1' }))
    expect(saved().answerKey.assignments).toEqual([{ itemId: 'apple', bucketId: '' }])
    expect(screen.getByRole('alert').textContent).toContain('Unknown bucket ID')
  })
  it('edits item media alt and preserves fractional points accepted by the canonical schema', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Sorting item 1 image URL'), {
      target: { value: '/uploads/apple.png' },
    })
    fireEvent.change(screen.getByLabelText('Sorting item 1 image alt text'), {
      target: { value: 'An apple' },
    })
    fireEvent.change(screen.getByLabelText('Sorting points'), { target: { value: '1.5' } })
    expect(saved().items[0].media).toEqual({ src: '/uploads/apple.png', alt: 'An apple' })
    expect(saved().points).toBe(1.5)
  })
})

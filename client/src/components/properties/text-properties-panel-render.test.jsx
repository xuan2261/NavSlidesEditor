import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PropertiesPanel from '../PropertiesPanel'

const textElement = {
  id: 'text-1',
  type: 'text',
  content: '<p>Hello</p>',
  x: 10,
  y: 20,
  width: 200,
  height: 80,
}

describe('text PropertiesPanel guidance', () => {
  it('does not leave text element selection with a blank type-specific panel', () => {
    const html = renderToString(
      <PropertiesPanel
        slide={{ id: 'slide-1', elements: [textElement] }}
        selectedElement={textElement}
        selectedElementIds={[textElement.id]}
        onUpdateElement={() => {}}
        onBringForward={() => {}}
        onSendBackward={() => {}}
        onDeleteElement={() => {}}
      />
    )

    expect(html).toContain('Text Formatting')
    expect(html).toContain('Home and Format ribbon controls')
  })
})

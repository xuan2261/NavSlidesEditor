import { render } from '@testing-library/react'
import { computeAccessibleName } from 'dom-accessibility-api'
import { describe, expect, it, vi } from 'vitest'
import CommonElementControls from './common-element-controls'
import ImageProperties from './image-properties'
import MediaProperties from './media-properties'
import ChartProperties from './chart-properties'
import CodeProperties from './code-properties'
import ShapeProperties from './shape-properties'
import MiscProperties from './misc-properties'
import TableProperties from './table-properties'
import TimelineProperties from './timeline-properties'
import GameProperties from './game-properties'
import { GAME_TYPES, GAME_TYPE_DEFAULTS } from '../../constants/game-element-types-constants'

const noop = vi.fn()

function expectEveryControlNamed(container) {
  const controls = [...container.querySelectorAll('button, input, select, textarea, [role="radio"], [role="tab"]')]
  const unnamed = controls.filter((control) => !computeAccessibleName(control).trim())
  expect(unnamed.map((control) => control.outerHTML)).toEqual([])
}

function renderAndCheck(node) {
  const view = render(node)
  expectEveryControlNamed(view.container)
  view.unmount()
}

describe('property control accessible names', () => {
  it('names common, image, media, chart, code, shape, table, and timeline controls', () => {
    const base = { id: 'el-1', type: 'shape', x: 10, y: 20, width: 300, height: 200 }
    renderAndCheck(
      <CommonElementControls
        element={base}
        elements={[base]}
        selectedElementIds={[base.id]}
        onUpdate={noop}
        onBringForward={noop}
        onSendBackward={noop}
        onDelete={noop}
      />
    )
    renderAndCheck(<ImageProperties element={{ type: 'image' }} onUpdate={noop} />)
    renderAndCheck(<MediaProperties element={{ type: 'video' }} onUpdate={noop} />)
    renderAndCheck(<MediaProperties element={{ type: 'audio' }} onUpdate={noop} />)
    renderAndCheck(<ChartProperties element={{ type: 'chart', chartData: { labels: [], datasets: [{ label: 'A', data: [] }] } }} onUpdate={noop} />)
    renderAndCheck(<CodeProperties element={{ type: 'code', walkthroughSteps: [{ label: 'Step 1', startLine: 1, endLine: 2 }] }} onUpdate={noop} onEditCode={noop} />)
    renderAndCheck(<ShapeProperties element={base} elements={[base]} selectedElementIds={[base.id]} onUpdate={noop} />)
    const line = { ...base, id: 'line-1', type: 'line' }
    renderAndCheck(<ShapeProperties element={line} elements={[line]} selectedElementIds={[line.id]} onUpdate={noop} />)
    renderAndCheck(<TableProperties element={{ type: 'table', data: [['A', 'B'], ['C', 'D']] }} onUpdate={noop} />)
    renderAndCheck(<TimelineProperties element={{ type: 'timeline', events: [{ id: 'event-1', date: '2025', title: 'Launch' }] }} onUpdate={noop} />)
  })

  it('names controls for every miscellaneous property surface', () => {
    const variants = [
      { type: 'html' },
      { type: 'latex' },
      { type: 'markdown' },
      { type: 'callout' },
      { type: 'icon' },
      { type: 'qrcode' },
      { type: 'drawing', paths: [] },
      { type: 'line' },
      { type: 'svg' },
    ]
    for (const element of variants) {
      renderAndCheck(
        <MiscProperties
          element={element}
          onUpdate={noop}
          onDelete={noop}
          onEditHtml={noop}
          onEditLatex={noop}
        />
      )
    }
  })

  it('names controls in both tabs for every game type', () => {
    for (const gameType of GAME_TYPES.all) {
      const view = render(
        <GameProperties
          element={{
            id: `game-${gameType}`,
            type: 'game',
            gameType,
            [gameType]: GAME_TYPE_DEFAULTS[gameType],
          }}
          onUpdate={noop}
          onDelete={noop}
        />
      )
      expectEveryControlNamed(view.container)
      view.getByRole('tab', { name: 'Display' }).click()
      expectEveryControlNamed(view.container)
      view.unmount()
    }
  })
})

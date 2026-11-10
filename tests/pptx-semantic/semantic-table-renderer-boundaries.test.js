import { describe, expect, it } from 'vitest'
import { renderSemanticTable } from '../../shared/src/pptx-table-renderer.js'
import { options, table } from './semantic-table-renderer-fixtures.js'

describe('canonical table renderer bounded paint ownership', () => {
  it('rejects competing shared-edge declarations rather than overpainting twice', () => {
    const input = table()
    const border = { width: 19050, color: { kind: 'srgb', value: '123456' } }
    input.rows[0].cells[0].properties.borders = { right: border }
    input.rows[0].cells[1].properties.borders = { left: { ...border, width: 9525 } }
    expect(() => renderSemanticTable(input, options())).toThrow(/shared-edge/)
  })
  it('retains authored row spans and unequal row heights without drawing covered text', () => {
    const input = table()
    const second = structuredClone(input.rows[0])
    second.componentId = 'row1'
    second.heightEmu = 476250
    for (const cell of second.cells) {
      const id = `${cell.componentId}2`
      Object.assign(cell, { componentId: id, anchorCellId: id })
      cell.textDocument.componentId = `${id}:body`
      cell.textDocument.paragraphs[0].componentId = `${id}:p`
      cell.textDocument.paragraphs[0].runs[0].componentId = `${id}:r`
    }
    input.rows.push(second)
    input.rows[0].cells[0].merge.rowSpan = 2
    Object.assign(second.cells[0], { anchorCellId: 'a', merge: { vMerge: true } })
    const before = JSON.stringify(input)
    const svg = renderSemanticTable(input, options())
    expect(svg).toContain('width="300" height="150"')
    expect(svg).toContain('transform="translate(100 100)"')
    expect(svg).not.toContain('data-pptx-table-cell="a2"')
    expect(JSON.stringify(input)).toBe(before)
  })
})

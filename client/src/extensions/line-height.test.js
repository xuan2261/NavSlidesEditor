import { describe, it, expect } from 'vitest'
import { LineHeight } from './tiptap-line-height-extension'

describe('LineHeight extension', () => {
  it('has correct name', () => {
    expect(LineHeight.name).toBe('lineHeight')
  })

  it('targets paragraph, heading, and list types', () => {
    const types = LineHeight.options.types
    expect(types).toContain('paragraph')
    expect(types).toContain('heading')
    expect(types).toContain('listItem')
    expect(types).toContain('bulletList')
    expect(types).toContain('orderedList')
  })

  it('parses lineHeight from HTML element style', () => {
    const globalAttrs = LineHeight.config.addGlobalAttributes.call({ options: LineHeight.options })
    const lineHeightAttr = globalAttrs[0].attributes.lineHeight

    expect(lineHeightAttr.parseHTML({ style: { lineHeight: '1.5' } })).toBe('1.5')
    expect(lineHeightAttr.parseHTML({ style: { lineHeight: '2' } })).toBe('2')
    expect(lineHeightAttr.parseHTML({ style: {} })).toBe(null)
    expect(lineHeightAttr.parseHTML({ style: { color: 'red' } })).toBe(null)
  })

  it('renders lineHeight to HTML attributes', () => {
    const globalAttrs = LineHeight.config.addGlobalAttributes.call({ options: LineHeight.options })
    const lineHeightAttr = globalAttrs[0].attributes.lineHeight

    expect(lineHeightAttr.renderHTML({ lineHeight: '1.5' })).toEqual({ style: 'line-height: 1.5' })
    expect(lineHeightAttr.renderHTML({ lineHeight: '2' })).toEqual({ style: 'line-height: 2' })
    expect(lineHeightAttr.renderHTML({ lineHeight: null })).toEqual({})
    expect(lineHeightAttr.renderHTML({})).toEqual({})
  })

  it('has setLineHeight and unsetLineHeight commands', () => {
    expect(typeof LineHeight.config.addCommands).toBe('function')
    const commands = LineHeight.config.addCommands()
    expect(commands.setLineHeight).toBeDefined()
    expect(commands.unsetLineHeight).toBeDefined()
  })
})

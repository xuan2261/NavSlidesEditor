import { describe, it, expect } from 'vitest'
import { FontWeight } from './tiptap-font-weight-extension'

describe('FontWeight extension', () => {
  it('has correct name', () => {
    expect(FontWeight.name).toBe('fontWeight')
  })

  it('targets textStyle types', () => {
    expect(FontWeight.options.types).toEqual(['textStyle'])
  })

  it('parses fontWeight from HTML element style', () => {
    const globalAttrs = FontWeight.config.addGlobalAttributes.call({ options: FontWeight.options })
    const fontWeightAttr = globalAttrs[0].attributes.fontWeight

    expect(fontWeightAttr.parseHTML({ style: { fontWeight: '700' } })).toBe('700')
    expect(fontWeightAttr.parseHTML({ style: { fontWeight: '300' } })).toBe('300')
    expect(fontWeightAttr.parseHTML({ style: {} })).toBe(null)
    expect(fontWeightAttr.parseHTML({ style: { color: 'red' } })).toBe(null)
  })

  it('renders fontWeight to HTML attributes', () => {
    const globalAttrs = FontWeight.config.addGlobalAttributes.call({ options: FontWeight.options })
    const fontWeightAttr = globalAttrs[0].attributes.fontWeight

    expect(fontWeightAttr.renderHTML({ fontWeight: '700' })).toEqual({ style: 'font-weight: 700' })
    expect(fontWeightAttr.renderHTML({ fontWeight: '400' })).toEqual({ style: 'font-weight: 400' })
    expect(fontWeightAttr.renderHTML({ fontWeight: null })).toEqual({})
    expect(fontWeightAttr.renderHTML({})).toEqual({})
  })

  it('has setFontWeight command', () => {
    expect(typeof FontWeight.config.addCommands).toBe('function')
    const commands = FontWeight.config.addCommands()
    expect(commands.setFontWeight).toBeDefined()
    expect(commands.unsetFontWeight).toBeDefined()
  })
})

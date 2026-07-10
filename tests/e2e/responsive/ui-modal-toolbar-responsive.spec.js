import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { test, expect } from '@playwright/test'

const read = (path) => readFileSync(join(cwd(), path), 'utf8')

test.describe('responsive modal and toolbar contracts', () => {
  test('[F10] TemplatePicker uses responsive columns for narrow and desktop widths', () => {
    const source = read('client/src/components/TemplatePickerModal.jsx')

    expect(source).toContain('grid-cols-1')
    expect(source).toContain('sm:grid-cols-2')
    expect(source).toContain('lg:grid-cols-4')
  })

  test('[F11] MediaLibrary toolbar wraps and upload is a keyboard button', () => {
    const source = read('client/src/components/MediaLibraryModal.jsx')

    expect(source).toContain('flex flex-wrap')
    expect(source).toContain('min-w-[180px]')
    expect(source).toContain('uploadInputRef.current?.click()')
    expect(source).not.toMatch(/<label[\s\S]*Upload[\s\S]*type="file"/)
  })
})

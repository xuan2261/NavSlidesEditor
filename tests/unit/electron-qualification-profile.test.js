import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { resolveQualificationProfile } from '../../electron/qualification-profile.js'

const normal = path.resolve('normal-electron-profile')
describe('qualification profile isolation', () => {
  it('keeps an unset override out of normal desktop startup and accepts a separate absolute profile', () => {
    expect(resolveQualificationProfile(undefined, normal)).toBeUndefined()
    const dedicated = path.resolve('.tmp/desktop-qualification/user-data')
    expect(resolveQualificationProfile(dedicated, normal)).toBe(dedicated)
  })
  it.each([
    '',
    'relative/user-data',
    ` ${path.resolve('qualification')} `,
    `${path.parse(normal).root}qualification${path.sep}..${path.sep}user-data`,
    `${path.resolve('qualification')}\0`,
  ])('rejects ambiguous or unsafe override %j before a profile can be selected', (value) => {
    expect(() => resolveQualificationProfile(value, normal)).toThrow('absolute dedicated directory')
  })
  it.each([
    normal,
    path.join(normal, 'qualification-child'),
    path.dirname(normal),
    path.parse(normal).root,
  ])('rejects overlap with normal user data or the filesystem root: %s', (value) => {
    expect(() => resolveQualificationProfile(value, normal)).toThrow('must not overlap')
  })
})

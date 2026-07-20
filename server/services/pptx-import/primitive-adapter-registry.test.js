import { describe, expect, it, vi } from 'vitest'
import registryModule from './primitive-adapter-registry.js'

const { PRIMITIVE_ADAPTER_REGISTRY, getPrimitiveAdapterDefinition, resolvePrimitiveAdapter } = registryModule

describe('primitive adapter registry safety', () => {
  it('uses a null-prototype own-key registry', () => {
    expect(Object.getPrototypeOf(PRIMITIVE_ADAPTER_REGISTRY)).toBeNull()
    expect(getPrimitiveAdapterDefinition('native-text-plain-run')).toMatchObject({
      method: 'applyTextPatch', overrideKey: 'nativeTextAdapter',
    })
    expect(getPrimitiveAdapterDefinition('toString')).toBeNull()
    expect(getPrimitiveAdapterDefinition('__proto__')).toBeNull()
  })

  it('rejects inherited, accessor, and prototype override keys', () => {
    const inherited = Object.create({ nativeTextAdapter: { applyTextPatch: vi.fn() } })
    expect(resolvePrimitiveAdapter('native-text-plain-run', inherited)).toBeNull()

    const accessor = {}
    Object.defineProperty(accessor, 'nativeTextAdapter', { get() { throw new Error('getter') } })
    expect(resolvePrimitiveAdapter('native-text-plain-run', accessor)).toBeNull()
    expect(resolvePrimitiveAdapter('__proto__', {})).toBeNull()
  })

  it('rejects inherited and accessor adapter methods without invoking getters', () => {
    const inheritedMethod = { nativeTextAdapter: Object.create({ applyTextPatch() {} }) }
    expect(resolvePrimitiveAdapter('native-text-plain-run', inheritedMethod)).toBeNull()

    const methodGetter = vi.fn(() => { throw new Error('method getter') })
    const accessorMethod = { nativeTextAdapter: {} }
    Object.defineProperty(accessorMethod.nativeTextAdapter, 'applyTextPatch', { get: methodGetter })
    expect(resolvePrimitiveAdapter('native-text-plain-run', accessorMethod)).toBeNull()
    expect(methodGetter).not.toHaveBeenCalled()
  })

  it('captures an own adapter method when resolving an override', () => {
    const original = vi.fn(() => 'original')
    const replacement = vi.fn(() => 'replacement')
    const adapter = { applyTextPatch: original }
    const resolved = resolvePrimitiveAdapter('native-text-plain-run', { nativeTextAdapter: adapter })
    adapter.applyTextPatch = replacement

    expect(resolved.apply('bytes', { id: 'operation' })).toBe('original')
    expect(original).toHaveBeenCalledWith('bytes', { id: 'operation' })
    expect(replacement).not.toHaveBeenCalled()
  })
})

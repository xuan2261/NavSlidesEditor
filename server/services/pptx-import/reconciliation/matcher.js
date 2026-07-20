function ancestryKey(object) {
  return (object.ancestry || []).join('/')
}

function identityKey(object) {
  if (!object.nativeId) return null
  return `${object.slidePart}|${ancestryKey(object)}|${object.nativeId}`
}

function diagnosticKey(object) {
  return [
    object.slidePart,
    ancestryKey(object),
    object.kind,
    object.name || '',
  ].join('|')
}

function result(native, shadow, method, confidence) {
  return {
    native,
    shadow,
    method,
    confidence,
    patchAuthority: false,
  }
}

function matchObjects(nativeObjects, shadowObjects) {
  const matches = []
  const ambiguities = []
  const usedNative = new Set()
  const usedShadow = new Set()
  const nativeExact = new Map()

  nativeObjects.forEach((object, index) => {
    const key = identityKey(object)
    if (!key) return
    const candidates = nativeExact.get(key) || []
    candidates.push(index)
    nativeExact.set(key, candidates)
  })

  shadowObjects.forEach((shadow, shadowIndex) => {
    const key = identityKey(shadow)
    if (!key) return
    const candidates = (nativeExact.get(key) || []).filter((index) => !usedNative.has(index))
    if (candidates.length === 1) {
      const nativeIndex = candidates[0]
      usedNative.add(nativeIndex)
      usedShadow.add(shadowIndex)
      matches.push(result(nativeObjects[nativeIndex], shadow, 'native-id', 1))
    } else if (candidates.length > 1) {
      usedShadow.add(shadowIndex)
      ambiguities.push({
        slidePart: shadow.slidePart,
        shadow,
        candidates: candidates.map((index) => nativeObjects[index]),
        method: 'native-id',
        patchAuthority: false,
      })
    }
  })

  shadowObjects.forEach((shadow, shadowIndex) => {
    if (usedShadow.has(shadowIndex)) return
    const key = diagnosticKey(shadow)
    const candidates = nativeObjects
      .map((native, index) => ({ native, index }))
      .filter(({ native, index }) => !usedNative.has(index) && diagnosticKey(native) === key)
    if (candidates.length === 1) {
      usedNative.add(candidates[0].index)
      usedShadow.add(shadowIndex)
      matches.push(result(candidates[0].native, shadow, 'diagnostic', 0.5))
    } else if (candidates.length > 1) {
      usedShadow.add(shadowIndex)
      ambiguities.push({
        slidePart: shadow.slidePart,
        shadow,
        candidates: candidates.map(({ native }) => native),
        method: 'diagnostic',
        patchAuthority: false,
      })
    }
  })

  return {
    matches,
    ambiguities,
    nativeOnly: nativeObjects.filter((_, index) => !usedNative.has(index)),
    shadowOnly: shadowObjects.filter((_, index) => !usedShadow.has(index)),
  }
}

module.exports = { matchObjects }

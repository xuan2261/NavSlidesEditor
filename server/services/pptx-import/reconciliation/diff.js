const { canonicalReport, reportHash, stableJson } = require('./canonical')
const { matchObjects } = require('./matcher')

function same(left, right) {
  return stableJson(left ?? null) === stableJson(right ?? null)
}

function identity(object) {
  return {
    slidePart: object.slidePart,
    nativeId: object.nativeId,
    name: object.name,
    ancestry: object.ancestry,
    kind: object.kind,
  }
}

function discrepancy(type, native, shadow, values, severity = 'warning') {
  return {
    type,
    severity,
    slidePart: native?.slidePart || shadow?.slidePart,
    object: identity(native || shadow),
    native: {
      value: values?.native,
      lineage: native?.lineage || null,
    },
    shadow: {
      value: values?.shadow,
      lineage: shadow?.lineage || null,
    },
    patchAuthority: false,
  }
}

function compareMatch(match) {
  const { native, shadow } = match
  const diffs = []
  if (native.kind !== shadow.kind) {
    diffs.push(discrepancy('kind', native, shadow, {
      native: native.kind, shadow: shadow.kind,
    }))
  }
  for (const [type, field] of [
    ['geometry', 'transform'],
    ['style', 'style'],
    ['unknown', 'unknown'],
  ]) {
    if (!same(native[field], shadow[field])) {
      diffs.push(discrepancy(type, native, shadow, {
        native: native[field], shadow: shadow[field],
      }))
    }
  }
  const nativeRelationships = {
    relationships: native.relationships,
    dependentParts: native.dependentParts,
  }
  const shadowRelationships = {
    relationships: shadow.relationships,
    dependentParts: shadow.dependentParts,
  }
  if (!same(nativeRelationships, shadowRelationships)) {
    diffs.push(discrepancy('relationship', native, shadow, {
      native: nativeRelationships,
      shadow: shadowRelationships,
    }))
  }
  return diffs
}

function flatten(inventory) {
  return inventory.slides.flatMap((slide) => slide.objects)
}

function scopeObject(slidePart, source, kind) {
  return {
    slidePart,
    nativeId: null,
    name: slidePart,
    ancestry: [],
    kind,
    lineage: { source, method: 'inventory-scope', confidence: 1, warnings: [] },
  }
}

function compareScopes(nativeInventory, shadowInventory) {
  const diffs = []
  const packageFields = {
    size: nativeInventory.package.size,
    layoutParts: nativeInventory.package.layoutParts,
    masterParts: nativeInventory.package.masterParts,
    themeParts: nativeInventory.package.themeParts,
    dependentParts: nativeInventory.package.dependentParts,
  }
  const shadowPackageFields = {
    size: shadowInventory.package.size,
    layoutParts: shadowInventory.package.layoutParts,
    masterParts: shadowInventory.package.masterParts,
    themeParts: shadowInventory.package.themeParts,
    dependentParts: shadowInventory.package.dependentParts,
  }
  if (!same(packageFields, shadowPackageFields)) {
    diffs.push(discrepancy(
      'relationship',
      scopeObject('[package]', 'native', 'package'),
      scopeObject('[package]', 'officecli', 'package'),
      { native: packageFields, shadow: shadowPackageFields }
    ))
  }
  const shadowByPart = new Map(shadowInventory.slides.map((slide) => [slide.part, slide]))
  for (const nativeSlide of nativeInventory.slides) {
    const shadowSlide = shadowByPart.get(nativeSlide.part)
    if (!shadowSlide) continue
    const nativeScope = scopeObject(nativeSlide.part, 'native', 'slide')
    const shadowScope = scopeObject(shadowSlide.part, 'officecli', 'slide')
    if (!same(nativeSlide.size, shadowSlide.size)) {
      diffs.push(discrepancy('geometry', nativeScope, shadowScope, {
        native: nativeSlide.size, shadow: shadowSlide.size,
      }))
    }
    if (!same(nativeSlide.inheritance, shadowSlide.inheritance)) {
      diffs.push(discrepancy('style', nativeScope, shadowScope, {
        native: nativeSlide.inheritance, shadow: shadowSlide.inheritance,
      }))
    }
    if (!same(nativeSlide.relationships, shadowSlide.relationships)) {
      diffs.push(discrepancy('relationship', nativeScope, shadowScope, {
        native: nativeSlide.relationships, shadow: shadowSlide.relationships,
      }))
    }
  }
  return diffs
}

function reconcileInventories(nativeInventory, shadowInventory) {
  const matching = matchObjects(flatten(nativeInventory), flatten(shadowInventory))
  const diffs = [
    ...compareScopes(nativeInventory, shadowInventory),
    ...matching.matches.flatMap(compareMatch),
  ]
  for (const object of matching.nativeOnly) {
    diffs.push(discrepancy('missing', object, null, {
      native: identity(object), shadow: null,
    }, 'info'))
  }
  for (const object of matching.shadowOnly) {
    diffs.push(discrepancy('missing', null, object, {
      native: null, shadow: identity(object),
    }, 'info'))
  }
  for (const ambiguity of matching.ambiguities) {
    diffs.push({
      type: 'ambiguity',
      severity: 'warning',
      slidePart: ambiguity.slidePart,
      object: identity(ambiguity.shadow),
      native: {
        value: ambiguity.candidates.map(identity),
        lineage: ambiguity.candidates.map((object) => object.lineage),
      },
      shadow: {
        value: identity(ambiguity.shadow),
        lineage: ambiguity.shadow.lineage,
      },
      matchMethod: ambiguity.method,
      patchAuthority: false,
    })
  }
  const report = canonicalReport({
    schemaVersion: 1,
    nativeRevisionId: nativeInventory.revisionId,
    shadowRevisionId: shadowInventory.revisionId,
    matches: matching.matches.map((match) => ({
      native: identity(match.native),
      shadow: identity(match.shadow),
      method: match.method,
      confidence: match.confidence,
      patchAuthority: false,
    })),
    ambiguities: matching.ambiguities.map((ambiguity) => ({
      slidePart: ambiguity.slidePart,
      shadow: identity(ambiguity.shadow),
      candidates: ambiguity.candidates.map(identity),
      method: ambiguity.method,
      patchAuthority: false,
    })),
    diffs,
  })
  return { ...report, hash: reportHash(report) }
}

module.exports = { reconcileInventories }

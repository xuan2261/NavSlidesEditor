const { layoutFailure } = require('./pptx-smartart-layout-declarations')

function solveLayoutConstraints(nodes, bounds) {
  const values = new Map(),
    equations = []
  const key = (node, property) => `${node.index}:${property}`
  function set(node, property, value, declaration) {
    const k = key(node, property)
    if (!Number.isFinite(value) || (['w', 'h', 'sp'].includes(property) && value < 0))
      layoutFailure(declaration, 'invalid constraint result')
    if (values.has(k) && values.get(k) !== value)
      layoutFailure(declaration, `conflicting constraint ${property}`)
    values.set(k, value)
  }
  const get = (node, property) => values.get(key(node, property))
  function scope(node, which, name, d) {
    const result = (which === 'ch' ? node.children : [node]).filter(
      (n) => name === undefined || n.declaration.attributes.name === name
    )
    if (!result.length) layoutFailure(d, 'unresolved constraint target/reference')
    return result
  }
  for (const [property, value] of Object.entries({ l: 0, t: 0, w: bounds.width, h: bounds.height }))
    set(nodes[0], property, value, nodes[0].declaration)
  for (const node of nodes) {
    for (const d of node.constraints) {
      const a = d.attributes,
        targets = scope(node, a.for ?? 'self', a.forName, d)
      let reference
      if (a.refType) {
        const references = scope(node, a.refFor ?? 'self', a.refForName, d)
        if (references.length !== 1) layoutFailure(d, 'ambiguous constraint reference')
        reference = references[0]
      }
      for (const target of targets) equations.push({ target, reference, declaration: d })
    }
  }
  // Each equation is an authored equality. Never solve an underdetermined
  // system by inventing a size, dropping a constraint or silently fitting.
  function solve() {
    let progress = false
    for (let i = equations.length - 1; i >= 0; i--) {
      const e = equations[i],
        a = e.declaration.attributes
      const value = e.reference ? get(e.reference, a.refType) : a.val
      if (value === undefined) continue
      set(e.target, a.type, value * (a.fact ?? 1), e.declaration)
      equations.splice(i, 1)
      progress = true
    }
    return progress
  }
  const linear = nodes.filter((n) => n.algorithm.attributes.type === 'lin')
  while (true) {
    let progress = solve()
    for (let i = linear.length - 1; i >= 0; i--) {
      const node = linear[i],
        horizontal = ['fromL', 'fromR'].includes(node.params.linDir)
      const size = horizontal ? 'w' : 'h',
        cross = horizontal ? 'h' : 'w'
      const gap = node.children.length > 1 ? get(node, 'sp') : 0
      if (
        gap === undefined ||
        get(node, size) === undefined ||
        get(node, cross) === undefined ||
        node.children.some((c) => get(c, size) === undefined || get(c, cross) === undefined)
      )
        continue
      const reverse = ['fromR', 'fromB'].includes(node.params.linDir)
      let cursor = reverse ? get(node, size) : 0
      for (const child of node.children) {
        const extent = get(child, size)
        if (reverse) cursor -= extent
        const align = horizontal ? node.params.vertAlign : node.params.horzAlign
        const factor = ['mid', 'ctr'].includes(align) ? 0.5 : ['b', 'r'].includes(align) ? 1 : 0
        set(child, horizontal ? 'l' : 't', cursor, node.algorithm)
        set(
          child,
          horizontal ? 't' : 'l',
          (get(node, cross) - get(child, cross)) * factor,
          node.algorithm
        )
        cursor += reverse ? -gap : extent + gap
      }
      linear.splice(i, 1)
      progress = true
    }
    if (!progress) break
  }
  if (equations.length) layoutFailure(equations[0].declaration, 'cyclic/underconstrained reference')
  if (linear.length)
    layoutFailure(linear[0].algorithm, 'underconstrained linear dimensions/spacing')
  for (const node of nodes)
    if (['w', 'h', 'l', 't'].some((property) => get(node, property) === undefined))
      layoutFailure(node.declaration, 'underconstrained placement')
  return get
}
module.exports = { solveLayoutConstraints }

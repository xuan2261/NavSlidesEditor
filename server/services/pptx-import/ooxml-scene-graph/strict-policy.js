function resolveSceneGraphStrictPolicy(options = {}, env = process.env) {
  const strict = options.strict === true || env.PPTX_SLA_STRICT === '1'
  return {
    strict,
    strictCountGate:
      strict || options.strictCountGate === true || env.PPTX_SLA_STRICT_COUNT === '1',
    strictNodeGate:
      strict || options.strictNodeGate === true || env.PPTX_SLA_STRICT_NODES === '1',
  }
}

module.exports = { resolveSceneGraphStrictPolicy }

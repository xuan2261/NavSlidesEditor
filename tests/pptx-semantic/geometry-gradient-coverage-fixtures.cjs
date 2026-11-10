function gradientCoverageGeometry({
  width = 180,
  alpha = 100000,
  constant = false,
  hard = false,
} = {}) {
  const stops = hard
    ? [
        [0, 'F01E3C', 100000],
        [90000, 'F01E3C', 100000],
        [90000, '1E50F0', 0],
        [100000, '1E50F0', 0],
      ]
    : [
        [0, 'F01E3C', alpha],
        [100000, constant ? 'F01E3C' : '1E50F0', alpha],
      ]
  return {
    width,
    height: 120,
    style: {
      fill: {
        gradient: {
          kind: 'path',
          path: 'circle',
          rotWithShape: true,
          tileRect: { l: 25000, t: 25000, r: 25000, b: 25000 },
          fillToRect: constant
            ? { l: -100000, t: -100000, r: -100000, b: -100000 }
            : { l: 10000, r: 30000, t: 40000, b: 40000 },
          stops: stops.map(([pos, value, opacity]) => ({
            pos,
            color: { kind: 'srgb', value, transforms: [{ kind: 'alpha', value: opacity }] },
          })),
        },
      },
    },
  }
}

module.exports = { gradientCoverageGeometry }

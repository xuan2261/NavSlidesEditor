// Native DrawingML domains shared by source grammar and paint evaluation.
// Keep this leaf free of document/renderer imports: they consume it during startup.
const GEOMETRY_COLOR_TRANSFORM_RANGES = Object.freeze({
  tint: [0, 100000],
  shade: [0, 100000],
  alpha: [0, 100000],
  alphaOff: [-100000, 100000],
  alphaMod: [0, 2147483647],
  hue: [0, 21599999],
  hueOff: [-2147483648, 2147483647],
  hueMod: [0, 2147483647],
  ...Object.fromEntries(
    ['sat', 'lum', 'red', 'green', 'blue'].flatMap((kind) =>
      [kind, kind + 'Off', kind + 'Mod'].map((name) => [name, [-2147483648, 2147483647]])
    )
  ),
})
module.exports = { GEOMETRY_COLOR_TRANSFORM_RANGES }

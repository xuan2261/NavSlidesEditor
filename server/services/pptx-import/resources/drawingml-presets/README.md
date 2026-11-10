# DrawingML preset geometry source

`drawingml-preset-shapes.xml` is the unmodified Apache POI resource from:

https://github.com/apache/poi/blob/338882ac8898df5c13a7d15f533204c5dd8607d6/poi/src/main/resources/org/apache/poi/sl/draw/geom/presetShapeDefinitions.xml

SHA-256: `4a762444d8d85876881c02a5b1dedf6f73006fcd8acb7b4e393435615b37c780`.
The catalog has 187 preset definitions. `LICENSE` and `NOTICE` are copied from
the same commit's `legal/` directory.

NavSlides resolves the authored DrawingML formulas and path commands into its
canonical geometry model. The catalog does not establish native render-engine
fidelity, export eligibility or full preset qualification. Import retains the
preset name, source adjustments and resolved geometry; unsupported input fails
instead of using a generic shape alias.

The pinned catalog has eight `+-` formulas with an extra fourth operand `0`
in `circularArrow`, `leftCircularArrow` and `leftRightCircularArrow` (`xB`,
`yB`, `xJ`, `yJ`). POI's evaluator consumes the first three operands. The
source adapter removes that exact trailing operand only for these catalog
records, leaving the vendored file unchanged. User-authored formulas retain
strict operator arity. The catalog also reuses guide names in evaluation
order; the core preserves that order instead of rejecting valid reassignment.

Native EMU circular-arrow formulas contain degree-3 and degree-4 intermediates,
not just coordinates. The shared evaluator infers their degree from the ordered
whitelisted formulas for custom and preset geometry alike; preset names and
persisted metadata grant no exception. Constants, ordinary/unproved results and
geometric coordinates retain the absolute `1e15` bound. Only proved degree-2/3/4
guide results use `1e15 * max(1, width, height)^degree`. Numeric literals are
checked even in unselected branches, and derived path-grid coordinates and arc
centers/endpoints are bounded in the native geometry domain.

The proof is transient and recomputed after JSON reload. Extent-free source
templates defer unknown arithmetic and are compiled independently at every
protected real context, including hidden or override-masked contexts. Source
formulas, operation order and actual extents remain unchanged. These admission
bounds and small-grid scaling checks do not establish floating-point accuracy,
independent native pixel fidelity or export eligibility.

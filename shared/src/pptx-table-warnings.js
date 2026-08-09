const TABLE_ROTATION_CONTROL = 'table-layout-rotation'
const TABLE_ROTATION_FALLBACK = 'native-table-unrotated'
const TABLE_ROTATION_MATRIX_ROW = 'table.table-layout-rotation.pptx-export'

function hasUnsupportedTableRotation(element) {
  const rotation = Number(element?.rotation)
  return Number.isFinite(rotation) && Math.abs(rotation % 360) > 0.0001
}

function attachPptxExportReport(warnings) {
  if (!warnings || typeof warnings !== 'object') return null
  if (!warnings.exportReport) {
    Object.defineProperty(warnings, 'exportReport', {
      configurable: true,
      enumerable: false,
      value: { surface: 'pptx-export', warningCount: 0, warnings: [] },
    })
  }
  return warnings.exportReport
}

function recordPptxTableRotationWarning(warnings, { element, slideNumber }) {
  if (!hasUnsupportedTableRotation(element)) return false

  const message = `Slide ${slideNumber}: table rotation is unsupported; exported as an editable native table without rotation`
  warnings.push(message)
  const report = attachPptxExportReport(warnings)
  if (!report) return true

  report.warnings.push({
    elementId: element?.id || null,
    elementType: 'table',
    control: TABLE_ROTATION_CONTROL,
    surface: 'pptx-export',
    matrixRowId: TABLE_ROTATION_MATRIX_ROW,
    severity: 'warning',
    message,
    fallback: TABLE_ROTATION_FALLBACK,
    slideNumber,
  })
  report.warningCount = report.warnings.length
  return true
}

module.exports = {
  TABLE_ROTATION_CONTROL,
  TABLE_ROTATION_FALLBACK,
  TABLE_ROTATION_MATRIX_ROW,
  hasUnsupportedTableRotation,
  recordPptxTableRotationWarning,
}

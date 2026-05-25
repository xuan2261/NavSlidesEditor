const uuidv4 = () => require('node:crypto').randomUUID()
const { mapBox, readNumber } = require('../geometry')

function baseElement(element, scale, zIndex, box = null) {
  return {
    id: uuidv4(),
    ...(box || mapBox(element, scale)),
    rotation: readNumber(element?.rotate, 0),
    opacity: typeof element.opacity === 'number' ? element.opacity : 1,
    zIndex,
  }
}

function shapeName(shapType = '') {
  const s = String(shapType || '').toLowerCase()
  const n = s.replace(/[\s_-]/g, '')

  if (n.includes('ellipse') || n.includes('oval') || n.includes('circle')) return 'circle'
  if (n.includes('triangle') || n.includes('isoscelestriangle') || n.includes('righttriangle')) return 'triangle'
  if (n.includes('diamond') || n.includes('rhombus')) return 'diamond'
  if (n.includes('arrow')) return 'arrow-right'
  if (n === 'line' || n.includes('line') && !n.includes('arrow') && !n.includes('connector') && !n.includes('straight')) return 'line'
  if (n.includes('straightconnector') || n.includes('straight') && n.includes('connector')) return 'line'
  if (n.includes('round') || n.includes('roundedrect') || n.includes('rounded') || n.includes('corner')) return 'rounded-rect'
  if (/star/.test(n) && /\d/.test(n)) return 'star'
  if (n.includes('star4') || n.includes('star5') || n.includes('star6') || n.includes('star7') || n.includes('star8') || n.includes('star10') || n.includes('star12')) return 'star'
  if (n.includes('hexagon')) return 'hexagon'
  if (n.includes('pentagon')) return 'pentagon'
  if (n.includes('cloud')) return 'cloud'
  if (n.includes('cylinder') || n.includes('can')) return 'cylinder'
  if (n.includes('parallelogram')) return 'parallelogram'
  if (n.includes('trapezoid')) return 'trapezoid'
  if (n.includes('bracket') || n.includes('leftbrace') || n.includes('rightbrace') || n.includes('brace')) return 'bracket'
  return 'rect'
}

function warning(warnings, slideIndex, type, message) {
  warnings.push({ slideIndex, type, message })
}

function extractShadow(element) {
  const s = element.shadow
  if (!s || typeof s !== 'object') return null
  return {
    shadowX: typeof s.h === 'number' ? s.h : 0,
    shadowY: typeof s.v === 'number' ? s.v : 0,
    shadowBlur: typeof s.blur === 'number' ? s.blur : 0,
    shadowColor: typeof s.color === 'string' ? s.color : '#000000',
  }
}

function placeholder(element, scale, zIndex, slideIndex, warnings, type, label) {
  warning(warnings, slideIndex, type, label)
  return {
    ...baseElement(element, scale, zIndex),
    type: 'shape',
    shape: 'rect',
    fill: '#fff7ed',
    stroke: '#f59e0b',
    strokeWidth: 2,
    locked: true,
    text: label,
    textColor: '#92400e',
    fontSize: 14,
    importPlaceholderType: type,
  }
}

module.exports = {
  baseElement,
  extractShadow,
  placeholder,
  shapeName,
  warning,
}

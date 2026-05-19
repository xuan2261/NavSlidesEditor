import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ThreeModal from './three-js-3d-scene-template-selector-modal.jsx'
import {
  TEMPLATES,
  DEFAULT_CUSTOM,
  generateThreeJsHtml,
  THREE_CDN,
  ORBIT_CDN,
} from '../data/three-js-3d-scene-templates.js'

const NAMED_IDS = [
  'rotating-cube',
  'wireframe-sphere',
  'particle-cloud',
  'torus-knot',
  'wave-plane',
  'galaxy',
  'terrain',
  'instanced-spheres',
]

describe('three-js-3d-scene-templates data module — Slice 1 shape', () => {
  it('exports 9 templates including custom', () => {
    expect(TEMPLATES.length).toBe(9)
    const ids = TEMPLATES.map((t) => t.id)
    for (const id of NAMED_IDS) expect(ids).toContain(id)
    expect(ids).toContain('custom')
  })

  it('pins Three.js 0.162.0 in CDN URLs', () => {
    expect(THREE_CDN).toContain('three@0.162.0')
    expect(ORBIT_CDN).toContain('three@0.162.0')
    expect(ORBIT_CDN).toContain('OrbitControls')
  })

  it('exports generateThreeJsHtml as a function and DEFAULT_CUSTOM as string', () => {
    expect(typeof generateThreeJsHtml).toBe('function')
    expect(typeof DEFAULT_CUSTOM).toBe('string')
    expect(DEFAULT_CUSTOM.length).toBeGreaterThan(100)
  })
})

describe('generateThreeJsHtml — Slice 2 real template content', () => {
  // Regression guard: galaxy/terrain/instanced-spheres were previously aliased
  // to particle-cloud / wave-plane / wireframe-sphere. These assertions catch
  // any future re-aliasing.
  it('galaxy uses 5000 particles and lerp color blending', () => {
    const html = generateThreeJsHtml('galaxy', {})
    expect(html).toContain('5000')
    expect(html).toContain('lerp')
  })

  it('terrain uses computeVertexNormals and flatShading', () => {
    const html = generateThreeJsHtml('terrain', {})
    expect(html).toContain('computeVertexNormals')
    expect(html).toContain('flatShading')
  })

  it('instanced-spheres uses InstancedMesh', () => {
    const html = generateThreeJsHtml('instanced-spheres', {})
    expect(html).toContain('InstancedMesh')
  })

  it('all 8 named templates use importmap + OrbitControls (ES module + addons)', () => {
    for (const id of NAMED_IDS) {
      const html = generateThreeJsHtml(id, {})
      expect(html, `${id} importmap`).toContain('<script type="importmap">')
      expect(html, `${id} OrbitControls`).toContain('three/addons/controls/OrbitControls.js')
    }
  })
})

describe('generateThreeJsHtml — Slice 4 hybrid background API', () => {
  it('emits alpha:true and skips scene.background when transparent=true', () => {
    const html = generateThreeJsHtml('rotating-cube', {
      color: '#ff0000',
      background: '#abcdef',
      transparent: true,
      speed: 1,
    })
    expect(html).toContain('alpha:true')
    expect(html).not.toContain("scene.background=new THREE.Color('#abcdef')")
  })

  it('emits alpha:false and sets scene.background to the chosen color when transparent=false', () => {
    const html = generateThreeJsHtml('rotating-cube', {
      color: '#ff0000',
      background: '#abcdef',
      transparent: false,
      speed: 1,
    })
    expect(html).toContain('alpha:false')
    expect(html).toContain("scene.background=new THREE.Color('#abcdef')")
  })

  it('renderer options use canonical {antialias:true,alpha:...} ordering', () => {
    const html = generateThreeJsHtml('rotating-cube', { transparent: false })
    expect(html).toMatch(/\{antialias:true,alpha:(true|false)\}/)
  })

  it('changing color updates the generated HTML', () => {
    const a = generateThreeJsHtml('rotating-cube', { color: '#ff0000', transparent: false })
    const b = generateThreeJsHtml('rotating-cube', { color: '#00ff00', transparent: false })
    expect(a).toContain("'#ff0000'")
    expect(b).toContain("'#00ff00'")
  })
})

describe('ThreeJs3dSceneTemplateSelectorModal — existing UI contract', () => {
  it('renders all 9 template names', () => {
    render(<ThreeModal onInsert={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Rotating Cube')).toBeTruthy()
    expect(screen.getByText('Wireframe Sphere')).toBeTruthy()
    expect(screen.getByText('Particle Cloud')).toBeTruthy()
    expect(screen.getByText('Torus Knot')).toBeTruthy()
    expect(screen.getByText('Wave Plane')).toBeTruthy()
    expect(screen.getByText('Galaxy')).toBeTruthy()
    expect(screen.getByText('Terrain')).toBeTruthy()
    expect(screen.getByText('Instanced Spheres')).toBeTruthy()
    expect(screen.getByText('Custom Code')).toBeTruthy()
  })

  it('Insert calls onInsert with HTML containing Three.js + DOCTYPE', () => {
    const onInsert = vi.fn()
    render(<ThreeModal onInsert={onInsert} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /insert/i }))
    const html = onInsert.mock.calls[0][0]
    expect(html).toContain('three')
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('default template is rotating cube (BoxGeometry)', () => {
    const onInsert = vi.fn()
    render(<ThreeModal onInsert={onInsert} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /insert/i }))
    expect(onInsert.mock.calls[0][0]).toContain('BoxGeometry')
  })

  it('clicking Torus Knot switches selection', () => {
    const onInsert = vi.fn()
    render(<ThreeModal onInsert={onInsert} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Torus Knot'))
    fireEvent.click(screen.getByRole('button', { name: /insert/i }))
    expect(onInsert.mock.calls[0][0]).toContain('TorusKnotGeometry')
  })
})

describe('ThreeJs3dSceneTemplateSelectorModal — Slice 3 preview iframe', () => {
  it('renders preview iframe with sandbox="allow-scripts" (no allow-same-origin)', () => {
    const { container } = render(<ThreeModal onInsert={vi.fn()} onClose={vi.fn()} />)
    const iframe = container.querySelector('iframe[title="3D scene preview"]')
    expect(iframe).toBeTruthy()
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('default preview srcDoc contains BoxGeometry', () => {
    const { container } = render(<ThreeModal onInsert={vi.fn()} onClose={vi.fn()} />)
    const iframe = container.querySelector('iframe[title="3D scene preview"]')
    expect(iframe.getAttribute('srcdoc') || '').toContain('BoxGeometry')
  })
})

describe('ThreeJs3dSceneTemplateSelectorModal — Slice 4 hybrid bg controls', () => {
  it('renders foreground color, background color, Transparent checkbox, and speed inputs', () => {
    const { container } = render(<ThreeModal onInsert={vi.fn()} onClose={vi.fn()} />)
    const colorInputs = container.querySelectorAll('input[type="color"]')
    expect(colorInputs.length).toBe(2)
    expect(screen.getByLabelText(/transparent/i)).toBeTruthy()
    expect(container.querySelector('input[type="number"]')).toBeTruthy()
  })

  it('toggling Transparent makes Insert emit alpha:true HTML', () => {
    const onInsert = vi.fn()
    render(<ThreeModal onInsert={onInsert} onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(/transparent/i))
    fireEvent.click(screen.getByRole('button', { name: /insert/i }))
    const html = onInsert.mock.calls[0][0]
    expect(html).toContain('alpha:true')
  })
})

describe('ThreeJs3dSceneTemplateSelectorModal — Slice 5 custom mode', () => {
  it('switching to Custom Code loads DEFAULT_CUSTOM scaffold containing TorusGeometry', () => {
    render(<ThreeModal onInsert={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Custom Code'))
    const textarea = screen.getByRole('textbox')
    expect(textarea.value).toContain('TorusGeometry')
  })

  it('Tab key in custom textarea inserts 2 spaces', () => {
    render(<ThreeModal onInsert={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Custom Code'))
    const textarea = screen.getByRole('textbox')
    textarea.selectionStart = 0
    textarea.selectionEnd = 0
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(textarea.value.startsWith('  ')).toBe(true)
  })

  it('Edit as code on rotating-cube switches to custom and copies HTML containing BoxGeometry', () => {
    render(<ThreeModal onInsert={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /edit as code/i }))
    const textarea = screen.getByRole('textbox')
    expect(textarea.value).toContain('BoxGeometry')
  })

  it('Refresh Preview button is present in custom mode', () => {
    render(<ThreeModal onInsert={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Custom Code'))
    expect(screen.getByRole('button', { name: /refresh preview/i })).toBeTruthy()
  })
})

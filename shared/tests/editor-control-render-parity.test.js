import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { renderElement } from '../src/element-renderers.js'

const base = { id: 'audit-element', x: 40, y: 50, width: 400, height: 200 }
function inspect(element, check, opts = {}) {
  const dom = new JSDOM(renderElement({ ...base, ...element }, {}, opts))
  try {
    check(dom.window.document)
  } finally {
    dom.window.close()
  }
}

describe('authored control render parity', () => {
  it('preserves axis title text and top-right legend configuration in printed charts', () => {
    inspect(
      {
        type: 'chart',
        chartType: 'bar',
        legendPosition: 'topRight',
        axisTitles: { category: "Teacher's month <term>", value: 'Revenue' },
        chartData: { labels: ['A'], datasets: [{ label: 'Series', data: [-2] }] },
      },
      (document) => {
        const config = JSON.parse(
          document.querySelector('canvas').getAttribute('data-chart-config')
        )
        expect(config.options.plugins.legend.position).toBe('top')
        expect(config.options.plugins.legend.align).toBe('end')
        expect(config.options.scales.x.title.text).toBe("Teacher's month <term>")
        expect(config.options.scales.y.title.text).toBe('Revenue')
        expect(config.data.datasets[0].data).toEqual([-2])
      },
      { forPrint: true }
    )
  })

  it('overrides both SVG quote forms while preserving paint definitions and declaration priority', () => {
    inspect(
      {
        type: 'svg',
        fillOverride: '#22c55e',
        strokeOverride: '#112233',
        content: `<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop stop-color="#f00"/></linearGradient><rect fill="#f00"/></defs><rect id="solid" fill='#333' data-fill="retained" fill-opacity="0.5" style='stroke:#555;fill:#444 !important'/><circle id="gradient" fill="url(#g)" stroke="url(#g)"/></svg>`,
      },
      (document) => {
        const solid = document.querySelector('#solid')
        expect(solid.getAttribute('fill')).toBe('#22c55e')
        expect(solid.style.fill).toBe('#22c55e')
        expect(solid.style.getPropertyPriority('fill')).toBe('important')
        expect(solid.style.stroke).toBe('#112233')
        expect(solid.getAttribute('data-fill')).toBe('retained')
        expect(solid.getAttribute('fill-opacity')).toBe('0.5')
        expect(document.querySelector('defs rect').getAttribute('fill')).toBe('#f00')
        expect(document.querySelector('#gradient').getAttribute('fill')).toBe('url(#g)')
        expect(document.querySelector('#gradient').getAttribute('stroke')).toBe('url(#g)')
      }
    )
  })

  it('keeps gradient paint references after leading CSS comment trivia', () => {
    inspect(
      {
        type: 'svg',
        fillOverride: '#22c55e',
        strokeOverride: '#112233',
        content:
          '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop stop-color="#f00"/></linearGradient></defs><rect id="gradient" style="fill:/* retained paint */url(#g);stroke: /* first */ /* second */ url(#g)"/></svg>',
      },
      (document) => {
        const paint = document.defaultView.getComputedStyle(document.querySelector('#gradient'))
        expect(paint.fill).toBe('url(#g)')
        expect(paint.stroke).toBe('url(#g)')
        expect(document.querySelector('#g stop').getAttribute('stop-color')).toBe('#f00')
      }
    )
  })

  it('keeps cropped image citations outside the clipping layer', () => {
    inspect(
      {
        type: 'image',
        src: '/uploads/a.png',
        imageW: 500,
        imageH: 280,
        imageOffsetX: -50,
        imageOffsetY: -20,
        citationText: 'Source A',
      },
      (document) => {
        const image = document.querySelector('img')
        const citation = [...document.querySelectorAll('div')].find(
          (node) => node.textContent === 'Source A' && node.style.top === '100%'
        )
        expect(citation).toBeTruthy()
        let ancestor = citation.parentElement
        while (ancestor) {
          expect(ancestor.style.overflow).not.toBe('hidden')
          ancestor = ancestor.parentElement
        }
        expect(image.parentElement.style.overflow).toBe('hidden')
        expect(image.style.left).toBe('-50px')
      }
    )
  })

  it('preserves multiline table cells without interpreting their text as HTML', () => {
    inspect({ type: 'table', data: [['First\n<strong>Second</strong>']] }, (document) => {
      const cell = document.querySelector('td')
      expect(cell.textContent).toBe('First\n<strong>Second</strong>')
      expect(cell.style.whiteSpace).toBe('pre-wrap')
      expect(cell.querySelector('strong')).toBeNull()
    })
  })
})

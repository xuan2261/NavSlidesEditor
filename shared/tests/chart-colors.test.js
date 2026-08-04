const {
  DARK_CHART_GRID,
  DARK_CHART_TEXT,
  LIGHT_CHART_GRID,
  LIGHT_CHART_TEXT,
  getBackgroundLuminance,
  resolveChartBackground,
  resolveChartPalette,
} = require('../src/chart-colors.js')

describe('chart color palette', () => {
  it('selects light fallbacks for a dark solid background', () => {
    expect(getBackgroundLuminance({ type: 'color', color: '#1e1e2e' })).toBeLessThan(0.45)
    expect(resolveChartPalette({ type: 'color', color: '#1e1e2e' })).toEqual({
      text: LIGHT_CHART_TEXT,
      grid: LIGHT_CHART_GRID,
    })
  })

  it('selects dark fallbacks for a light gradient', () => {
    expect(resolveChartPalette({ type: 'gradient', gradient: 'linear-gradient(#fff, #f8f9fa)' })).toEqual({
      text: DARK_CHART_TEXT,
      grid: DARK_CHART_GRID,
    })
  })

  it('keeps the historical dark fallback when the background is unavailable', () => {
    expect(resolveChartPalette()).toEqual({ text: DARK_CHART_TEXT, grid: DARK_CHART_GRID })
  })

  it('resolves none and missing backgrounds through the caller-provided rendered fallback', () => {
    expect(resolveChartBackground(undefined, '#1e1e2e')).toEqual({
      type: 'color',
      color: '#1e1e2e',
    })
    expect(resolveChartBackground({ type: 'none' }, '#f8fafc')).toEqual({
      type: 'color',
      color: '#f8fafc',
    })
  })

  it('reads FX colors from params and the nested print fallback', () => {
    expect(
      resolveChartPalette({ type: 'fx', fx: { params: { bg: '#1e1e2e' } } })
    ).toEqual({ text: LIGHT_CHART_TEXT, grid: LIGHT_CHART_GRID })
    expect(
      resolveChartPalette({ type: 'fx', fx: { fallbackColor: '#f8fafc' } })
    ).toEqual({ text: DARK_CHART_TEXT, grid: DARK_CHART_GRID })
    expect(
      resolveChartPalette(
        resolveChartBackground(
          { type: 'fx', fx: { params: { bg: '#1e1e2e' }, fallbackColor: '#f8fafc' } },
          '#000000',
          { preferFallback: true }
        )
      )
    ).toEqual({ text: DARK_CHART_TEXT, grid: DARK_CHART_GRID })
  })
})

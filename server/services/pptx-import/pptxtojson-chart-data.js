// Compatibility payload extraction for the byte-locked pptxtojson runtime.
// This reads parser objects only; source XML and canonical chart caches stay intact.
const array = value => value == null ? [] : Array.isArray(value) ? value : [value]
function cache(channel) {
  if (!channel) return { count:0, points:[] }
  const choices = [channel['c:numLit'], channel['c:strLit'], channel['c:numRef']?.['c:numCache'], channel['c:strRef']?.['c:strCache']].filter(value=>value !== undefined)
  if (choices.length > 1) throw new TypeError('Ambiguous chart cache choice')
  const value = choices[0]
  if (!value) return { count:0, points:[] }
  const points = array(value['c:pt'])
  const indices = new Set()
  const count = Number(value['c:ptCount']?.attrs?.val)
  if (!Number.isSafeInteger(count) || count < 0 || count > 100000) throw new TypeError('Invalid chart cache count')
  for (const point of points) {
    const index = Number(point.attrs?.idx)
    if (!Number.isSafeInteger(index) || index < 0 || index >= count || indices.has(index)) throw new TypeError('Invalid chart cache index')
    indices.add(index)
  }
  return { count, points }
}
function numeric(value) {
  if (typeof value !== 'string' && typeof value !== 'number' || String(value).trim() === '' || !Number.isFinite(Number(value))) throw new TypeError('Invalid numeric chart cache value')
  return Number(value)
}
function numericArray(channel) {
  const data = cache(channel), output = Array(data.count).fill(null)
  for (const point of data.points) output[Number(point.attrs.idx)] = numeric(point['c:v'])
  return output
}
function name(series, index) {
  const tx = series['c:tx']
  if (tx?.['c:v'] !== undefined) return tx['c:v']
  const first = cache(tx).points.find(p=>Number(p.attrs.idx) === 0)
  return first?.['c:v'] ?? index
}
function extractChartData(input) {
  const series = array(input)
  if (series.length === 1 && series[0]['c:xVal']) {
    const item = series[0]
    const output = [numericArray(item['c:xVal']), numericArray(item['c:yVal'])]
    if (item['c:bubbleSize']) output.push(numericArray(item['c:bubbleSize']))
    return output
  }
  return series.map((item,index)=>{
    const xlabels = {}
    for (const point of cache(item['c:cat']).points) xlabels[point.attrs.idx] = point['c:v']
    const ys = cache(item['c:val'] ?? item['c:yVal'])
    const xs = item['c:xVal'] && numericArray(item['c:xVal'])
    const sizes = item['c:bubbleSize'] && numericArray(item['c:bubbleSize'])
    const values = ys.points.map(point=>{
      const i = Number(point.attrs.idx)
      return { ...(xs ? { index:i } : {}), x:xs ? xs[i] : point.attrs.idx, y:numeric(point['c:v']), ...(sizes ? { bubbleSize:sizes[i] } : {}) }
    })
    return { key:name(item,index), values, xlabels, ...(xs ? { pointCount:Math.max(ys.count,xs.length,sizes?.length ?? 0) } : {}) }
  })
}
module.exports = { extractChartData }

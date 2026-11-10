const { values } = require('./pptx-chart-native-layout')
function meshData(plot, blankMode) {
  const sorted = [...plot.series].sort((a,b)=>a.order-b.order)
  const maps = sorted.map(s=>values(s.data.val))
  const count = sorted[0].data.cat?.cache?.count ?? Math.max(...sorted.map(s=>s.data.val.cache.count))
  if (blankMode === 'zero') for (const map of maps) for (let i=0;i<count;i++) if (!map.has(i)) map.set(i,0)
  const cells = maps.map(()=>new Map())
  for (let i=0;i<count;i++) {
    let positive=0, negative=0
    const totals = [0,0]
    for (const map of maps) { const value=map.get(i); if (value !== undefined) totals[value<0?1:0]+=Math.abs(value) }
    for (let s=0;s<maps.length;s++) {
      const raw=maps[s].get(i)
      if (raw === undefined) continue
      const value=plot.options.grouping === 'percentStacked' ? totals[raw<0?1:0] ? raw/totals[raw<0?1:0] : 0 : raw
      const stacked=['stacked','percentStacked'].includes(plot.options.grouping)
      const baseline=stacked ? raw<0 ? negative : positive : 0
      cells[s].set(i,{ raw, value:baseline+value, baseline })
      if (stacked) { if (raw<0) negative+=value; else positive+=value }
    }
  }
  return { sorted,maps,cells,count }
}
module.exports = { meshData }

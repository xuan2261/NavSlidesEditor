import fs from 'node:fs/promises'
const profile = JSON.parse(await fs.readFile(process.argv[2], 'utf8'))
const nodes = new Map(profile.nodes.map(n => [n.id, n]))
const parents = new Map()
for (const n of profile.nodes) for (const id of n.children || []) parents.set(id, n.id)
const self = new Map(), inclusive = new Map()
for (let i = 0; i < profile.samples.length; i++) {
 const time = (profile.timeDeltas[i] || 0) / 1000
 const id = profile.samples[i]
 self.set(id, (self.get(id) || 0) + time)
 for (let cursor = id; cursor; cursor = parents.get(cursor)) inclusive.set(cursor, (inclusive.get(cursor) || 0) + time)
}
const top = map => [...map].sort((a,b) => b[1]-a[1]).slice(0,35).map(([id,ms]) => ({ms, ...nodes.get(id).callFrame}))
console.log(JSON.stringify({durationMs:(profile.endTime-profile.startTime)/1000,self:top(self),inclusive:top(inclusive)},null,2))

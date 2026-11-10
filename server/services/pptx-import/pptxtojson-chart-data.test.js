import { describe,expect,it } from 'vitest'
import data from './pptxtojson-chart-data.js'
const point = (idx,value) => ({ attrs:{ idx:String(idx) },'c:v':String(value) })
const literal = (points,count=3,string=false) => ({ [string ? 'c:strLit' : 'c:numLit']:{ 'c:ptCount':{ attrs:{ val:String(count) } },'c:pt':points } })
const reference = (points,count=3,string=false) => ({ [string ? 'c:strRef' : 'c:numRef']:{ [string ? 'c:strCache' : 'c:numCache']:{ 'c:ptCount':{ attrs:{ val:String(count) } },'c:pt':points } } })
describe('pinned parser chart cache extraction',()=>{
  it.each([literal,reference])('uses declared count and native indices without converting missing slots or zero values',channel=>{
    const series={ 'c:xVal':channel([point(2,9),point(0,0)]),'c:yVal':channel([point(0,0),point(2,4)]),'c:bubbleSize':channel([point(0,1),point(2,4)]) }
    expect(data.extractChartData(series)).toEqual([[0,null,9],[0,null,4],[1,null,4]])
  })
  it.each([literal,reference])('retains category values, source indices and literal series names',channel=>{
    const input={ 'c:tx':{ 'c:v':'Actual name' },'c:cat':channel([point(0,'A'),point(2,'B')],3,true),'c:val':channel([point(0,0),point(2,4)]) }
    expect(data.extractChartData(input)).toEqual([{ key:'Actual name',values:[{ x:'0',y:0 },{ x:'2',y:4 }],xlabels:{ 0:'A',2:'B' } }])
  })
  it('retains numeric per-series X domains and bubble magnitudes in a multi-series payload',()=>{
    const series={ 'c:xVal':literal([point(0,5),point(2,15)],4),'c:yVal':literal([point(0,7),point(2,9)],4),'c:bubbleSize':literal([point(0,1),point(2,4)],4) }
    const result=data.extractChartData([series,series])
    expect(result).toHaveLength(2)
    expect(result[1].pointCount).toBe(4)
    expect(result[1].values).toEqual([{ index:0,x:5,y:7,bubbleSize:1 },{ index:2,x:15,y:9,bubbleSize:4 }])
  })
  it.each([
    literal([point(0,1)],-1),literal([point(3,1)],3),literal([point(0,1),point(0,2)],3),literal([point(0,'not a number')],3),
  ])('rejects malformed external numeric caches instead of fabricating data',channel=>{
    expect(()=>data.extractChartData({ 'c:xVal':channel,'c:yVal':channel })).toThrow(TypeError)
  })
})

import { describe, expect, it } from 'vitest'
import { rejectTraversalTarget, parseRelationshipTargets } from './parse-rels.js'

describe('parse-rels (T3.5)', () => {
  it('T3.5 rejects ../ traversal targets', () => {
    expect(rejectTraversalTarget('../evil.xml')).toBeNull()
    expect(rejectTraversalTarget('/etc/passwd')).toBeNull()
    expect(rejectTraversalTarget('ppt/media/image1.png')).toBe('ppt/media/image1.png')
  })

  it('parses relationship targets from rels xml', () => {
    const xml = `<Relationships>
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
    </Relationships>`
    const rels = parseRelationshipTargets(xml, 'ppt/slides/_rels/slide1.xml.rels')
    expect(rels[0].id).toBe('rId2')
    expect(rels[0].target).toContain('media/image1.png')
  })
})

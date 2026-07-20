import childProcess from 'node:child_process'
import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import inventoryModule from './opc-inventory.js'

const { buildOpcInventory } = inventoryModule

async function hostilePackage() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml',
    '<Types><Default Extension="xml" ContentType="application/xml"/></Types>')
  zip.file('ppt/presentation.xml', '<p:presentation xmlns:p="p"/>')
  zip.file('ppt/slides/slide1.xml', '<p:sld xmlns:p="p"/>')
  zip.file('ppt/slides/_rels/slide1.xml.rels', `<Relationships>
    <Relationship Id="ext" Type="urn:test/video" TargetMode="External"
      Target="https://invalid.example/video"/>
    <Relationship Id="odd" Type="urn:test/unknown-extension" Target="../mystery/item.bin"/>
  </Relationships>`)
  zip.file('ppt/mystery/item.bin', Buffer.from('unknown'))
  zip.file('ppt/embeddings/object1.bin', Buffer.from('ole'))
  zip.file('ppt/activeX/activeX1.bin', Buffer.from('activex'))
  zip.file('ppt/vbaProject.bin', Buffer.from('macro'))
  zip.file('_xmlsignatures/sig1.xml', '<Signature/>')
  zip.file('ppt/3dmodels/model1.bin', Buffer.from('3d'))
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

function markFirstEntryEncrypted(bytes) {
  const copy = Buffer.from(bytes)
  const local = copy.indexOf(Buffer.from('PK\x03\x04', 'binary'))
  const central = copy.indexOf(Buffer.from('PK\x01\x02', 'binary'))
  copy.writeUInt16LE(copy.readUInt16LE(local + 6) | 1, local + 6)
  copy.writeUInt16LE(copy.readUInt16LE(central + 8) | 1, central + 8)
  return copy
}

describe('hostile complex OPC inventory', () => {
  it('classifies hostile parts and external links without fetch or spawn', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const spawn = vi.spyOn(childProcess, 'spawn')
    const inventory = await buildOpcInventory(await hostilePackage())

    expect(inventory.capabilitySummary.kinds).toEqual(expect.arrayContaining([
      '3d', 'activeX', 'externalMedia', 'macro', 'ole', 'signature', 'unknown',
    ]))
    expect(inventory.securityFlags).toEqual(expect.arrayContaining([
      'activeX', 'external-relationship', 'macro', 'ole', 'signature',
    ]))
    expect(fetch).not.toHaveBeenCalled()
    expect(spawn).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
    spawn.mockRestore()
  })

  it('rejects encrypted packages within the guarded inventory boundary', async () => {
    const encrypted = markFirstEntryEncrypted(await hostilePackage())
    await expect(Promise.race([
      buildOpcInventory(encrypted),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1_000)),
    ])).rejects.not.toThrow('timeout')
  })

  it('bounds hostile package expansion before object inspection', async () => {
    await expect(buildOpcInventory(await hostilePackage(), { maxZipEntries: 2 }))
      .rejects.toThrow(/Too many ZIP entries/)
  })
})

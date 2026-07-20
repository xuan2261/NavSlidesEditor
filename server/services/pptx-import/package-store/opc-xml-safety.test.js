import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import inventoryModule from './opc-inventory.js'
import guards from '../pptx-guards.js'

const { buildOpcInventory } = inventoryModule
const { validatePptxPackage } = guards

async function pptx(slideXml = '<s/>') {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<T/>')
  zip.file('ppt/presentation.xml', '<p/>')
  zip.file('ppt/slides/slide1.xml', slideXml)
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

async function expectReason(operation, reason) {
  await expect(operation).rejects.toMatchObject({ reason })
}

describe('OPC XML pre-parser safety budgets', () => {
  it.each([
    ['depth', '<a><b><c/></b></a>', { maxXmlDepth: 2 }, 'xml-depth-exceeded'],
    ['attributes', '<a first="1" second="2"/>', { maxXmlAttributes: 1 }, 'xml-attribute-limit-exceeded'],
    ['text', '<a>more than four bytes</a>', { maxXmlTextBytes: 4 }, 'xml-text-budget-exceeded'],
    ['part bytes', '<a>more than four bytes</a>', { maxXmlBytes: 8 }, 'xml-byte-budget-exceeded'],
    ['aggregate bytes', '<a>aggregate budget</a>', { maxAggregateXmlBytes: 12 }, 'xml-aggregate-budget-exceeded'],
  ])('rejects XML %s before inventory parsing', async (_, xml, limits, reason) => {
    await expectReason(buildOpcInventory(await pptx(xml), limits), reason)
  })

  it.each([
    ['DTD', '<!DOCTYPE a [<!ELEMENT a ANY>]><a/>', 'xml-dtd-prohibited'],
    ['entity declaration', '<!ENTITY payload "unsafe"><a>&payload;</a>', 'xml-entity-prohibited'],
    ['XInclude', '<a><xi:include href="file:///private"/></a>', 'xml-xinclude-prohibited'],
  ])('rejects XML %s before content or relationship parsing', async (_, xml, reason) => {
    await expectReason(buildOpcInventory(await pptx(xml)), reason)
  })

  it('rejects invalid explicit XML limits instead of falling back to an unbounded default', async () => {
    await expectReason(buildOpcInventory(await pptx(), { maxXmlBytes: 0 }), 'invalid-safety-limit')
  })

  it('applies the same XML gate at the upload parser boundary', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-xml-safety-'))
    const filePath = path.join(directory, 'unsafe.pptx')
    try {
      await fs.writeFile(filePath, await pptx('<!DOCTYPE a [<!ELEMENT a ANY>]><a/>'))
      await expectReason(validatePptxPackage(filePath, 'unsafe.pptx'), 'xml-dtd-prohibited')
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
})

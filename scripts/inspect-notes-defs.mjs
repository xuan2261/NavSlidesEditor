import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('node:fs');
const JSZip = require('jszip');
const { buildSemanticInventory } = require('../server/services/pptx-import/semantic-inventory.js');

async function main() {
  const bytes = fs.readFileSync('server/data/test-corpus/STTre_Duc.pptx');
  const zip = await JSZip.loadAsync(bytes);
  const inventory = await buildSemanticInventory(zip);
  const notesDefs = inventory.definitions.filter(d => d.partUri.includes('notesSlide2.xml'));
  console.log('Notes slide 2 definitions count:', notesDefs.length);
  for (const d of notesDefs) {
    console.log(d.id, d.kind, d.localName, d.namespaceUri);
  }
}

main().catch(console.error);

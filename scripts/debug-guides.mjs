import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('node:fs');
const JSZip = require('jszip');
const { buildSemanticInventory } = require('../server/services/pptx-import/semantic-inventory.js');
const { projectSourceGuideLists } = require('../server/services/pptx-import/semantic-source-guides.js');

async function main() {
  const bytes = fs.readFileSync('server/data/test-corpus/STTre_Duc.pptx');
  const zip = await JSZip.loadAsync(bytes);
  const inventory = await buildSemanticInventory(zip);
  console.log('Guide definitions in inventory:');
  for (const def of inventory.definitions) {
    if (['sldGuideLst', 'notesGuideLst'].includes(def.localName)) {
      console.log('GUIDE DEF:', def.id, 'partUri:', def.partUri, 'local:', def.localName, 'path:', def.componentLocators?.[0]?.path);
    }
  }
}

main().catch(console.error);

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('node:fs');
const JSZip = require('jszip');
const { buildSemanticInventory } = require('../server/services/pptx-import/semantic-inventory.js');
const { projectSemanticImport } = require('../server/services/pptx-import/semantic-projector.js');

async function main() {
  const bytes = fs.readFileSync('server/data/test-corpus/STTre_Duc.pptx');
  const zip = await JSZip.loadAsync(bytes);
  const inventory = await buildSemanticInventory(zip);
  console.log('Inventory definitions:', inventory.definitions.length);
  // Let's inspect definitions in inventory with identical componentLocators
  const locMap = new Map();
  for (const def of inventory.definitions) {
    const key = JSON.stringify([def.source?.partUri, def.source?.componentLocator?.path, def.kind]);
    if (locMap.has(key)) {
      console.log('DUPLICATE INVENTORY DEF:', key, 'id:', def.id, 'first id:', locMap.get(key).id);
    } else {
      locMap.set(key, def);
    }
  }
}

main().catch(console.error);

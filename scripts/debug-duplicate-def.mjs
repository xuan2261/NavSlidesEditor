import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { importPptxFile } = require('../server/services/pptx-import/importer.js');
const { projectSemanticImport } = require('../server/services/pptx-import/semantic-projector.js');

// Hook into normalizePptxSemanticDocument or catch error
try {
  // Let's monkey-patch or inspect before normalizePptxSemanticDocument
  const doc = require('../shared/src/pptx-semantic-document.js');
  const orig = doc.normalizePptxSemanticDocument;
  doc.normalizePptxSemanticDocument = function(document, options) {
    if (document.schemaVersion === 3) {
      const sourceDefs = new Map();
      for (const [id, def] of Object.entries(document.definitions || {})) {
        if (def.origin === 'project') continue;
        const s = def.source;
        if (typeof s?.sourceId === 'number') {
          const key = JSON.stringify([s.sourceId, def.kind]);
          if (sourceDefs.has(key)) {
            console.log('DUPLICATE KEY FOUND:', key, 'Def ID:', id, 'First Def ID:', sourceDefs.get(key));
            console.log('Def:', def);
            console.log('Location:', document.sourceLocations?.[s.sourceId]);
          } else {
            sourceDefs.set(key, id);
          }
        }
      }
    }
    return orig.apply(this, arguments);
  };
} catch(e) {}

async function run() {
  await importPptxFile('server/data/test-corpus/STTre_Duc.pptx', {
    semanticImport: true,
    geometryInheritance: true
  });
}
run();

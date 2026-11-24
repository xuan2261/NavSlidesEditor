import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { importPptxFile } = require('../server/services/pptx-import/importer.js');

const sourceGraph = require('../shared/src/pptx-semantic-source-graph.js');
const orig = sourceGraph.compactSemanticGraph;
sourceGraph.compactSemanticGraph = function(candidate) {
  console.log('Definitions count in compactSemanticGraph:', Object.keys(candidate.definitions || {}).length);
  const seen = new Map();
  for (const [id, def] of Object.entries(candidate.definitions || {})) {
    if (def.origin === 'project') continue;
    const s = def.source;
    const locPath = s?.componentLocator?.path ? (Array.isArray(s.componentLocator.path) ? s.componentLocator.path.join('.') : s.componentLocator.path) : s?.nativeId;
    const key = `${s?.partUri}#${locPath}#${def.kind}`;
    if (seen.has(key)) {
      console.log('DUPLICATE BEFORE COMPACT:', key, 'id:', id, 'firstId:', seen.get(key));
    } else {
      seen.set(key, id);
    }
  }
  return orig.apply(this, arguments);
};

async function run() {
  try {
    await importPptxFile('server/data/test-corpus/STTre_Duc.pptx', {
      semanticImport: true,
      geometryInheritance: true
    });
  } catch (err) {
    console.error('Import error:', err.message);
  }
}
run();

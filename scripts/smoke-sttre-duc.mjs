import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { importPptxFile } = require('../server/services/pptx-import/importer.js');

async function main() {
  try {
    const res = await importPptxFile('server/data/test-corpus/STTre_Duc.pptx', {
      semanticImport: true,
      geometryInheritance: true
    });
    console.log('STTre_Duc import result:', {
      ok: true,
      slideCount: res.presentation.slides.length,
      hasSemantic: !!res.presentation.pptxSemantic,
      schemaVersion: res.presentation.pptxSemantic?.schemaVersion,
      definitionsCount: Object.keys(res.presentation.pptxSemantic?.definitions || {}).length,
      instancesCount: Object.keys(res.presentation.pptxSemantic?.instances || {}).length
    });
  } catch (err) {
    console.error('STTre_Duc import failed:', err.message, err.stack);
    process.exit(1);
  }
}

main();

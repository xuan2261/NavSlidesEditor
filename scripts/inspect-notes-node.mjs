import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fs = require('node:fs');
const JSZip = require('jszip');
const { parseXml } = require('../server/services/pptx-import/ooxml-text-run-xml.js');

async function main() {
  const bytes = fs.readFileSync('server/data/test-corpus/STTre_Duc.pptx');
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('ppt/notesSlides/notesSlide2.xml').async('text');
  const roots = parseXml(xml);
  const path = [0, 0, 0, 2, 0, 0, 0, 0, 0];
  let cur = { children: roots };
  for (let i = 0; i < path.length; i++) {
    cur = cur.children[path[i]];
    console.log(`Step ${i} (idx ${path[i]}):`, cur.local, cur.uri, cur.attrs);
  }
}

main().catch(console.error);

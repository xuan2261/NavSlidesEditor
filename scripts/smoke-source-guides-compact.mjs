import { createRequire } from 'node:module';
import { fieldFixture, fieldPresentation } from '../tests/pptx-semantic/field-fixtures.js';

const require = createRequire(import.meta.url);
const { projectSemanticImport } = require('../server/services/pptx-import/semantic-projector.js');
const { compactSemanticGraph } = require('../shared/src/pptx-semantic-source-graph.js');
const { semanticDefinition } = require('../shared/src/pptx-semantic-records.js');
const { validateSourceGuideList } = require('../shared/src/pptx-source-guides.js');
const { normalizePptxSemanticDocument } = require('../shared/src/pptx-semantic-document.js');

async function check() {
  const zip = fieldFixture();
  const children = '<g:guide id="1" orient="horz" pos="2160"><g:clr><a:srgbClr val="A4A3A4"/></g:clr></g:guide><g:guide id="2" pos="3840"><g:clr><a:srgbClr val="A4A3A4"/></g:clr></g:guide>';
  const part = 'ppt/presentation.xml';
  const xml = await zip.file(part).async('string');
  zip.file(part, xml.replace('</p:presentation>', '<p:extLst><p:ext uri="{EFAFB233-063F-42B5-8137-9DF3F51BA10A}"><g:sldGuideLst xmlns:g="http://schemas.microsoft.com/office/powerpoint/2012/main">' + children + '</g:sldGuideLst></p:ext></p:extLst></p:presentation>'));
  const { presentation } = await projectSemanticImport({ zip, presentation: fieldPresentation() });
  const def = Object.values(presentation.pptxSemantic.definitions).find(d => d.kind === 'source-guide-list');
  const compacted = compactSemanticGraph(presentation.pptxSemantic);
  
  const decodedDef = semanticDefinition(compacted, def.id);
  console.log('Decoded guide 0 id:', decodedDef.content.sourceGuideList.guides[0].value.id, typeof decodedDef.content.sourceGuideList.guides[0].value.id);
  console.log('Decoded guide 1 id:', decodedDef.content.sourceGuideList.guides[1].value.id, typeof decodedDef.content.sourceGuideList.guides[1].value.id);
  validateSourceGuideList(decodedDef);
  console.log('validateSourceGuideList PASSED');

  const normalized = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(compacted)));
  console.log('normalizePptxSemanticDocument PASSED! Schema version:', normalized.schemaVersion);
}
check().catch((e) => {
  console.error('FAILED:', e);
});

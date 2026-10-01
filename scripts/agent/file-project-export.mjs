import shared from 'revealjs-shared'
import { collectProjectMediaEntries } from '../../client/src/utils/project-media-utils.js'
const { projectExportValue } = shared


/** JSON references media; it is not a ZIP archive or an offline media bundle. */
export function portableProject(presentation) {
  const exported = projectExportValue(presentation)
  const hasUploads = collectProjectMediaEntries(exported, { localOnly: true }).length > 0
  const document = {
    version: '1.1', title: exported?.title || 'Presentation',
    exportedAt: new Date().toISOString(), hasLocalMedia: false, presentation: exported,
  }
  return {
    bytes: JSON.stringify(document, null, 2),
    warnings: hasUploads ? ['JSON export references external uploaded assets. It does not embed media; keep the original uploads available. A self-contained .navslides ZIP exporter is not provided.'] : [],
  }
}

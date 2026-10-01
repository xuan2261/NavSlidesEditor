import { importTools } from './file-import-tools.mjs'
import { exportTools } from './file-export-tools.mjs'
import { previewTools } from './file-preview.mjs'

export const fileTools = [...importTools, ...exportTools, ...previewTools]

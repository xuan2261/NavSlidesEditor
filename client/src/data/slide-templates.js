// Barrel for the built-in slide layout library. The public import path
// (`../data/slide-templates`) and the `SLIDE_TEMPLATES` named export are stable;
// layouts live in per-category modules under `slide-templates/` to keep each
// file small. Decorative chrome uses the `'auto'` color sentinel so it adopts
// the active theme token; deliberate semantic colors stay explicit hex.
import { BASIC_TEMPLATES } from './slide-templates/basic'
import { CONTENT_TEMPLATES } from './slide-templates/content'
import { LAYOUT_TEMPLATES } from './slide-templates/layout'
import { DATA_TEMPLATES } from './slide-templates/data'
import { STRUCTURE_TEMPLATES } from './slide-templates/structure'
import { ENDING_TEMPLATES } from './slide-templates/ending'

export const SLIDE_TEMPLATES = {
  ...BASIC_TEMPLATES,
  ...CONTENT_TEMPLATES,
  ...LAYOUT_TEMPLATES,
  ...DATA_TEMPLATES,
  ...STRUCTURE_TEMPLATES,
  ...ENDING_TEMPLATES,
}

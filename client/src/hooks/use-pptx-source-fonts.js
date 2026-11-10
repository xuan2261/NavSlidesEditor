import { useContext } from 'react'
import { PptxSourceFontContext } from '../contexts/pptx-source-font-context'

export function usePptxSourceFonts() {
  return useContext(PptxSourceFontContext)
}

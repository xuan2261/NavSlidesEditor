import { NativeSmartArtRenderer } from '../../native-smartart/native-smartart-renderer'

export function DiagramRenderer({ element }) {
  return (
    <NativeSmartArtRenderer document={element.smartArtDocument} bounds={element.pptxFamilyBounds} />
  )
}

import { AlignStartVertical, AlignHorizontalJustifyCenter, AlignEndVertical } from 'lucide-react'
import { Button } from '../ui'
import RibbonSection from './ribbon-section'
import { CANVAS_WIDTH } from '../../data/slide-constants'
import { getRotatedAABB } from '../canvas/use-canvas-resize-rotate'
import { handleRibbonKeyboardActivation } from './ribbon-keyboard-activation'

const ALIGNMENTS = [
  ['left', 'Align left', AlignStartVertical],
  ['center-h', 'Align center horizontal', AlignHorizontalJustifyCenter],
  ['right', 'Align right', AlignEndVertical],
]

export default function HorizontalAlignmentControls({
  element,
  selectedElementIds,
  slideWidth,
  onUpdateElement,
  onAlignElements,
}) {
  const width =
    Number.isFinite(Number(slideWidth)) && Number(slideWidth) > 0
      ? Number(slideWidth)
      : CANVAS_WIDTH
  const align = (kind) => {
    if (selectedElementIds?.length > 1) {
      onAlignElements?.(kind)
      return
    }
    if (element.locked) return
    const box = getRotatedAABB({ ...element, x: element.x || 0, y: element.y || 0 })
    const offset =
      kind === 'left'
        ? -box.left
        : kind === 'right'
          ? width - box.right
          : width / 2 - (box.left + box.right) / 2
    onUpdateElement?.({ x: Math.round((element.x || 0) + offset) })
  }
  return (
    <RibbonSection label="Align" className="border-r border-border">
      <div className="flex items-center gap-0.5">
        {ALIGNMENTS.map(([kind, label, Icon]) => (
          <Button
            key={kind}
            variant="icon"
            className="h-7 w-7"
            title={label}
            aria-label={label}
            data-testid={`format-align-${kind}`}
            onMouseDown={(event) => {
              event.preventDefault()
              align(kind)
            }}
            onKeyDown={(event) => handleRibbonKeyboardActivation(event, () => align(kind))}
          >
            <Icon size={14} />
          </Button>
        ))}
      </div>
    </RibbonSection>
  )
}

import {
  Group,
  Ungroup,
  ArrowUpToLine,
  ArrowDownToLine,
  ChevronsUp,
  ChevronsDown,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  AlignStartVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignEndHorizontal,
} from 'lucide-react'
import { Button } from '../../ui'

const ALIGN_ACTIONS = [
  ['left', AlignStartVertical, 'Align left'],
  ['center-h', AlignHorizontalJustifyCenter, 'Center H'],
  ['right', AlignEndVertical, 'Align right'],
  ['top', AlignStartHorizontal, 'Align top'],
  ['center-v', AlignVerticalJustifyCenter, 'Center V'],
  ['bottom', AlignEndHorizontal, 'Align bottom'],
  ['distribute-h', AlignHorizontalDistributeCenter, 'Distribute H'],
  ['distribute-v', AlignVerticalDistributeCenter, 'Distribute V'],
]

export default function ArrangeControls({
  selectedCount,
  onGroup,
  onUngroup,
  onAlignElements,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
}) {
  return (
    <div className="flex items-center gap-0.5">
      {selectedCount >= 2 && (
        <>
          {ALIGN_ACTIONS.map(([type, Icon, title]) => (
            <Button
              key={type}
              variant="icon"
              className="h-7 w-7"
              onClick={() => onAlignElements?.(type)}
              title={title}
              aria-label={title}
            >
              <Icon size={14} />
            </Button>
          ))}
          <span className="mx-1 h-5 w-[1px] shrink-0 bg-border" />
          <Button
            variant="icon"
            className="h-7 w-7"
            onClick={onGroup}
            title="Group elements"
            aria-label="Group elements"
          >
            <Group size={14} />
          </Button>
          <Button
            variant="icon"
            className="h-7 w-7"
            onClick={onUngroup}
            title="Ungroup elements"
            aria-label="Ungroup elements"
          >
            <Ungroup size={14} />
          </Button>
          <span className="mx-1 h-5 w-[1px] shrink-0 bg-border" />
        </>
      )}
      <Button
        variant="icon"
        className="h-7 w-7"
        onClick={onBringForward}
        title="Bring forward"
        aria-label="Bring forward"
      >
        <ArrowUpToLine size={14} />
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onClick={onSendBackward}
        title="Send backward"
        aria-label="Send backward"
      >
        <ArrowDownToLine size={14} />
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onClick={onBringToFront}
        title="Bring to front"
        aria-label="Bring to front"
      >
        <ChevronsUp size={14} />
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onClick={onSendToBack}
        title="Send to back"
        aria-label="Send to back"
      >
        <ChevronsDown size={14} />
      </Button>
    </div>
  )
}

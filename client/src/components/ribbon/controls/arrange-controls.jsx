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
  availability,
}) {
  return (
    <div className="flex items-center gap-0.5">
      {(selectedCount >= 2 || availability) && (
        <>
          {selectedCount >= 2 && ALIGN_ACTIONS.map(([type, Icon, title]) => (
            <Button
              key={type}
              variant="icon"
              className="h-7 w-7"
              onClick={() => { if (!availability?.arrange) onAlignElements?.(type) }}
              disabled={Boolean(availability?.arrange)}
              title={availability?.arrange || title}
              aria-label={title}
            >
              <Icon size={14} />
            </Button>
          ))}
          <span className="mx-1 h-5 w-[1px] shrink-0 bg-border" />
          <Button
            variant="icon"
            className="h-7 w-7"
            onClick={(event) => { if (!availability?.group) onGroup?.(event) }}
            disabled={Boolean(availability?.group)}
            title={availability?.group || 'Group elements'}
            aria-label="Group elements"
          >
            <Group size={14} />
          </Button>
          <Button
            variant="icon"
            className="h-7 w-7"
            onClick={(event) => { if (!availability?.ungroup) onUngroup?.(event) }}
            disabled={Boolean(availability?.ungroup)}
            title={availability?.ungroup || 'Ungroup elements'}
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
        onClick={(event) => { if (!availability?.arrange) onBringForward?.(event) }}
        disabled={Boolean(availability?.arrange)}
        title={availability?.arrange || 'Bring forward'}
        aria-label="Bring forward"
      >
        <ArrowUpToLine size={14} />
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onClick={(event) => { if (!availability?.arrange) onSendBackward?.(event) }}
        disabled={Boolean(availability?.arrange)}
        title={availability?.arrange || 'Send backward'}
        aria-label="Send backward"
      >
        <ArrowDownToLine size={14} />
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onClick={(event) => { if (!availability?.arrange) onBringToFront?.(event) }}
        disabled={Boolean(availability?.arrange)}
        title={availability?.arrange || 'Bring to front'}
        aria-label="Bring to front"
      >
        <ChevronsUp size={14} />
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onClick={(event) => { if (!availability?.arrange) onSendToBack?.(event) }}
        disabled={Boolean(availability?.arrange)}
        title={availability?.arrange || 'Send to back'}
        aria-label="Send to back"
      >
        <ChevronsDown size={14} />
      </Button>
    </div>
  )
}

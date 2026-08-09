import { useMemo } from 'react'

export function useEditorCommandModel({
  openTemplateModal,
  closeCommandPalette,
  groupElements,
  ungroupElements,
  save,
  zoomIn,
  zoomOut,
  fitZoom,
  startSlideshow,
  insertLink,
}) {
  return useMemo(
    () => [
      {
        id: 'insertSlide',
        label: 'Insert Slide',
        shortcut: 'Ctrl+M',
        action: openTemplateModal,
      },
      {
        id: 'insertLink',
        label: 'Insert Link',
        shortcut: '',
        action: insertLink,

      },
      { id: 'group', label: 'Group Elements', shortcut: 'Ctrl+G', action: groupElements },
      {
        id: 'ungroup',
        label: 'Ungroup Elements',
        shortcut: 'Ctrl+Shift+G',
        action: ungroupElements,
      },
      { id: 'save', label: 'Save', shortcut: 'Ctrl+S', action: save },
      { id: 'zoomIn', label: 'Zoom In', shortcut: 'Ctrl+=', action: zoomIn },
      { id: 'zoomOut', label: 'Zoom Out', shortcut: 'Ctrl+-', action: zoomOut },
      { id: 'resetZoom', label: 'Fit to Window', shortcut: 'Ctrl+0', action: fitZoom },
      {
        id: 'startSlideshow',
        label: 'Start Slideshow',
        shortcut: 'F5',
        action: startSlideshow,
      },
      {
        id: 'commandPalette',
        label: 'Command Palette',
        shortcut: 'Ctrl+K',
        action: closeCommandPalette,
      },
    ],
    [
      closeCommandPalette,
      fitZoom,
      groupElements,
      openTemplateModal,
      save,
      startSlideshow,
      insertLink,
      ungroupElements,
      zoomIn,
      zoomOut,
    ]
  )
}

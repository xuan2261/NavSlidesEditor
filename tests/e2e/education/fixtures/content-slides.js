/**
 * Standard content slides fixture: shapes with labels, TipTap text,
 * paired images for fanout testing, and unequal-width shapes for alignment testing.
 */

export const SHAPE_WITH_LABEL_SLIDE = {
  id: 'slide-shape-label',
  elements: [
    {
      id: 'shape-labeled-1',
      type: 'shape',
      shape: 'rect',
      x: 150,
      y: 120,
      width: 320,
      height: 180,
      fill: '#4338ca',
      stroke: '#818cf8',
      strokeWidth: 2,
      borderRadius: 12,
      opacity: 1,
      text: 'Verified Shape Label',
      fontSize: 24,
      textColor: '#ffffff',
    },
    {
      id: 'text-tiptap-styled-1',
      type: 'text',
      x: 520,
      y: 120,
      width: 360,
      height: 180,
      content:
        '<p style="font-family: Georgia, serif; line-height: 1.8;"><span style="font-size: 28px;"><strong>Styled TipTap Heading</strong></span></p><p style="line-height: 1.6;">Body paragraph with line-height preserved.</p>',
    },
  ],
  background: { type: 'color', color: '#18181b' },
}

export const DUAL_IMAGES_SLIDE = {
  id: 'slide-dual-images',
  elements: [
    {
      id: 'image-fanout-primary',
      type: 'image',
      x: 80,
      y: 100,
      width: 350,
      height: 240,
      src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="350" height="240"><rect width="100%" height="100%" fill="%233b82f6"/><text x="50%" y="50%" fill="white" font-size="20" text-anchor="middle">Image A</text></svg>',
      alt: 'Diagram A',
      longDescription: 'Primary detailed architectural description for Diagram A',
      objectFit: 'contain',
    },
    {
      id: 'image-fanout-secondary',
      type: 'image',
      x: 480,
      y: 100,
      width: 350,
      height: 240,
      src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="350" height="240"><rect width="100%" height="100%" fill="%2310b981"/><text x="50%" y="50%" fill="white" font-size="20" text-anchor="middle">Image B</text></svg>',
      alt: 'Diagram B',
      longDescription: '',
      objectFit: 'contain',
    },
  ],
  background: { type: 'color', color: '#09090b' },
}

export const UNEQUAL_WIDTH_SHAPES_SLIDE = {
  id: 'slide-unequal-shapes',
  elements: [
    {
      id: 'shape-narrow-1',
      type: 'shape',
      shape: 'rect',
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      fill: '#ef4444',
      text: 'Narrow (120px)',
      fontSize: 14,
    },
    {
      id: 'shape-medium-2',
      type: 'shape',
      shape: 'rect',
      x: 280,
      y: 220,
      width: 240,
      height: 80,
      fill: '#f59e0b',
      text: 'Medium (240px)',
      fontSize: 14,
    },
    {
      id: 'shape-wide-3',
      type: 'shape',
      shape: 'rect',
      x: 580,
      y: 340,
      width: 360,
      height: 80,
      fill: '#10b981',
      text: 'Wide (360px)',
      fontSize: 14,
    },
  ],
  background: { type: 'color', color: '#111827' },
}

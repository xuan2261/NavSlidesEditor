/**
 * Vertical child slides fixture for multi-dimensional presentation navigation testing.
 * Reveal.js renders children as nested <section> tags within the parent slide.
 */

import { NAME_PICKER_GAME_ELEMENT } from './game-configs.js'

export const VERTICAL_PARENT_WITH_GAME_CHILD = {
  id: 'slide-vertical-parent',
  elements: [
    {
      id: 'vertical-parent-heading',
      type: 'text',
      x: 100,
      y: 80,
      width: 800,
      height: 100,
      content:
        '<h2>Vertical Parent Slide (Section 1)</h2><p>Press down arrow in Reveal to navigate to child slide.</p>',
    },
  ],
  background: { type: 'color', color: '#1e293b' },
  children: [
    {
      id: 'slide-vertical-child-1',
      elements: [
        {
          id: 'vertical-child-heading',
          type: 'text',
          x: 100,
          y: 40,
          width: 800,
          height: 60,
          content: '<h3>Vertical Child 1 — Nested Game</h3>',
        },
        {
          ...NAME_PICKER_GAME_ELEMENT,
          id: 'vertical-child-name-picker',
          y: 120,
        },
      ],
      background: { type: 'color', color: '#0f172a' },
    },
  ],
}

/**
 * Master interactive deck fixture.
 * Combines standard slides, 10 game types, vertical children,
 * action triggers, simulation, HTML quiz, and multi-game blocks.
 */

import {
  NAME_PICKER_GAME_ELEMENT,
  HOT_POTATO_TWO_QUESTIONS_ELEMENT,
  JEOPARDY_STANDARD_ELEMENT,
  FOUR_CORNERS_GAME_ELEMENT,
  RELAY_RACE_GAME_ELEMENT,
} from './game-configs.js'
import {
  TRIVIA_CHAMP_GAME_ELEMENT,
  SCATTERGORIES_GAME_ELEMENT,
  MATCHING_GAME_ELEMENT,
} from './game-configs-extended.js'
import {
  SHAPE_WITH_LABEL_SLIDE,
  DUAL_IMAGES_SLIDE,
  UNEQUAL_WIDTH_SHAPES_SLIDE,
} from './content-slides.js'
import {
  ACTION_TRIGGER_SLIDE,
  SIMULATION_AND_QUIZ_SLIDE,
  MULTI_GAME_BLOCKS_SLIDE,
} from './interactive-slides.js'
import { VERTICAL_PARENT_WITH_GAME_CHILD } from './vertical-slides.js'

export const GAME_SLIDE_NAME_PICKER = {
  id: 'slide-game-picker',
  elements: [
    {
      id: 'picker-slide-title',
      type: 'text',
      x: 100,
      y: 30,
      width: 800,
      height: 50,
      content: '<h2>Interactive Activity: Name Picker</h2>',
    },
    NAME_PICKER_GAME_ELEMENT,
  ],
  background: { type: 'color', color: '#111827' },
}

export const GAME_SLIDE_HOT_POTATO = {
  id: 'slide-game-hot-potato',
  elements: [
    {
      id: 'hot-potato-slide-title',
      type: 'text',
      x: 100,
      y: 30,
      width: 800,
      height: 50,
      content: '<h2>Interactive Activity: Hot Potato (2 Questions)</h2>',
    },
    HOT_POTATO_TWO_QUESTIONS_ELEMENT,
  ],
  background: { type: 'color', color: '#18181b' },
}

export const GAME_SLIDE_JEOPARDY = {
  id: 'slide-game-jeopardy',
  elements: [
    {
      id: 'jeopardy-slide-title',
      type: 'text',
      x: 50,
      y: 10,
      width: 860,
      height: 35,
      content: '<h2>Classroom Review: Jeopardy Board</h2>',
    },
    JEOPARDY_STANDARD_ELEMENT,
  ],
  background: { type: 'color', color: '#09090b' },
}

export const GAME_SLIDE_ACTIVE_PLAY = {
  id: 'slide-game-active-play',
  elements: [
    {
      id: 'active-play-title',
      type: 'text',
      x: 50,
      y: 15,
      width: 860,
      height: 40,
      content: '<h2>Classroom Active Play: Four Corners & Relay</h2>',
    },
    FOUR_CORNERS_GAME_ELEMENT,
  ],
  background: { type: 'color', color: '#0b1329' },
}

export const GAME_SLIDE_RELAY_RACE = {
  id: 'slide-game-relay-race',
  elements: [
    {
      id: 'relay-race-slide-title',
      type: 'text',
      x: 50,
      y: 15,
      width: 860,
      height: 40,
      content: '<h2>Science Relay Race</h2>',
    },
    RELAY_RACE_GAME_ELEMENT,
  ],
  background: { type: 'color', color: '#1a1a2e' },
}

export const GAME_SLIDE_TRIVIA_CHAMP = {
  id: 'slide-game-trivia-champ',
  elements: [
    {
      id: 'trivia-champ-slide-title',
      type: 'text',
      x: 50,
      y: 15,
      width: 860,
      height: 40,
      content: '<h2>Trivia Championship</h2>',
    },
    TRIVIA_CHAMP_GAME_ELEMENT,
  ],
  background: { type: 'color', color: '#1e1b4b' },
}

export const GAME_SLIDE_SCATTERGORIES = {
  id: 'slide-game-scattergories',
  elements: [
    {
      id: 'scattergories-slide-title',
      type: 'text',
      x: 50,
      y: 15,
      width: 860,
      height: 40,
      content: '<h2>Quick Scattergories</h2>',
    },
    SCATTERGORIES_GAME_ELEMENT,
  ],
  background: { type: 'color', color: '#0f172a' },
}

export const GAME_SLIDE_EXTENDED = {
  id: 'slide-game-extended',
  elements: [
    {
      id: 'extended-games-title',
      type: 'text',
      x: 50,
      y: 15,
      width: 860,
      height: 40,
      content: '<h2>Vocabulary & Trivia: Matching</h2>',
    },
    MATCHING_GAME_ELEMENT,
  ],
  background: { type: 'color', color: '#161226' },
}

export const INTERACTIVE_DECK_SLIDES = [
  SHAPE_WITH_LABEL_SLIDE,
  DUAL_IMAGES_SLIDE,
  UNEQUAL_WIDTH_SHAPES_SLIDE,
  ACTION_TRIGGER_SLIDE,
  SIMULATION_AND_QUIZ_SLIDE,
  MULTI_GAME_BLOCKS_SLIDE,
  GAME_SLIDE_NAME_PICKER,
  GAME_SLIDE_HOT_POTATO,
  GAME_SLIDE_JEOPARDY,
  GAME_SLIDE_ACTIVE_PLAY,
  GAME_SLIDE_RELAY_RACE,
  GAME_SLIDE_TRIVIA_CHAMP,
  GAME_SLIDE_SCATTERGORIES,
  GAME_SLIDE_EXTENDED,
  VERTICAL_PARENT_WITH_GAME_CHILD,
]

export function buildEducationDeckPayload(title = 'Education Baseline Deck') {
  return {
    title,
    theme: 'black',
    transition: 'slide',
    slides: INTERACTIVE_DECK_SLIDES,
  }
}

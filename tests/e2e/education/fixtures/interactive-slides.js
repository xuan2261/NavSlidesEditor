/**
 * Additional interactive slide fixtures:
 * - Slide with action triggers (navigation button)
 * - Slide with HTML quiz and HTML physics simulation
 * - Slide with multiple game blocks on the same slide
 */

import { POLL_GAME_ELEMENT, WORD_CLOUD_GAME_ELEMENT } from './game-configs-extended.js'

export const ACTION_TRIGGER_SLIDE = {
  id: 'slide-action-trigger',
  elements: [
    {
      id: 'action-trigger-title',
      type: 'text',
      x: 100,
      y: 60,
      width: 700,
      height: 60,
      content: '<h2>Interactive Navigation Trigger</h2>',
    },
    {
      id: 'action-trigger-button',
      type: 'shape',
      shape: 'rect',
      x: 100,
      y: 160,
      width: 260,
      height: 70,
      fill: '#4f46e5',
      stroke: '#818cf8',
      strokeWidth: 2,
      borderRadius: 10,
      text: 'Next Activity',
      fontSize: 20,
      textColor: '#ffffff',
      action: {
        kind: 'next',
        label: 'Go to next activity',
      },
    },
  ],
  background: { type: 'color', color: '#0f172a' },
}

export const SIMULATION_AND_QUIZ_SLIDE = {
  id: 'slide-sim-and-quiz',
  elements: [
    {
      id: 'sim-quiz-title',
      type: 'text',
      x: 60,
      y: 30,
      width: 840,
      height: 50,
      content: '<h2>Interactive Simulation & HTML Quiz</h2>',
    },
    {
      id: 'html-simulation-1',
      type: 'html',
      x: 60,
      y: 90,
      width: 440,
      height: 380,
      content: `<div id="pendulum-sim" style="width:100%;height:100%;background:#18181b;color:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:8px;">
        <h4 style="margin:0 0 10px;">Pendulum Motion Simulation</h4>
        <svg width="200" height="200" viewBox="0 0 200 200">
          <line x1="100" y1="20" x2="150" y2="150" stroke="#38bdf8" stroke-width="3"/>
          <circle cx="150" cy="150" r="16" fill="#ef4444"/>
          <circle cx="100" cy="20" r="4" fill="#ffffff"/>
        </svg>
        <span style="font-size:12px;opacity:0.8;">Frequency: 0.5 Hz | Amplitude: 30°</span>
      </div>`,
    },
    {
      id: 'html-quiz-1',
      type: 'html',
      x: 520,
      y: 90,
      width: 420,
      height: 380,
      content: `<div id="quick-quiz" style="width:100%;height:100%;background:#1e1b4b;color:#f8fafc;padding:20px;box-sizing:border-box;border-radius:8px;">
        <h4 style="margin:0 0 12px;color:#a5b4fc;">Quick Check: Energy Conservation</h4>
        <p style="font-size:14px;line-height:1.5;">At which point is the pendulum kinetic energy at maximum?</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">
          <button style="padding:8px 12px;background:#312e81;border:1px solid #6366f1;color:white;border-radius:6px;text-align:left;cursor:pointer;">A. At highest amplitude</button>
          <button style="padding:8px 12px;background:#312e81;border:1px solid #6366f1;color:white;border-radius:6px;text-align:left;cursor:pointer;">B. At lowest equilibrium point</button>
          <button style="padding:8px 12px;background:#312e81;border:1px solid #6366f1;color:white;border-radius:6px;text-align:left;cursor:pointer;">C. Kinetic energy is constant</button>
        </div>
      </div>`,
    },
  ],
  background: { type: 'color', color: '#09090b' },
}

export const MULTI_GAME_BLOCKS_SLIDE = {
  id: 'slide-multi-games',
  elements: [
    {
      id: 'multi-games-title',
      type: 'text',
      x: 60,
      y: 20,
      width: 880,
      height: 45,
      content: '<h2>Multi-Game Activity Slide: Poll & Word Cloud</h2>',
    },
    POLL_GAME_ELEMENT,
    WORD_CLOUD_GAME_ELEMENT,
  ],
  background: { type: 'color', color: '#13111c' },
}

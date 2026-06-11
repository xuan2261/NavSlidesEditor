/**
 * Shared bounded history stack helper for undo/redo.
 *
 * Undo and redo must retain the same depth so a long run of undos can be fully
 * redone. Pushing returns a new array capped at HISTORY_CAP most-recent entries;
 * the input is never mutated.
 */

export const HISTORY_CAP = 50

/**
 * @param {Array} stack - existing history/redo stack
 * @param {*} entry - snapshot to append
 * @returns {Array} new stack capped at HISTORY_CAP entries
 */
export function pushHistory(stack, entry) {
  const base = Array.isArray(stack) ? stack : []
  return [...base.slice(-(HISTORY_CAP - 1)), entry]
}

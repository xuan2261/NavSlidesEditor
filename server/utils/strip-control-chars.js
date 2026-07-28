/**
 * Remove C0/C1 control characters from text that originated outside the server
 * (parser output, OOXML content, thrown error messages) before it reaches a log
 * or an API response.
 *
 * These bytes are invisible in a diff but active in a terminal: an ANSI escape
 * repaints or hides a log line, BEL and NUL confuse downstream tooling, and a
 * JSON transport only defers the problem because it re-escapes them for any
 * consumer that later prints the parsed string.
 *
 * Written as textual escapes on purpose. Spelling this class with literal bytes
 * makes the source itself unreadable and turns the file binary to git.
 *
 * Replacing with a space (rather than deleting) keeps adjacent words separated;
 * every caller collapses runs of whitespace immediately afterwards.
 */
// eslint-disable-next-line no-control-regex -- matching these is the point
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f]', 'g')

function stripControlChars(value) {
  return String(value ?? '').replace(CONTROL_CHARS, ' ')
}

module.exports = { stripControlChars }

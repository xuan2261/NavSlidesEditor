function serializeEducationConfig(value) {
  return JSON.stringify(value).replace(/[<\u2028\u2029]/g, (character) =>
    character === '<' ? '\\u003c' : character === '\u2028' ? '\\u2028' : '\\u2029'
  )
}
function escapeInlineScript(source) {
  return String(source).replace(/<\/script/gi, (closing) => `<\\/${closing.slice(2)}`)
}
module.exports = { serializeEducationConfig, escapeInlineScript }

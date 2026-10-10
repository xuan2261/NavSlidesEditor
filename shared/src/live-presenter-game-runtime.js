function safeScriptLiteral(value) {
  const escaped = String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/</g, '\\u003c')
    .split(String.fromCharCode(0x2028))
    .join('\\u2028')
    .split(String.fromCharCode(0x2029))
    .join('\\u2029')
  return `'${escaped}'`
}
function buildGameBootstrapRuntime(presentationId) {
  return `
          livePresentationReady = function(data) {
            if (!data || data.presentationId !== ${safeScriptLiteral(presentationId)}) return;
            var transport = window.__navslidesEducationTransport;
            if (transport) transport.presentationReady(data, livePresenterSocket);
          };`
}
module.exports = { buildGameBootstrapRuntime, safeScriptLiteral }

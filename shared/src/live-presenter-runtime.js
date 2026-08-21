const {
  buildGameBootstrapRuntime,
  safeScriptLiteral,
} = require('./live-presenter-game-runtime.js')

function buildLivePresenterRuntime({ presentationId, hasGames }) {
  const gameBootstrapRuntime = hasGames ? buildGameBootstrapRuntime(presentationId) : ''
  const presentationIdLiteral = safeScriptLiteral(presentationId)
  const lineBreak = String.fromCharCode(10)
  const livePresentationReadyDeclaration = hasGames
    ? `        var livePresentationReady = function() {};${lineBreak}`
    : ''
  const presentationDataListener = hasGames
    ? [
        "          sock.on('presentation-data', function() {",
        '            livePresentationReady();',
        '          });',
      ].join(lineBreak) + lineBreak
    : ''
  return `
      // Live presenter: connect Socket.IO and broadcast navigation
      var liveRoom = params.get('live');
      if (liveRoom) {
        var presenterToken = '';
        try {
          var launchCtx = JSON.parse(window.name || '{}');
          if (launchCtx && launchCtx.roomCode === liveRoom && launchCtx.presenterToken) {
            presenterToken = launchCtx.presenterToken;
          }
        } catch (e) {}
        var livePresenterSocket = null;
${livePresentationReadyDeclaration}        var script = document.createElement('script');
        script.src = '/vendor/socket.io/socket.io.min.js';
        script.onload = function() {
          var sock = livePresenterSocket = io({ path: '/ws' });
          sock.on('connect', function() {
            sock.emit('join-room', {
              roomId: liveRoom,
              role: 'presenter',
              presentationId: ${presentationIdLiteral},
              presenterToken: presenterToken
            });
            if (typeof drainAllGameShortcutActions === 'function') drainAllGameShortcutActions();
            if (!document.getElementById('navslides-live-indicator')) {
              var badge = document.createElement('div');
              badge.id = 'navslides-live-indicator';
              badge.style.cssText = 'position:fixed;top:12px;left:12px;z-index:9999;background:rgba(239,68,68,0.9);color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;font-family:system-ui,sans-serif;';
              badge.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#fff;animation:livePulse 1.5s ease-in-out infinite;display:inline-block;"></span> LIVE';
              var style = document.createElement('style');
              style.id = 'navslides-live-indicator-style';
              style.textContent = '@keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.3}}';
              document.head.appendChild(style);
              document.body.appendChild(badge);
            }
            emitLiveNavigate(true);
          });
${presentationDataListener}          sock.on('join-error', function(payload) {
            alert((payload && payload.message) || 'Presenter access denied');
          });
          var lastLiveIndices = null;
          function getLiveRevealIndices() {
            var indices = Reveal.getIndices() || {};
            var liveIndices = {
              slideIndex: indices.h || 0,
              verticalIndex: indices.v || 0,
              fragmentIndex: indices.f || 0
            };
            var currentSlide = Reveal.getCurrentSlide && Reveal.getCurrentSlide();
            var horizontalSlides = document.querySelectorAll('.reveal .slides > section');
            for (var h = 0; h < horizontalSlides.length; h += 1) {
              var horizontal = horizontalSlides[h];
              if (horizontal === currentSlide) {
                liveIndices.slideIndex = h;
                liveIndices.verticalIndex = 0;
                return liveIndices;
              }
              var verticalSlides = horizontal.querySelectorAll('section');
              for (var v = 0; v < verticalSlides.length; v += 1) {
                if (verticalSlides[v] === currentSlide) {
                  liveIndices.slideIndex = h;
                  liveIndices.verticalIndex = v;
                  return liveIndices;
                }
              }
            }
            return liveIndices;
          }
          function emitLiveNavigate(force) {
            var indices = getLiveRevealIndices();
            var state = {
              slideIndex: indices.slideIndex || 0,
              verticalIndex: indices.verticalIndex || 0,
              fragmentIndex: indices.fragmentIndex || 0
            };
            var key = state.slideIndex + ':' + state.verticalIndex + ':' + state.fragmentIndex;
            if (force !== true && key === lastLiveIndices) return;
            lastLiveIndices = key;
            sock.emit('navigate', {
              slideIndex: state.slideIndex,
              verticalIndex: state.verticalIndex,
              fragmentIndex: state.fragmentIndex
            });
          }
          function emitLiveNavigateAfterInput() {
            setTimeout(function() { emitLiveNavigate(true); }, 0);
            setTimeout(function() { emitLiveNavigate(true); }, 120);
            setTimeout(function() { emitLiveNavigate(true); }, 400);
          }
          // Broadcast slide changes. The polling fallback covers headless CI
          // cases where keyboard navigation updates Reveal before events flush.
          Reveal.on('slidechanged', emitLiveNavigate);
          Reveal.on('fragmentshown', emitLiveNavigate);
          Reveal.on('fragmenthidden', emitLiveNavigate);
          setInterval(emitLiveNavigate, 250);
          document.addEventListener('keydown', emitLiveNavigateAfterInput, true);
          document.addEventListener('keyup', emitLiveNavigateAfterInput, true);
          window.addEventListener('hashchange', emitLiveNavigateAfterInput);
          sock.on('control-navigate', function(state) {
            Reveal.slide(state.slideIndex || 0, state.verticalIndex || 0, state.fragmentIndex || 0);
          });
          // Track cursor for viewers
          document.addEventListener('mousemove', function(e) {
            sock.emit('cursor-move', {
              x: e.clientX / window.innerWidth,
              y: e.clientY / window.innerHeight
            });
          });
        };
        document.head.appendChild(script);${gameBootstrapRuntime}
      }`
}

module.exports = { buildLivePresenterRuntime }

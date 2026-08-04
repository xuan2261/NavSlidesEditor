function safeScriptLiteral(value) {
  const escaped = String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/</g, '\\u003c')
    .split(String.fromCharCode(0x2028)).join('\\u2028')
    .split(String.fromCharCode(0x2029)).join('\\u2029')
  return `'${escaped}'`
}

function buildGameBootstrapRuntime(presentationId) {
  const presentationIdLiteral = safeScriptLiteral(presentationId)
  return `
          var gameHostStates = {};
          var gameBootstrapTimer = null;
          var gameBootstrapInFlight = false;
          var GAME_BOOTSTRAP_MAX_ATTEMPTS = 5;
          function gameStateKey(gameId) {
            return 'navslides-game-host-state:' + ${presentationIdLiteral} + ':' + gameId;
          }
          function createHostPlayerId() {
            var random = '';
            try {
              if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                random = window.crypto.randomUUID();
              } else if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
                var bytes = new Uint8Array(16);
                window.crypto.getRandomValues(bytes);
                random = Array.prototype.map.call(bytes, function(byte) {
                  return byte.toString(16).padStart(2, '0');
                }).join('');
              }
            } catch (e) {}
            if (!random) random = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
            return 'presenter-host-' + random;
          }
          function readGameHostState(gameId) {
            var state = { gameId: gameId, playerId: createHostPlayerId() };
            try {
              var stored = sessionStorage.getItem(gameStateKey(gameId));
              if (stored) state = Object.assign(state, JSON.parse(stored));
            } catch (e) {}
            if (!state.playerId || state.playerId === 'presenter-' + gameId) {
              state.playerId = createHostPlayerId();
              state.sessionToken = '';
            }
            return state;
          }
          function capabilityMapKey() {
            return 'navslides-game-host-capabilities:' + ${presentationIdLiteral};
          }
          function saveGameHostState(state) {
            try {
              sessionStorage.setItem(gameStateKey(state.gameId), JSON.stringify({
                gameId: state.gameId,
                playerId: state.playerId,
                hostCapability: state.hostCapability || '',
                sessionToken: state.sessionToken || ''
              }));
              var known = getKnownGameCapabilities();
              if (state.hostCapability) known[state.gameId] = state.hostCapability;
              sessionStorage.setItem(capabilityMapKey(), JSON.stringify(known));
            } catch (e) {}
          }
          function getKnownGameCapabilities() {
            var known = {};
            try {
              var stored = sessionStorage.getItem(capabilityMapKey());
              if (stored) known = JSON.parse(stored) || {};
            } catch (e) {}
            Object.keys(gameHostStates).forEach(function(gameId) {
              var capability = gameHostStates[gameId].hostCapability;
              if (capability) known[gameId] = capability;
            });
            return known;
          }
          function emitGameHostJoin(state) {
            if (!state.socket || !state.socket.connected || !state.hostCapability) return;
            state.joined = false;
            state.socket.emit('game-join', {
              gameId: state.gameId,
              playerName: 'Presenter',
              playerId: state.playerId,
              role: 'host',
              gameType: state.gameType,
              hostCapability: state.hostCapability,
              ...(state.sessionToken ? { sessionToken: state.sessionToken } : {})
            });
          }
          function rebootGameHost(state, gameSocket) {
            if (state.socket !== gameSocket) return;
            state.joined = false;
            state.socket = null;
            gameSocket.disconnect();
            if (typeof livePresentationReady === 'function') livePresentationReady();
          }
          function connectGameHost(game) {
            if (!game || !game.gameId || !game.hostCapability) return;
            var state = gameHostStates[game.gameId] || readGameHostState(game.gameId);
            state.gameId = game.gameId;
            state.gameType = game.gameType;
            state.hostCapability = game.hostCapability || state.hostCapability;
            gameHostStates[game.gameId] = state;
            saveGameHostState(state);
            if (!state.socket || state.socket.disconnected) {
              if (state.socket) state.socket.disconnect();
              var gameSocket = io('/games', { path: '/ws', reconnection: true });
              state.socket = gameSocket;
              gameSocket.on('connect', function() {
                emitGameHostJoin(state);
              });
              gameSocket.on('game-session', function(data) {
                if (!data || data.playerId !== state.playerId || typeof data.sessionToken !== 'string') return;
                state.sessionToken = data.sessionToken;
                saveGameHostState(state);
              });
              gameSocket.on('game-player-joined', function() {
                state.joined = true;
                window.__navslidesGameHostReady = Object.keys(gameHostStates)
                  .filter(function(id) { return gameHostStates[id].joined; }).length;
              });
              gameSocket.on('game-error', function(data) {
                if (data && data.message === 'invalid-host-capability') {
                  state.joined = false;
                }
                if (data && data.message === 'room-not-found') {
                  rebootGameHost(state, gameSocket);
                }
              });
              gameSocket.on('game-room-expired', function() {
                rebootGameHost(state, gameSocket);
              });
            }
            if (state.socket && state.socket.connected) emitGameHostJoin(state);
          }
          function connectGameHosts(games) {
            (games || []).forEach(connectGameHost);
          }
          function bootstrapGameHosts() {
            if (gameBootstrapInFlight || typeof fetch !== 'function') return;
            gameBootstrapInFlight = true;
            var attempt = 0;
            function request() {
              attempt += 1;
              fetch('/api/presentations/' + encodeURIComponent(${presentationIdLiteral}) + '/present/game-bootstrap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify({
                  roomCode: liveRoom,
                  presenterToken: presenterToken,
                  hostCapabilities: getKnownGameCapabilities()
                })
              }).then(function(response) {
                return response.json().catch(function() { return {}; }).then(function(data) {
                  return { response: response, data: data };
                });
              }).then(function(result) {
                var retryable = result.response.status === 409 || result.response.status === 503;
                if (result.response.ok) {
                  gameBootstrapInFlight = false;
                  connectGameHosts(result.data.games || []);
                  return;
                }
                if (retryable && attempt < GAME_BOOTSTRAP_MAX_ATTEMPTS) {
                  gameBootstrapTimer = setTimeout(request, Math.min(500 * attempt, 2500));
                  return;
                }
                gameBootstrapInFlight = false;
              }).catch(function() {
                if (attempt < GAME_BOOTSTRAP_MAX_ATTEMPTS) {
                  gameBootstrapTimer = setTimeout(request, Math.min(500 * attempt, 2500));
                } else {
                  gameBootstrapInFlight = false;
                }
              });
            }
            request();
          }
          window.addEventListener('beforeunload', function() {
            if (gameBootstrapTimer) clearTimeout(gameBootstrapTimer);
            Object.keys(gameHostStates).forEach(function(gameId) {
              var state = gameHostStates[gameId];
              if (state.socket) state.socket.disconnect();
            });
          });
          livePresentationReady = bootstrapGameHosts;`
}

module.exports = { buildGameBootstrapRuntime, safeScriptLiteral }

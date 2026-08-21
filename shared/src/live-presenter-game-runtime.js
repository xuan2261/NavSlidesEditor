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
          var gameHostStates = Object.create(null);
          var pendingGameShortcutActions = Object.create(null);
          var gameBootstrapTimer = null;
          var gameBootstrapInFlight = false;
          var GAME_BOOTSTRAP_MAX_ATTEMPTS = 5;
          var GAME_SHORTCUT_QUEUE_LIMIT = 20;
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
            var known = Object.create(null);
            try {
              var stored = sessionStorage.getItem(capabilityMapKey());
              var parsed = stored && JSON.parse(stored);
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                Object.keys(parsed).forEach(function(gameId) {
                  known[gameId] = parsed[gameId];
                });
              }
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
            state.pendingShortcutActions = state.pendingShortcutActions || pendingGameShortcutActions[game.gameId] || [];
            delete pendingGameShortcutActions[game.gameId];
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
                drainGameShortcutActions(state);
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
          function queueGameShortcut(queue, detail) {
            if (!queue || queue.length >= GAME_SHORTCUT_QUEUE_LIMIT) return false;
            queue.push(Object.assign({}, detail));
            return true;
          }
          function gameSocketEventForShortcut(state, action) {
            if ((action === 'startSpin' || action === 'random') && state.gameType === 'name-picker') {
              return 'game-random';
            }
            if (
              ['next', 'nextQuestion', 'nextPhase', 'nextTeam'].indexOf(action) >= 0 &&
              ['hot-potato', 'jeopardy', 'relay-race', 'trivia-champ'].indexOf(state.gameType) >= 0
            ) {
              return 'game-next';
            }
            if (action === 'end') return 'game-end';
            if (action === 'startPoll' && state.gameType === 'poll') return 'game-poll-start';
            if (
              ['reveal', 'refreshResults'].indexOf(action) >= 0 &&
              state.gameType === 'poll'
            ) {
              return 'game-poll-reveal';
            }
            if (action === 'startWordCloud' && state.gameType === 'word-cloud') {
              return 'game-word-cloud-start';
            }
            if (
              ['reveal', 'refreshWordCloud'].indexOf(action) >= 0 &&
              state.gameType === 'word-cloud'
            ) {
              return 'game-word-cloud-reveal';
            }
            if (action === 'startMatching' && state.gameType === 'matching') {
              return 'game-matching-start';
            }
            if (
              ['reveal', 'revealMatching'].indexOf(action) >= 0 &&
              state.gameType === 'matching'
            ) {
              return 'game-matching-reveal';
            }
            return null;
          }
          function liveSocketEventForShortcut(action) {
            if (action === 'startTimer') return 'game-timer-start';
            if (action === 'pauseGame') return 'game-timer-pause';
            if (action === 'addTime' || action === 'subTime') return 'game-timer-adjust';
            return null;
          }
          function dispatchGameShortcut(state, detail) {
            if (!state || !state.socket || !state.socket.connected || !state.joined) return false;
            if (!detail || detail.gameType !== state.gameType) return true;
            var gameSocketEvent = gameSocketEventForShortcut(state, detail.action);
            if (gameSocketEvent) {
              state.socket.emit(gameSocketEvent, { gameId: state.gameId });
              return true;
            }
            var liveSocketEvent = liveSocketEventForShortcut(detail.action);
            if (!liveSocketEvent) return true;
            if (typeof livePresenterSocket === 'undefined' || !livePresenterSocket || !livePresenterSocket.connected) {
              return false;
            }
            var payload = { elementId: state.gameId };
            if (liveSocketEvent === 'game-timer-start') payload.duration = detail.duration;
            if (liveSocketEvent === 'game-timer-adjust') payload.delta = detail.delta;
            livePresenterSocket.emit(liveSocketEvent, payload);
            return true;
          }
          function drainAllGameShortcutActions() {
            Object.keys(gameHostStates).forEach(function(gameId) {
              drainGameShortcutActions(gameHostStates[gameId]);
            });
          }
          function drainGameShortcutActions(state) {
            if (!state || !state.pendingShortcutActions || !state.pendingShortcutActions.length) return;
            var queued = state.pendingShortcutActions;
            state.pendingShortcutActions = [];
            for (var index = 0; index < queued.length; index += 1) {
              if (dispatchGameShortcut(state, queued[index])) continue;
              state.pendingShortcutActions = queued.slice(index);
              return;
            }
          }
          function notifyPresenterReady() {
            if (!window.opener || window.opener.closed) return;
            try {
              window.opener.postMessage({
                type: 'navslides:presenter-ready',
                presentationId: ${presentationIdLiteral},
                roomCode: liveRoom
              }, window.location.origin);
            } catch (e) {}
          }
          function notifyPresenterUnready() {
            if (!window.opener || window.opener.closed) return;
            try {
              window.opener.postMessage({
                type: 'navslides:presenter-unready',
                presentationId: ${presentationIdLiteral},
                roomCode: liveRoom
              }, window.location.origin);
            } catch (e) {}
          }
          window.addEventListener('message', function(event) {
            if (event.origin !== window.location.origin || event.source !== window.opener) return;
            var message = event.data || {};
            if (
              message.type !== 'navslides:game-shortcut' ||
              message.presentationId !== ${presentationIdLiteral} ||
              message.roomCode !== liveRoom
            ) {
              return;
            }
            var detail = message.detail || {};
            if (
              typeof detail.elementId !== 'string' ||
              typeof detail.action !== 'string' ||
              typeof detail.gameType !== 'string'
            ) {
              return;
            }
            var state = gameHostStates[detail.elementId];
            if (!state) {
              var pending = pendingGameShortcutActions[detail.elementId] || [];
              pendingGameShortcutActions[detail.elementId] = pending;
              queueGameShortcut(pending, detail);
              return;
            }
            if (detail.gameType !== state.gameType) return;
            if (dispatchGameShortcut(state, detail)) return;
            state.pendingShortcutActions = state.pendingShortcutActions || [];
            queueGameShortcut(state.pendingShortcutActions, detail);
          });
          notifyPresenterReady();
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
            notifyPresenterUnready();
            if (gameBootstrapTimer) clearTimeout(gameBootstrapTimer);
            Object.keys(gameHostStates).forEach(function(gameId) {
              var state = gameHostStates[gameId];
              if (state.socket) state.socket.disconnect();
            });
          });
          livePresentationReady = bootstrapGameHosts;`
}

module.exports = { buildGameBootstrapRuntime, safeScriptLiteral }

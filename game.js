(function () {
  const storageKey = 'itw_tcg_game_session';
  const state = {
    socket: null,
    sessionId: '',
    roomCode: '',
    playerName: '',
    playerSlot: '',
    room: null,
    error: ''
  };

  const elements = {
    playerName: document.getElementById('playerName'),
    roomCodeInput: document.getElementById('roomCodeInput'),
    createRoomButton: document.getElementById('createRoomButton'),
    joinRoomButton: document.getElementById('joinRoomButton'),
    connectionStatus: document.getElementById('connectionStatus'),
    roomSummary: document.getElementById('roomSummary'),
    roomCodeValue: document.getElementById('roomCodeValue'),
    playerSlotValue: document.getElementById('playerSlotValue'),
    seedValue: document.getElementById('seedValue'),
    playersStatus: document.getElementById('playersStatus'),
    roundValue: document.getElementById('roundValue'),
    phaseValue: document.getElementById('phaseValue'),
    turnPlayerValue: document.getElementById('turnPlayerValue'),
    challengeStatusValue: document.getElementById('challengeStatusValue'),
    validationMessage: document.getElementById('validationMessage'),
    boardArea: document.getElementById('boardArea'),
    handCountLabel: document.getElementById('handCountLabel'),
    handArea: document.getElementById('handArea'),
    challengeAttacker: document.getElementById('challengeAttacker'),
    challengeDefender: document.getElementById('challengeDefender'),
    challengeButton: document.getElementById('challengeButton'),
    activateCardSelect: document.getElementById('activateCardSelect'),
    activateCardButton: document.getElementById('activateCardButton'),
    endTurnButton: document.getElementById('endTurnButton'),
    logArea: document.getElementById('logArea'),
    resultPanel: document.getElementById('resultPanel'),
    resultBody: document.getElementById('resultBody')
  };

  function loadSession() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      state.sessionId = saved.sessionId || '';
      state.roomCode = saved.roomCode || '';
      state.playerName = saved.playerName || '';
      elements.playerName.value = state.playerName;
      elements.roomCodeInput.value = state.roomCode;
    } catch (error) {}
  }

  function saveSession() {
    localStorage.setItem(storageKey, JSON.stringify({
      sessionId: state.sessionId,
      roomCode: state.roomCode,
      playerName: state.playerName
    }));
  }

  function status(text) {
    elements.connectionStatus.textContent = text;
  }

  function setError(message) {
    state.error = message || '';
    elements.validationMessage.textContent = state.error;
  }

  function socketUrl() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return protocol + '//' + location.host + '/ws';
  }

  function ensureName() {
    const name = elements.playerName.value.trim();
    if (!name) {
      setError('Enter a player name first.');
      return '';
    }
    state.playerName = name;
    saveSession();
    return name;
  }

  function connect(initialMessage) {
    if (state.socket && state.socket.readyState <= 1) {
      state.socket.close();
    }
    const socket = new WebSocket(socketUrl());
    state.socket = socket;
    status('Connecting…');
    socket.addEventListener('open', function () {
      status('Connected.');
      socket.send(JSON.stringify(initialMessage));
    });
    socket.addEventListener('message', function (event) {
      const payload = JSON.parse(event.data);
      if (payload.type === 'joined') {
        state.sessionId = payload.sessionId;
        state.roomCode = payload.code;
        state.playerSlot = payload.slot;
        saveSession();
        renderMeta();
        setError('');
      } else if (payload.type === 'state') {
        state.room = payload.room;
        render();
      } else if (payload.type === 'error') {
        setError(payload.message || 'Request failed.');
      }
    });
    socket.addEventListener('close', function () {
      status('Disconnected.');
    });
  }

  function sendAction(action) {
    if (!state.socket || state.socket.readyState !== 1) {
      setError('Not connected to a room.');
      return;
    }
    setError('');
    state.socket.send(JSON.stringify({ type: 'action', action: action }));
  }

  function renderMeta() {
    elements.roomSummary.hidden = !state.roomCode;
    elements.roomCodeValue.textContent = state.roomCode || '—';
    elements.playerSlotValue.textContent = state.playerSlot || '—';
    elements.seedValue.textContent = state.room && state.room.seed ? state.room.seed : '—';
  }

  function zoneLabel(slot) {
    if (!state.room || !state.room.players[slot]) return slot;
    return state.room.players[slot].name + (slot === state.room.youAre ? ' (You)' : '');
  }

  function cardHtml(card, extra) {
    const effects = (card.mechanics.effects || []).map(function (effect) {
      return '<li>' + escapeHtml(effect) + '</li>';
    }).join('');
    const unsupported = (card.unsupportedEffects || []).length
      ? '<p class="muted">Manual: ' + escapeHtml(card.unsupportedEffects.join(' | ')) + '</p>'
      : '';
    return '<article class="card">'
      + '<header><h4>' + escapeHtml(card.metadata.name) + '</h4><span class="tag">R' + card.mechanics.rank + '</span></header>'
      + '<div class="tags"><span class="tag">' + escapeHtml(card.mechanics.suit) + '</span><span class="tag">Cost ' + card.mechanics.cost + '</span>'
      + '<span class="tag">Eff ' + card.effectiveRank + '</span>'
      + '<span class="tag">' + (card.exhausted ? 'Exhausted' : 'Ready') + '</span></div>'
      + (extra || '')
      + '<ul>' + effects + '</ul>'
      + unsupported
      + '</article>';
  }

  function renderPlayersStatus() {
    if (!state.room) {
      elements.playersStatus.innerHTML = '<p class="muted">Create or join a room.</p>';
      return;
    }
    elements.playersStatus.innerHTML = ['player1', 'player2'].map(function (slot) {
      const player = state.room.players[slot];
      if (!player) return '<div class="player-pill"><span>' + slot + '</span><span>Waiting for player…</span></div>';
      return '<div class="player-pill"><span>' + escapeHtml(player.name) + '</span><span>' + (player.connected ? 'Connected' : 'Disconnected') + '</span></div>';
    }).join('');
  }

  function renderBoard() {
    if (!state.room) {
      elements.boardArea.innerHTML = '<p class="muted">No room joined.</p>';
      return;
    }
    elements.boardArea.innerHTML = ['player1', 'player2'].map(function (slot) {
      const player = state.room.players[slot];
      if (!player) return '';
      return '<section class="board-player ' + (state.room.turnPlayer === slot ? 'active' : '') + '">'
        + '<header><h3>' + escapeHtml(zoneLabel(slot)) + '</h3><div class="muted">Deck ' + player.deckCount + ' • Hand ' + player.handCount + ' • Compost ' + player.compostCount + '</div></header>'
        + '<div class="zone-grid">'
        + renderZone('Energy', player.board.energy)
        + renderZone('Support', player.board.support)
        + renderZone('Wildlife', player.board.wildlife)
        + '</div>'
        + '</section>';
    }).join('');
  }

  function renderZone(title, cards) {
    return '<div class="zone"><h4>' + title + '</h4><div class="card-list">'
      + (cards.length ? cards.map(function (card) { return cardHtml(card); }).join('') : '<p class="muted">None</p>')
      + '</div></div>';
  }

  function renderHand() {
    const you = state.room && state.room.players[state.room.youAre];
    if (!you) {
      elements.handArea.innerHTML = '<p class="muted">Your hand will appear here.</p>';
      elements.handCountLabel.textContent = '0 cards';
      return;
    }
    elements.handCountLabel.textContent = you.hand.length + ' card' + (you.hand.length === 1 ? '' : 's');
    elements.handArea.innerHTML = you.hand.map(function (card, index) {
      return cardHtml(card, '<button data-play-index="' + index + '">Play card</button>');
    }).join('') || '<p class="muted">No cards in hand.</p>';
    Array.prototype.forEach.call(elements.handArea.querySelectorAll('[data-play-index]'), function (button) {
      button.addEventListener('click', function () {
        sendAction({ type: 'play_card', handIndex: Number(button.getAttribute('data-play-index')) });
      });
    });
  }

  function renderSelectors() {
    if (!state.room || !state.room.players[state.room.youAre]) return;
    const you = state.room.players[state.room.youAre];
    const opponentSlot = state.room.youAre === 'player1' ? 'player2' : 'player1';
    const opponent = state.room.players[opponentSlot];
    fillSelect(elements.challengeAttacker, you.board.support.concat(you.board.wildlife).map(optionForCard));
    fillSelect(elements.challengeDefender, opponent ? opponent.board.support.concat(opponent.board.wildlife).map(optionForCard) : []);
    fillSelect(elements.activateCardSelect, you.board.energy.concat(you.board.support, you.board.wildlife).map(optionForCard));
  }

  function optionForCard(card) {
    return { value: card.id, label: card.metadata.name + ' (' + card.mechanics.suit + ', Eff ' + card.effectiveRank + ')' };
  }

  function fillSelect(select, options) {
    select.innerHTML = '<option value="">Select…</option>' + options.map(function (item) {
      return '<option value="' + escapeHtml(item.value) + '">' + escapeHtml(item.label) + '</option>';
    }).join('');
  }

  function renderLog() {
    const log = state.room ? state.room.log : [];
    elements.logArea.innerHTML = log.length ? log.slice().reverse().map(function (entry) {
      return '<div class="log-entry ' + escapeHtml(entry.type) + '"><strong>' + escapeHtml(entry.type) + '</strong><div>' + escapeHtml(entry.text) + '</div></div>';
    }).join('') : '<p class="muted">Action log is empty.</p>';
  }

  function renderResult() {
    const room = state.room;
    if (!room || !room.gameOver || !room.finalResult) {
      elements.resultPanel.hidden = true;
      return;
    }
    elements.resultPanel.hidden = false;
    const winner = room.players[room.winner];
    elements.resultBody.innerHTML = '<p><strong>Winner:</strong> ' + escapeHtml(winner ? winner.name : '—') + '</p>'
      + '<p><strong>Reason:</strong> ' + escapeHtml(room.finalResult.reason || '—') + '</p>'
      + '<p><strong>Seed:</strong> ' + escapeHtml(room.finalResult.seed || '—') + '</p>'
      + '<p><strong>Scores:</strong> ' + room.finalResult.scores.player1 + ' - ' + room.finalResult.scores.player2 + '</p>';
  }

  function render() {
    renderMeta();
    renderPlayersStatus();
    if (state.room) {
      elements.roundValue.textContent = state.room.round || '—';
      elements.phaseValue.textContent = state.room.phase || '—';
      elements.turnPlayerValue.textContent = state.room.players[state.room.turnPlayer] ? state.room.players[state.room.turnPlayer].name : '—';
      elements.challengeStatusValue.textContent = state.room.preventChallenges ? 'Prevented this turn' : 'Available';
      elements.seedValue.textContent = state.room.seed || '—';
    }
    renderBoard();
    renderHand();
    renderSelectors();
    renderLog();
    renderResult();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  elements.createRoomButton.addEventListener('click', function () {
    const name = ensureName();
    if (!name) return;
    connect({ type: 'create_room', name: name });
  });

  elements.joinRoomButton.addEventListener('click', function () {
    const name = ensureName();
    const code = elements.roomCodeInput.value.trim().toUpperCase();
    if (!name || !code) {
      setError('Enter a player name and room code.');
      return;
    }
    connect({ type: 'join_room', name: name, code: code, sessionId: state.sessionId || undefined });
  });

  elements.challengeButton.addEventListener('click', function () {
    if (!elements.challengeAttacker.value || !elements.challengeDefender.value) {
      setError('Choose both a challenger and a defender.');
      return;
    }
    sendAction({ type: 'challenge', attackerId: elements.challengeAttacker.value, defenderId: elements.challengeDefender.value });
  });

  elements.activateCardButton.addEventListener('click', function () {
    if (!elements.activateCardSelect.value) {
      setError('Choose a card to activate.');
      return;
    }
    sendAction({ type: 'activate_card', cardId: elements.activateCardSelect.value });
  });

  elements.endTurnButton.addEventListener('click', function () {
    sendAction({ type: 'end_turn' });
  });

  loadSession();
  render();

  if (state.sessionId && state.roomCode && state.playerName) {
    connect({ type: 'reconnect_room', code: state.roomCode, sessionId: state.sessionId, name: state.playerName });
  }
})();

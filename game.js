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

  function setChildren(parent, children) {
    parent.replaceChildren.apply(parent, children);
  }

  function el(tag, options) {
    const node = document.createElement(tag);
    const opts = options || {};
    if (opts.className) node.className = opts.className;
    if (opts.text != null) node.textContent = String(opts.text);
    if (opts.html != null) node.innerHTML = opts.html;
    if (opts.attrs) {
      Object.keys(opts.attrs).forEach(function (key) {
        node.setAttribute(key, String(opts.attrs[key]));
      });
    }
    if (opts.children) setChildren(node, opts.children);
    return node;
  }

  function createCardNode(card, options) {
    const article = el('article', { className: 'card' });
    const header = el('header');
    header.append(el('h4', { text: card.metadata.name }));
    header.append(el('span', { className: 'tag', text: 'R' + card.mechanics.rank }));

    const tags = el('div', { className: 'tags' });
    ['' + card.mechanics.suit, 'Cost ' + card.mechanics.cost, 'Eff ' + card.effectiveRank, card.exhausted ? 'Exhausted' : 'Ready']
      .forEach(function (label) {
        tags.append(el('span', { className: 'tag', text: label }));
      });

    const list = el('ul');
    (card.mechanics.effects || []).forEach(function (effect) {
      list.append(el('li', { text: effect }));
    });

    article.append(header, tags);

    if (options && typeof options.onPlay === 'function') {
      const button = el('button', { text: 'Play card' });
      button.addEventListener('click', options.onPlay);
      article.append(button);
    }

    article.append(list);

    if ((card.unsupportedEffects || []).length) {
      article.append(el('p', { className: 'muted', text: 'Manual: ' + card.unsupportedEffects.join(' | ') }));
    }

    return article;
  }

  function renderPlayersStatus() {
    if (!state.room) {
      setChildren(elements.playersStatus, [el('p', { className: 'muted', text: 'Create or join a room.' })]);
      return;
    }
    const nodes = ['player1', 'player2'].map(function (slot) {
      const player = state.room.players[slot];
      const pill = el('div', { className: 'player-pill' });
      pill.append(el('span', { text: player ? player.name : slot }));
      pill.append(el('span', { text: player ? (player.connected ? 'Connected' : 'Disconnected') : 'Waiting for player…' }));
      return pill;
    });
    setChildren(elements.playersStatus, nodes);
  }

  function renderZone(title, cards) {
    const zone = el('div', { className: 'zone' });
    zone.append(el('h4', { text: title }));
    const list = el('div', { className: 'card-list' });
    if (cards.length) {
      cards.forEach(function (card) { list.append(createCardNode(card)); });
    } else {
      list.append(el('p', { className: 'muted', text: 'None' }));
    }
    zone.append(list);
    return zone;
  }

  function renderBoard() {
    if (!state.room) {
      setChildren(elements.boardArea, [el('p', { className: 'muted', text: 'No room joined.' })]);
      return;
    }
    const nodes = ['player1', 'player2'].map(function (slot) {
      const player = state.room.players[slot];
      if (!player) return null;
      const section = el('section', { className: 'board-player' + (state.room.turnPlayer === slot ? ' active' : '') });
      const header = el('header');
      header.append(el('h3', { text: zoneLabel(slot) }));
      header.append(el('div', {
        className: 'muted',
        text: 'Deck ' + player.deckCount + ' • Hand ' + player.handCount + ' • Compost ' + player.compostCount
      }));
      const grid = el('div', { className: 'zone-grid' });
      grid.append(renderZone('Energy', player.board.energy));
      grid.append(renderZone('Support', player.board.support));
      grid.append(renderZone('Wildlife', player.board.wildlife));
      section.append(header, grid);
      return section;
    }).filter(Boolean);
    setChildren(elements.boardArea, nodes);
  }

  function renderHand() {
    const you = state.room && state.room.players[state.room.youAre];
    if (!you) {
      elements.handCountLabel.textContent = '0 cards';
      setChildren(elements.handArea, [el('p', { className: 'muted', text: 'Your hand will appear here.' })]);
      return;
    }
    elements.handCountLabel.textContent = you.hand.length + ' card' + (you.hand.length === 1 ? '' : 's');
    if (!you.hand.length) {
      setChildren(elements.handArea, [el('p', { className: 'muted', text: 'No cards in hand.' })]);
      return;
    }
    const cards = you.hand.map(function (card, index) {
      return createCardNode(card, {
        onPlay: function () {
          sendAction({ type: 'play_card', handIndex: index });
        }
      });
    });
    setChildren(elements.handArea, cards);
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
    const nodes = [el('option', { text: 'Select…', attrs: { value: '' } })];
    options.forEach(function (item) {
      nodes.push(el('option', { text: item.label, attrs: { value: item.value } }));
    });
    setChildren(select, nodes);
  }

  function renderLog() {
    const log = state.room ? state.room.log : [];
    if (!log.length) {
      setChildren(elements.logArea, [el('p', { className: 'muted', text: 'Action log is empty.' })]);
      return;
    }
    const nodes = log.slice().reverse().map(function (entry) {
      const wrapper = el('div', { className: 'log-entry ' + entry.type });
      wrapper.append(el('strong', { text: entry.type }));
      wrapper.append(el('div', { text: entry.text }));
      return wrapper;
    });
    setChildren(elements.logArea, nodes);
  }

  function renderResult() {
    const room = state.room;
    if (!room || !room.gameOver || !room.finalResult) {
      elements.resultPanel.hidden = true;
      setChildren(elements.resultBody, []);
      return;
    }
    elements.resultPanel.hidden = false;
    const winner = room.players[room.winner];
    setChildren(elements.resultBody, [
      el('p', { text: 'Winner: ' + (winner ? winner.name : '—') }),
      el('p', { text: 'Reason: ' + (room.finalResult.reason || '—') }),
      el('p', { text: 'Seed: ' + (room.finalResult.seed || '—') }),
      el('p', { text: 'Scores: ' + room.finalResult.scores.player1 + ' - ' + room.finalResult.scores.player2 })
    ]);
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

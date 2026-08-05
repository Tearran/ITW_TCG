const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROUND_GUARD = 200;
const HAND_SIZE = 7;
const ROOM_TTL_MS = 1000 * 60 * 60;
const STATIC_FILES = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/game.html', 'game.html'],
  ['/game.js', 'game.js'],
  ['/game.css', 'game.css'],
  ['/README.md', 'README.md'],
  ['/energy.json', 'energy.json'],
  ['/support.json', 'support.json'],
  ['/wildlife.json', 'wildlife.json'],
  ['/events.json', 'events.json'],
  ['/effects.json', 'effects.json'],
  ['/artwork.json', 'artwork.json']
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

function loadJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, fileName), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeName(name) {
  return String(name || '').trim().slice(0, 24) || 'Player';
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function createSeed() {
  return crypto.randomBytes(8).toString('hex');
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedToInt(seed) {
  return parseInt(seed.slice(0, 8), 16) || 1;
}

function shuffleWithSeed(cards, seed) {
  const deck = cards.slice();
  const rand = mulberry32(seedToInt(seed));
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function generateRoomCode(existing) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    let code = '';
    for (let i = 0; i < 5; i += 1) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    if (!existing.has(code)) return code;
  }
  throw new Error('Unable to generate unique room code.');
}

function getCardId(card) {
  return `${card.mechanics.suit}-${card.mechanics.id}`;
}

function buildDeckCards() {
  const explicitDeck = path.join(ROOT, 'deck.json');
  if (fs.existsSync(explicitDeck)) {
    return loadJson('deck.json').map(normalizeCard);
  }
  return ['energy.json', 'support.json', 'wildlife.json', 'events.json']
    .flatMap((file) => loadJson(file))
    .map(normalizeCard);
}

function normalizeCard(card) {
  return {
    id: getCardId(card),
    mechanics: clone(card.mechanics),
    metadata: clone(card.metadata),
    sourceEffects: clone(card.mechanics.effects || [])
  };
}

function createGameEngine(options = {}) {
  const allCards = buildDeckCards();
  const cardMap = new Map(allCards.map((card) => [card.id, card]));

  function copyCardById(id) {
    return clone(cardMap.get(id));
  }

  function extractSupportedEffects(card) {
    const effects = card.sourceEffects || [];
    const supported = [];
    const unsupported = [];
    for (const effect of effects) {
      if (
        /^Challenge 1 opposing (Support|Wildlife)\.$/.test(effect) ||
        /^Exhaust \d+ Energy\.$/.test(effect) ||
        effect === 'Compost 1 Wildlife.' ||
        effect === 'Compost 1 opposing Wildlife.' ||
        effect === 'Compost 1 opposing Energy.' ||
        effect === 'Draw 3 cards.' ||
        effect === 'Each player draws 1 card.' ||
        effect === 'Refresh all Energy.' ||
        effect === 'Prevent all Challenges this turn.'
      ) {
        supported.push(effect);
      } else {
        unsupported.push(effect);
      }
    }
    return { supported, unsupported };
  }

  function createPlayer(slot, name, sessionId) {
    return {
      slot,
      name,
      sessionId,
      connected: true,
      deck: [],
      hand: [],
      board: { energy: [], support: [], wildlife: [] },
      compost: [],
      invalidMessage: ''
    };
  }

  function createRoomState(code, name, sessionId) {
    const seed = options.seed || createSeed();
    const createdAt = Date.now();
    return {
      code,
      seed,
      createdAt,
      updatedAt: createdAt,
      started: false,
      status: 'waiting',
      phase: 'waiting',
      round: 0,
      turnPlayer: 'player1',
      winner: null,
      gameOver: false,
      finalResult: null,
      preventChallenges: false,
      log: [],
      players: {
        player1: createPlayer('player1', sanitizeName(name), sessionId),
        player2: null
      },
      sessionToPlayer: new Map([[sessionId, 'player1']]),
      activeConnections: new Map(),
      lastChallenge: null
    };
  }

  function addLog(room, text, type = 'system') {
    room.log.push({ at: Date.now(), type, text });
    if (room.log.length > 200) room.log.shift();
  }

  function getPlayersArray(room) {
    return ['player1', 'player2'].filter((slot) => room.players[slot]).map((slot) => room.players[slot]);
  }

  function dealOpeningHand(player, room) {
    drawCards(room, player.slot, HAND_SIZE, { silent: true, source: 'opening hand' });
  }

  function freshCardInstance(cardId) {
    const card = copyCardById(cardId);
    card.exhausted = false;
    card.hostedCards = [];
    card.turnFlags = {};
    const { supported, unsupported } = extractSupportedEffects(card);
    card.supportedEffects = supported;
    card.unsupportedEffects = unsupported;
    return card;
  }

  function prepareDeck(seed) {
    return shuffleWithSeed(allCards.map((card) => card.id), seed);
  }

  function startGame(room) {
    if (room.started) throw new Error('Game already started.');
    if (!room.players.player1 || !room.players.player2) throw new Error('Two players are required to start.');
    room.started = true;
    room.status = 'active';
    room.phase = 'main';
    room.round = 1;
    room.turnPlayer = 'player1';
    room.preventChallenges = false;
    room.lastChallenge = null;
    for (const player of getPlayersArray(room)) {
      player.deck = prepareDeck(`${room.seed}-${player.slot}`);
      player.hand = [];
      player.board = { energy: [], support: [], wildlife: [] };
      player.compost = [];
      dealOpeningHand(player, room);
    }
    addLog(room, `Game started. Seed: ${room.seed}. ${room.players.player1.name} goes first and begins in Main phase after setup.`, 'system');
  }

  function getPlayer(room, slot) {
    const player = room.players[slot];
    if (!player) throw new Error(`Unknown player slot ${slot}`);
    return player;
  }

  function getOpponentSlot(slot) {
    return slot === 'player1' ? 'player2' : 'player1';
  }

  function getOpponent(room, slot) {
    return getPlayer(room, getOpponentSlot(slot));
  }

  function effectiveRank(card) {
    return Math.max(0, Number(card.mechanics.rank) - (card.exhausted ? 2 : 0));
  }

  function drawCards(room, slot, count, options = {}) {
    const player = getPlayer(room, slot);
    for (let i = 0; i < count; i += 1) {
      if (player.deck.length === 0) {
        room.gameOver = true;
        room.status = 'finished';
        room.winner = getOpponentSlot(slot);
        room.finalResult = {
          reason: `${player.name} could not draw from an empty deck.`,
          seed: room.seed,
          scores: calculateScores(room)
        };
        addLog(room, `${player.name} could not draw from an empty deck and loses.`, 'result');
        return;
      }
      const cardId = player.deck.shift();
      player.hand.push(freshCardInstance(cardId));
    }
    if (!options.silent) {
      addLog(room, `${player.name} draws ${count} card${count === 1 ? '' : 's'}.`, 'action');
    }
  }

  function payEnergy(player, amount) {
    const readyEnergy = player.board.energy.filter((card) => !card.exhausted);
    if (readyEnergy.length < amount) {
      throw new Error(`Need ${amount} ready Energy to pay this cost.`);
    }
    readyEnergy.slice(0, amount).forEach((card) => {
      card.exhausted = true;
    });
  }

  function removeCardFromZone(zone, cardId) {
    const index = zone.findIndex((card) => card.id === cardId);
    if (index === -1) return null;
    return zone.splice(index, 1)[0];
  }

  function findBoardCard(player, cardId) {
    for (const zoneName of ['energy', 'support', 'wildlife']) {
      const card = player.board[zoneName].find((entry) => entry.id === cardId);
      if (card) return { zoneName, card };
    }
    return null;
  }

  function compostCard(player, card) {
    if (!card) return;
    card.exhausted = false;
    player.compost.push(card);
  }

  function moveBoardCardToCompost(player, cardId) {
    for (const zoneName of ['energy', 'support', 'wildlife']) {
      const card = removeCardFromZone(player.board[zoneName], cardId);
      if (card) {
        compostCard(player, card);
        return card;
      }
    }
    return null;
  }

  function returnWildlifeToHand(player, cardId) {
    const card = removeCardFromZone(player.board.wildlife, cardId);
    if (!card) throw new Error('Selected Wildlife is not in play.');
    card.exhausted = false;
    player.hand.push(card);
  }

  function refreshPlayer(room, slot) {
    const player = getPlayer(room, slot);
    const freezeEnergy = player.frozenEnergyRefresh;
    for (const card of player.board.support.concat(player.board.wildlife)) {
      card.exhausted = false;
    }
    for (const card of player.board.energy) {
      if (!freezeEnergy) card.exhausted = false;
    }
    player.frozenEnergyRefresh = false;
  }

  function calculatePlayerScore(player) {
    let total = 0;
    for (const zoneName of ['energy', 'support', 'wildlife']) {
      for (const card of player.board[zoneName]) {
        if (!card.exhausted) total += Number(card.mechanics.rank) || 0;
      }
    }
    return total;
  }

  function calculateScores(room) {
    return {
      player1: calculatePlayerScore(room.players.player1),
      player2: calculatePlayerScore(room.players.player2)
    };
  }

  function finalizeByScore(room, reason) {
    const scores = calculateScores(room);
    let winner = null;
    if (scores.player1 > scores.player2) winner = 'player1';
    else if (scores.player2 > scores.player1) winner = 'player2';
    else {
      const p1 = room.players.player1;
      const p2 = room.players.player2;
      while (!winner) {
        if (!p1.deck.length && !p2.deck.length) {
          winner = 'player1';
          break;
        }
        if (!p1.deck.length) {
          winner = 'player2';
          break;
        }
        if (!p2.deck.length) {
          winner = 'player1';
          break;
        }
        const c1 = freshCardInstance(p1.deck.shift());
        const c2 = freshCardInstance(p2.deck.shift());
        addLog(room, `Tie break draw: ${p1.name} drew ${c1.metadata.name} (${c1.mechanics.rank}), ${p2.name} drew ${c2.metadata.name} (${c2.mechanics.rank}).`, 'result');
        if (c1.mechanics.rank > c2.mechanics.rank) winner = 'player1';
        else if (c2.mechanics.rank > c1.mechanics.rank) winner = 'player2';
      }
    }
    room.gameOver = true;
    room.status = 'finished';
    room.winner = winner;
    room.finalResult = { reason, seed: room.seed, scores };
    addLog(room, `Final score — ${room.players.player1.name}: ${scores.player1}, ${room.players.player2.name}: ${scores.player2}. Winner: ${room.players[winner].name}.`, 'result');
  }

  function maybeEndGame(room) {
    if (!room.started || room.gameOver) return;
    const players = getPlayersArray(room);
    const anyEmptyHand = players.some((player) => player.hand.length === 0);
    if (anyEmptyHand) {
      finalizeByScore(room, 'A player ended the round with no cards in hand.');
    }
  }

  function advanceTurn(room) {
    const current = room.turnPlayer;
    const next = getOpponentSlot(current);
    room.lastChallenge = null;
    room.preventChallenges = false;
    if (current === 'player2') {
      room.round += 1;
      if (room.round > MAX_ROUND_GUARD) {
        finalizeByScore(room, 'Round guard reached.');
        return;
      }
      maybeEndGame(room);
      if (room.gameOver) return;
    }
    room.turnPlayer = next;
    room.phase = 'refresh';
    refreshPlayer(room, next);
    addLog(room, `${room.players[next].name} begins turn ${room.round}, Refresh phase.`, 'system');
    room.phase = 'draw';
    drawCards(room, next, 1, { silent: false, source: 'turn draw' });
    if (room.gameOver) return;
    room.phase = 'main';
  }

  function ensureTurn(room, slot) {
    if (!room.started) throw new Error('Game has not started yet.');
    if (room.gameOver) throw new Error('Game is already over.');
    if (room.turnPlayer !== slot) throw new Error('It is not your turn.');
  }

  function ensureMainOrChallenge(room) {
    if (!['main', 'challenge'].includes(room.phase)) {
      throw new Error(`Action not allowed during ${room.phase} phase.`);
    }
  }

  function playCard(room, slot, handIndex) {
    ensureTurn(room, slot);
    ensureMainOrChallenge(room);
    const player = getPlayer(room, slot);
    if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= player.hand.length) {
      throw new Error('Selected hand card is invalid.');
    }
    const card = player.hand[handIndex];
    payEnergy(player, Number(card.mechanics.cost) || 0);
    player.hand.splice(handIndex, 1);
    card.exhausted = false;
    const suit = card.mechanics.suit;
    const zone = suit === 'event' ? null : player.board[suit];
    if (zone) {
      zone.push(card);
      addLog(room, `${player.name} plays ${card.metadata.name} (${suit}).`, 'action');
      if (card.unsupportedEffects.length) {
        addLog(room, `${card.metadata.name} has unresolved passive/manual text: ${card.unsupportedEffects.join(' | ')}`, 'warning');
      }
      if (card.sourceEffects.includes('Draw 1 card when played.')) {
        drawCards(room, slot, 1, { silent: false, source: card.metadata.name });
      }
    } else {
      addLog(room, `${player.name} plays event ${card.metadata.name}.`, 'action');
      resolveEffectSequence(room, slot, card, { fromEvent: true });
      compostCard(player, card);
    }
  }

  function resolveEffectSequence(room, slot, card, options = {}) {
    for (const effect of card.supportedEffects || []) {
      applyEffect(room, slot, card, effect, options);
      if (room.gameOver) return;
    }
    if ((card.unsupportedEffects || []).length) {
      addLog(room, `${card.metadata.name} includes manual/unimplemented effects: ${card.unsupportedEffects.join(' | ')}`, 'warning');
    }
  }

  function applyEffect(room, slot, card, effect, options = {}) {
    const player = getPlayer(room, slot);
    const opponent = getOpponent(room, slot);
    let match;
    if ((match = effect.match(/^Exhaust (\d+) Energy\.$/))) {
      payEnergy(player, Number(match[1]));
      addLog(room, `${player.name} exhausts ${match[1]} Energy for ${card.metadata.name}.`, 'action');
      return;
    }
    if (effect === 'Draw 3 cards.') {
      drawCards(room, slot, 3, { silent: false, source: card.metadata.name });
      return;
    }
    if (effect === 'Each player draws 1 card.') {
      drawCards(room, 'player1', 1, { silent: false, source: card.metadata.name });
      if (!room.gameOver) drawCards(room, 'player2', 1, { silent: false, source: card.metadata.name });
      return;
    }
    if (effect === 'Refresh all Energy.') {
      player.board.energy.forEach((entry) => { entry.exhausted = false; });
      addLog(room, `${player.name} refreshes all Energy.`, 'action');
      return;
    }
    if (effect === 'Prevent all Challenges this turn.') {
      room.preventChallenges = true;
      addLog(room, 'Challenges are prevented for the rest of this turn.', 'action');
      return;
    }
    if (effect === 'Compost 1 Wildlife.') {
      if (!opponent.board.wildlife.length && !player.board.wildlife.length) {
        throw new Error('No Wildlife is available to compost.');
      }
      const targetPlayer = opponent.board.wildlife.length ? opponent : player;
      const target = targetPlayer.board.wildlife[0];
      moveBoardCardToCompost(targetPlayer, target.id);
      addLog(room, `${target.metadata.name} is composted by ${card.metadata.name}.`, 'action');
      return;
    }
    if (effect === 'Compost 1 opposing Wildlife.') {
      if (!opponent.board.wildlife.length) throw new Error('Opponent has no Wildlife to compost.');
      const target = opponent.board.wildlife[0];
      moveBoardCardToCompost(opponent, target.id);
      addLog(room, `${target.metadata.name} is composted by ${card.metadata.name}.`, 'action');
      return;
    }
    if (effect === 'Compost 1 opposing Energy.') {
      if (!opponent.board.energy.length) throw new Error('Opponent has no Energy to compost.');
      const target = opponent.board.energy[0];
      moveBoardCardToCompost(opponent, target.id);
      addLog(room, `${target.metadata.name} is composted by ${card.metadata.name}.`, 'action');
      return;
    }
    if (/^Challenge 1 opposing (Support|Wildlife)\.$/.test(effect)) {
      room.phase = 'challenge';
      addLog(room, `${card.metadata.name} enables a challenge action that the player may also take manually.`, 'warning');
      return;
    }
  }

  function declareChallenge(room, slot, attackerId, defenderId) {
    ensureTurn(room, slot);
    if (room.phase !== 'main' && room.phase !== 'challenge') {
      throw new Error(`Challenges are not allowed during ${room.phase} phase.`);
    }
    if (room.preventChallenges) {
      throw new Error('Challenges are prevented this turn.');
    }
    const player = getPlayer(room, slot);
    const opponent = getOpponent(room, slot);
    const attackerEntry = findBoardCard(player, attackerId);
    if (!attackerEntry) throw new Error('Attacking card is not in play.');
    if (!['support', 'wildlife'].includes(attackerEntry.zoneName)) throw new Error('Only Support or Wildlife may challenge.');
    const attacker = attackerEntry.card;
    if (attacker.exhausted) throw new Error('Exhausted cards cannot challenge.');
    const defenderEntry = findBoardCard(opponent, defenderId);
    if (!defenderEntry) throw new Error('Defending card is not in play.');
    if (!['support', 'wildlife'].includes(defenderEntry.zoneName)) throw new Error('Only opposing Support or Wildlife may be challenged.');
    const defender = defenderEntry.card;
    if (defender.sourceEffects.includes('Hosted Wildlife cannot be Challenged.') && defenderEntry.zoneName === 'wildlife') {
      throw new Error('This Wildlife cannot currently be challenged.');
    }
    room.phase = 'challenge';
    room.lastChallenge = { attackerId, defenderId, attackerName: attacker.metadata.name, defenderName: defender.metadata.name };
    const attackerRank = effectiveRank(attacker);
    const defenderRank = effectiveRank(defender);
    addLog(room, `${player.name} challenges ${defender.metadata.name} with ${attacker.metadata.name} (${attackerRank} vs ${defenderRank}).`, 'action');
    if (attackerRank > defenderRank) {
      moveBoardCardToCompost(opponent, defender.id);
      attacker.exhausted = true;
      addLog(room, `${defender.metadata.name} is composted. ${attacker.metadata.name} survives and becomes Exhausted.`, 'action');
    } else if (attackerRank < defenderRank) {
      moveBoardCardToCompost(player, attacker.id);
      addLog(room, `${attacker.metadata.name} is composted.`, 'action');
    } else {
      moveBoardCardToCompost(player, attacker.id);
      moveBoardCardToCompost(opponent, defender.id);
      addLog(room, `Equal Effective Rank: both cards are composted.`, 'action');
    }
  }

  function activateCard(room, slot, cardId) {
    ensureTurn(room, slot);
    ensureMainOrChallenge(room);
    const player = getPlayer(room, slot);
    const entry = findBoardCard(player, cardId);
    if (!entry) throw new Error('Selected card is not in play.');
    resolveEffectSequence(room, slot, entry.card, { activation: true });
  }

  function endTurn(room, slot) {
    ensureTurn(room, slot);
    room.phase = 'end';
    addLog(room, `${room.players[slot].name} ends their turn.`, 'system');
    advanceTurn(room);
  }

  function serializeCard(card, viewerSlot, ownerSlot) {
    return {
      id: card.id,
      mechanics: {
        id: card.mechanics.id,
        rank: card.mechanics.rank,
        suit: card.mechanics.suit,
        cost: card.mechanics.cost,
        effects: clone(card.sourceEffects || [])
      },
      metadata: clone(card.metadata),
      exhausted: !!card.exhausted,
      effectiveRank: effectiveRank(card),
      supportedEffects: clone(card.supportedEffects || []),
      unsupportedEffects: clone(card.unsupportedEffects || []),
      visibility: viewerSlot === ownerSlot ? 'private' : 'public'
    };
  }

  function serializePlayer(room, ownerSlot, viewerSlot) {
    const player = getPlayer(room, ownerSlot);
    return {
      slot: ownerSlot,
      name: player.name,
      connected: player.connected,
      deckCount: player.deck.length,
      handCount: player.hand.length,
      hand: viewerSlot === ownerSlot ? player.hand.map((card) => serializeCard(card, viewerSlot, ownerSlot)) : [],
      board: {
        energy: player.board.energy.map((card) => serializeCard(card, viewerSlot, ownerSlot)),
        support: player.board.support.map((card) => serializeCard(card, viewerSlot, ownerSlot)),
        wildlife: player.board.wildlife.map((card) => serializeCard(card, viewerSlot, ownerSlot))
      },
      compostCount: player.compost.length,
      compostTop: player.compost.length ? serializeCard(player.compost[player.compost.length - 1], viewerSlot, ownerSlot) : null
    };
  }

  function serializeRoom(room, viewerSlot) {
    return {
      code: room.code,
      seed: room.seed,
      started: room.started,
      status: room.status,
      phase: room.phase,
      round: room.round,
      turnPlayer: room.turnPlayer,
      preventChallenges: room.preventChallenges,
      gameOver: room.gameOver,
      winner: room.winner,
      finalResult: room.finalResult,
      youAre: viewerSlot,
      players: {
        player1: serializePlayer(room, 'player1', viewerSlot),
        player2: room.players.player2 ? serializePlayer(room, 'player2', viewerSlot) : null
      },
      log: clone(room.log),
      lastChallenge: clone(room.lastChallenge)
    };
  }

  function joinRoom(room, name, sessionId) {
    if (room.sessionToPlayer.has(sessionId)) {
      const slot = room.sessionToPlayer.get(sessionId);
      const player = getPlayer(room, slot);
      player.connected = true;
      if (name) player.name = sanitizeName(name);
      addLog(room, `${player.name} reconnected.`, 'system');
      return slot;
    }
    if (!room.players.player2) {
      room.players.player2 = createPlayer('player2', sanitizeName(name), sessionId);
      room.sessionToPlayer.set(sessionId, 'player2');
      addLog(room, `${room.players.player2.name} joined the room.`, 'system');
      startGame(room);
      return 'player2';
    }
    const disconnectedSlot = ['player1', 'player2'].find((slot) => room.players[slot] && !room.players[slot].connected && room.players[slot].name === sanitizeName(name));
    if (disconnectedSlot) {
      const player = room.players[disconnectedSlot];
      room.sessionToPlayer.set(sessionId, disconnectedSlot);
      player.sessionId = sessionId;
      player.connected = true;
      addLog(room, `${player.name} reconnected.`, 'system');
      return disconnectedSlot;
    }
    throw new Error('Room is full.');
  }

  function disconnect(room, sessionId) {
    if (!room.sessionToPlayer.has(sessionId)) return;
    const slot = room.sessionToPlayer.get(sessionId);
    const player = room.players[slot];
    if (player) {
      player.connected = false;
      addLog(room, `${player.name} disconnected.`, 'system');
    }
  }

  function applyClientAction(room, slot, action) {
    if (!action || typeof action !== 'object') throw new Error('Malformed action payload.');
    switch (action.type) {
      case 'play_card':
        playCard(room, slot, Number(action.handIndex));
        break;
      case 'activate_card':
        activateCard(room, slot, String(action.cardId || ''));
        break;
      case 'challenge':
        declareChallenge(room, slot, String(action.attackerId || ''), String(action.defenderId || ''));
        break;
      case 'end_turn':
        endTurn(room, slot);
        break;
      default:
        throw new Error('Unknown action type.');
    }
  }

  return {
    createRoomState,
    joinRoom,
    disconnect,
    serializeRoom,
    applyClientAction,
    calculateScores,
    startGame,
    payEnergy,
    effectiveRank,
    prepareDeck,
    finalizeByScore,
    advanceTurn
  };
}

const engine = createGameEngine();
const rooms = new Map();

function jsonResponse(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  let relativePath = STATIC_FILES.get(pathname);
  if (!relativePath && pathname.startsWith('/artwork/')) {
    relativePath = pathname.slice(1);
  }
  if (!relativePath) return false;
  const filePath = path.join(ROOT, relativePath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return true;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
  return true;
}

function cleanupRooms() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    const allDisconnected = ['player1', 'player2'].every((slot) => !room.players[slot] || !room.players[slot].connected);
    if (allDisconnected && now - room.updatedAt > ROOM_TTL_MS) {
      rooms.delete(code);
    }
  }
}

function broadcastRoom(room) {
  room.updatedAt = Date.now();
  for (const [sessionId, socket] of room.activeConnections.entries()) {
    if (socket.readyState !== socket.OPEN) continue;
    const slot = room.sessionToPlayer.get(sessionId);
    if (!slot) continue;
    socket.send(JSON.stringify({ type: 'state', room: engine.serializeRoom(room, slot) }));
  }
}

function sendError(socket, message) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify({ type: 'error', message }));
  }
}

function attachConnection(room, sessionId, socket) {
  room.activeConnections.set(sessionId, socket);
  socket.on('close', () => {
    room.activeConnections.delete(sessionId);
    engine.disconnect(room, sessionId);
    broadcastRoom(room);
  });
}

const server = http.createServer((req, res) => {
  cleanupRooms();
  if (req.method === 'GET' && serveStatic(req, res)) return;
  if (req.method === 'GET' && req.url.startsWith('/api/health')) {
    return jsonResponse(res, 200, { ok: true, rooms: rooms.size });
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (socket) => {
  let room = null;
  let sessionId = null;
  socket.on('message', (buffer) => {
    let payload;
    try {
      payload = JSON.parse(String(buffer));
    } catch (error) {
      sendError(socket, 'Malformed JSON message.');
      return;
    }
    try {
      if (payload.type === 'create_room') {
        sessionId = randomId('session');
        const code = generateRoomCode(rooms);
        room = engine.createRoomState(code, payload.name, sessionId);
        rooms.set(code, room);
        attachConnection(room, sessionId, socket);
        addSocketAck(socket, sessionId, code, 'player1');
        broadcastRoom(room);
        return;
      }
      if (payload.type === 'join_room') {
        const code = String(payload.code || '').trim().toUpperCase();
        if (!rooms.has(code)) throw new Error('Room not found.');
        room = rooms.get(code);
        sessionId = payload.sessionId ? String(payload.sessionId) : randomId('session');
        const slot = engine.joinRoom(room, payload.name, sessionId);
        attachConnection(room, sessionId, socket);
        addSocketAck(socket, sessionId, code, slot);
        broadcastRoom(room);
        return;
      }
      if (payload.type === 'reconnect_room') {
        const code = String(payload.code || '').trim().toUpperCase();
        if (!rooms.has(code)) throw new Error('Room not found.');
        room = rooms.get(code);
        sessionId = String(payload.sessionId || '');
        if (!sessionId) throw new Error('Missing session id.');
        const slot = engine.joinRoom(room, payload.name, sessionId);
        attachConnection(room, sessionId, socket);
        addSocketAck(socket, sessionId, code, slot);
        broadcastRoom(room);
        return;
      }
      if (!room || !sessionId) throw new Error('Join a room first.');
      const slot = room.sessionToPlayer.get(sessionId);
      if (!slot) throw new Error('Session is no longer associated with a player.');
      if (payload.type === 'action') {
        engine.applyClientAction(room, slot, payload.action);
        broadcastRoom(room);
        return;
      }
      throw new Error('Unknown message type.');
    } catch (error) {
      sendError(socket, error.message || 'Request failed.');
      if (room) broadcastRoom(room);
    }
  });
});

function addSocketAck(socket, sessionId, code, slot) {
  socket.send(JSON.stringify({ type: 'joined', sessionId, code, slot }));
}

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`ITW TCG server listening on http://localhost:${PORT}`);
  });
}

module.exports = {
  createGameEngine,
  server
};

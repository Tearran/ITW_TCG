(function () {
  'use strict';

  const STUN_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  const HAND_SIZE = 7;
  const CHANNEL_NAME = 'game';
  const DEFAULT_NAMES = ['Host', 'Guest'];

  const GAME_RULES = {
    security: 'Host browser is authoritative. Guests may request actions, but only host validates and mutates state. Suitable for friendly play only.',
    implementedEffects: [
      'Challenge 1 opposing Support.',
      'Challenge 1 opposing Wildlife.',
      'Prevent all Challenges this turn.',
      'Draw 3 cards.',
      'Each player draws 1 card.',
      'Compost 1 Wildlife.',
      'Compost 1 opposing Wildlife.',
      'Compost 1 opposing Energy.',
      'Refresh all Energy.',
      'Exhaust 1 opposing Energy.',
      'Exhaust all Energy.',
      'Each player composts 1 Support.',
      "Return 1 Energy to its owner's hand.",
      'Cancel the Challenge.',
      'Exhaust all Wildlife.',
      'Prevent 1 Challenge this turn.',
      "Return all Wildlife to their owners' hands."
    ],
    unimplementedEffects: {
      'Move 1 Wildlife to this card.': 'Hosting and movement are not modeled in the MVP board layout.',
      'Hosted Wildlife gains +2 Rank.': 'Hosted-card relationships are not modeled in the MVP.',
      'Hosted Wildlife cannot be Challenged.': 'Hosted-card relationships are not modeled in the MVP.',
      'Adjacent Wildlife gains +1 Rank.': 'Adjacency bonuses are not modeled in the MVP board layout.',
      'Adjacent Wildlife gains +2 Rank.': 'Adjacency bonuses are not modeled in the MVP board layout.',
      'Search your deck for 1 Wildlife.': 'Deck search is outside the MVP interaction flow.',
      'Search your deck for a Support card.': 'Deck search is outside the MVP interaction flow.',
      'Generate 1 Energy per turn.': 'Base energy system is represented by ready/exhausted energy cards, not a triggered effect.',
      'Draw 1 card when played.': 'Not included in the MVP effect list.',
      'Exhaust 2 Energy.': 'Not included as a standalone effect in the MVP effect list.',
      'Exhaust 1 Energy.': 'Not included as a standalone effect in the MVP effect list.',
      'Heal 1 damage from a connected Wildlife card.': 'Damage is not modeled in the MVP.',
      'Herd mechanics: gains +1 defense for each adjacent herd animal.': 'Adjacency/defense bonuses are not modeled in the MVP.',
      'Increases adjacent Wildlife defense by 1.': 'Adjacency/defense bonuses are not modeled in the MVP.',
      'Can escape to the hand if attacked.': 'Reactive escape timing is outside the MVP.',
      'Provides 2 Energy if played in a Wetland biome.': 'Biome rules are not modeled in the MVP.',
      'Gains +1 defense in Forest biomes.': 'Biome rules are not modeled in the MVP.',
      'Attracts Insect suit Wildlife.': 'Suit attraction rules are not modeled in the MVP.',
      'Produces acorns; double Energy output every 3rd turn.': 'Per-turn scaling output is not modeled in the MVP.',
      'Can move across water terrain without penalty.': 'Terrain is not modeled in the MVP.',
      'Opposing Energy cannot Refresh this turn.': 'Delayed refresh lock is not modeled in the MVP.'
    }
  };

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function zoneLabel(suit) {
    if (suit === 'energy') return 'energy';
    if (suit === 'support') return 'support';
    if (suit === 'wildlife') return 'wildlife';
    return 'event';
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      const error = new Error('Failed to fetch ' + url + ': ' + response.status);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function loadCardData() {
    try {
      const deck = await fetchJson('deck.json');
      if (Array.isArray(deck)) {
        return deck.map(normalizeCard);
      }
      throw new Error('deck.json is not an array');
    } catch (error) {
      if (error && error.status && error.status !== 404) {
        console.warn('deck.json load failed, falling back to suit files', error);
      }
      const [wildlife, support, energy, events] = await Promise.all([
        fetchJson('wildlife.json'),
        fetchJson('support.json'),
        fetchJson('energy.json'),
        fetchJson('events.json')
      ]);
      return [].concat(energy, support, wildlife, events).map(normalizeCard);
    }
  }

  function normalizeCard(entry) {
    if (entry && entry.mechanics && entry.metadata) {
      return {
        id: entry.mechanics.id,
        name: entry.metadata.name,
        suit: entry.mechanics.suit,
        rank: Number(entry.mechanics.rank || 0),
        cost: Number(entry.mechanics.cost || 0),
        effects: Array.isArray(entry.mechanics.effects) ? entry.mechanics.effects.slice() : [],
        illustration: entry.metadata.illustration || '',
        metadata: entry.metadata
      };
    }
    return {
      id: entry.id,
      name: entry.name,
      suit: entry.suit,
      rank: Number(entry.rank || 0),
      cost: Number(entry.cost || 0),
      effects: Array.isArray(entry.effects) ? entry.effects.slice() : [],
      illustration: entry.illustration || '',
      metadata: entry.metadata || {}
    };
  }

  class GameEngine {
    constructor(cardDefs) {
      this.cardDefs = Array.isArray(cardDefs) ? cardDefs.slice() : [];
      this.cardMap = {};
      this.cardDefs.forEach((card) => {
        this.cardMap[String(card.id)] = card;
      });
    }

    getCard(cardId) {
      const card = this.cardMap[String(cardId)];
      if (!card) {
        throw new Error('Unknown card: ' + cardId);
      }
      return card;
    }

    buildDeck() {
      return shuffle(this.cardDefs.map((card) => card.id));
    }

    newGame(p0name, p1name) {
      const decks = [this.buildDeck(), this.buildDeck()];
      const players = [0, 1].map((idx) => ({
        name: idx === 0 ? (p0name || DEFAULT_NAMES[0]) : (p1name || DEFAULT_NAMES[1]),
        deck: decks[idx],
        hand: [],
        board: { energy: [], support: [], wildlife: [] },
        compost: [],
        mustMulligan: false,
        mulliganResolved: false
      }));

      const state = {
        phase: 'setup',
        round: 1,
        currentPlayer: Math.floor(Math.random() * 2),
        players,
        log: [],
        preventChallengesThisTurn: false,
        preventNextChallenge: false,
        pendingChallenge: null,
        pendingEffect: null,
        gameOver: false,
        winner: null,
        scores: [0, 0],
        challengeContext: null,
        loseReason: null
      };

      for (let p = 0; p < 2; p += 1) {
        for (let i = 0; i < HAND_SIZE; i += 1) {
          this.drawCard(state, p, { suppressEndCheck: true });
        }
        state.players[p].mustMulligan = !state.players[p].hand.some((cardId) => this.getCard(cardId).suit === 'energy');
      }

      state.log.push({
        turn: state.round,
        player: -1,
        text: players[state.currentPlayer].name + ' was chosen to start. Resolve mulligans first.'
      });

      return this.checkGameOver(state);
    }

    applyAction(state, action, fromPlayerIdx) {
      const next = deepClone(state);
      if (next.gameOver) {
        throw new Error('Game is already over.');
      }
      if (!action || !action.type) {
        throw new Error('Action type required.');
      }

      const mulliganPending = next.players.some((p) => !p.mulliganResolved);
      if (mulliganPending && action.type !== 'mulligan') {
        throw new Error('Resolve mulligans before taking game actions.');
      }

      const logs = [];
      const actingPlayer = next.players[fromPlayerIdx];
      if (!actingPlayer) {
        throw new Error('Invalid player index.');
      }

      if (next.pendingEffect && next.pendingEffect.forPlayer !== fromPlayerIdx) {
        throw new Error('Waiting on another player to resolve a pending effect.');
      }

      switch (action.type) {
        case 'mulligan':
          this.handleMulligan(next, fromPlayerIdx, action, logs);
          break;
        case 'playEnergy':
          this.assertCanAct(next, fromPlayerIdx, ['main']);
          this.playEnergy(next, fromPlayerIdx, action.cardId, logs);
          break;
        case 'playCard':
          this.assertCanAct(next, fromPlayerIdx, ['main']);
          this.playCard(next, fromPlayerIdx, action.cardId, logs);
          break;
        case 'declareChallenge':
          this.assertCanAct(next, fromPlayerIdx, ['challenge']);
          this.declareChallenge(next, fromPlayerIdx, action, logs);
          break;
        case 'resolveChallenge':
          if (next.phase !== 'challenge') {
            throw new Error('Action not allowed during ' + next.phase + ' phase.');
          }
          this.resolveChallenge(next, fromPlayerIdx, logs);
          break;
        case 'chooseCompost':
          this.choosePending(next, fromPlayerIdx, action, 'chooseCompost', logs);
          break;
        case 'chooseReturn':
          this.choosePending(next, fromPlayerIdx, action, 'chooseReturn', logs);
          break;
        case 'endTurn':
          this.endTurn(next, fromPlayerIdx, logs);
          break;
        default:
          throw new Error('Unsupported action: ' + action.type);
      }

      next.log = next.log.concat(logs);
      return { newState: this.checkGameOver(next), logs };
    }

    assertCanAct(state, playerIdx, allowedPhases) {
      if (state.currentPlayer !== playerIdx) {
        throw new Error('It is not your turn.');
      }
      if (allowedPhases.indexOf(state.phase) === -1) {
        throw new Error('Action not allowed during ' + state.phase + ' phase.');
      }
      if (state.pendingEffect) {
        throw new Error('Resolve pending effect first.');
      }
    }

    handleMulligan(state, playerIdx, action, logs) {
      const player = state.players[playerIdx];
      if (player.mulliganResolved) {
        throw new Error('Mulligan already resolved.');
      }
      if (action.accept) {
        player.deck = shuffle(player.deck.concat(player.hand));
        player.hand = [];
        for (let i = 0; i < HAND_SIZE; i += 1) {
          this.drawCard(state, playerIdx, { suppressEndCheck: true, ignoreLoseOnEmpty: true });
        }
        logs.push({ turn: state.round, player: playerIdx, text: player.name + ' takes a mulligan.' });
      } else {
        logs.push({ turn: state.round, player: playerIdx, text: player.name + ' keeps their opening hand.' });
      }
      player.mulliganResolved = true;
      player.mustMulligan = false;
      if (state.players.every((p) => p.mulliganResolved)) {
        state.phase = 'refresh';
        this.startTurn(state, state.currentPlayer, logs, { initialStart: true });
      }
    }

    playEnergy(state, playerIdx, cardId, logs) {
      const player = state.players[playerIdx];
      const handIndex = player.hand.indexOf(cardId);
      if (handIndex === -1) {
        throw new Error('Energy card is not in hand.');
      }
      const card = this.getCard(cardId);
      if (card.suit !== 'energy') {
        throw new Error('Selected card is not energy.');
      }
      player.hand.splice(handIndex, 1);
      player.board.energy.push({ cardId, exhausted: false });
      logs.push({ turn: state.round, player: playerIdx, text: player.name + ' played ' + card.name + ' as Energy.' });
    }

    playCard(state, playerIdx, cardId, logs) {
      const player = state.players[playerIdx];
      const handIndex = player.hand.indexOf(cardId);
      if (handIndex === -1) {
        throw new Error('Card is not in hand.');
      }
      const card = this.getCard(cardId);
      if (card.suit === 'energy') {
        throw new Error('Use playEnergy for energy cards.');
      }
      this.payEnergy(state, playerIdx, card.cost, logs);
      player.hand.splice(handIndex, 1);
      if (card.suit === 'event') {
        logs.push({ turn: state.round, player: playerIdx, text: player.name + ' played event ' + card.name + '.' });
        player.compost.push(cardId);
        this.applyEffects(state, playerIdx, card, logs, { source: 'play' });
      } else {
        player.board[zoneLabel(card.suit)].push({ cardId, exhausted: false });
        logs.push({ turn: state.round, player: playerIdx, text: player.name + ' played ' + card.name + '.' });
        this.applyEffects(state, playerIdx, card, logs, { source: 'play', ignoreChallengeEffects: true });
      }
    }

    payEnergy(state, playerIdx, cost, logs) {
      if (!cost) {
        return;
      }
      const readyEnergy = state.players[playerIdx].board.energy.filter((entry) => !entry.exhausted);
      if (readyEnergy.length < cost) {
        throw new Error('Not enough ready energy to pay cost ' + cost + '.');
      }
      for (let i = 0; i < cost; i += 1) {
        readyEnergy[i].exhausted = true;
      }
      logs.push({ turn: state.round, player: playerIdx, text: state.players[playerIdx].name + ' exhausted ' + cost + ' Energy to pay a cost.' });
    }

    declareChallenge(state, playerIdx, action, logs) {
      if (state.preventChallengesThisTurn) {
        throw new Error('Challenges are prevented this turn.');
      }
      const attackerZone = this.findBoardCard(state.players[playerIdx], action.attackerCardId);
      if (!attackerZone || ['support', 'wildlife'].indexOf(attackerZone.zone) === -1) {
        throw new Error('Attacker must be a Support or Wildlife you control.');
      }
      if (attackerZone.entry.exhausted) {
        throw new Error('Attacker must be ready.');
      }
      const attackerCard = this.getCard(action.attackerCardId);
      const defenderPlayerIdx = Number(action.defenderPlayerIdx);
      if (defenderPlayerIdx !== 1 - playerIdx) {
        throw new Error('Defender must belong to the opposing player.');
      }
      const defenderZone = this.findBoardCard(state.players[defenderPlayerIdx], action.defenderCardId);
      if (!defenderZone || ['support', 'wildlife'].indexOf(defenderZone.zone) === -1) {
        throw new Error('Defender must be opposing Support or Wildlife.');
      }
      const allowedTargets = attackerCard.effects.filter((effect) => effect.indexOf('Challenge 1 opposing ') === 0);
      if (!allowedTargets.length) {
        throw new Error('Selected attacker cannot challenge.');
      }
      const defenderType = defenderZone.zone.charAt(0).toUpperCase() + defenderZone.zone.slice(1);
      const match = allowedTargets.some((effect) => effect === 'Challenge 1 opposing ' + defenderType + '.');
      if (!match) {
        throw new Error('Selected attacker cannot target that card type.');
      }
      state.pendingChallenge = {
        attackerPIdx: playerIdx,
        attackerCardId: action.attackerCardId,
        defenderPIdx: defenderPlayerIdx,
        defenderCardId: action.defenderCardId
      };
      state.challengeContext = { cancelled: false };
      logs.push({
        turn: state.round,
        player: playerIdx,
        text: state.players[playerIdx].name + ' declared a challenge with ' + attackerCard.name + ' against ' + this.getCard(action.defenderCardId).name + '.'
      });
    }

    resolveChallenge(state, playerIdx, logs) {
      if (!state.pendingChallenge) {
        throw new Error('No pending challenge to resolve.');
      }
      // Host (as authoritative source) may resolve challenges on behalf of the current player.
      const effectivePlayerIdx = state.pendingChallenge.attackerPIdx;
      const pending = state.pendingChallenge;
      const attackerPlayer = state.players[pending.attackerPIdx];
      const defenderPlayer = state.players[pending.defenderPIdx];
      const attackerRef = this.findBoardCard(attackerPlayer, pending.attackerCardId);
      const defenderRef = this.findBoardCard(defenderPlayer, pending.defenderCardId);
      if (!attackerRef || !defenderRef) {
        state.pendingChallenge = null;
        state.challengeContext = null;
        throw new Error('Challenge participants are no longer on the board.');
      }

      const challengeCard = this.getCard(pending.attackerCardId);
      this.applyEffects(state, effectivePlayerIdx, challengeCard, logs, { source: 'challenge' });
      if (state.pendingEffect) {
        throw new Error('Resolve pending effect before finalizing challenge.');
      }
      if (state.challengeContext && state.challengeContext.cancelled) {
        state.pendingChallenge = null;
        state.challengeContext = null;
        logs.push({ turn: state.round, player: -1, text: 'The challenge was cancelled.' });
        return;
      }
      if (state.preventNextChallenge) {
        state.preventNextChallenge = false;
        state.pendingChallenge = null;
        state.challengeContext = null;
        logs.push({ turn: state.round, player: -1, text: 'The next challenge was prevented.' });
        return;
      }
      if (state.preventChallengesThisTurn) {
        state.pendingChallenge = null;
        state.challengeContext = null;
        logs.push({ turn: state.round, player: -1, text: 'Challenges are prevented this turn.' });
        return;
      }

      const attackerCard = this.getCard(attackerRef.entry.cardId);
      const defenderCard = this.getCard(defenderRef.entry.cardId);
      const attackerRank = Math.max(0, attackerCard.rank - (attackerRef.entry.exhausted ? 2 : 0));
      const defenderRank = Math.max(0, defenderCard.rank - (defenderRef.entry.exhausted ? 2 : 0));

      if (attackerRank > defenderRank) {
        this.moveBoardCardToCompost(defenderPlayer, defenderRef.zone, defenderRef.index);
        attackerRef.entry.exhausted = true;
        logs.push({ turn: state.round, player: effectivePlayerIdx, text: attackerCard.name + ' wins the challenge against ' + defenderCard.name + '.' });
      } else if (defenderRank > attackerRank) {
        this.moveBoardCardToCompost(attackerPlayer, attackerRef.zone, attackerRef.index);
        logs.push({ turn: state.round, player: pending.defenderPIdx, text: defenderCard.name + ' wins the challenge against ' + attackerCard.name + '.' });
      } else {
        this.moveBoardCardToCompost(defenderPlayer, defenderRef.zone, defenderRef.index);
        this.moveBoardCardToCompost(attackerPlayer, attackerRef.zone, attackerRef.index);
        logs.push({ turn: state.round, player: -1, text: attackerCard.name + ' and ' + defenderCard.name + ' tie and are both composted.' });
      }
      state.pendingChallenge = null;
      state.challengeContext = null;
    }

    choosePending(state, playerIdx, action, expectedType, logs) {
      const pending = state.pendingEffect;
      if (!pending || pending.type !== expectedType) {
        throw new Error('No matching pending effect to resolve.');
      }
      if (pending.forPlayer !== playerIdx) {
        throw new Error('This choice belongs to another player.');
      }
      const optionIndex = pending.options.findIndex((option) => option.cardId === action.cardId && option.zone === action.zone && option.playerIdx === pending.targetPlayerForChoice);
      if (optionIndex === -1 && pending.options.findIndex((option) => option.cardId === action.cardId && option.zone === action.zone) === -1) {
        throw new Error('Chosen card is not a valid option.');
      }
      const option = pending.options[optionIndex >= 0 ? optionIndex : pending.options.findIndex((o) => o.cardId === action.cardId && o.zone === action.zone)];
      if (expectedType === 'chooseCompost') {
        const targetPlayer = state.players[option.playerIdx];
        const ref = this.findBoardCard(targetPlayer, option.cardId);
        if (!ref) {
          throw new Error('Chosen card is no longer available.');
        }
        this.moveBoardCardToCompost(targetPlayer, ref.zone, ref.index);
        logs.push({ turn: state.round, player: playerIdx, text: this.getCard(option.cardId).name + ' was composted.' });
      } else {
        const targetPlayer = state.players[option.playerIdx];
        const ref = this.findBoardCard(targetPlayer, option.cardId);
        if (!ref) {
          throw new Error('Chosen card is no longer available.');
        }
        const cardId = targetPlayer.board[ref.zone][ref.index].cardId;
        targetPlayer.board[ref.zone].splice(ref.index, 1);
        targetPlayer.hand.push(cardId);
        logs.push({ turn: state.round, player: playerIdx, text: this.getCard(option.cardId).name + ' returned to ' + targetPlayer.name + "'s hand." });
      }
      const followUp = pending.onResolve;
      state.pendingEffect = null;
      if (typeof followUp === 'function') {
        followUp();
      }
    }

    endTurn(state, playerIdx, logs) {
      if (state.currentPlayer !== playerIdx) {
        throw new Error('Only the current player may end the turn.');
      }
      if (state.pendingEffect || state.pendingChallenge) {
        throw new Error('Resolve pending actions before ending the turn.');
      }
      if (state.phase === 'main') {
        state.phase = 'challenge';
        logs.push({ turn: state.round, player: playerIdx, text: state.players[playerIdx].name + ' moves to the Challenge phase.' });
        return;
      }
      if (state.phase === 'challenge') {
        const bothHandsEmpty = state.players.every((player) => player.hand.length === 0);
        if (bothHandsEmpty) {
          state.phase = 'gameover';
          logs.push({ turn: state.round, player: -1, text: 'Both players have empty hands at round end. Scoring the game.' });
          return;
        }
        state.phase = 'end';
      }
      const oldPlayer = state.currentPlayer;
      state.currentPlayer = 1 - state.currentPlayer;
      if (state.currentPlayer === 0) {
        state.round += 1;
      }
      this.startTurn(state, state.currentPlayer, logs, { previousPlayer: oldPlayer });
    }

    startTurn(state, playerIdx, logs, options) {
      const player = state.players[playerIdx];
      state.phase = 'refresh';
      state.preventChallengesThisTurn = false;
      state.preventNextChallenge = false;
      state.pendingChallenge = null;
      state.challengeContext = null;
      this.refreshPlayer(player, logs, playerIdx, state);
      state.phase = 'draw';
      logs.push({ turn: state.round, player: playerIdx, text: player.name + ' begins turn ' + state.round + '.' });
      this.drawCard(state, playerIdx, { logs, suppressEndCheck: true });
      if (state.gameOver) {
        return;
      }
      if (player.hand.length === 0) {
        state.gameOver = true;
        state.phase = 'gameover';
        state.winner = 1 - playerIdx;
        state.loseReason = player.name + ' has no cards in hand after drawing.';
        logs.push({ turn: state.round, player: -1, text: state.loseReason });
        return;
      }
      state.phase = 'main';
      if (options && options.initialStart) {
        logs.push({ turn: state.round, player: playerIdx, text: player.name + ' starts in the Main phase after refresh and draw.' });
      }
    }

    refreshPlayer(player, logs, playerIdx, state) {
      ['energy', 'support', 'wildlife'].forEach((zone) => {
        player.board[zone].forEach((entry) => {
          entry.exhausted = false;
        });
      });
      logs.push({ turn: (state && state.round) || 0, player: playerIdx, text: player.name + ' refreshes all exhausted cards.' });
    }

    drawCard(state, playerIdx, options) {
      const player = state.players[playerIdx];
      if (!player.deck.length) {
        if (options && options.ignoreLoseOnEmpty) {
          return null;
        }
        state.gameOver = true;
        state.phase = 'gameover';
        state.winner = 1 - playerIdx;
        state.loseReason = player.name + ' could not draw a card and loses.';
        if (options && options.logs) {
          options.logs.push({ turn: state.round, player: -1, text: state.loseReason });
        }
        return null;
      }
      const cardId = player.deck.shift();
      player.hand.push(cardId);
      if (options && options.logs) {
        options.logs.push({ turn: state.round, player: playerIdx, text: player.name + ' drew a card.' });
      }
      return cardId;
    }

    applyEffects(state, playerIdx, card, logs, context) {
      const source = (context && context.source) || 'play';
      const ignoreChallengeEffects = context && context.ignoreChallengeEffects;
      card.effects.forEach((effect) => {
        if (source !== 'challenge' && effect.indexOf('Challenge 1 opposing ') === 0 && ignoreChallengeEffects) {
          return;
        }
        switch (effect) {
          case 'Prevent all Challenges this turn.':
            state.preventChallengesThisTurn = true;
            logs.push({ turn: state.round, player: playerIdx, text: 'All challenges are prevented this turn.' });
            break;
          case 'Draw 3 cards.':
            for (let i = 0; i < 3 && !state.gameOver; i += 1) {
              this.drawCard(state, playerIdx, { logs, suppressEndCheck: true });
            }
            break;
          case 'Each player draws 1 card.':
            [0, 1].forEach((idx) => {
              if (!state.gameOver) {
                this.drawCard(state, idx, { logs, suppressEndCheck: true });
              }
            });
            break;
          case 'Compost 1 Wildlife.':
            this.queueChoice(state, playerIdx, 'chooseCompost', this.listBoardOptions(state, null, 'wildlife'), 'Choose a Wildlife to compost.');
            break;
          case 'Compost 1 opposing Wildlife.':
            this.queueChoice(state, playerIdx, 'chooseCompost', this.listBoardOptions(state, 1 - playerIdx, 'wildlife'), 'Choose an opposing Wildlife to compost.', 1 - playerIdx);
            break;
          case 'Compost 1 opposing Energy.':
            this.queueChoice(state, playerIdx, 'chooseCompost', this.listBoardOptions(state, 1 - playerIdx, 'energy'), 'Choose an opposing Energy to compost.', 1 - playerIdx);
            break;
          case 'Refresh all Energy.':
            state.players[playerIdx].board.energy.forEach((entry) => {
              entry.exhausted = false;
            });
            logs.push({ turn: state.round, player: playerIdx, text: 'All of ' + state.players[playerIdx].name + "'s Energy was refreshed." });
            break;
          case 'Exhaust 1 opposing Energy.': {
            const target = state.players[1 - playerIdx].board.energy.find((entry) => !entry.exhausted) || state.players[1 - playerIdx].board.energy[0];
            if (target) {
              target.exhausted = true;
              logs.push({ turn: state.round, player: playerIdx, text: 'An opposing Energy was exhausted.' });
            }
            break;
          }
          case 'Exhaust all Energy.':
            state.players[playerIdx].board.energy.forEach((entry) => {
              entry.exhausted = true;
            });
            logs.push({ turn: state.round, player: playerIdx, text: 'All of ' + state.players[playerIdx].name + "'s Energy was exhausted." });
            break;
          case 'Each player composts 1 Support.':
            this.queueChoice(state, playerIdx, 'chooseCompost', this.listBoardOptions(state, playerIdx, 'support'), 'Choose one of your Supports to compost.', playerIdx, {
              chainedChoice: { playerIdx: 1 - playerIdx, zone: 'support', type: 'chooseCompost', text: 'Choose one of your Supports to compost.' }
            });
            break;
          case "Return 1 Energy to its owner's hand.":
            this.queueChoice(state, playerIdx, 'chooseReturn', this.listBoardOptions(state, null, 'energy'), 'Choose an Energy to return to its owner\'s hand.');
            break;
          case 'Cancel the Challenge.':
            if (state.challengeContext) {
              state.challengeContext.cancelled = true;
            }
            break;
          case 'Exhaust all Wildlife.':
            [0, 1].forEach((idx) => {
              state.players[idx].board.wildlife.forEach((entry) => {
                entry.exhausted = true;
              });
            });
            logs.push({ turn: state.round, player: playerIdx, text: 'All Wildlife were exhausted.' });
            break;
          case 'Prevent 1 Challenge this turn.':
            state.preventNextChallenge = true;
            logs.push({ turn: state.round, player: playerIdx, text: 'The next challenge this turn will be prevented.' });
            break;
          case "Return all Wildlife to their owners' hands.":
            [0, 1].forEach((idx) => {
              const wildlife = state.players[idx].board.wildlife.splice(0);
              wildlife.forEach((entry) => state.players[idx].hand.push(entry.cardId));
            });
            logs.push({ turn: state.round, player: playerIdx, text: 'All Wildlife returned to their owners\' hands.' });
            break;
          default:
            if (GAME_RULES.unimplementedEffects[effect]) {
              logs.push({ turn: state.round, player: playerIdx, text: 'Unimplemented effect noted: ' + effect });
            }
            break;
        }
      });
      if (state.pendingEffect && state.pendingEffect.meta && state.pendingEffect.meta.chainedChoice && !state.pendingEffect._wrapped) {
        const original = state.pendingEffect;
        original._wrapped = true;
        const baseOptions = original.options.slice();
        const afterResolve = original.meta.chainedChoice;
        original.onResolve = () => {
          const options = this.listBoardOptions(state, afterResolve.playerIdx, afterResolve.zone);
          if (options.length) {
            state.pendingEffect = {
              type: afterResolve.type,
              forPlayer: afterResolve.playerIdx,
              targetPlayerForChoice: afterResolve.playerIdx,
              options,
              prompt: afterResolve.text,
              meta: null
            };
          } else {
            state.pendingEffect = null;
          }
        };
        original.options = baseOptions;
      }
    }

    queueChoice(state, forPlayer, type, options, prompt, targetPlayerForChoice, meta) {
      if (!options.length) {
        state.pendingEffect = null;
        return;
      }
      state.pendingEffect = {
        type,
        forPlayer,
        targetPlayerForChoice: typeof targetPlayerForChoice === 'number' ? targetPlayerForChoice : null,
        options,
        prompt,
        meta: meta || null
      };
    }

    listBoardOptions(state, playerIdx, zone) {
      const options = [];
      const players = typeof playerIdx === 'number' ? [playerIdx] : [0, 1];
      players.forEach((idx) => {
        state.players[idx].board[zone].forEach((entry) => {
          options.push({ playerIdx: idx, zone, cardId: entry.cardId });
        });
      });
      return options;
    }

    findBoardCard(player, cardId) {
      for (const zone of ['energy', 'support', 'wildlife']) {
        const index = player.board[zone].findIndex((entry) => entry.cardId === cardId);
        if (index >= 0) {
          return { zone, index, entry: player.board[zone][index] };
        }
      }
      return null;
    }

    moveBoardCardToCompost(player, zone, index) {
      const removed = player.board[zone].splice(index, 1)[0];
      if (removed) {
        player.compost.push(removed.cardId);
      }
    }

    calculateScores(state) {
      return state.players.map((player) => {
        let score = 0;
        player.board.energy.forEach((entry) => {
          if (!entry.exhausted) score += this.getCard(entry.cardId).rank;
        });
        ['support', 'wildlife'].forEach((zone) => {
          player.board[zone].forEach((entry) => {
            if (!entry.exhausted) score += this.getCard(entry.cardId).rank;
          });
        });
        return score;
      });
    }

    breakTie(state) {
      while (true) {
        const pulls = [0, 1].map((idx) => {
          const player = state.players[idx];
          return player.deck.length ? this.getCard(player.deck.shift()) : null;
        });
        if (!pulls[0] && !pulls[1]) {
          return 'tie';
        }
        if (!pulls[0]) return 1;
        if (!pulls[1]) return 0;
        if (pulls[0].rank > pulls[1].rank) return 0;
        if (pulls[1].rank > pulls[0].rank) return 1;
      }
    }

    checkGameOver(state) {
      if (state.phase === 'gameover' || state.gameOver) {
        state.gameOver = true;
        state.phase = 'gameover';
        state.scores = this.calculateScores(state);
        if (state.winner === null) {
          if (state.scores[0] > state.scores[1]) state.winner = 0;
          else if (state.scores[1] > state.scores[0]) state.winner = 1;
          else state.winner = this.breakTie(state);
        }
        return state;
      }
      return state;
    }
  }

  function sanitizeStateForPlayer(state, viewerIdx, engine) {
    const copy = deepClone(state);
    copy.players.forEach((player, idx) => {
      if (idx !== viewerIdx) {
        player.hand = { count: player.hand.length };
      } else {
        player.handDetails = player.hand.map((cardId) => engine.getCard(cardId));
      }
      ['energy', 'support', 'wildlife'].forEach((zone) => {
        player.board[zone] = player.board[zone].map((entry) => ({
          cardId: entry.cardId,
          exhausted: entry.exhausted,
          card: engine.getCard(entry.cardId)
        }));
      });
      player.compostCount = player.compost.length;
    });
    if (copy.pendingEffect) {
      copy.pendingEffect.options = copy.pendingEffect.options.map((option) => ({
        playerIdx: option.playerIdx,
        zone: option.zone,
        cardId: option.cardId,
        card: engine.getCard(option.cardId)
      }));
    }
    copy.viewer = viewerIdx;
    return copy;
  }

  async function createOffer(conn) {
    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);
    return JSON.stringify(offer);
  }

  async function handleAnswer(conn, sdp) {
    const answer = typeof sdp === 'string' ? JSON.parse(sdp) : sdp;
    await conn.setRemoteDescription(answer);
  }

  async function addIceCandidate(conn, candidate) {
    const parsed = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
    if (parsed) {
      await conn.addIceCandidate(parsed);
    }
  }

  class GameUI {
    constructor() {
      this.cardDefs = [];
      this.engine = null;
      this.fullState = null;
      this.viewState = null;
      this.localPlayerIdx = 0;
      this.isHost = false;
      this.peerConnection = null;
      this.dataChannel = null;
      this.pendingIce = [];
      this.selected = null;
      this.connectionStatus = 'Disconnected';
      this.elements = this.bindElements();
      this.attachEvents();
      this.init();
    }

    bindElements() {
      return {
        setup: document.getElementById('setup'),
        game: document.getElementById('game'),
        gameover: document.getElementById('gameover'),
        playerName: document.getElementById('playerName'),
        hostName: document.getElementById('hostName'),
        joinName: document.getElementById('joinName'),
        hostBtn: document.getElementById('hostBtn'),
        joinBtn: document.getElementById('joinBtn'),
        startBtn: document.getElementById('startBtn'),
        offerOut: document.getElementById('offerOut'),
        offerIn: document.getElementById('offerIn'),
        answerOut: document.getElementById('answerOut'),
        answerIn: document.getElementById('answerIn'),
        candidateOut: document.getElementById('candidateOut'),
        candidateIn: document.getElementById('candidateIn'),
        addAnswerBtn: document.getElementById('addAnswerBtn'),
        addOfferBtn: document.getElementById('addOfferBtn'),
        addCandidateBtn: document.getElementById('addCandidateBtn'),
        connectionStatus: document.getElementById('connectionStatus'),
        phase: document.getElementById('phaseLabel'),
        round: document.getElementById('roundLabel'),
        currentPlayer: document.getElementById('currentPlayerLabel'),
        scores: document.getElementById('scoresLabel'),
        log: document.getElementById('logPanel'),
        opponentBoard: document.getElementById('opponentBoard'),
        playerBoard: document.getElementById('playerBoard'),
        hand: document.getElementById('playerHand'),
        actions: document.getElementById('actionButtons'),
        selectedInfo: document.getElementById('selectedCardInfo'),
        prompt: document.getElementById('promptBar'),
        winner: document.getElementById('winnerLabel'),
        finalScores: document.getElementById('finalScores'),
        playAgainBtn: document.getElementById('playAgainBtn')
      };
    }

    attachEvents() {
      this.elements.hostBtn.addEventListener('click', () => this.setupHost());
      this.elements.joinBtn.addEventListener('click', () => this.setupGuest());
      this.elements.startBtn.addEventListener('click', () => this.startHostedGame());
      this.elements.addAnswerBtn.addEventListener('click', () => this.applyRemoteAnswer());
      this.elements.addOfferBtn.addEventListener('click', () => this.applyRemoteOffer());
      this.elements.addCandidateBtn.addEventListener('click', () => this.applyIceCandidate());
      this.elements.playAgainBtn.addEventListener('click', () => window.location.reload());
    }

    async init() {
      try {
        this.cardDefs = await loadCardData();
        this.engine = new GameEngine(this.cardDefs);
        this.setStatus('Cards loaded. Ready to host or join.');
      } catch (error) {
        console.error(error);
        this.setStatus('Failed to load card data: ' + error.message);
      }
    }

    setStatus(text) {
      this.connectionStatus = text;
      this.elements.connectionStatus.textContent = text;
    }

    createPeerConnection() {
      this.peerConnection = new RTCPeerConnection(STUN_CONFIG);
      this.pendingIce = [];
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const existing = this.elements.candidateOut.value.trim();
          const serialized = JSON.stringify(event.candidate);
          this.elements.candidateOut.value = existing ? existing + '\n' + serialized : serialized;
        }
      };
      this.peerConnection.onconnectionstatechange = () => {
        this.setStatus('Connection: ' + this.peerConnection.connectionState);
      };
      this.peerConnection.ondatachannel = (event) => {
        this.bindDataChannel(event.channel);
      };
    }

    bindDataChannel(channel) {
      this.dataChannel = channel;
      this.dataChannel.onopen = () => this.setStatus('Connected');
      this.dataChannel.onclose = () => this.setStatus('Disconnected');
      this.dataChannel.onmessage = (event) => this.handleMessage(event.data);
    }

    async setupHost() {
      this.isHost = true;
      this.localPlayerIdx = 0;
      this.createPeerConnection();
      this.bindDataChannel(this.peerConnection.createDataChannel(CHANNEL_NAME));
      const offer = await createOffer(this.peerConnection);
      this.elements.offerOut.value = offer;
      this.setStatus('Host offer created. Share it with your opponent.');
    }

    async setupGuest() {
      this.isHost = false;
      this.localPlayerIdx = 1;
      this.createPeerConnection();
      this.setStatus('Paste a host offer, then create an answer.');
    }

    async applyRemoteOffer() {
      if (!this.peerConnection) this.createPeerConnection();
      const text = this.elements.offerIn.value.trim();
      if (!text) return;
      await this.peerConnection.setRemoteDescription(JSON.parse(text));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.elements.answerOut.value = JSON.stringify(answer);
      this.setStatus('Answer created. Send it back to the host.');
    }

    async applyRemoteAnswer() {
      if (!this.peerConnection) return;
      const text = this.elements.answerIn.value.trim();
      if (!text) return;
      await handleAnswer(this.peerConnection, text);
      this.setStatus('Remote answer applied. Add ICE candidates as needed.');
    }

    async applyIceCandidate() {
      if (!this.peerConnection) return;
      const lines = this.elements.candidateIn.value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      for (const line of lines) {
        await addIceCandidate(this.peerConnection, line);
      }
      this.elements.candidateIn.value = '';
      this.setStatus('ICE candidate(s) applied.');
    }

    startHostedGame() {
      if (!this.isHost || !this.engine) return;
      const hostName = this.elements.hostName.value.trim() || this.elements.playerName.value.trim() || 'Host';
      const guestName = this.elements.joinName.value.trim() || 'Guest';
      this.fullState = this.engine.newGame(hostName, guestName);
      this.viewState = sanitizeStateForPlayer(this.fullState, this.localPlayerIdx, this.engine);
      this.showScreen('game');
      this.render();
      this.broadcastState();
    }

    handleMessage(raw) {
      const msg = JSON.parse(raw);
      if (msg.type === 'stateUpdate') {
        this.viewState = msg.state;
        this.showScreen(this.viewState.gameOver ? 'gameover' : 'game');
        this.render();
      } else if (msg.type === 'action' && this.isHost) {
        try {
          const result = this.engine.applyAction(this.fullState, msg.action, 1);
          this.fullState = result.newState;
          this.viewState = sanitizeStateForPlayer(this.fullState, this.localPlayerIdx, this.engine);
          this.render();
          this.broadcastState();
        } catch (error) {
          this.sendMessage({ type: 'error', payload: error.message });
        }
      } else if (msg.type === 'error') {
        this.setStatus('Remote error: ' + msg.payload);
      }
    }

    sendMessage(message) {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify(message));
      }
    }

    broadcastState() {
      if (!this.isHost || !this.fullState) return;
      const localView = sanitizeStateForPlayer(this.fullState, 0, this.engine);
      const remoteView = sanitizeStateForPlayer(this.fullState, 1, this.engine);
      this.viewState = this.localPlayerIdx === 0 ? localView : remoteView;
      this.sendMessage({ type: 'stateUpdate', state: remoteView });
      if (this.fullState.gameOver) {
        this.showScreen('gameover');
      }
    }

    performAction(action) {
      try {
        if (this.isHost) {
          const result = this.engine.applyAction(this.fullState, action, this.localPlayerIdx);
          this.fullState = result.newState;
          this.viewState = sanitizeStateForPlayer(this.fullState, this.localPlayerIdx, this.engine);
          this.render();
          this.broadcastState();
        } else {
          this.sendMessage({ type: 'action', action });
        }
      } catch (error) {
        this.setStatus(error.message);
      }
    }

    showScreen(screen) {
      ['setup', 'game', 'gameover'].forEach((id) => {
        this.elements[id].hidden = id !== screen;
      });
    }

    render() {
      const state = this.viewState;
      if (!state) return;
      this.elements.round.textContent = String(state.round);
      this.elements.phase.textContent = state.phase;
      this.elements.currentPlayer.textContent = state.players[state.currentPlayer] ? state.players[state.currentPlayer].name : '-';
      this.elements.scores.textContent = state.scores ? state.scores.join(' - ') : '0 - 0';
      this.elements.prompt.textContent = state.pendingEffect ? state.pendingEffect.prompt : '';
      this.renderLog(state.log || []);
      this.renderBoard(this.elements.opponentBoard, state.players[1 - this.localPlayerIdx], false);
      this.renderBoard(this.elements.playerBoard, state.players[this.localPlayerIdx], true);
      this.renderHand(state.players[this.localPlayerIdx]);
      this.renderActions(state);
      this.renderSelectedInfo();
      if (state.gameOver) {
        this.elements.finalScores.textContent = state.scores.join(' - ');
        this.elements.winner.textContent = state.winner === 'tie' ? 'Tie' : state.players[state.winner].name + ' wins';
      }
    }

    renderLog(logs) {
      this.elements.log.innerHTML = logs.map((entry) => '<div class="log-entry"><span class="log-turn">T' + entry.turn + '</span><span>' + this.escapeHtml(entry.text) + '</span></div>').join('');
      this.elements.log.scrollTop = this.elements.log.scrollHeight;
    }

    renderBoard(container, player, interactive) {
      container.innerHTML = '';
      ['energy', 'support', 'wildlife'].forEach((zone) => {
        const section = document.createElement('section');
        section.className = 'board-zone';
        const title = document.createElement('h3');
        title.textContent = player.name + ' ' + zone;
        section.appendChild(title);
        const row = document.createElement('div');
        row.className = 'card-row';
        player.board[zone].forEach((entry) => {
          row.appendChild(this.buildCard(entry.card, entry, interactive, player, zone));
        });
        section.appendChild(row);
        container.appendChild(section);
      });
    }

    renderHand(player) {
      this.elements.hand.innerHTML = '';
      const handCards = player.handDetails || [];
      handCards.forEach((card) => {
        const cardEl = this.buildCard(card, { cardId: card.id, exhausted: false }, true, player, 'hand');
        cardEl.addEventListener('click', () => {
          this.selected = { source: 'hand', cardId: card.id, card };
          this.renderSelectedInfo();
          this.renderActions(this.viewState);
        });
        this.elements.hand.appendChild(cardEl);
      });
    }

    renderActions(state) {
      const buttons = [];
      const localPlayer = state.players[this.localPlayerIdx];
      const isMyTurn = state.currentPlayer === this.localPlayerIdx;
      this.elements.actions.innerHTML = '';

      if (state.phase === 'setup' && !localPlayer.mulliganResolved) {
        buttons.push(this.makeButton('Keep Hand', () => this.performAction({ type: 'mulligan', accept: false })));
        if (localPlayer.mustMulligan) {
          buttons.push(this.makeButton('Mulligan', () => this.performAction({ type: 'mulligan', accept: true })));
        }
      }

      if (state.pendingEffect && state.pendingEffect.forPlayer === this.localPlayerIdx) {
        state.pendingEffect.options.forEach((option) => {
          const card = option.card;
          const label = (state.pendingEffect.type === 'chooseReturn' ? 'Return ' : 'Compost ') + card.name;
          buttons.push(this.makeButton(label, () => this.performAction({ type: state.pendingEffect.type, cardId: option.cardId, zone: option.zone })));
        });
      } else if (isMyTurn && state.phase === 'main' && this.selected && this.selected.source === 'hand') {
        if (this.selected.card.suit === 'energy') {
          buttons.push(this.makeButton('Play Energy', () => this.performAction({ type: 'playEnergy', cardId: this.selected.cardId })));
        } else {
          buttons.push(this.makeButton('Play Card', () => this.performAction({ type: 'playCard', cardId: this.selected.cardId })));
        }
        buttons.push(this.makeButton('To Challenge Phase', () => this.performAction({ type: 'endTurn' })));
      } else if (isMyTurn && state.phase === 'challenge') {
        if (this.selected && this.selected.source === 'board' && this.selected.ownerIdx === this.localPlayerIdx && ['support', 'wildlife'].indexOf(this.selected.zone) >= 0) {
          const opponent = state.players[1 - this.localPlayerIdx];
          ['support', 'wildlife'].forEach((zone) => {
            opponent.board[zone].forEach((entry) => {
              buttons.push(this.makeButton('Challenge ' + entry.card.name, () => this.performAction({ type: 'declareChallenge', attackerCardId: this.selected.cardId, defenderCardId: entry.cardId, defenderPlayerIdx: 1 - this.localPlayerIdx })));
            });
          });
        }
        if (this.isHost && this.fullState && this.fullState.pendingChallenge) {
          buttons.push(this.makeButton('Resolve Challenge', () => this.performAction({ type: 'resolveChallenge' })));
        }
        buttons.push(this.makeButton('End Turn', () => this.performAction({ type: 'endTurn' })));
      }

      buttons.forEach((btn) => this.elements.actions.appendChild(btn));
    }

    buildCard(card, entry, interactive, player, zone) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'card suit-' + card.suit + (entry.exhausted ? ' exhausted' : '');
      if (this.selected && this.selected.cardId === card.id && this.selected.zone === zone && this.selected.ownerIdx === this.playerIndexByName(player.name)) {
        el.classList.add('selected');
      }
      el.innerHTML = '<div class="card-rank">' + card.rank + '</div>' +
        '<div class="card-name">' + this.escapeHtml(card.name) + '</div>' +
        '<div class="card-suit">' + this.escapeHtml(card.suit) + '</div>' +
        '<div class="card-cost">Cost ' + card.cost + '</div>';
      if (interactive) {
        el.addEventListener('click', () => {
          this.selected = { source: zone === 'hand' ? 'hand' : 'board', cardId: card.id, card, zone, ownerIdx: this.playerIndexByName(player.name) };
          this.renderSelectedInfo();
          this.renderActions(this.viewState);
        });
      } else {
        el.disabled = true;
      }
      return el;
    }

    playerIndexByName(name) {
      return this.viewState.players.findIndex((player) => player.name === name);
    }

    renderSelectedInfo() {
      if (!this.selected) {
        this.elements.selectedInfo.innerHTML = '<p>Select a card to inspect it.</p>';
        return;
      }
      const card = this.selected.card;
      this.elements.selectedInfo.innerHTML = '<h3>' + this.escapeHtml(card.name) + '</h3>' +
        '<p>Suit: ' + this.escapeHtml(card.suit) + ' • Rank: ' + card.rank + ' • Cost: ' + card.cost + '</p>' +
        '<ul>' + card.effects.map((effect) => '<li>' + this.escapeHtml(effect) + '</li>').join('') + '</ul>';
    }

    makeButton(label, handler) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'action-btn';
      btn.textContent = label;
      btn.addEventListener('click', handler);
      return btn;
    }

    escapeHtml(text) {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  }

  window.CardData = { load: loadCardData };
  window.GameEngine = GameEngine;
  window.GAME_RULES = GAME_RULES;
  window.createOffer = createOffer;
  window.handleAnswer = handleAnswer;
  window.addIceCandidate = addIceCandidate;
  window.GameUI = GameUI;

  window.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('setup')) {
      window.__gameUI = new GameUI();
    }
  });
}());

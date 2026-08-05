/**
 * Into the Wild TCG — Static WebRTC Game Engine
 *
 * Card pool is loaded directly from energy.json, support.json,
 * wildlife.json, and events.json. deck.json is not required.
 *
 * End-of-round rule:
 *   After BOTH players complete their turns, check whether at least
 *   one player has zero cards in hand. If so, the game ends and
 *   scores are calculated. Reaching zero during a turn does NOT
 *   immediately end the game.
 *
 * Scoring:
 *   Every Energy, Support, and Wildlife card remaining in play scores
 *   its Printed Rank, Ready or Exhausted.
 *   Cards remaining in hand subtract their Printed Rank (hand penalty).
 *   Event and Compost cards score zero.
 *
 *   Final Score = Σ Printed Rank of cards in play
 *               − Σ Printed Rank of cards in hand
 */

'use strict';

/* ------------------------------------------------------------------ */
/* Card loading                                                         */
/* ------------------------------------------------------------------ */

/**
 * Normalize a raw card object from any of the four JSON files into a
 * flat game-card record.
 * @param {object} raw - Object with { mechanics, metadata } shape.
 * @returns {object} Flat card record.
 */
function normalizeCard(raw) {
  return {
    id: raw.mechanics.id,
    rank: raw.mechanics.rank,
    suit: raw.mechanics.suit,
    cost: raw.mechanics.cost,
    effects: raw.mechanics.effects || [],
    name: raw.metadata.name,
    illustration: raw.metadata.illustration || '',
    ready: true,   // Ready = not Exhausted
    location: 'deck',  // deck | hand | play | compost
  };
}

/**
 * Load and combine all four card JSON files into a single normalized
 * array. Returns a Promise that resolves to the combined card array.
 * @param {string} [base=''] - Optional base URL prefix.
 * @returns {Promise<object[]>}
 */
async function loadCardPool(base = '') {
  const files = [
    `${base}energy.json`,
    `${base}support.json`,
    `${base}wildlife.json`,
    `${base}events.json`,
  ];

  const results = await Promise.all(files.map(url => fetch(url).then(r => {
    if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`);
    return r.json();
  })));

  const combined = [];
  for (const arr of results) {
    for (const raw of arr) {
      combined.push(normalizeCard(raw));
    }
  }
  return combined;
}

/* ------------------------------------------------------------------ */
/* Deck utilities                                                       */
/* ------------------------------------------------------------------ */

/**
 * Return a shallow-copied and shuffled version of the card array.
 * Uses Fisher-Yates shuffle.
 * @param {object[]} cards
 * @returns {object[]}
 */
function shuffleDeck(cards) {
  const deck = cards.map(c => ({ ...c }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/* ------------------------------------------------------------------ */
/* Game state                                                           */
/* ------------------------------------------------------------------ */

/**
 * Create an initial game state for two players from the normalized
 * card pool.
 * @param {object[]} cardPool - Normalized card records.
 * @returns {object} gameState
 */
function createGameState(cardPool) {
  const deck1 = shuffleDeck(cardPool);
  const deck2 = shuffleDeck(cardPool);

  const draw = (deck, n) => deck.splice(0, n).map(c => ({ ...c, location: 'hand' }));

  return {
    phase: 'play',      // play | gameover
    round: 1,
    activePlayer: 0,    // 0 = player 1, 1 = player 2
    turnCompleted: [false, false],  // tracks who has completed this round
    players: [
      {
        deck: deck1,
        hand: draw(deck1, 7),
        play: [],       // cards currently in play
        compost: [],
      },
      {
        deck: deck2,
        hand: draw(deck2, 7),
        play: [],
        compost: [],
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Turn actions                                                         */
/* ------------------------------------------------------------------ */

/**
 * Refresh Phase: restore all Exhausted cards in a player's play area.
 * @param {object} state
 * @param {number} playerIndex
 */
function refreshPhase(state, playerIndex) {
  assertActivePlayer(state, playerIndex);
  for (const card of state.players[playerIndex].play) {
    card.ready = true;
  }
}

/**
 * Draw Phase: draw one card from deck to hand.
 * If the deck is empty the player loses immediately (deck-empty draw
 * loss rule).
 * @param {object} state
 * @param {number} playerIndex
 * @returns {{ drawnCard: object|null, deckEmptyLoss: boolean }}
 */
function drawPhase(state, playerIndex) {
  assertActivePlayer(state, playerIndex);
  const player = state.players[playerIndex];
  if (player.deck.length === 0) {
    state.phase = 'gameover';
    state.deckEmptyLossPlayer = playerIndex;
    return { drawnCard: null, deckEmptyLoss: true };
  }
  const card = player.deck.splice(0, 1)[0];
  card.location = 'hand';
  player.hand.push(card);
  return { drawnCard: card, deckEmptyLoss: false };
}

/**
 * Play Phase: move a card from hand to play by paying its Energy Cost.
 * @param {object} state
 * @param {number} playerIndex
 * @param {number} cardId - ID of the card to play (must be in hand).
 * @param {number[]} energyIds - IDs of Ready Energy cards in play to exhaust.
 * @returns {{ ok: boolean, error?: string }}
 */
function playCard(state, playerIndex, cardId, energyIds) {
  if (state.phase !== 'play') return { ok: false, error: 'Game is over' };
  assertActivePlayer(state, playerIndex);
  const player = state.players[playerIndex];

  const handIndex = player.hand.findIndex(c => c.id === cardId);
  if (handIndex === -1) return { ok: false, error: 'Card not in hand' };

  const card = player.hand[handIndex];

  if (card.suit === 'event') {
    // Events go to compost after resolving, not to play
    player.hand.splice(handIndex, 1);
    card.location = 'compost';
    player.compost.push(card);
    return { ok: true, movedToCompost: true };
  }

  // Pay energy cost
  if (card.cost > 0) {
    if (energyIds.length < card.cost) {
      return { ok: false, error: `Need ${card.cost} Energy, provided ${energyIds.length}` };
    }
    const energyCards = energyIds.map(eid => player.play.find(c => c.id === eid && c.suit === 'energy' && c.ready));
    if (energyCards.some(e => !e)) {
      return { ok: false, error: 'One or more Energy cards not found, not in play, or already Exhausted' };
    }
    for (const e of energyCards) {
      e.ready = false;  // Exhaust the energy
    }
  }

  player.hand.splice(handIndex, 1);
  card.location = 'play';
  card.ready = true;
  player.play.push(card);
  return { ok: true };
}

/**
 * Challenge action: an attacking card challenges a defending card.
 * Compares Effective Rank (Printed Rank when Ready; 0 when Exhausted).
 * Winner stays, loser goes to Compost.
 * Equal Rank: both go to Compost.
 * The attacker becomes Exhausted after challenging.
 *
 * @param {object} state
 * @param {number} playerIndex - Attacking player.
 * @param {number} attackerId - Card ID of attacker (must be in play, Ready).
 * @param {number} defenderId - Card ID of defender (in opponent's play).
 * @returns {{ ok: boolean, result?: string, error?: string }}
 */
function challenge(state, playerIndex, attackerId, defenderId) {
  if (state.phase !== 'play') return { ok: false, error: 'Game is over' };
  assertActivePlayer(state, playerIndex);
  const opponentIndex = 1 - playerIndex;
  const attPlayer = state.players[playerIndex];
  const defPlayer = state.players[opponentIndex];

  const attacker = attPlayer.play.find(c => c.id === attackerId);
  const defender = defPlayer.play.find(c => c.id === defenderId);

  if (!attacker) return { ok: false, error: 'Attacker not found in play' };
  if (!defender) return { ok: false, error: 'Defender not found in opponent play' };
  if (!attacker.ready) return { ok: false, error: 'Attacker is Exhausted' };

  const attRank = attacker.ready ? attacker.rank : 0;
  const defRank = defender.ready ? defender.rank : 0;

  let result;
  if (attRank > defRank) {
    result = 'attacker_wins';
    defPlayer.play = defPlayer.play.filter(c => c.id !== defenderId);
    defender.location = 'compost';
    defPlayer.compost.push(defender);
  } else if (defRank > attRank) {
    result = 'defender_wins';
    attPlayer.play = attPlayer.play.filter(c => c.id !== attackerId);
    attacker.location = 'compost';
    attPlayer.compost.push(attacker);
  } else {
    result = 'both_compost';
    attPlayer.play = attPlayer.play.filter(c => c.id !== attackerId);
    defPlayer.play = defPlayer.play.filter(c => c.id !== defenderId);
    attacker.location = 'compost';
    defender.location = 'compost';
    attPlayer.compost.push(attacker);
    defPlayer.compost.push(defender);
  }

  if (result !== 'attacker_loses' && attPlayer.play.find(c => c.id === attackerId)) {
    attacker.ready = false;  // Exhaust attacker after successful or equal challenge
  }

  return { ok: true, result };
}

/**
 * End Turn: mark the active player's turn as complete and advance.
 * After both players complete their turns, run end-of-round check.
 *
 * End-of-round rule:
 *   If at least one player has zero cards in hand, the game ends.
 *   Otherwise, start the next round.
 *
 * @param {object} state
 * @param {number} playerIndex
 * @returns {{ ok: boolean, roundEnded?: boolean, gameOver?: boolean }}
 */
function endTurn(state, playerIndex) {
  if (state.phase !== 'play') return { ok: false, error: 'Game is over' };
  assertActivePlayer(state, playerIndex);

  state.turnCompleted[playerIndex] = true;
  state.activePlayer = 1 - playerIndex;  // Pass to the other player

  // Check whether both players have completed their turns this round
  if (state.turnCompleted[0] && state.turnCompleted[1]) {
    return endOfRound(state);
  }

  return { ok: true, roundEnded: false };
}

/**
 * End-of-round resolution (called internally after both players have
 * completed their turns).
 * @param {object} state
 * @returns {{ ok: boolean, roundEnded: boolean, gameOver: boolean }}
 */
function endOfRound(state) {
  // Check whether at least one player has zero cards in hand
  const anyHandEmpty = state.players.some(p => p.hand.length === 0);

  if (anyHandEmpty) {
    state.phase = 'gameover';
    state.scores = calculateScores(state);
    return { ok: true, roundEnded: true, gameOver: true };
  }

  // Start the next round
  state.round += 1;
  state.turnCompleted = [false, false];
  return { ok: true, roundEnded: true, gameOver: false };
}

/* ------------------------------------------------------------------ */
/* Scoring                                                              */
/* ------------------------------------------------------------------ */

/**
 * Calculate the final score for a player.
 *
 * Board score: Σ Printed Rank of all Energy, Support, and Wildlife
 *              cards in play (Ready OR Exhausted).
 * Hand penalty: Σ Printed Rank of all cards remaining in hand.
 * Events and Compost cards score 0.
 *
 * Final Score = Board Score − Hand Penalty
 *
 * @param {object} player - A player object from gameState.players.
 * @returns {{ boardScore: number, handPenalty: number, finalScore: number }}
 */
function calculatePlayerScore(player) {
  const scoringSuits = new Set(['energy', 'support', 'wildlife']);

  const boardScore = player.play
    .filter(c => scoringSuits.has(c.suit))
    .reduce((sum, c) => sum + c.rank, 0);

  const handPenalty = player.hand
    .reduce((sum, c) => sum + c.rank, 0);

  return {
    boardScore,
    handPenalty,
    finalScore: boardScore - handPenalty,
  };
}

/**
 * Calculate scores for all players.
 * @param {object} state
 * @returns {object[]} Array of score objects indexed by player.
 */
function calculateScores(state) {
  return state.players.map(calculatePlayerScore);
}

/* ------------------------------------------------------------------ */
/* Internal helpers                                                     */
/* ------------------------------------------------------------------ */

function assertActivePlayer(state, playerIndex) {
  if (state.activePlayer !== playerIndex) {
    throw new Error(`Not player ${playerIndex}'s turn (active: ${state.activePlayer})`);
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

const ITW_Game = {
  normalizeCard,
  loadCardPool,
  shuffleDeck,
  createGameState,
  refreshPhase,
  drawPhase,
  playCard,
  challenge,
  endTurn,
  endOfRound,
  calculatePlayerScore,
  calculateScores,
};

// Support both browser globals and Node-style module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ITW_Game;
} else if (typeof window !== 'undefined') {
  window.ITW_Game = ITW_Game;
}

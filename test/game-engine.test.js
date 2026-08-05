const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameEngine } = require('../server');

function setupRoom() {
  const engine = createGameEngine({ seed: '12345678' });
  const room = engine.createRoomState('ABCDE', 'Alice', 's1');
  engine.joinRoom(room, 'Bob', 's2');
  room.phase = 'main';
  return { engine, room };
}

function makeCard(id, suit, rank, cost, effects, name) {
  return {
    id,
    exhausted: false,
    mechanics: { id: rank, suit, rank, cost, effects },
    metadata: { name },
    sourceEffects: effects.slice(),
    supportedEffects: effects.slice(),
    unsupportedEffects: []
  };
}

test('room join limit rejects third player', () => {
  const { engine, room } = setupRoom();
  assert.throws(() => engine.joinRoom(room, 'Cara', 's3'), /Room is full/);
});

test('turn ownership is enforced', () => {
  const { engine, room } = setupRoom();
  assert.equal(room.turnPlayer, 'player1');
  assert.throws(() => engine.applyClientAction(room, 'player2', { type: 'end_turn' }), /not your turn/i);
});

test('energy payment exhausts ready energy and blocks unpaid card play', () => {
  const { engine, room } = setupRoom();
  const player = room.players.player1;
  player.hand = [makeCard('support-x', 'support', 4, 2, [], 'Costly Support')];
  player.board.energy = [
    makeCard('e1', 'energy', 1, 0, [], 'Energy 1'),
    makeCard('e2', 'energy', 1, 0, [], 'Energy 2')
  ];
  engine.applyClientAction(room, 'player1', { type: 'play_card', handIndex: 0 });
  assert.equal(player.board.support.length, 1);
  assert.equal(player.board.energy.filter((card) => card.exhausted).length, 2);
  player.hand = [makeCard('support-y', 'support', 4, 1, [], 'Another Support')];
  assert.throws(() => engine.applyClientAction(room, 'player1', { type: 'play_card', handIndex: 0 }), /Need 1 ready Energy/);
});

test('equal-rank challenge composts both cards', () => {
  const { engine, room } = setupRoom();
  room.players.player1.board.wildlife = [makeCard('w1', 'wildlife', 6, 0, [], 'Fox')];
  room.players.player2.board.wildlife = [makeCard('w2', 'wildlife', 6, 0, [], 'Hawk')];
  engine.applyClientAction(room, 'player1', { type: 'challenge', attackerId: 'w1', defenderId: 'w2' });
  assert.equal(room.players.player1.board.wildlife.length, 0);
  assert.equal(room.players.player2.board.wildlife.length, 0);
  assert.equal(room.players.player1.compost.length, 1);
  assert.equal(room.players.player2.compost.length, 1);
});

test('refresh restores exhausted cards at start of next turn', () => {
  const { engine, room } = setupRoom();
  room.players.player1.board.energy = [makeCard('e1', 'energy', 1, 0, [], 'Energy 1')];
  room.players.player1.board.support = [makeCard('s1', 'support', 2, 0, [], 'Support 1')];
  room.players.player1.board.energy[0].exhausted = true;
  room.players.player1.board.support[0].exhausted = true;
  engine.applyClientAction(room, 'player1', { type: 'end_turn' });
  engine.applyClientAction(room, 'player2', { type: 'end_turn' });
  assert.equal(room.turnPlayer, 'player1');
  assert.equal(room.players.player1.board.energy[0].exhausted, false);
  assert.equal(room.players.player1.board.support[0].exhausted, false);
});

test('score calculation counts only ready cards in play', () => {
  const { engine, room } = setupRoom();
  room.players.player1.board.energy = [makeCard('e1', 'energy', 3, 0, [], 'Energy 1')];
  room.players.player1.board.support = [makeCard('s1', 'support', 5, 0, [], 'Support 1')];
  room.players.player1.board.support[0].exhausted = true;
  room.players.player2.board.wildlife = [makeCard('w2', 'wildlife', 4, 0, [], 'Wildlife 2')];
  const scores = engine.calculateScores(room);
  assert.deepEqual(scores, { player1: 3, player2: 4 });
});

test('illegal client actions are rejected', () => {
  const { engine, room } = setupRoom();
  assert.throws(() => engine.applyClientAction(room, 'player1', { type: 'challenge', attackerId: 'missing', defenderId: 'missing' }), /not in play/i);
  assert.throws(() => engine.applyClientAction(room, 'player1', { type: 'mystery' }), /Unknown action type/);
  assert.throws(() => engine.applyClientAction(room, 'player1', null), /Malformed action payload/);
});

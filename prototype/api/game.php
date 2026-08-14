<?php

// Card catalog and authoritative PHP game engine for the Tonto prototype
// room. Cards are loaded directly from decks/tonto_01.json; this file
// does not create a second card database.
//
// This increment supports a minimal game loop only: mulligan, phase
// advancement, playing Energy/Support/Wildlife cards, and Challenges
// between ready Support/Wildlife cards. Event cards and free-form card
// effect text are not interpreted yet.

define('DECK_SOURCE_PATH', dirname(__DIR__, 2) . '/decks/tonto_01.json');
define('OPENING_HAND_SIZE', 7);
define('MAX_CHAT_MESSAGES', 50);
define('MAX_CHAT_MESSAGE_LENGTH', 300);

/**
 * Thrown when a requested game action is invalid or not allowed. The
 * error code lets callers distinguish e.g. unimplemented card types
 * from ordinary rule violations.
 */
class GameActionException extends \Exception
{
    private string $errorCode;

    public function __construct(string $message, string $errorCode = 'invalid_action')
    {
        parent::__construct($message);
        $this->errorCode = $errorCode;
    }

    public function errorCode(): string
    {
        return $this->errorCode;
    }
}

/**
 * Load and validate the Tonto card catalog from decks/tonto_01.json.
 * Cached for the life of the request.
 *
 * @return array<int, array> Card records indexed by mechanics.id.
 */
function load_card_catalog(): array
{
    static $catalog = null;

    if ($catalog !== null) {
        return $catalog;
    }

    $contents = file_get_contents(DECK_SOURCE_PATH);

    if ($contents === false) {
        send_error('Unable to load the card catalog.', 500);
    }

    $cards = json_decode($contents, true);

    if (!is_array($cards)) {
        send_error('The card catalog is malformed.', 500);
    }

    $catalog = [];

    foreach ($cards as $card) {
        if (!is_valid_card_record($card)) {
            send_error('The card catalog contains an invalid card record.', 500);
        }

        $catalog[$card['mechanics']['id']] = $card;
    }

    return $catalog;
}

/**
 * Validate the shape of a single card record: required mechanics and
 * metadata fields, and that the illustration path lives inside
 * artwork/.
 */
function is_valid_card_record($card): bool
{
    if (!is_array($card) || !isset($card['mechanics'], $card['metadata'])) {
        return false;
    }

    $mechanics = $card['mechanics'];
    $metadata = $card['metadata'];

    if (!is_array($mechanics) || !is_array($metadata)) {
        return false;
    }

    if (!is_int($mechanics['id'] ?? null)) {
        return false;
    }
    if (!is_int($mechanics['rank'] ?? null)) {
        return false;
    }
    if (!is_string($mechanics['suit'] ?? null) || $mechanics['suit'] === '') {
        return false;
    }
    if (!is_int($mechanics['cost'] ?? null)) {
        return false;
    }
    if (!is_string($metadata['name'] ?? null) || $metadata['name'] === '') {
        return false;
    }

    $illustration = $metadata['illustration'] ?? null;

    return is_string($illustration) && strpos($illustration, 'artwork/') === 0;
}

/**
 * Look up a card record by id. Throws if the id is unknown, which
 * should only happen if room state has been corrupted.
 */
function card_catalog_lookup(int $cardId): array
{
    $catalog = load_card_catalog();

    if (!isset($catalog[$cardId])) {
        throw new GameActionException('Unknown card id.');
    }

    return $catalog[$cardId];
}

/**
 * Build a freshly shuffled 52-card Tonto deck as an array of card ids.
 * Each call produces an independently shuffled deck.
 */
function build_shuffled_deck(): array
{
    $deck = array_keys(load_card_catalog());
    shuffle($deck);

    return $deck;
}

/**
 * Create the initial authoritative two-player game state: an
 * independently shuffled deck per player, with a 7-card opening hand
 * dealt to each.
 */
function create_initial_game_state(): array
{
    $state = [
        'phase' => 'mulligan',
        'round' => 1,
        'currentPlayer' => 0,
        'nextInstanceId' => 1,
        'winner' => null,
        'loseReason' => null,
        'pendingChallenge' => null,
        'log' => ['The game has started. Each player may keep or mulligan their opening hand.'],
        'players' => [
            new_player_game_state(),
            new_player_game_state(),
        ],
    ];

    foreach ([0, 1] as $slot) {
        draw_cards($state, $slot, OPENING_HAND_SIZE);
    }

    return $state;
}

function new_player_game_state(): array
{
    return [
        'deck' => build_shuffled_deck(),
        'hand' => [],
        'board' => [],
        'compost' => [],
        'mulliganResolved' => false,
        'mulliganUsed' => false,
    ];
}

function next_instance_id(array &$state): string
{
    $id = 'i' . $state['nextInstanceId'];
    $state['nextInstanceId']++;

    return $id;
}

/**
 * Draw $count cards into $slot's hand. Ends the game immediately if
 * the player's deck runs out.
 */
function draw_cards(array &$state, int $slot, int $count): void
{
    for ($i = 0; $i < $count; $i++) {
        if ($state['phase'] === 'gameover') {
            return;
        }

        if (count($state['players'][$slot]['deck']) === 0) {
            $state['phase'] = 'gameover';
            $state['winner'] = 1 - $slot;
            $state['loseReason'] = "Player {$slot} could not draw from an empty deck.";
            $state['log'][] = $state['loseReason'];

            return;
        }

        $cardId = array_shift($state['players'][$slot]['deck']);
        $state['players'][$slot]['hand'][] = [
            'instanceId' => next_instance_id($state),
            'cardId' => $cardId,
        ];
    }
}

/**
 * Find the index of a hand/board entry by instance id, or null.
 */
function find_entry_index(array $entries, string $instanceId): ?int
{
    foreach ($entries as $index => $entry) {
        if ($entry['instanceId'] === $instanceId) {
            return $index;
        }
    }

    return null;
}

/**
 * Apply one authoritative game action for $slot. Throws
 * GameActionException on any invalid or disallowed action.
 */
function apply_game_action(array &$state, int $slot, array $action): void
{
    if ($state['phase'] === 'gameover') {
        throw new GameActionException('The game is over.');
    }

    $type = $action['type'] ?? null;

    if ($state['pendingChallenge'] !== null && $type !== 'resolveChallenge') {
        throw new GameActionException('Resolve the pending Challenge before any other action.');
    }

    switch ($type) {
        case 'mulliganDecision':
            apply_mulligan_decision($state, $slot, $action);
            return;
        case 'advancePhase':
            apply_advance_phase($state, $slot);
            return;
        case 'playCard':
            apply_play_card($state, $slot, $action);
            return;
        case 'declareChallenge':
            apply_declare_challenge($state, $slot, $action);
            return;
        case 'resolveChallenge':
            apply_resolve_challenge($state);
            return;
        default:
            throw new GameActionException('Unknown action type.');
    }
}

function apply_mulligan_decision(array &$state, int $slot, array $action): void
{
    if ($state['phase'] !== 'mulligan') {
        throw new GameActionException('Not in the mulligan phase.');
    }

    if ($state['players'][$slot]['mulliganResolved']) {
        throw new GameActionException('Mulligan decision already resolved.');
    }

    $choice = $action['choice'] ?? null;

    if ($choice === 'keep') {
        $state['players'][$slot]['mulliganResolved'] = true;
        $state['log'][] = "Player {$slot} kept their opening hand.";
    } elseif ($choice === 'mulligan') {
        if ($state['players'][$slot]['mulliganUsed']) {
            throw new GameActionException('Only one mulligan is allowed.');
        }

        foreach ($state['players'][$slot]['hand'] as $entry) {
            $state['players'][$slot]['deck'][] = $entry['cardId'];
        }
        $state['players'][$slot]['hand'] = [];
        shuffle($state['players'][$slot]['deck']);

        $state['players'][$slot]['mulliganUsed'] = true;
        $state['players'][$slot]['mulliganResolved'] = true;
        $state['log'][] = "Player {$slot} took a mulligan.";

        draw_cards($state, $slot, OPENING_HAND_SIZE);
    } else {
        throw new GameActionException('Invalid mulligan decision.');
    }

    if ($state['phase'] !== 'gameover'
        && $state['players'][0]['mulliganResolved']
        && $state['players'][1]['mulliganResolved']
    ) {
        $state['phase'] = 'refresh';
        $state['currentPlayer'] = 0;
    }
}

function apply_advance_phase(array &$state, int $slot): void
{
    if ($state['phase'] === 'mulligan') {
        throw new GameActionException('Both players must resolve the mulligan decision first.');
    }
    if ($slot !== $state['currentPlayer']) {
        throw new GameActionException('It is not your turn.');
    }

    switch ($state['phase']) {
        case 'refresh':
            foreach ($state['players'][$slot]['board'] as $index => $card) {
                $state['players'][$slot]['board'][$index]['exhausted'] = false;
            }
            $state['phase'] = 'draw';
            return;
        case 'draw':
            draw_cards($state, $slot, 1);
            if ($state['phase'] === 'gameover') {
                return;
            }
            $state['phase'] = 'main';
            return;
        case 'main':
            $state['phase'] = 'challenge';
            return;
        case 'challenge':
            $state['phase'] = 'end';
            return;
        case 'end':
            if ($slot === 0) {
                $state['currentPlayer'] = 1;
                $state['phase'] = 'refresh';
                return;
            }
            if (count($state['players'][0]['hand']) === 0 || count($state['players'][1]['hand']) === 0) {
                end_game($state);
                return;
            }
            $state['round']++;
            $state['currentPlayer'] = 0;
            $state['phase'] = 'refresh';
            return;
        default:
            throw new GameActionException('Cannot advance from the current phase.');
    }
}

function apply_play_card(array &$state, int $slot, array $action): void
{
    if ($state['phase'] !== 'main') {
        throw new GameActionException('Cards can only be played during the main phase.');
    }
    if ($slot !== $state['currentPlayer']) {
        throw new GameActionException('It is not your turn.');
    }

    $instanceId = $action['cardInstanceId'] ?? null;

    if (!is_string($instanceId) || $instanceId === '') {
        throw new GameActionException('cardInstanceId is required.');
    }

    $handIndex = find_entry_index($state['players'][$slot]['hand'], $instanceId);

    if ($handIndex === null) {
        throw new GameActionException('That card is not in your hand.');
    }

    $entry = $state['players'][$slot]['hand'][$handIndex];
    $card = card_catalog_lookup($entry['cardId']);
    $suit = $card['mechanics']['suit'];
    $cost = $card['mechanics']['cost'];

    if ($suit === 'event') {
        throw new GameActionException('Event cards are not implemented yet.', 'not_implemented');
    }

    if (!in_array($suit, ['energy', 'support', 'wildlife'], true)) {
        throw new GameActionException('Unsupported card type.', 'not_implemented');
    }

    if ($suit === 'energy') {
        if ($cost !== 0) {
            throw new GameActionException('Energy cards must not have a cost.');
        }
    } else {
        $energyInstanceIds = $action['energyInstanceIds'] ?? [];

        if (!is_array($energyInstanceIds)) {
            throw new GameActionException('energyInstanceIds must be an array.');
        }

        pay_energy_cost($state, $slot, $cost, $energyInstanceIds);
    }

    array_splice($state['players'][$slot]['hand'], $handIndex, 1);
    $state['players'][$slot]['board'][] = [
        'instanceId' => $entry['instanceId'],
        'cardId' => $entry['cardId'],
        'exhausted' => false,
    ];
    $state['log'][] = "Player {$slot} played {$card['metadata']['name']}.";
}

/**
 * Pay a card's Energy cost by exhausting the given ready Energy cards
 * from $slot's board.
 */
function pay_energy_cost(array &$state, int $slot, int $cost, array $energyInstanceIds): void
{
    if ($cost === 0) {
        if (count($energyInstanceIds) !== 0) {
            throw new GameActionException('This card does not require any Energy.');
        }

        return;
    }

    if (count($energyInstanceIds) !== $cost) {
        throw new GameActionException("This card requires exactly {$cost} ready Energy card(s).");
    }

    if (count(array_unique($energyInstanceIds)) !== count($energyInstanceIds)) {
        throw new GameActionException('The same Energy card was selected more than once.');
    }

    $boardIndexes = [];

    foreach ($energyInstanceIds as $energyInstanceId) {
        if (!is_string($energyInstanceId)) {
            throw new GameActionException('Invalid Energy card selection.');
        }

        $index = find_entry_index($state['players'][$slot]['board'], $energyInstanceId);

        if ($index === null) {
            throw new GameActionException('A selected Energy card is not on your board.');
        }

        $boardCard = $state['players'][$slot]['board'][$index];

        if ($boardCard['exhausted']) {
            throw new GameActionException('A selected Energy card is already exhausted.');
        }

        if (card_catalog_lookup($boardCard['cardId'])['mechanics']['suit'] !== 'energy') {
            throw new GameActionException('Only Energy cards can pay a card cost.');
        }

        $boardIndexes[] = $index;
    }

    foreach ($boardIndexes as $index) {
        $state['players'][$slot]['board'][$index]['exhausted'] = true;
    }
}

function apply_declare_challenge(array &$state, int $slot, array $action): void
{
    if ($state['phase'] !== 'challenge') {
        throw new GameActionException('Challenges can only be declared during the Challenge phase.');
    }
    if ($slot !== $state['currentPlayer']) {
        throw new GameActionException('It is not your turn.');
    }

    $attackerInstanceId = $action['attackerInstanceId'] ?? null;
    $defenderInstanceId = $action['defenderInstanceId'] ?? null;

    if (!is_string($attackerInstanceId) || !is_string($defenderInstanceId)) {
        throw new GameActionException('attackerInstanceId and defenderInstanceId are required.');
    }

    $opponent = 1 - $slot;
    $attackerIndex = find_entry_index($state['players'][$slot]['board'], $attackerInstanceId);
    $defenderIndex = find_entry_index($state['players'][$opponent]['board'], $defenderInstanceId);

    if ($attackerIndex === null) {
        throw new GameActionException('The attacker must be on your board.');
    }
    if ($defenderIndex === null) {
        throw new GameActionException('The defender must be on the opposing board.');
    }

    $attacker = $state['players'][$slot]['board'][$attackerIndex];
    $defender = $state['players'][$opponent]['board'][$defenderIndex];

    if ($attacker['exhausted']) {
        throw new GameActionException('The attacker is exhausted.');
    }
    if ($defender['exhausted']) {
        throw new GameActionException('The defender is exhausted.');
    }

    $attackerSuit = card_catalog_lookup($attacker['cardId'])['mechanics']['suit'];
    $defenderSuit = card_catalog_lookup($defender['cardId'])['mechanics']['suit'];

    if (!in_array($attackerSuit, ['support', 'wildlife'], true)) {
        throw new GameActionException('Only ready Support or Wildlife cards may declare a Challenge.');
    }
    if (!in_array($defenderSuit, ['support', 'wildlife'], true)) {
        throw new GameActionException('Only Support or Wildlife cards may be challenged.');
    }

    $state['pendingChallenge'] = [
        'attackerSlot' => $slot,
        'attackerInstanceId' => $attackerInstanceId,
        'defenderSlot' => $opponent,
        'defenderInstanceId' => $defenderInstanceId,
    ];
}

function apply_resolve_challenge(array &$state): void
{
    $pending = $state['pendingChallenge'];

    if ($pending === null) {
        throw new GameActionException('No Challenge is pending.');
    }

    $attackerSlot = $pending['attackerSlot'];
    $defenderSlot = $pending['defenderSlot'];
    $attackerIndex = find_entry_index($state['players'][$attackerSlot]['board'], $pending['attackerInstanceId']);
    $defenderIndex = find_entry_index($state['players'][$defenderSlot]['board'], $pending['defenderInstanceId']);

    if ($attackerIndex === null || $defenderIndex === null) {
        $state['pendingChallenge'] = null;
        throw new GameActionException('The Challenge participants are no longer on the board.');
    }

    $attacker = $state['players'][$attackerSlot]['board'][$attackerIndex];
    $defender = $state['players'][$defenderSlot]['board'][$defenderIndex];

    $attackRank = effective_rank($attacker);
    $defendRank = effective_rank($defender);
    $attackerName = card_catalog_lookup($attacker['cardId'])['metadata']['name'];
    $defenderName = card_catalog_lookup($defender['cardId'])['metadata']['name'];

    if ($attackRank <= $defendRank) {
        array_splice($state['players'][$attackerSlot]['board'], $attackerIndex, 1);
        $state['players'][$attackerSlot]['compost'][] = $attacker['cardId'];
    } else {
        $state['players'][$attackerSlot]['board'][$attackerIndex]['exhausted'] = true;
    }

    if ($defendRank <= $attackRank) {
        array_splice($state['players'][$defenderSlot]['board'], $defenderIndex, 1);
        $state['players'][$defenderSlot]['compost'][] = $defender['cardId'];
    }

    $state['log'][] = "Challenge: {$attackerName} (Rank {$attackRank}) vs {$defenderName} (Rank {$defendRank}).";
    $state['pendingChallenge'] = null;
}

function effective_rank(array $entry): int
{
    $rank = card_catalog_lookup($entry['cardId'])['mechanics']['rank'];

    return $entry['exhausted'] ? $rank - 2 : $rank;
}

function end_game(array &$state): void
{
    $state['phase'] = 'gameover';
    $scores = calculate_scores($state);

    if ($scores[0] > $scores[1]) {
        $state['winner'] = 0;
    } elseif ($scores[1] > $scores[0]) {
        $state['winner'] = 1;
    } else {
        $state['winner'] = null;
    }

    $state['log'][] = 'The game has ended.';
}

/**
 * Final/interim score for each player: printed rank of cards in play
 * minus printed rank of cards remaining in hand.
 */
function calculate_scores(array $state): array
{
    $scores = [0, 0];

    foreach ($state['players'] as $slot => $player) {
        foreach ($player['board'] as $entry) {
            $scores[$slot] += card_catalog_lookup($entry['cardId'])['mechanics']['rank'];
        }
        foreach ($player['hand'] as $entry) {
            $scores[$slot] -= card_catalog_lookup($entry['cardId'])['mechanics']['rank'];
        }
    }

    return $scores;
}

/**
 * Append a chat message to the room record, trimming history to the
 * most recent MAX_CHAT_MESSAGES entries.
 */
function append_chat_message(array &$room, int $slot, string $message): void
{
    if (!isset($room['chat']) || !is_array($room['chat'])) {
        $room['chat'] = [];
    }

    $room['chat'][] = [
        'slot' => $slot,
        'timestamp' => current_timestamp(),
        'message' => $message,
    ];

    if (count($room['chat']) > MAX_CHAT_MESSAGES) {
        $room['chat'] = array_slice($room['chat'], -MAX_CHAT_MESSAGES);
    }
}

/**
 * Build the state payload returned to a specific player: their full
 * hand, both public boards, hand counts, and recent chat. The
 * requesting player's own data is always at players[0].
 */
function project_room_state(array $room, int $slot): array
{
    $state = $room['state'];
    $opponentSlot = 1 - $slot;
    $scores = $state !== null ? calculate_scores($state) : [0, 0];

    return [
        'roomCode' => $room['roomCode'],
        'status' => $room['status'],
        'stateVersion' => $room['stateVersion'],
        'you' => $slot,
        'game' => $state === null ? null : [
            'phase' => $state['phase'],
            'round' => $state['round'],
            'currentPlayer' => $state['currentPlayer'],
            'winner' => $state['winner'],
            'loseReason' => $state['loseReason'],
            'pendingChallenge' => $state['pendingChallenge'],
            'log' => $state['log'],
            'players' => [
                project_player_state($state['players'][$slot], $scores[$slot], true),
                project_player_state($state['players'][$opponentSlot], $scores[$opponentSlot], false),
            ],
        ],
        'chat' => array_map(static function (array $entry): array {
            return [
                'slot' => $entry['slot'],
                'timestamp' => $entry['timestamp'],
                'message' => $entry['message'],
            ];
        }, $room['chat'] ?? []),
    ];
}

function project_player_state(array $player, int $score, bool $includeHand): array
{
    $projected = [
        'handCount' => count($player['hand']),
        'board' => array_map('project_zone_card', $player['board']),
        'compostCount' => count($player['compost']),
        'deckCount' => count($player['deck']),
        'mulliganResolved' => $player['mulliganResolved'],
        'mulliganUsed' => $player['mulliganUsed'],
        'score' => $score,
    ];

    if ($includeHand) {
        $projected['hand'] = array_map('project_zone_card', $player['hand']);
    }

    return $projected;
}

function project_zone_card(array $entry): array
{
    $card = card_catalog_lookup($entry['cardId']);

    return [
        'instanceId' => $entry['instanceId'],
        'cardId' => $entry['cardId'],
        'exhausted' => $entry['exhausted'] ?? false,
        'name' => $card['metadata']['name'],
        'suit' => $card['mechanics']['suit'],
        'rank' => $card['mechanics']['rank'],
        'cost' => $card['mechanics']['cost'],
        'illustration' => $card['metadata']['illustration'],
    ];
}
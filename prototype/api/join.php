<?php

require __DIR__ . '/lib.php';

require_method('POST');

$body = read_json_body();
$roomCode = is_string($body['roomCode'] ?? null) ? strtoupper(trim($body['roomCode'])) : '';

if ($roomCode === '' || !is_valid_room_code($roomCode)) {
    send_error('Invalid room code.', 400);
}

$playerToken = generate_player_token();
$tokenHash = hash_player_token($playerToken);

$joinError = null;
$joined = false;

with_room_lock($roomCode, function (?array $room) use ($tokenHash, &$joinError, &$joined) {
    if ($room === null) {
        $joinError = ['message' => 'Room not found.', 'status' => 404];
        return null;
    }

    if ($room['status'] !== 'waiting') {
        $joinError = ['message' => 'Room is not open for joining.', 'status' => 409];
        return null;
    }

    if (count($room['players']) >= 2) {
        $joinError = ['message' => 'Room is full.', 'status' => 409];
        return null;
    }

    $room['players'][] = [
        'slot' => 1,
        'tokenHash' => $tokenHash,
        'joinedAt' => current_timestamp(),
    ];
    $room['status'] = 'ready';
    $room['stateVersion'] = ($room['stateVersion'] ?? 0) + 1;

    $joined = true;

    return $room;
});

if ($joinError !== null) {
    send_error($joinError['message'], $joinError['status']);
}

if (!$joined) {
    send_error('Unable to join room.', 500);
}

send_json([
    'roomCode' => $roomCode,
    'playerToken' => $playerToken,
    'playerIndex' => 1,
    'status' => 'ready',
]);
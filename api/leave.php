<?php

require __DIR__ . '/lib.php';

require_method('POST');

$body = read_json_body();
$roomCode = is_string($body['roomCode'] ?? null) ? strtoupper(trim($body['roomCode'])) : '';

if ($roomCode === '' || !is_valid_room_code($roomCode)) {
    send_error('Invalid room code.', 400);
}

$token = get_bearer_token();

if ($token === null) {
    send_error('Missing bearer token.', 401);
}

$leaveError = null;
$leaveErrorStatus = 400;

with_room_lock($roomCode, function (?array $room) use ($token, &$leaveError, &$leaveErrorStatus) {
    if ($room === null) {
        $leaveError = 'Room not found.';
        $leaveErrorStatus = 404;
        return null;
    }

    $slot = find_player_slot($room, $token);

    if ($slot === null) {
        $leaveError = 'Invalid player token.';
        $leaveErrorStatus = 401;
        return null;
    }

    foreach ($room['players'] as $index => $player) {
        if ($player['slot'] === $slot) {
            $room['players'][$index]['connected'] = false;
            $room['players'][$index]['revoked'] = true;
        }
    }

    $room['stateVersion'] = ($room['stateVersion'] ?? 0) + 1;

    return $room;
});

if ($leaveError !== null) {
    send_error($leaveError, $leaveErrorStatus);
}

send_json(['status' => 'left']);
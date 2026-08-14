<?php

require __DIR__ . '/lib.php';
require __DIR__ . '/game.php';

require_method('POST');

$body = read_json_body();
$roomCode = is_string($body['roomCode'] ?? null) ? strtoupper(trim($body['roomCode'])) : '';
$action = $body['action'] ?? null;

if ($roomCode === '' || !is_valid_room_code($roomCode)) {
    send_error('Invalid room code.', 400);
}

if (!is_array($action) || !is_string($action['type'] ?? null)) {
    send_error('A valid action is required.', 400);
}

$token = get_bearer_token();

if ($token === null) {
    send_error('Missing bearer token.', 401);
}

$actionError = null;
$actionErrorCode = null;
$actionErrorStatus = 400;
$resultSlot = null;

with_room_lock($roomCode, function (?array $room) use ($token, $action, &$actionError, &$actionErrorCode, &$actionErrorStatus, &$resultSlot) {
    if ($room === null) {
        $actionError = 'Room not found.';
        $actionErrorStatus = 404;
        return null;
    }

    $slot = find_player_slot($room, $token);

    if ($slot === null) {
        $actionError = 'Invalid player token.';
        $actionErrorStatus = 401;
        return null;
    }

    if ($room['state'] === null) {
        $actionError = 'The game has not started yet.';
        $actionErrorStatus = 409;
        return null;
    }

    try {
        apply_game_action($room['state'], $slot, $action);
    } catch (GameActionException $e) {
        $actionError = $e->getMessage();
        $actionErrorCode = $e->errorCode();
        return null;
    }

    $room['stateVersion'] = ($room['stateVersion'] ?? 0) + 1;
    $resultSlot = $slot;

    return $room;
});

if ($actionError !== null) {
    send_error($actionError, $actionErrorStatus, $actionErrorCode);
}

$room = read_room($roomCode);

if ($room === null) {
    send_error('Room not found.', 404);
}

send_json(project_room_state($room, $resultSlot));
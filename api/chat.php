<?php

require __DIR__ . '/lib.php';
require __DIR__ . '/game.php';

require_method('POST');

$body = read_json_body();
$roomCode = is_string($body['roomCode'] ?? null) ? strtoupper(trim($body['roomCode'])) : '';
$message = is_string($body['message'] ?? null) ? trim($body['message']) : '';

if ($roomCode === '' || !is_valid_room_code($roomCode)) {
    send_error('Invalid room code.', 400);
}

if ($message === '') {
    send_error('Chat message cannot be empty.', 400);
}

if (mb_strlen($message) > MAX_CHAT_MESSAGE_LENGTH) {
    send_error('Chat message is too long.', 400);
}

$token = get_bearer_token();

if ($token === null) {
    send_error('Missing bearer token.', 401);
}

$chatError = null;
$chatErrorStatus = 400;
$resultSlot = null;

with_room_lock($roomCode, function (?array $room) use ($token, $message, &$chatError, &$chatErrorStatus, &$resultSlot) {
    if ($room === null) {
        $chatError = 'Room not found.';
        $chatErrorStatus = 404;
        return null;
    }

    $slot = find_player_slot($room, $token);

    if ($slot === null) {
        $chatError = 'Invalid player token.';
        $chatErrorStatus = 401;
        return null;
    }

    append_chat_message($room, $slot, $message);
    $room['stateVersion'] = ($room['stateVersion'] ?? 0) + 1;
    $resultSlot = $slot;

    return $room;
});

if ($chatError !== null) {
    send_error($chatError, $chatErrorStatus);
}

$room = read_room($roomCode);

if ($room === null) {
    send_error('Room not found.', 404);
}

send_json(project_room_state($room, $resultSlot));
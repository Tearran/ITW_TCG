<?php

require __DIR__ . '/lib.php';
require __DIR__ . '/game.php';

require_method('GET');

$roomCode = is_string($_GET['roomCode'] ?? null) ? strtoupper(trim($_GET['roomCode'])) : '';

if ($roomCode === '' || !is_valid_room_code($roomCode)) {
    send_error('Invalid room code.', 400);
}

$token = get_bearer_token();

if ($token === null) {
    send_error('Missing bearer token.', 401);
}

$room = read_room($roomCode);

if ($room === null) {
    send_error('Room not found.', 404);
}

$slot = find_player_slot($room, $token);

if ($slot === null) {
    send_error('Invalid player token.', 401);
}

if (isset($_GET['sinceVersion']) && is_numeric($_GET['sinceVersion'])) {
    $sinceVersion = (int) $_GET['sinceVersion'];

    if ($sinceVersion === $room['stateVersion']) {
        http_response_code(204);
        exit;
    }
}

send_json(project_room_state($room, $slot));
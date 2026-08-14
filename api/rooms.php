<?php

require __DIR__ . '/lib.php';

require_method('POST');

const MAX_CREATE_ATTEMPTS = 5;

$playerToken = generate_player_token();
$tokenHash = hash_player_token($playerToken);
$roomCode = null;

for ($attempt = 0; $attempt < MAX_CREATE_ATTEMPTS; $attempt++) {
    $candidateCode = generate_room_code();
    $created = false;

    with_room_lock($candidateCode, function (?array $room) use ($candidateCode, $tokenHash, &$created) {
        // Someone already holds this code; try a different one.
        if ($room !== null) {
            return null;
        }

        $created = true;

        return [
            'roomCode' => $candidateCode,
            'status' => 'waiting',
            'stateVersion' => 0,
            'players' => [
                [
                    'slot' => 0,
                    'tokenHash' => $tokenHash,
                    'joinedAt' => current_timestamp(),
                ],
            ],
            'state' => null,
        ];
    });

    if ($created) {
        $roomCode = $candidateCode;
        break;
    }
}

if ($roomCode === null) {
    send_error('Unable to allocate a room code. Please try again.', 500);
}

send_json([
    'roomCode' => $roomCode,
    'playerToken' => $playerToken,
    'playerIndex' => 0,
    'status' => 'waiting',
]);
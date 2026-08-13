<?php

// Shared helpers for the prototype room API.
//
// Storage model: each room is a single JSON file under data/rooms/,
// guarded by a matching lock file. No SQL, no accounts, no SSE/WebSockets.

define('ROOMS_DIR', __DIR__ . '/../data/rooms');

const ROOM_CODE_LENGTH = 6;
// Excludes ambiguous characters (0/O, 1/I/L).
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Send a JSON response and stop execution.
 */
function send_json(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Send a consistently-shaped JSON error response and stop execution.
 * The message is expected to be safe to show to a client; internal
 * details (file paths, PHP errors, etc.) must never be passed in.
 */
function send_error(string $message, int $status = 400): void
{
    send_json(['error' => ['message' => $message]], $status);
}

/**
 * Require the request to use the given HTTP method, or fail.
 */
function require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        send_error('Method not allowed.', 405);
    }
}

/**
 * Read and decode a JSON request body. Returns an associative array.
 * An empty body decodes to an empty array. Malformed JSON is rejected.
 */
function read_json_body(): array
{
    $raw = file_get_contents('php://input');

    if ($raw === false || $raw === '') {
        return [];
    }

    $data = json_decode($raw, true);

    if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
        send_error('Malformed JSON request body.', 400);
    }

    if (!is_array($data)) {
        send_error('Malformed JSON request body.', 400);
    }

    return $data;
}

/**
 * Generate a short, URL-safe room code.
 */
function generate_room_code(): string
{
    $alphabetLength = strlen(ROOM_CODE_ALPHABET);
    $code = '';

    for ($i = 0; $i < ROOM_CODE_LENGTH; $i++) {
        $code .= ROOM_CODE_ALPHABET[random_int(0, $alphabetLength - 1)];
    }

    return $code;
}

/**
 * Generate a cryptographically secure temporary player token.
 * Only the hash of this value is ever persisted.
 */
function generate_player_token(): string
{
    return bin2hex(random_bytes(32));
}

/**
 * Hash a player token for storage.
 */
function hash_player_token(string $token): string
{
    return hash('sha256', $token);
}

/**
 * Validate a room code's shape before it is ever used to build a file
 * path. Must be checked before room_file_path()/room_lock_path().
 */
function is_valid_room_code(string $code): bool
{
    return preg_match('/^[' . ROOM_CODE_ALPHABET . ']{' . ROOM_CODE_LENGTH . '}$/', $code) === 1;
}

/**
 * Build the storage path for a room's JSON file.
 * Caller must have already validated the room code.
 */
function room_file_path(string $roomCode): string
{
    return ROOMS_DIR . '/' . $roomCode . '.json';
}

/**
 * Build the path to a room's lock file.
 * Caller must have already validated the room code.
 */
function room_lock_path(string $roomCode): string
{
    return ROOMS_DIR . '/' . $roomCode . '.lock';
}

/**
 * Read a room record from disk. Returns null if the room does not exist.
 */
function read_room(string $roomCode): ?array
{
    $path = room_file_path($roomCode);

    if (!file_exists($path)) {
        return null;
    }

    $contents = file_get_contents($path);

    if ($contents === false) {
        return null;
    }

    $room = json_decode($contents, true);

    return is_array($room) ? $room : null;
}

/**
 * Atomically write a room record to disk: write to a temporary file in
 * the same directory, then rename() it into place.
 */
function write_room(string $roomCode, array $room): void
{
    $finalPath = room_file_path($roomCode);
    $tmpPath = ROOMS_DIR . '/.' . $roomCode . '.' . bin2hex(random_bytes(8)) . '.tmp';

    if (file_put_contents($tmpPath, json_encode($room, JSON_PRETTY_PRINT)) === false) {
        send_error('Unable to save room state.', 500);
    }

    if (!rename($tmpPath, $finalPath)) {
        @unlink($tmpPath);
        send_error('Unable to save room state.', 500);
    }
}

/**
 * Run $callback while holding an exclusive lock on the room's lock
 * file. The callback receives the current room record (or null if it
 * does not exist yet) and must return one of:
 *   - an array with a new room record to persist, or
 *   - null to persist nothing (e.g. on a validation failure that has
 *     already called send_error() itself).
 *
 * The lock is always released before this function returns.
 */
function with_room_lock(string $roomCode, callable $callback): void
{
    $lockPath = room_lock_path($roomCode);
    $lockHandle = fopen($lockPath, 'c');

    if ($lockHandle === false) {
        send_error('Unable to access room storage.', 500);
    }

    if (!flock($lockHandle, LOCK_EX)) {
        fclose($lockHandle);
        send_error('Unable to access room storage.', 500);
    }

    try {
        $room = read_room($roomCode);
        $updatedRoom = $callback($room);

        if ($updatedRoom !== null) {
            write_room($roomCode, $updatedRoom);
        }
    } finally {
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
    }
}

/**
 * Return the current time as an ISO 8601 UTC timestamp.
 */
function current_timestamp(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}
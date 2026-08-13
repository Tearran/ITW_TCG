<?php

header('Content-Type: application/json');

$jsonFile = __DIR__ . '../decks/tonto_01.json';

if (!file_exists($jsonFile)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Card database not found'
    ]);
    exit;
}

$data = json_decode(file_get_contents($jsonFile), true);

if ($data === null) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Invalid card JSON'
    ]);
    exit;
}

echo json_encode($data);

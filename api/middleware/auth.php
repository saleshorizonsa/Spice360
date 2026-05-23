<?php

function requireAuth(): array {
    $token = null;

    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        $token = trim($m[1]);
    }

    if (!$token) {
        throw new RuntimeException('Authentication required', 401);
    }

    $payload = jwtDecode($token);
    if (!$payload) {
        throw new RuntimeException('Invalid or expired session. Please log in again.', 401);
    }

    return $payload;
}

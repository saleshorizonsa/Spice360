<?php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Organization-Id');
header('Access-Control-Max-Age: 3600');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/jwt.php';
require_once __DIR__ . '/middleware/auth.php';
require_once __DIR__ . '/handlers/auth.php';
require_once __DIR__ . '/handlers/entities.php';
require_once __DIR__ . '/handlers/owner.php';

$path   = rtrim(preg_replace('#^/?api#', '', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)), '/') ?: '/';
$method = $_SERVER['REQUEST_METHOD'];
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

try {
    // ── Auth ──────────────────────────────────────────────────────────────
    if ($path === '/auth/login'  && $method === 'POST') {
        echo json_encode(handleLogin($body));

    } elseif ($path === '/auth/signup' && $method === 'POST') {
        echo json_encode(handleSignup($body));

    } elseif ($path === '/auth/logout' && $method === 'POST') {
        echo json_encode(['success' => true]);

    } elseif ($path === '/auth/me' && $method === 'GET') {
        $user = requireAuth();
        echo json_encode(getUserById($user['id']));

    } elseif ($path === '/auth/confirm' && $method === 'GET') {
        echo json_encode(handleEmailConfirm($_GET['token'] ?? ''));

    } elseif ($path === '/auth/resend' && $method === 'POST') {
        echo json_encode(handleResendVerification($body['email'] ?? ''));

    // ── Entities ──────────────────────────────────────────────────────────
    } elseif (preg_match('#^/entities/([A-Za-z0-9]+)$#', $path, $m) && $method === 'GET') {
        echo json_encode(listEntities($m[1], requireAuth(), $_GET));

    } elseif (preg_match('#^/entities/([A-Za-z0-9]+)/filter$#', $path, $m) && $method === 'POST') {
        echo json_encode(filterEntities($m[1], requireAuth(), $body));

    } elseif (preg_match('#^/entities/([A-Za-z0-9]+)/bulk$#', $path, $m) && $method === 'POST') {
        echo json_encode(bulkCreateEntities($m[1], requireAuth(), $body['records'] ?? []));

    } elseif (preg_match('#^/entities/([A-Za-z0-9]+)$#', $path, $m) && $method === 'POST') {
        echo json_encode(createEntity($m[1], requireAuth(), $body));

    } elseif (preg_match('#^/entities/([A-Za-z0-9]+)/([A-Za-z0-9_-]+)$#', $path, $m) && $method === 'PUT') {
        echo json_encode(updateEntity($m[1], $m[2], requireAuth(), $body));

    } elseif (preg_match('#^/entities/([A-Za-z0-9]+)/([A-Za-z0-9_-]+)$#', $path, $m) && $method === 'DELETE') {
        echo json_encode(deleteEntity($m[1], $m[2], requireAuth()));

    // ── Owner ─────────────────────────────────────────────────────────────
    } elseif ($path === '/owner/tenants' && $method === 'GET') {
        echo json_encode(ownerListTenants(requireAuth()));

    } elseif (preg_match('#^/owner/tenants/([A-Za-z0-9_-]+)/subscription$#', $path, $m) && $method === 'POST') {
        echo json_encode(ownerUpdateSubscription($m[1], $body, requireAuth()));

    } elseif (preg_match('#^/owner/tenants/([A-Za-z0-9_-]+)/users$#', $path, $m) && $method === 'GET') {
        echo json_encode(ownerListTenantUsers($m[1], requireAuth()));

    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Not found']);
    }
} catch (RuntimeException $e) {
    $code = $e->getCode();
    http_response_code($code >= 400 && $code < 600 ? $code : 500);
    echo json_encode(['error' => $e->getMessage()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
}

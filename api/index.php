<?php

$allowedOrigins = array_filter(array_map('trim', explode(',',
    defined('ALLOWED_ORIGINS') ? ALLOWED_ORIGINS : (getenv('ALLOWED_ORIGINS') ?: 'https://erp.horizon-sa.net')
)));
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$corsOrigin = in_array($requestOrigin, $allowedOrigins, true) ? $requestOrigin : ($allowedOrigins[0] ?? 'https://erp.horizon-sa.net');

header('Access-Control-Allow-Origin: ' . $corsOrigin);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Organization-Id');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 3600');
header('Vary: Origin');
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

    } elseif ($path === '/auth/forgot-password' && $method === 'POST') {
        echo json_encode(handleForgotPassword($body));

    } elseif ($path === '/auth/reset-password' && $method === 'POST') {
        echo json_encode(handleResetPassword($body));

    } elseif ($path === '/auth/change-password' && $method === 'POST') {
        $authUser = requireAuth();
        echo json_encode(handleChangePassword($body, $authUser));

    } elseif ($path === '/auth/profile' && $method === 'PUT') {
        $authUser = requireAuth();
        echo json_encode(handleUpdateProfile($body, $authUser));

    } elseif ($path === '/auth/accept-invite' && $method === 'POST') {
        echo json_encode(handleAcceptInvite($body));

    } elseif ($path === '/auth/send-invite' && $method === 'POST') {
        $authUser = requireAuth();
        echo json_encode(handleSendInvite($body, $authUser));

    // ── Search ────────────────────────────────────────────────────────────
    } elseif ($path === '/search' && $method === 'GET') {
        $authUser = requireAuth();
        echo json_encode(searchEntities($_GET['q'] ?? '', $authUser));

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

    // ── Public (no auth required) ─────────────────────────────────────────
    } elseif ($path === '/public/plans' && $method === 'GET') {
        $tableName = sanitizeTableName('SubscriptionPlan');
        ensureEntityTable($tableName);
        $db = getDB();
        $planQuery = "SELECT * FROM `{$tableName}`
             ORDER BY CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(record,'$.display_order')),'99') AS UNSIGNED) ASC,
                      created_at ASC";
        $rows = $db->query($planQuery)->fetchAll();
        if (empty($rows)) {
            $defaults = [
                ['id' => 'starter',      'plan_id' => 'starter',      'plan_name' => 'Starter',      'monthly_price' => 299,  'currency' => 'SAR', 'billing_cycle' => 'monthly', 'trial_days' => 14, 'user_limit' => 5,           'invoice_limit' => 500,    'support_level' => 'Email support',             'modules' => ['Sales','Inventory','Finance','ZATCA'],                                                 'limits' => ['users' => 5,      'invoices_per_month' => 500,    'tenants' => 1], 'display_order' => 1, 'status' => 'active'],
                ['id' => 'professional', 'plan_id' => 'professional', 'plan_name' => 'Professional', 'monthly_price' => 799,  'currency' => 'SAR', 'billing_cycle' => 'monthly', 'trial_days' => 14, 'user_limit' => 25,          'invoice_limit' => 5000,   'support_level' => 'Priority support',          'modules' => ['Sales','Inventory','Finance','Purchasing','HR','Projects','ZATCA','Reports'],         'limits' => ['users' => 25,     'invoices_per_month' => 5000,   'tenants' => 1], 'display_order' => 2, 'status' => 'active'],
                ['id' => 'enterprise',   'plan_id' => 'enterprise',   'plan_name' => 'Enterprise',   'monthly_price' => null, 'currency' => 'SAR', 'billing_cycle' => 'custom',  'trial_days' => 30, 'user_limit' => 'Unlimited', 'invoice_limit' => 'Custom', 'support_level' => 'Dedicated success manager', 'modules' => ['All modules','Advanced reports','Owner controls','Integrations'],                    'limits' => ['users' => 999999, 'invoices_per_month' => 999999, 'tenants' => 1], 'display_order' => 3, 'status' => 'active'],
            ];
            $ins = $db->prepare("INSERT IGNORE INTO `{$tableName}` (id, record, status, created_at, updated_at) VALUES (?, ?, 'active', NOW(), NOW())");
            foreach ($defaults as $plan) {
                $rowId = $plan['id'];
                unset($plan['id']);
                $ins->execute([$rowId, json_encode($plan)]);
            }
            $rows = $db->query($planQuery)->fetchAll();
        }
        echo json_encode(array_map('normalizeRow', $rows));

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

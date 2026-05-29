<?php
/**
 * ONE-TIME ADMIN SETUP SCRIPT
 * Protected by SETUP_SECRET defined in config.php (auto-disabled after first successful use).
 * Run once at: https://erp.horizon-sa.net/api/setup-admin.php?secret=YOUR_SECRET
 * The script writes a lock file and refuses to run again after the first success.
 */

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/database.php';

header('Content-Type: text/plain');

$lockFile   = __DIR__ . '/.setup-done';
$forceReset = ($_GET['force'] ?? '') === '1';

// Refuse if already run (force=1 + valid secret bypasses the lock)
if (file_exists($lockFile) && !$forceReset) {
    http_response_code(403);
    echo "✗ Setup has already been completed. This endpoint is disabled.\n";
    exit;
}

// Require secret token
$secret         = defined('SETUP_SECRET') ? SETUP_SECRET : '';
$providedSecret = $_GET['secret'] ?? '';
if (!$secret || !hash_equals($secret, $providedSecret)) {
    http_response_code(403);
    echo "✗ Invalid or missing secret. Provide ?secret=YOUR_SECRET\n";
    exit;
}

// ── Configure the admin account here ─────────────────────────────────────────
$adminEmail    = defined('PLATFORM_OWNER_EMAIL') ? PLATFORM_OWNER_EMAIL : 'shareef6695@gmail.com';
$adminPassword = $_GET['password'] ?? '';
$adminName     = $_GET['name']     ?? 'Admin';
// ─────────────────────────────────────────────────────────────────────────────

if (strlen($adminPassword) < 8) {
    http_response_code(400);
    echo "✗ Provide ?password=YourPassword (min 8 chars)\n";
    exit;
}

try {
    getDB()->exec("CREATE TABLE IF NOT EXISTS `_users` (
        `id`                   VARCHAR(36)  NOT NULL,
        `email`                VARCHAR(255) NOT NULL,
        `password_hash`        VARCHAR(255) NOT NULL,
        `full_name`            VARCHAR(255) DEFAULT NULL,
        `is_verified`          TINYINT(1)   NOT NULL DEFAULT 0,
        `verification_token`   VARCHAR(255) DEFAULT NULL,
        `verification_expires` DATETIME     DEFAULT NULL,
        `reset_token`          VARCHAR(255) DEFAULT NULL,
        `reset_expires`        DATETIME     DEFAULT NULL,
        `terms_accepted_at`    DATETIME     DEFAULT NULL,
        `created_at`           DATETIME     DEFAULT CURRENT_TIMESTAMP,
        `updated_at`           DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        UNIQUE KEY `uk_email` (`email`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $stmt = getDB()->prepare('SELECT id FROM `_users` WHERE email = ? LIMIT 1');
    $stmt->execute([strtolower($adminEmail)]);
    $existing = $stmt->fetch();
    $hash     = password_hash($adminPassword, PASSWORD_BCRYPT, ['cost' => 12]);

    if ($existing) {
        getDB()->prepare('UPDATE `_users` SET password_hash=?, full_name=?, is_verified=1, verification_token=NULL WHERE email=?')
               ->execute([$hash, $adminName, strtolower($adminEmail)]);
        echo "✓ Admin account updated and verified.\n";
    } else {
        $id = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff),
            mt_rand(0,0x0fff)|0x4000,mt_rand(0,0x3fff)|0x8000,
            mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff));
        getDB()->prepare('INSERT INTO `_users` (id,email,password_hash,full_name,is_verified,terms_accepted_at) VALUES (?,?,?,?,1,NOW())')
               ->execute([$id, strtolower($adminEmail), $hash, $adminName]);
        echo "✓ Admin account created.\n";
    }

    echo "  Email: $adminEmail\n";
    echo "  Role : owner (platform owner)\n\n";

    if (!$forceReset) {
        file_put_contents($lockFile, date('Y-m-d H:i:s') . ' ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
        echo "✓ Setup locked. This endpoint will refuse all future requests.\n";
    } else {
        echo "✓ Force reset complete.\n";
    }

} catch (Exception $e) {
    http_response_code(500);
    echo "✗ Error: " . $e->getMessage() . "\n";
}

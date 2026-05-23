<?php
/**
 * ONE-TIME ADMIN SETUP SCRIPT
 * Run this once at: https://erp.horizon-sa.net/api/setup-admin.php
 * DELETE this file from the server immediately after use.
 */

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/database.php';

// ── Configure the admin account here ─────────────────────────────────────────
$adminEmail    = 'shareef6695@gmail.com';
$adminPassword = 'Horizon@2025';          // Change this after first login
$adminName     = 'Mahmood';
// ─────────────────────────────────────────────────────────────────────────────

header('Content-Type: text/plain');

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
        `created_at`           DATETIME     DEFAULT CURRENT_TIMESTAMP,
        `updated_at`           DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        UNIQUE KEY `uk_email` (`email`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $stmt = getDB()->prepare('SELECT id FROM `_users` WHERE email = ? LIMIT 1');
    $stmt->execute([strtolower($adminEmail)]);
    $existing = $stmt->fetch();

    if ($existing) {
        $hash = password_hash($adminPassword, PASSWORD_BCRYPT);
        getDB()->prepare('UPDATE `_users` SET password_hash=?, full_name=?, is_verified=1, verification_token=NULL WHERE email=?')
               ->execute([$hash, $adminName, strtolower($adminEmail)]);
        echo "✓ Admin account updated and verified.\n";
    } else {
        $id   = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff),
            mt_rand(0,0x0fff)|0x4000,mt_rand(0,0x3fff)|0x8000,
            mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff));
        $hash = password_hash($adminPassword, PASSWORD_BCRYPT);
        getDB()->prepare('INSERT INTO `_users` (id,email,password_hash,full_name,is_verified) VALUES (?,?,?,?,1)')
               ->execute([$id, strtolower($adminEmail), $hash, $adminName]);
        echo "✓ Admin account created.\n";
    }

    echo "  Email   : $adminEmail\n";
    echo "  Password: $adminPassword\n";
    echo "  Role    : owner (platform owner)\n\n";
    echo "⚠ DELETE this file from the server now:\n";
    echo "  public_html/api/setup-admin.php\n";

} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
}

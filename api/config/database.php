<?php

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

function generateUUID(): string {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function normalizeRow(array $row): array {
    $record = is_string($row['record'] ?? null)
        ? (json_decode($row['record'], true) ?? [])
        : ($row['record'] ?? []);

    return array_merge($record, [
        'id'              => $row['id'],
        'base44_id'       => $row['base44_id']      ?? null,
        'tenant_id'       => $row['tenant_id']      ?? $row['organization_id'] ?? null,
        'organization_id' => $row['organization_id'] ?? null,
        'organization_key'=> $row['organization_key'] ?? null,
        'status'          => $record['status']      ?? $row['status'] ?? null,
        'created_by'      => $row['created_by']     ?? null,
        'updated_by'      => $row['updated_by']     ?? null,
        'source'          => $row['source']         ?? null,
        'created_at'      => $row['created_at']     ?? null,
        'updated_at'      => $row['updated_at']     ?? null,
    ]);
}

function tableNameForEntity(string $entityName): string {
    $name = preg_replace('/([A-Z]+)([A-Z][a-z])/', '$1_$2', $entityName);
    $name = preg_replace('/([a-z0-9])([A-Z])/', '$1_$2', $name);
    return strtolower($name);
}

function sanitizeTableName(string $name): string {
    return preg_replace('/[^a-z0-9_]/', '', tableNameForEntity($name));
}

function ensureEntityTable(string $tableName): void {
    static $created = [];
    if (isset($created[$tableName])) return;
    getDB()->exec("CREATE TABLE IF NOT EXISTS `{$tableName}` (
        `id`               VARCHAR(36)  NOT NULL,
        `base44_id`        VARCHAR(255) DEFAULT NULL,
        `tenant_id`        VARCHAR(36)  DEFAULT NULL,
        `organization_id`  VARCHAR(36)  DEFAULT NULL,
        `organization_key` VARCHAR(100) DEFAULT NULL,
        `status`           VARCHAR(100) DEFAULT NULL,
        `source`           VARCHAR(100) DEFAULT NULL,
        `created_by`       VARCHAR(255) DEFAULT NULL,
        `updated_by`       VARCHAR(255) DEFAULT NULL,
        `created_at`       DATETIME     DEFAULT CURRENT_TIMESTAMP,
        `updated_at`       DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        `record`           JSON,
        PRIMARY KEY (`id`),
        KEY `idx_org`    (`organization_id`),
        KEY `idx_tenant` (`tenant_id`),
        KEY `idx_status` (`status`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $created[$tableName] = true;
}

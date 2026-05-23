<?php

function requireOwner(array $user): void {
    if (!($user['is_platform_owner'] ?? false) && ($user['role'] ?? '') !== 'owner') {
        throw new RuntimeException('Owner access required', 403);
    }
}

function ownerListTenants(array $user): array {
    requireOwner($user);
    $db = getDB();

    $orgTable = sanitizeTableName('Organization');
    $subTable = sanitizeTableName('Subscription');
    ensureEntityTable($orgTable);
    ensureEntityTable($subTable);

    $orgs = $db->query(
        "SELECT id, organization_id, record, created_at, updated_at FROM `{$orgTable}` ORDER BY created_at DESC"
    )->fetchAll();

    $subs = $db->query("SELECT organization_id, id, record FROM `{$subTable}`")->fetchAll();
    $subMap = [];
    foreach ($subs as $sub) {
        $oid = $sub['organization_id'];
        if (!isset($subMap[$oid])) {
            $subMap[$oid] = array_merge(
                json_decode($sub['record'], true) ?? [],
                ['id' => $sub['id'], 'organization_id' => $oid]
            );
        }
    }

    // User counts per org from the entity User table
    $userTable = sanitizeTableName('User');
    ensureEntityTable($userTable);
    $userCountRows = $db->query(
        "SELECT organization_id, COUNT(*) as cnt FROM `{$userTable}` GROUP BY organization_id"
    )->fetchAll();
    $userCountMap = [];
    foreach ($userCountRows as $row) {
        $userCountMap[$row['organization_id']] = (int)$row['cnt'];
    }

    $result = [];
    foreach ($orgs as $org) {
        $record = json_decode($org['record'], true) ?? [];
        $result[] = array_merge($record, [
            'id'              => $org['id'],
            'organization_id' => $org['id'],
            'created_at'      => $org['created_at'],
            'updated_at'      => $org['updated_at'],
            'subscription'    => $subMap[$org['id']] ?? null,
            'user_count'      => $userCountMap[$org['id']] ?? 0,
        ]);
    }
    return $result;
}

function ownerUpdateSubscription(string $orgId, array $data, array $user): array {
    requireOwner($user);
    $db = getDB();

    $subTable = sanitizeTableName('Subscription');
    ensureEntityTable($subTable);

    $stmt = $db->prepare("SELECT id, record FROM `{$subTable}` WHERE organization_id = ? LIMIT 1");
    $stmt->execute([$orgId]);
    $existing = $stmt->fetch();

    $now = date('c');

    if ($existing) {
        $record = array_merge(json_decode($existing['record'], true) ?? [], $data);
        $record['updated_at'] = $now;
        $record['updated_by'] = $user['email'];
        $db->prepare(
            "UPDATE `{$subTable}` SET record = ?, updated_at = NOW(), updated_by = ?, status = ? WHERE id = ?"
        )->execute([json_encode($record), $user['email'], $record['status'] ?? null, $existing['id']]);
        return array_merge(['id' => $existing['id'], 'organization_id' => $orgId], $record);
    }

    $id = generateUUID();
    $record = array_merge($data, [
        'organization_id' => $orgId,
        'tenant_id'       => $orgId,
        'created_at'      => $now,
        'updated_at'      => $now,
        'created_by'      => $user['email'],
    ]);
    $db->prepare(
        "INSERT INTO `{$subTable}` (id, organization_id, tenant_id, status, record) VALUES (?,?,?,?,?)"
    )->execute([$id, $orgId, $orgId, $record['status'] ?? null, json_encode($record)]);
    return array_merge(['id' => $id, 'organization_id' => $orgId], $record);
}

function ownerListTenantUsers(string $orgId, array $user): array {
    requireOwner($user);
    $db = getDB();

    $userTable = sanitizeTableName('User');
    ensureEntityTable($userTable);

    // Join _users (auth table) with User entity table by email
    try {
        $stmt = $db->prepare(
            "SELECT au.id, au.email, au.full_name, au.is_verified, au.created_at
             FROM `_users` au
             INNER JOIN `{$userTable}` eu
               ON LOWER(JSON_UNQUOTE(JSON_EXTRACT(eu.record, '$.email'))) = LOWER(au.email)
             WHERE eu.organization_id = ?"
        );
        $stmt->execute([$orgId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (!empty($rows)) return $rows;
    } catch (Exception $e) {
        // fall through to entity-only fallback
    }

    // Fallback: return User entity records only
    $stmt = $db->prepare("SELECT id, record FROM `{$userTable}` WHERE organization_id = ?");
    $stmt->execute([$orgId]);
    return array_map(fn($row) => array_merge(
        ['id' => $row['id']],
        json_decode($row['record'], true) ?? []
    ), $stmt->fetchAll());
}

<?php

const METADATA_COLUMNS = ['id','base44_id','tenant_id','organization_id','organization_key','status','source','created_by','updated_by','created_at','updated_at'];
const ORG_SCOPE_EXCLUSIONS = ['Organization','SubscriptionPlan'];
const SYSTEM_ENTITIES = ['AuditTrail','DocumentNumberSeries','Notification'];
const LOCKED_STATUS_VALUES = ['posted','closed','cleared','reported','paid','completed','pgi_completed','reversed','cancelled','submitted_to_zatca','locked'];
const LOCKED_STATUS_FIELDS = ['status','posting_status','payment_status','zatca_status','filing_status','submission_status','period_status'];

const PERIOD_CONTROLLED_ENTITIES = [
    'AccountsPayable'    => ['module'=>'finance',    'dateFields'=>['invoice_date','posting_date','document_date','due_date']],
    'AccountsReceivable' => ['module'=>'finance',    'dateFields'=>['invoice_date','posting_date','document_date','due_date']],
    'Budget'             => ['module'=>'finance',    'dateFields'=>['period_start','budget_date','posting_date','document_date']],
    'FixedAsset'         => ['module'=>'finance',    'dateFields'=>['acquisition_date','capitalization_date','posting_date']],
    'Invoice'            => ['module'=>'sales',      'dateFields'=>['invoice_date','posting_date','document_date']],
    'JournalEntry'       => ['module'=>'finance',    'dateFields'=>['posting_date','document_date','entry_date']],
    'Payment'            => ['module'=>'finance',    'dateFields'=>['payment_date','posting_date','document_date']],
    'VendorInvoice'      => ['module'=>'purchasing', 'dateFields'=>['invoice_date','posting_date','document_date']],
    'Delivery'           => ['module'=>'sales',      'dateFields'=>['delivery_date','posting_date','document_date']],
    'GoodsReceiptNote'   => ['module'=>'purchasing', 'dateFields'=>['receipt_date','posting_date','grn_date','document_date']],
    'PurchaseOrder'      => ['module'=>'purchasing', 'dateFields'=>['order_date','posting_date','document_date']],
    'SalesOrder'         => ['module'=>'sales',      'dateFields'=>['order_date','posting_date','document_date']],
    'StockMovement'      => ['module'=>'inventory',  'dateFields'=>['movement_date','posting_date','document_date']],
    'ProductionOrder'    => ['module'=>'operations', 'dateFields'=>['planned_start_date','start_date','posting_date','document_date']],
    'Payroll'            => ['module'=>'hr',         'dateFields'=>['payroll_date','period_start','posting_date','document_date']],
    'LeaveRequest'       => ['module'=>'hr',         'dateFields'=>['start_date','request_date','document_date']],
];

const AUDITABLE_ENTITIES = ['AccountsPayable','AccountsReceivable','ApprovalMatrix','ApprovalRequest','AssetAllocation','AssetDisposal','AssetMaintenance','AssetVerificationTask','BankAccount','Budget','CAPA','CertificateOfAnalysis','Coil','CoilSlitting','Customer','CycleCount','Delivery','Employee','FixedAsset','GoodsReceiptNote','InspectionLot','Invoice','JournalEntry','LeaveRequest','Material','Payment','PeriodClose','Plant','Product','ProductionOrder','Project','PurchaseOrder','PurchaseRequisition','Quotation','RFQ','Role','SalesOrder','SalesReturn','ServiceOrder','StockMovement','StockTransferOrder','StorageLocation','User','Vendor','VendorInvoice','WorkOrder','ZATCASubmissionLog'];

const DOCUMENT_NUMBER_CONFIG = [
    'Quotation'            => ['type'=>'quotation',           'fields'=>['quotation_number']],
    'SalesOrder'           => ['type'=>'sales_order',         'fields'=>['order_number','sales_order_number']],
    'Delivery'             => ['type'=>'delivery',            'fields'=>['delivery_number']],
    'Invoice'              => ['type'=>'invoice',             'fields'=>['invoice_number']],
    'SalesReturn'          => ['type'=>'sales_return',        'fields'=>['return_number']],
    'PurchaseRequisition'  => ['type'=>'purchase_requisition','fields'=>['requisition_number','pr_number']],
    'RFQ'                  => ['type'=>'rfq',                 'fields'=>['rfq_number']],
    'PurchaseOrder'        => ['type'=>'purchase_order',      'fields'=>['po_number','purchase_order_number']],
    'GoodsReceiptNote'     => ['type'=>'grn',                 'fields'=>['grn_number','receipt_number']],
    'VendorInvoice'        => ['type'=>'vendor_invoice',      'fields'=>['vendor_invoice_number']],
    'StockMovement'        => ['type'=>'stock_movement',      'fields'=>['movement_number']],
    'StockTransferOrder'   => ['type'=>'stock_transfer',      'fields'=>['sto_number']],
    'JournalEntry'         => ['type'=>'journal_entry',       'fields'=>['journal_number']],
    'Payment'              => ['type'=>'payment',             'fields'=>['payment_number']],
    'ProductionOrder'      => ['type'=>'production_order',    'fields'=>['production_order_number']],
    'WorkOrder'            => ['type'=>'work_order',          'fields'=>['work_order_number']],
    'Project'              => ['type'=>'project',             'fields'=>['project_number']],
    'InspectionLot'        => ['type'=>'inspection_lot',      'fields'=>['inspection_lot_number']],
    'CAPA'                 => ['type'=>'capa',                'fields'=>['capa_number']],
];

const DOCUMENT_PREFIX_MAP = [
    'quotation'=>'QT','sales_order'=>'SO','delivery'=>'DN','invoice'=>'INV',
    'sales_return'=>'SR','purchase_requisition'=>'PR','rfq'=>'RFQ',
    'purchase_order'=>'PO','grn'=>'GRN','vendor_invoice'=>'VINV',
    'stock_movement'=>'SM','stock_transfer'=>'STO','journal_entry'=>'JE',
    'payment'=>'PAY','production_order'=>'PRD','work_order'=>'WO',
    'project'=>'PRJ','inspection_lot'=>'IL','capa'=>'CAPA',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSelectedOrgId(?array $user): ?string {
    return $_SERVER['HTTP_X_ORGANIZATION_ID'] ?? null;
}

function isRecordLocked(array $record): bool {
    foreach (LOCKED_STATUS_FIELDS as $field) {
        $val = strtolower((string)($record[$field] ?? ''));
        if (in_array($val, LOCKED_STATUS_VALUES, true)) return true;
    }
    return false;
}

function getLockedLabel(array $record): string {
    foreach (LOCKED_STATUS_FIELDS as $field) {
        $val = strtolower((string)($record[$field] ?? ''));
        if (in_array($val, LOCKED_STATUS_VALUES, true)) return "$field: {$record[$field]}";
    }
    return 'locked status';
}

function checkPeriodClose(string $entityName, array $record, ?string $orgId): void {
    $config = PERIOD_CONTROLLED_ENTITIES[$entityName] ?? null;
    if (!$config || $entityName === 'PeriodClose') return;

    $postingDate = null;
    foreach ($config['dateFields'] as $f) {
        if (!empty($record[$f])) { $postingDate = substr($record[$f], 0, 10); break; }
    }
    if (!$postingDate) return;

    $tableName = sanitizeTableName('PeriodClose');
    ensureEntityTable($tableName);

    $stmt = getDB()->prepare(
        "SELECT record FROM `{$tableName}` WHERE organization_id = ? OR organization_id IS NULL"
    );
    $stmt->execute([$orgId]);
    $rows = $stmt->fetchAll();

    $periodKey = substr($postingDate, 0, 7);
    foreach ($rows as $row) {
        $p = json_decode($row['record'], true) ?? [];
        if (strtolower($p['status'] ?? '') !== 'closed') continue;
        $module = $p['module'] ?? 'all';
        if ($module !== 'all' && $module !== $config['module']) continue;
        $start = substr($p['period_start'] ?? '', 0, 10);
        $end   = substr($p['period_end']   ?? '', 0, 10);
        if ($start && $end && $postingDate >= $start && $postingDate <= $end) {
            throw new RuntimeException(
                "Posting date $postingDate is inside closed period " . ($p['period_key'] ?? $p['period_name'] ?? 'unknown') . ". Reopen the period in Admin Center before changing this record.",
                422
            );
        }
    }
}

function generateDocumentNumber(string $entityName, array &$record, ?string $orgId): void {
    $config = DOCUMENT_NUMBER_CONFIG[$entityName] ?? null;
    if (!$config) return;

    foreach ($config['fields'] as $f) {
        if (!empty($record[$f])) return;
    }

    $docType     = $config['type'];
    $prefix      = DOCUMENT_PREFIX_MAP[$docType] ?? 'DOC';
    $branchCode  = $record['branch_code'] ?? $record['plant_code'] ?? $record['organization_key'] ?? 'ALL';
    $fiscalYear  = date('y');
    $tableName   = 'document_number_series';
    ensureEntityTable($tableName);

    $db   = getDB();
    $stmt = $db->prepare(
        "SELECT * FROM `{$tableName}`
         WHERE JSON_UNQUOTE(JSON_EXTRACT(record,'$.document_type')) = ?
           AND JSON_UNQUOTE(JSON_EXTRACT(record,'$.branch_code'))   = ?
           AND JSON_UNQUOTE(JSON_EXTRACT(record,'$.fiscal_year'))   = ?
           AND JSON_UNQUOTE(JSON_EXTRACT(record,'$.status'))        = 'active'
         LIMIT 1"
    );
    $stmt->execute([$docType, $branchCode, $fiscalYear]);
    $seriesRow = $stmt->fetch();

    if (!$seriesRow) {
        $sid = generateUUID();
        $sr  = [
            'series_id' => "$prefix-$branchCode-$fiscalYear", 'document_type' => $docType,
            'prefix' => $prefix, 'branch_code' => $branchCode, 'fiscal_year' => $fiscalYear,
            'current_number' => 0, 'starting_number' => 1, 'number_width' => 6, 'status' => 'active',
        ];
        $db->prepare("INSERT INTO `{$tableName}` (id, organization_id, record) VALUES (?,?,?)")
           ->execute([$sid, $orgId, json_encode($sr)]);
        $seriesRow = ['id' => $sid, 'record' => json_encode($sr)];
    }

    $sr         = json_decode($seriesRow['record'], true);
    $nextNum    = ($sr['current_number'] ?? 0) + 1;
    $padded     = str_pad((string)$nextNum, $sr['number_width'] ?? 6, '0', STR_PAD_LEFT);
    $docNumber  = "$prefix-$branchCode-$fiscalYear-$padded";

    $db->prepare("UPDATE `{$tableName}` SET record = JSON_SET(record, '$.current_number', ?, '$.last_generated_number', ?) WHERE id = ?")
       ->execute([$nextNum, $docNumber, $seriesRow['id']]);

    $primaryField = $config['fields'][0];
    $record[$primaryField] = $docNumber;
}

function logAuditTrail(string $entityName, string $entityId, string $action, ?array $before, ?array $after, array $user, ?string $orgId): void {
    if (in_array($entityName, SYSTEM_ENTITIES, true) || !in_array($entityName, AUDITABLE_ENTITIES, true)) return;

    $tableName = sanitizeTableName('AuditTrail');
    ensureEntityTable($tableName);

    $fieldsChanged = [];
    $changes       = null;
    if ($action === 'update' && $before && $after) {
        $skip = ['id','created_at','updated_at'];
        $keys = array_unique(array_merge(array_keys($before), array_keys($after)));
        foreach ($keys as $k) {
            if (in_array($k, $skip, true)) continue;
            if (json_encode($before[$k] ?? null) !== json_encode($after[$k] ?? null)) {
                $fieldsChanged[] = $k;
                $changes['before'][$k] = $before[$k] ?? null;
                $changes['after'][$k]  = $after[$k]  ?? null;
            }
        }
    }

    $auditRecord = [
        'audit_id'        => 'AUD-' . time() . '-' . bin2hex(random_bytes(4)),
        'entity_type'     => sanitizeTableName($entityName),
        'entity_id'       => $entityId,
        'action_type'     => $action,
        'action_timestamp'=> date('c'),
        'user_email'      => $user['email'] ?? 'system',
        'user_name'       => $user['full_name'] ?? $user['email'] ?? 'system',
        'user_role'       => $user['role'] ?? 'user',
        'changes'         => $changes,
        'fields_changed'  => $fieldsChanged,
        'change_summary'  => $action === 'update'
            ? (count($fieldsChanged) ? 'Updated ' . count($fieldsChanged) . ' field(s): ' . implode(', ', $fieldsChanged) : 'Updated record')
            : ucfirst($action) . 'd ' . str_replace('_', ' ', sanitizeTableName($entityName)),
        'severity'        => $action === 'delete' ? 'warning' : 'info',
    ];

    $id = generateUUID();
    getDB()->prepare("INSERT INTO `{$tableName}` (id, organization_id, tenant_id, record) VALUES (?,?,?,?)")
           ->execute([$id, $orgId, $orgId, json_encode($auditRecord)]);
}

// ─── CRUD handlers ──────────────────────────────────────────────────────────

function buildWhereClause(array $filters, ?string $orgId, string $entityName, array $user): array {
    $conditions = [];
    $params     = [];
    $scopeExcluded = in_array($entityName, ORG_SCOPE_EXCLUSIONS, true);
    $isPlatformOwner = $user['is_platform_owner'] ?? false;

    $hasOrgFilter = array_key_exists('organization_id', $filters) || array_key_exists('tenant_id', $filters);

    if (!$scopeExcluded && !$isPlatformOwner && !$hasOrgFilter) {
        if (!$orgId) return [null, []]; // no org = return empty
        $conditions[] = 'organization_id = ?';
        $params[]     = $orgId;
    }

    foreach ($filters as $key => $value) {
        if ($value === null || $value === '') continue;
        if (in_array($key, METADATA_COLUMNS, true)) {
            $conditions[] = "`$key` = ?";
            $params[]     = $value;
        } else {
            $conditions[] = "JSON_UNQUOTE(JSON_EXTRACT(`record`, '$.$key')) = ?";
            $params[]     = (string)$value;
        }
    }

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    return [$where, $params];
}

function listEntities(string $entityName, array $user, array $queryParams): array {
    $tableName = sanitizeTableName($entityName);
    ensureEntityTable($tableName);

    $orgId = $queryParams['organization_id'] ?? getSelectedOrgId($user);
    [$where, $params] = buildWhereClause([], $orgId, $entityName, $user);
    if ($where === null) return [];

    $limit = isset($queryParams['limit']) && (int)$queryParams['limit'] > 0
        ? ' LIMIT ' . (int)$queryParams['limit'] : '';

    $stmt = getDB()->prepare("SELECT * FROM `{$tableName}` {$where} ORDER BY created_at DESC{$limit}");
    $stmt->execute($params);
    $rows = array_map('normalizeRow', $stmt->fetchAll());
    return applyOrgFilter($rows, $entityName, $user);
}

function filterEntities(string $entityName, array $user, array $body): array {
    $tableName = sanitizeTableName($entityName);
    ensureEntityTable($tableName);

    $filters = $body['filters'] ?? [];
    $limit   = isset($body['limit']) && (int)$body['limit'] > 0 ? (int)$body['limit'] : null;
    $sort    = $body['sort'] ?? null;
    $orgId   = $filters['organization_id'] ?? getSelectedOrgId($user);

    [$where, $params] = buildWhereClause($filters, $orgId, $entityName, $user);
    if ($where === null) return [];

    $limitSql = $limit ? " LIMIT $limit" : '';
    $stmt = getDB()->prepare("SELECT * FROM `{$tableName}` {$where} ORDER BY created_at DESC{$limitSql}");
    $stmt->execute($params);
    $rows = array_map('normalizeRow', $stmt->fetchAll());
    $rows = applyOrgFilter($rows, $entityName, $user);
    return $sort ? sortRows($rows, $sort) : $rows;
}

function applyOrgFilter(array $rows, string $entityName, array $user): array {
    if ($entityName !== 'Organization') return $rows;
    if ($user['role'] === 'owner' || $user['role'] === 'admin' || ($user['is_platform_owner'] ?? false)) return $rows;

    return array_values(array_filter($rows, function ($org) use ($user) {
        $allowedEmails = (array)($org['admin_emails'] ?? []);
        $allowedUsers  = (array)($org['authorized_user_ids'] ?? []);
        return ($org['owner_user_id'] ?? '') === $user['id']
            || ($org['owner_email'] ?? '') === $user['email']
            || ($org['created_by_email'] ?? '') === $user['email']
            || in_array($user['email'], $allowedEmails, true)
            || in_array($user['id'], $allowedUsers, true);
    }));
}

function sortRows(array $rows, string $sort): array {
    $fields = array_filter(array_map('trim', explode(',', $sort)));
    usort($rows, function ($a, $b) use ($fields) {
        foreach ($fields as $field) {
            $desc = $field[0] === '-';
            $key  = $desc ? substr($field, 1) : $field;
            $av   = $a[$key] ?? '';
            $bv   = $b[$key] ?? '';
            $cmp  = $av <=> $bv;
            if ($cmp !== 0) return $desc ? -$cmp : $cmp;
        }
        return 0;
    });
    return $rows;
}

function checkSubscriptionLimits(string $entityName, string $orgId, array $user): void {
    if ($user['is_platform_owner'] ?? false) return;
    if (in_array($entityName, ['Subscription', 'Organization', 'SubscriptionPlan', 'User', 'Role'], true)) return;

    $subTable = sanitizeTableName('Subscription');
    ensureEntityTable($subTable);
    $subStmt = getDB()->prepare(
        "SELECT record FROM `{$subTable}` WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1"
    );
    $subStmt->execute([$orgId]);
    $subRow = $subStmt->fetch();
    if (!$subRow) return; // no subscription record yet — allow (onboarding phase)

    $sub = is_string($subRow['record']) ? (json_decode($subRow['record'], true) ?? []) : ($subRow['record'] ?? []);
    $status     = $sub['status'] ?? 'trialing';
    $trialEnd   = $sub['trial_end_date'] ?? null;

    // Block if subscription is blocked
    $blocked = ['expired','cancelled','suspended'];
    if (in_array($status, $blocked, true)) {
        throw new RuntimeException('Your subscription has ended. Upgrade to continue creating records.', 402);
    }

    // Block if trial has expired
    if ($status === 'trialing' && $trialEnd && strtotime($trialEnd) < time()) {
        throw new RuntimeException('Your trial period has ended. Upgrade to continue creating records.', 402);
    }

    // Enforce invoice limit (per calendar month)
    if ($entityName === 'Invoice') {
        $invoiceTable = sanitizeTableName('Invoice');
        ensureEntityTable($invoiceTable);
        $monthStart = date('Y-m-01 00:00:00');
        $cntStmt = getDB()->prepare(
            "SELECT COUNT(*) FROM `{$invoiceTable}` WHERE organization_id = ? AND created_at >= ?"
        );
        $cntStmt->execute([$orgId, $monthStart]);
        $invoiceCount = (int)$cntStmt->fetchColumn();

        $limits   = $sub['limits'] ?? [];
        $maxInv   = isset($limits['invoices_per_month']) ? (int)$limits['invoices_per_month'] : PHP_INT_MAX;
        if ($maxInv > 0 && $maxInv < PHP_INT_MAX && $invoiceCount >= $maxInv) {
            throw new RuntimeException("Monthly invoice limit ({$maxInv}) reached. Upgrade your plan to create more invoices.", 402);
        }
    }

    // Enforce user limit
    if ($entityName === 'User') {
        $userTable = sanitizeTableName('User');
        ensureEntityTable($userTable);
        $cntStmt = getDB()->prepare("SELECT COUNT(*) FROM `{$userTable}` WHERE organization_id = ?");
        $cntStmt->execute([$orgId]);
        $userCount = (int)$cntStmt->fetchColumn();

        $limits   = $sub['limits'] ?? [];
        $maxUsers = isset($limits['users']) ? (int)$limits['users'] : PHP_INT_MAX;
        if ($maxUsers > 0 && $maxUsers < PHP_INT_MAX && $userCount >= $maxUsers) {
            throw new RuntimeException("User limit ({$maxUsers}) reached. Upgrade your plan to add more users.", 402);
        }
    }
}

function createEntity(string $entityName, array $user, array $data): array {
    $tableName = sanitizeTableName($entityName);
    ensureEntityTable($tableName);

    $scopeExcluded = in_array($entityName, ORG_SCOPE_EXCLUSIONS, true);
    $orgId = $data['organization_id'] ?? ($scopeExcluded ? null : getSelectedOrgId($user));

    if (!$scopeExcluded && !$orgId) {
        throw new RuntimeException('Company selection required. Complete onboarding or select a company before creating records.', 422);
    }

    if ($orgId) checkSubscriptionLimits($entityName, $orgId, $user);

    $record = $data;
    if ($orgId) { $record['organization_id'] = $orgId; $record['tenant_id'] = $orgId; }

    generateDocumentNumber($entityName, $record, $orgId);
    checkPeriodClose($entityName, $record, $orgId);

    $id = generateUUID();
    getDB()->prepare(
        "INSERT INTO `{$tableName}` (id, base44_id, tenant_id, organization_id, organization_key, status, source, created_by, record)
         VALUES (?,?,?,?,?,?,?,?,?)"
    )->execute([
        $id,
        $data['base44_id'] ?? null,
        $orgId, $orgId,
        $data['organization_key'] ?? null,
        $record['status'] ?? null,
        $data['source'] ?? 'web',
        $user['email'] ?? null,
        json_encode($record),
    ]);

    $row = fetchRow($tableName, $id);
    $normalized = normalizeRow($row);
    logAuditTrail($entityName, $id, 'create', null, $normalized, $user, $orgId);
    return $normalized;
}

function bulkCreateEntities(string $entityName, array $user, array $records): array {
    return array_map(fn($r) => createEntity($entityName, $user, $r), $records);
}

function updateEntity(string $entityName, string $id, array $user, array $data): array {
    $tableName = sanitizeTableName($entityName);
    ensureEntityTable($tableName);

    $existingRow = fetchRow($tableName, $id);
    if (!$existingRow) throw new RuntimeException('Record not found', 404);
    $existing = normalizeRow($existingRow);

    if (isRecordLocked($existing)) {
        $label = getLockedLabel($existing);
        throw new RuntimeException(
            "This record has $label and cannot be changed. Reverse or reopen it through the approved process.", 422
        );
    }

    $scopeExcluded = in_array($entityName, ORG_SCOPE_EXCLUSIONS, true);
    $orgId = $data['organization_id'] ?? $existingRow['organization_id'] ?? ($scopeExcluded ? null : getSelectedOrgId($user));

    $record = array_merge(
        json_decode($existingRow['record'] ?? '{}', true) ?? [],
        $data
    );
    if ($orgId) { $record['organization_id'] = $orgId; $record['tenant_id'] = $orgId; }

    checkPeriodClose($entityName, $record, $orgId);

    getDB()->prepare(
        "UPDATE `{$tableName}` SET tenant_id=?, organization_id=?, organization_key=?, status=?, updated_by=?, record=? WHERE id=?"
    )->execute([
        $orgId, $orgId,
        $data['organization_key'] ?? $existingRow['organization_key'] ?? null,
        $record['status'] ?? null,
        $user['email'] ?? null,
        json_encode($record),
        $id,
    ]);

    $normalized = normalizeRow(fetchRow($tableName, $id));
    logAuditTrail($entityName, $id, 'update', $existing, $normalized, $user, $orgId);
    return $normalized;
}

function deleteEntity(string $entityName, string $id, array $user): array {
    $tableName = sanitizeTableName($entityName);
    ensureEntityTable($tableName);

    $existingRow = fetchRow($tableName, $id);
    $existing    = $existingRow ? normalizeRow($existingRow) : null;

    if ($existing && isRecordLocked($existing)) {
        $label = getLockedLabel($existing);
        throw new RuntimeException(
            "This record has $label and cannot be deleted. Reverse or reopen it through the approved process.", 422
        );
    }

    getDB()->prepare("DELETE FROM `{$tableName}` WHERE id = ?")->execute([$id]);
    logAuditTrail($entityName, $id, 'delete', $existing, null, $user, $existingRow['organization_id'] ?? null);
    return ['id' => $id];
}

function fetchRow(string $tableName, string $id): ?array {
    $stmt = getDB()->prepare("SELECT * FROM `{$tableName}` WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

<?php

function ensureUsersTable(): void {
    getDB()->exec("CREATE TABLE IF NOT EXISTS `_users` (
        `id`                        VARCHAR(36)  NOT NULL,
        `email`                     VARCHAR(255) NOT NULL,
        `password_hash`             VARCHAR(255) NOT NULL,
        `full_name`                 VARCHAR(255) DEFAULT NULL,
        `is_verified`               TINYINT(1)   NOT NULL DEFAULT 0,
        `verification_token`        VARCHAR(255) DEFAULT NULL,
        `verification_expires`      DATETIME     DEFAULT NULL,
        `reset_token`               VARCHAR(255) DEFAULT NULL,
        `reset_expires`             DATETIME     DEFAULT NULL,
        `terms_accepted_at`         DATETIME     DEFAULT NULL,
        `created_at`                DATETIME     DEFAULT CURRENT_TIMESTAMP,
        `updated_at`                DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        UNIQUE KEY `uk_email` (`email`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Add columns if upgrading from older schema
    $cols = getDB()->query("SHOW COLUMNS FROM `_users`")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('terms_accepted_at', $cols)) {
        getDB()->exec("ALTER TABLE `_users` ADD COLUMN `terms_accepted_at` DATETIME DEFAULT NULL");
    }
}

function ensureRateLimitTable(): void {
    static $done = false;
    if ($done) return;
    getDB()->exec("CREATE TABLE IF NOT EXISTS `_rate_limits` (
        `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
        `bucket`     VARCHAR(255) NOT NULL,
        `hit_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `idx_bucket_hit` (`bucket`, `hit_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $done = true;
}

/**
 * @param string $bucket  e.g. "login:1.2.3.4" or "signup:1.2.3.4"
 * @param int    $maxHits maximum allowed hits within the window
 * @param int    $windowSeconds time window in seconds
 */
function checkRateLimit(string $bucket, int $maxHits, int $windowSeconds): void {
    ensureRateLimitTable();
    $db      = getDB();
    $cutoff  = date('Y-m-d H:i:s', time() - $windowSeconds);

    // Prune old entries (opportunistic, not blocking)
    $db->prepare("DELETE FROM `_rate_limits` WHERE hit_at < ?")->execute([$cutoff]);

    $stmt = $db->prepare("SELECT COUNT(*) FROM `_rate_limits` WHERE bucket = ? AND hit_at >= ?");
    $stmt->execute([$bucket, $cutoff]);
    $count = (int)$stmt->fetchColumn();

    if ($count >= $maxHits) {
        $retryAfter = $windowSeconds;
        header('Retry-After: ' . $retryAfter);
        throw new RuntimeException('Too many requests. Please wait before trying again.', 429);
    }

    $db->prepare("INSERT INTO `_rate_limits` (bucket, hit_at) VALUES (?, NOW())")->execute([$bucket]);
}

function clientIp(): string {
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        $val = $_SERVER[$key] ?? '';
        if ($val) return explode(',', $val)[0];
    }
    return 'unknown';
}

function validatePassword(string $password): void {
    if (strlen($password) < 8) {
        throw new RuntimeException('Password must be at least 8 characters.', 400);
    }
    if (!preg_match('/[A-Z]/', $password)) {
        throw new RuntimeException('Password must contain at least one uppercase letter.', 400);
    }
    if (!preg_match('/[a-z]/', $password)) {
        throw new RuntimeException('Password must contain at least one lowercase letter.', 400);
    }
    if (!preg_match('/[0-9]/', $password)) {
        throw new RuntimeException('Password must contain at least one number.', 400);
    }
}

function buildUserPayload(array $row): array {
    $adminEmails = array_filter(array_map('trim', explode(',', ADMIN_EMAILS)));
    $ownerEmail  = trim(PLATFORM_OWNER_EMAIL);
    $email       = $row['email'];

    $isPlatformOwner = $ownerEmail && strtolower($email) === strtolower($ownerEmail);
    $isAdmin         = $isPlatformOwner || in_array(strtolower($email), array_map('strtolower', $adminEmails), true);

    return [
        'id'               => $row['id'],
        'email'            => $email,
        'email_verified'   => (bool)$row['is_verified'],
        'full_name'        => $row['full_name'] ?? $email,
        'role'             => $isPlatformOwner ? 'owner' : ($isAdmin ? 'admin' : 'user'),
        'is_platform_owner'=> $isPlatformOwner,
        'assigned_roles'   => [],
    ];
}

function getUserById(string $id): array {
    ensureUsersTable();
    $stmt = getDB()->prepare('SELECT * FROM `_users` WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) throw new RuntimeException('User not found', 404);
    return buildUserPayload($row);
}

function handleLogin(array $body): array {
    $ip       = clientIp();
    $email    = trim(strtolower($body['email'] ?? ''));
    $password = $body['password'] ?? '';

    // 10 failed attempts per IP per 15 minutes
    checkRateLimit('login:' . $ip, 10, 900);

    if (!$email || !$password) {
        throw new RuntimeException('Email and password are required', 400);
    }

    ensureUsersTable();
    $stmt = getDB()->prepare('SELECT * FROM `_users` WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        throw new RuntimeException('Invalid email or password', 401);
    }

    if (!$user['is_verified']) {
        throw new RuntimeException('Please verify your email before logging in. Check your inbox for a confirmation link.', 403);
    }

    $userPayload = buildUserPayload($user);
    $token = jwtEncode([
        'id'               => $user['id'],
        'email'            => $user['email'],
        'full_name'        => $user['full_name'],
        'role'             => $userPayload['role'],
        'is_platform_owner'=> $userPayload['is_platform_owner'],
    ]);

    return ['token' => $token, 'user' => $userPayload];
}

function handleSignup(array $body): array {
    $ip       = clientIp();
    $email    = trim(strtolower($body['email'] ?? ''));
    $password = $body['password'] ?? '';
    $fullName = trim($body['full_name'] ?? $body['fullName'] ?? '');
    $plan     = $body['selected_plan'] ?? 'starter';
    $tosAccepted = !empty($body['terms_accepted']);

    // 10 signups per IP per hour
    checkRateLimit('signup:' . $ip, 10, 3600);

    if (!$email || !$password) {
        throw new RuntimeException('Email and password are required', 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('Invalid email address', 400);
    }

    validatePassword($password);

    if (!$tosAccepted) {
        throw new RuntimeException('You must accept the Terms of Service to create an account.', 400);
    }

    ensureUsersTable();
    $check = getDB()->prepare('SELECT id FROM `_users` WHERE email = ? LIMIT 1');
    $check->execute([$email]);
    if ($check->fetch()) {
        throw new RuntimeException('An account with this email already exists', 409);
    }

    $id                  = generateUUID();
    $hash                = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $verificationToken   = bin2hex(random_bytes(32));
    $verificationExpires = date('Y-m-d H:i:s', strtotime('+24 hours'));
    $termsAt             = $tosAccepted ? date('Y-m-d H:i:s') : null;

    $stmt = getDB()->prepare(
        'INSERT INTO `_users` (id, email, password_hash, full_name, is_verified, verification_token, verification_expires, terms_accepted_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)'
    );
    $stmt->execute([$id, $email, $hash, $fullName ?: null, $verificationToken, $verificationExpires, $termsAt]);

    sendVerificationEmail($email, $fullName, $verificationToken);

    return [
        'message'    => 'Account created. Please check your email to verify your address before logging in.',
        'email'      => $email,
        'email_sent' => true,
    ];
}

function handleEmailConfirm(string $token): array {
    if (!$token) {
        throw new RuntimeException('Verification token is missing', 400);
    }

    ensureUsersTable();
    $stmt = getDB()->prepare(
        'SELECT * FROM `_users` WHERE verification_token = ? AND verification_expires > NOW() LIMIT 1'
    );
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        throw new RuntimeException('This confirmation link has expired or is invalid. Request a new one.', 400);
    }

    getDB()->prepare(
        'UPDATE `_users` SET is_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?'
    )->execute([$user['id']]);

    return ['success' => true, 'message' => 'Email verified successfully.'];
}

function handleResendVerification(string $email): array {
    $ip    = clientIp();
    $email = trim(strtolower($email));
    if (!$email) throw new RuntimeException('Email is required', 400);

    // 3 resends per email per hour
    checkRateLimit('resend:' . $email, 3, 3600);

    ensureUsersTable();
    $stmt = getDB()->prepare('SELECT * FROM `_users` WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        return ['message' => 'If an account exists for this email, a confirmation link has been sent.'];
    }
    if ($user['is_verified']) {
        return ['message' => 'This email address is already verified.'];
    }

    $token   = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+24 hours'));
    getDB()->prepare(
        'UPDATE `_users` SET verification_token = ?, verification_expires = ? WHERE id = ?'
    )->execute([$token, $expires, $user['id']]);

    sendVerificationEmail($email, $user['full_name'] ?? '', $token);

    return ['message' => 'A new confirmation link has been sent. Check your inbox.'];
}

function handleForgotPassword(array $body): array {
    $ip    = clientIp();
    $email = trim(strtolower($body['email'] ?? ''));

    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('A valid email address is required.', 400);
    }

    // 3 reset requests per email per hour
    checkRateLimit('forgot:' . $email, 3, 3600);

    ensureUsersTable();
    $stmt = getDB()->prepare('SELECT * FROM `_users` WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Always return success to prevent email enumeration
    if (!$user || !$user['is_verified']) {
        return ['message' => 'If an account exists for this email, a password reset link has been sent.'];
    }

    $token   = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+1 hour'));
    getDB()->prepare(
        'UPDATE `_users` SET reset_token = ?, reset_expires = ? WHERE id = ?'
    )->execute([$token, $expires, $user['id']]);

    sendPasswordResetEmail($email, $user['full_name'] ?? '', $token);

    return ['message' => 'If an account exists for this email, a password reset link has been sent.'];
}

function handleResetPassword(array $body): array {
    $token       = trim($body['token'] ?? '');
    $newPassword = $body['password'] ?? '';

    if (!$token) {
        throw new RuntimeException('Reset token is missing.', 400);
    }

    validatePassword($newPassword);

    ensureUsersTable();
    $stmt = getDB()->prepare(
        'SELECT * FROM `_users` WHERE reset_token = ? AND reset_expires > NOW() LIMIT 1'
    );
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        throw new RuntimeException('This password reset link has expired or is invalid. Request a new one.', 400);
    }

    $hash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
    getDB()->prepare(
        'UPDATE `_users` SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?'
    )->execute([$hash, $user['id']]);

    return ['success' => true, 'message' => 'Your password has been reset. You can now log in.'];
}

function sendVerificationEmail(string $email, string $name, string $token): void {
    $link    = APP_URL . '/auth/confirm?token=' . urlencode($token);
    $appName = 'HORIZON ERP';
    $subject = "Verify your $appName account";
    $body    = "Hello " . ($name ?: 'there') . ",\n\n"
             . "Please verify your email address by clicking the link below:\n\n"
             . "$link\n\n"
             . "This link expires in 24 hours.\n\n"
             . "If you did not create an account, please ignore this email.\n\n"
             . "-- $appName Team";

    $headers = "From: $appName <" . MAIL_FROM . ">\r\n"
             . "Reply-To: " . MAIL_FROM . "\r\n"
             . "X-Mailer: PHP/" . PHP_VERSION;

    @mail($email, $subject, $body, $headers);
}

function sendPasswordResetEmail(string $email, string $name, string $token): void {
    $link    = APP_URL . '/reset-password?token=' . urlencode($token);
    $appName = 'HORIZON ERP';
    $subject = "Reset your $appName password";
    $body    = "Hello " . ($name ?: 'there') . ",\n\n"
             . "We received a request to reset your password. Click the link below to set a new password:\n\n"
             . "$link\n\n"
             . "This link expires in 1 hour. If you did not request a password reset, ignore this email.\n\n"
             . "-- $appName Team";

    $headers = "From: $appName <" . MAIL_FROM . ">\r\n"
             . "Reply-To: " . MAIL_FROM . "\r\n"
             . "X-Mailer: PHP/" . PHP_VERSION;

    @mail($email, $subject, $body, $headers);
}

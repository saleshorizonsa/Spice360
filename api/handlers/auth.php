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
        `created_at`                DATETIME     DEFAULT CURRENT_TIMESTAMP,
        `updated_at`                DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        UNIQUE KEY `uk_email` (`email`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
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
    $email    = trim(strtolower($body['email'] ?? ''));
    $password = $body['password'] ?? '';

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
    $email     = trim(strtolower($body['email'] ?? ''));
    $password  = $body['password'] ?? '';
    $fullName  = trim($body['full_name'] ?? $body['fullName'] ?? '');
    $plan      = $body['selected_plan'] ?? 'starter';

    if (!$email || !$password) {
        throw new RuntimeException('Email and password are required', 400);
    }
    if (strlen($password) < 6) {
        throw new RuntimeException('Password must be at least 6 characters', 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('Invalid email address', 400);
    }

    ensureUsersTable();
    $check = getDB()->prepare('SELECT id FROM `_users` WHERE email = ? LIMIT 1');
    $check->execute([$email]);
    if ($check->fetch()) {
        throw new RuntimeException('An account with this email already exists', 409);
    }

    $id                  = generateUUID();
    $hash                = password_hash($password, PASSWORD_BCRYPT);
    $verificationToken   = bin2hex(random_bytes(32));
    $verificationExpires = date('Y-m-d H:i:s', strtotime('+48 hours'));

    $stmt = getDB()->prepare(
        'INSERT INTO `_users` (id, email, password_hash, full_name, is_verified, verification_token, verification_expires)
         VALUES (?, ?, ?, ?, 0, ?, ?)'
    );
    $stmt->execute([$id, $email, $hash, $fullName ?: null, $verificationToken, $verificationExpires]);

    sendVerificationEmail($email, $fullName, $verificationToken);

    return [
        'message' => 'Account created. Please check your email to verify your address before logging in.',
        'email'   => $email,
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
    $email = trim(strtolower($email));
    if (!$email) throw new RuntimeException('Email is required', 400);

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
    $expires = date('Y-m-d H:i:s', strtotime('+48 hours'));
    getDB()->prepare(
        'UPDATE `_users` SET verification_token = ?, verification_expires = ? WHERE id = ?'
    )->execute([$token, $expires, $user['id']]);

    sendVerificationEmail($email, $user['full_name'] ?? '', $token);

    return ['message' => 'A new confirmation link has been sent. Check your inbox.'];
}

function sendVerificationEmail(string $email, string $name, string $token): void {
    $link    = APP_URL . '/auth/confirm?token=' . urlencode($token);
    $appName = 'HORIZON ERP';
    $subject = "Verify your $appName account";
    $body    = "Hello " . ($name ?: 'there') . ",\n\n"
             . "Please verify your email address by clicking the link below:\n\n"
             . "$link\n\n"
             . "This link expires in 48 hours.\n\n"
             . "If you did not create an account, please ignore this email.\n\n"
             . "-- $appName Team";

    $headers = "From: $appName <" . MAIL_FROM . ">\r\n"
             . "Reply-To: " . MAIL_FROM . "\r\n"
             . "X-Mailer: PHP/" . PHP_VERSION;

    @mail($email, $subject, $body, $headers);
}

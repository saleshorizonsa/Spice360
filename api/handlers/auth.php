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
    $profileCols = [
        'phone'               => "VARCHAR(50) DEFAULT NULL",
        'job_title'           => "VARCHAR(100) DEFAULT NULL",
        'department'          => "VARCHAR(100) DEFAULT NULL",
        'language_preference' => "VARCHAR(10) NOT NULL DEFAULT 'en'",
        'timezone'            => "VARCHAR(50) NOT NULL DEFAULT 'Asia/Riyadh'",
    ];
    foreach ($profileCols as $col => $def) {
        if (!in_array($col, $cols)) {
            getDB()->exec("ALTER TABLE `_users` ADD COLUMN `{$col}` {$def}");
        }
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
        'id'                  => $row['id'],
        'email'               => $email,
        'email_verified'      => (bool)$row['is_verified'],
        'full_name'           => $row['full_name'] ?? $email,
        'role'                => $isPlatformOwner ? 'owner' : ($isAdmin ? 'admin' : 'user'),
        'is_platform_owner'   => $isPlatformOwner,
        'assigned_roles'      => [],
        'phone'               => $row['phone'] ?? null,
        'job_title'           => $row['job_title'] ?? null,
        'department'          => $row['department'] ?? null,
        'language_preference' => $row['language_preference'] ?? 'en',
        'timezone'            => $row['timezone'] ?? 'Asia/Riyadh',
        'terms_accepted_at'   => $row['terms_accepted_at'] ?? null,
        'created_at'          => $row['created_at'] ?? null,
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
        throw new RuntimeException('Invalid email or password', 400);
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

function handleChangePassword(array $body, array $authUser): array {
    $oldPassword = $body['old_password'] ?? '';
    $newPassword = $body['new_password'] ?? '';

    if (!$oldPassword || !$newPassword) {
        throw new RuntimeException('Old and new passwords are required.', 400);
    }

    validatePassword($newPassword);

    ensureUsersTable();
    $stmt = getDB()->prepare('SELECT * FROM `_users` WHERE id = ? LIMIT 1');
    $stmt->execute([$authUser['id']]);
    $user = $stmt->fetch();

    if (!$user) {
        throw new RuntimeException('User not found.', 404);
    }

    if (!password_verify($oldPassword, $user['password_hash'])) {
        throw new RuntimeException('Current password is incorrect.', 400);
    }

    if ($oldPassword === $newPassword) {
        throw new RuntimeException('New password must be different from your current password.', 400);
    }

    $hash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
    getDB()->prepare('UPDATE `_users` SET password_hash = ? WHERE id = ?')
           ->execute([$hash, $user['id']]);

    sendPasswordChangedEmail($user['email'], $user['full_name'] ?? '');

    return ['success' => true, 'message' => 'Password changed successfully. A confirmation email has been sent.'];
}

function buildHtmlEmail(string $heading, string $bodyHtml, string $ctaUrl = '', string $ctaLabel = ''): string {
    $appName = 'HORIZON ERP';
    $year    = date('Y');
    $cta     = '';
    if ($ctaUrl && $ctaLabel) {
        $safeUrl   = htmlspecialchars($ctaUrl, ENT_QUOTES, 'UTF-8');
        $safeLabel = htmlspecialchars($ctaLabel, ENT_QUOTES, 'UTF-8');
        $cta = <<<HTML
        <tr>
            <td align="center" style="padding:24px 0 8px;">
                <a href="{$safeUrl}" style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">{$safeLabel}</a>
            </td>
        </tr>
HTML;
    }
    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
            <!-- Header -->
            <tr>
                <td style="background:#1d4ed8;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
                    <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">{$appName}</span>
                </td>
            </tr>
            <!-- Body -->
            <tr>
                <td style="background:#ffffff;padding:40px 40px 8px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;">{$heading}</h1>
                    {$bodyHtml}
                </td>
            </tr>
            <!-- CTA -->
            {$cta}
            <!-- Footer -->
            <tr>
                <td style="background:#ffffff;padding:24px 40px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;border-radius:0 0 12px 12px;">
                    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">&copy; {$year} {$appName}. All rights reserved.</p>
                </td>
            </tr>
        </table>
    </td></tr>
</table>
</body>
</html>
HTML;
}

function htmlMailHeaders(): string {
    $appName = 'HORIZON ERP';
    return "MIME-Version: 1.0\r\n"
         . "Content-Type: text/html; charset=UTF-8\r\n"
         . "From: {$appName} <" . MAIL_FROM . ">\r\n"
         . "Reply-To: " . MAIL_FROM . "\r\n"
         . "X-Mailer: PHP/" . PHP_VERSION;
}

function sendPasswordChangedEmail(string $email, string $name): void {
    $greeting  = htmlspecialchars($name ?: 'there', ENT_QUOTES, 'UTF-8');
    $resetUrl  = htmlspecialchars(APP_URL . '/reset-password', ENT_QUOTES, 'UTF-8');
    $bodyHtml  = <<<HTML
        <p style="color:#334155;font-size:15px;line-height:1.7;">Hello {$greeting},</p>
        <p style="color:#334155;font-size:15px;line-height:1.7;">Your HORIZON ERP password was <strong>successfully changed</strong>.</p>
        <p style="color:#334155;font-size:15px;line-height:1.7;">If you did not make this change, please reset your password immediately:</p>
        <p style="margin:0 0 8px;"><a href="{$resetUrl}" style="color:#1d4ed8;">{$resetUrl}</a></p>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px;">If you made this change yourself, no further action is needed.</p>
HTML;
    $subject   = 'Your HORIZON ERP password has been changed';
    $html      = buildHtmlEmail('Password Changed', $bodyHtml);
    @mail($email, $subject, $html, htmlMailHeaders());
}

function sendVerificationEmail(string $email, string $name, string $token): void {
    $link      = APP_URL . '/auth/confirm?token=' . urlencode($token);
    $greeting  = htmlspecialchars($name ?: 'there', ENT_QUOTES, 'UTF-8');
    $bodyHtml  = <<<HTML
        <p style="color:#334155;font-size:15px;line-height:1.7;">Hello {$greeting},</p>
        <p style="color:#334155;font-size:15px;line-height:1.7;">Thanks for signing up! Click the button below to verify your email address and activate your account.</p>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px;">This link expires in <strong>24 hours</strong>. If you did not create an account, you can safely ignore this email.</p>
HTML;
    $subject   = 'Verify your HORIZON ERP account';
    $html      = buildHtmlEmail('Confirm Your Email', $bodyHtml, $link, 'Verify Email Address');
    @mail($email, $subject, $html, htmlMailHeaders());
}

function handleAcceptInvite(array $body): array {
    $email    = trim(strtolower($body['email'] ?? ''));
    $password = $body['password'] ?? '';
    $fullName = trim($body['full_name'] ?? '');

    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('A valid email address is required.', 400);
    }

    validatePassword($password);
    ensureUsersTable();

    $stmt = getDB()->prepare('SELECT id FROM `_users` WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        throw new RuntimeException('This email is already registered. Please log in instead.', 409);
    }

    $id      = generateUUID();
    $hash    = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $termsAt = date('Y-m-d H:i:s');

    getDB()->prepare(
        'INSERT INTO `_users` (id, email, password_hash, full_name, is_verified, terms_accepted_at)
         VALUES (?, ?, ?, ?, 1, ?)'
    )->execute([$id, $email, $hash, $fullName ?: null, $termsAt]);

    $userPayload = getUserById($id);
    $token = jwtEncode([
        'id'               => $id,
        'email'            => $email,
        'full_name'        => $fullName ?: null,
        'role'             => $userPayload['role'],
        'is_platform_owner'=> $userPayload['is_platform_owner'],
    ]);

    return ['token' => $token, 'user' => $userPayload];
}

function handleSendInvite(array $body, array $authUser): array {
    $email      = trim(strtolower($body['email'] ?? ''));
    $fullName   = trim($body['full_name'] ?? '');
    $inviteLink = trim($body['invite_link'] ?? '');

    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('A valid email address is required.', 400);
    }
    if (!$inviteLink) {
        throw new RuntimeException('Invite link is required.', 400);
    }

    $greeting    = htmlspecialchars($fullName ?: 'there', ENT_QUOTES, 'UTF-8');
    $inviterName = htmlspecialchars($authUser['full_name'] ?? 'Your administrator', ENT_QUOTES, 'UTF-8');
    $bodyHtml    = <<<HTML
        <p style="color:#334155;font-size:15px;line-height:1.7;">Hello {$greeting},</p>
        <p style="color:#334155;font-size:15px;line-height:1.7;"><strong>{$inviterName}</strong> has invited you to join <strong>HORIZON ERP</strong>.</p>
        <p style="color:#334155;font-size:15px;line-height:1.7;">Click the button below to set your password and access the system. This link is unique to you — do not share it.</p>
HTML;
    $subject  = 'You\'ve been invited to HORIZON ERP';
    $html     = buildHtmlEmail('You\'re Invited!', $bodyHtml, $inviteLink, 'Accept Invitation');
    @mail($email, $subject, $html, htmlMailHeaders());

    return ['success' => true, 'message' => "Invitation sent to $email."];
}

function handleUpdateProfile(array $body, array $authUser): array {
    ensureUsersTable();

    $allowedFields = ['full_name', 'phone', 'job_title', 'department', 'language_preference', 'timezone'];
    $setClauses = [];
    $values     = [];

    foreach ($allowedFields as $field) {
        if (!array_key_exists($field, $body)) continue;
        $value = $body[$field];

        if ($field === 'full_name') {
            $value = trim($value ?? '');
            if ($value === '') throw new RuntimeException('Full name cannot be empty.', 400);
        }
        if ($field === 'language_preference' && !in_array($value, ['en', 'ar'], true)) {
            throw new RuntimeException('Language must be "en" or "ar".', 400);
        }

        $setClauses[] = "`{$field}` = ?";
        $values[]     = $value;
    }

    if (empty($setClauses)) {
        throw new RuntimeException('No valid profile fields provided.', 400);
    }

    $values[] = $authUser['id'];
    getDB()->prepare("UPDATE `_users` SET " . implode(', ', $setClauses) . " WHERE id = ?")
           ->execute($values);

    return getUserById($authUser['id']);
}

function sendPasswordResetEmail(string $email, string $name, string $token): void {
    $link     = APP_URL . '/reset-password?token=' . urlencode($token);
    $greeting = htmlspecialchars($name ?: 'there', ENT_QUOTES, 'UTF-8');
    $bodyHtml = <<<HTML
        <p style="color:#334155;font-size:15px;line-height:1.7;">Hello {$greeting},</p>
        <p style="color:#334155;font-size:15px;line-height:1.7;">We received a request to reset your HORIZON ERP password. Click the button below to choose a new one.</p>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px;">This link expires in <strong>1 hour</strong>. If you did not request a password reset, ignore this email — your account is safe.</p>
HTML;
    $subject  = 'Reset your HORIZON ERP password';
    $html     = buildHtmlEmail('Reset Your Password', $bodyHtml, $link, 'Reset Password');
    @mail($email, $subject, $html, htmlMailHeaders());
}

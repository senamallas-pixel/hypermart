<?php
/**
 * /auth/* — register, login, forgot-password, reset-password.
 */
class AuthController
{
    public static function register(Router $r): void
    {
        $r->post('/auth/register',        [self::class, 'doRegister']);
        $r->post('/auth/login',           [self::class, 'doLogin']);
        $r->post('/auth/forgot-password', [self::class, 'forgotPassword']);
        $r->post('/auth/reset-password',  [self::class, 'resetPassword']);
    }

    public static function doRegister(array $p): void
    {
        $b = Request::body();
        $email = Validation::email((string) Validation::require($b, 'email'));
        $password = Validation::password((string) Validation::require($b, 'password'));
        $displayName = trim((string) Validation::require($b, 'display_name'));
        if (strlen($displayName) < 2) {
            throw new ApiException(422, 'Name must be at least 2 characters');
        }
        $phone = $b['phone'] ?? null;
        $role  = $b['role'] ?? 'customer';
        if (!in_array($role, Enums::USER_ROLE, true)) {
            $role = 'customer';
        }

        if (Database::one('SELECT id FROM users WHERE email = :e', ['e' => $email])) {
            throw new ApiException(400, 'Email already registered');
        }

        if ($email === ADMIN_EMAIL) {
            $role = 'admin';
        }

        $now = now_utc();
        $userId = Database::insert('users', [
            'uid'           => self::uuid4(),
            'email'         => $email,
            'display_name'  => $displayName,
            'phone'         => $phone,
            'role'          => $role,
            'password_hash' => Auth::hashPassword($password),
            'created_at'    => $now,
            'last_login'    => $now,
        ]);

        // Owners get a free 1-month active subscription on registration
        if ($role === 'owner') {
            Database::insert('subscriptions', [
                'user_id'     => $userId,
                'plan_amount' => SUBSCRIPTION_AMOUNT,
                'status'      => 'active',
                'starts_at'   => $now,
                'expires_at'  => gmdate('Y-m-d H:i:s', time() + 30 * 86400),
                'created_at'  => $now,
            ]);
        }

        $user = Database::one('SELECT * FROM users WHERE id = :id', ['id' => $userId]);
        $token = Auth::createToken($userId);
        Response::json([
            'access_token' => $token,
            'token_type'   => 'bearer',
            'user'         => Present::user($user),
        ], 201);
    }

    public static function doLogin(array $p): void
    {
        $b = Request::body();
        $email = Validation::email((string) Validation::require($b, 'email'));
        $password = (string) Validation::require($b, 'password');

        $user = Database::one('SELECT * FROM users WHERE email = :e', ['e' => $email]);
        if (!$user || !Auth::verifyPassword($password, $user['password_hash'])) {
            throw new ApiException(401, 'Invalid email or password');
        }

        $update = ['last_login' => now_utc()];
        if ($user['email'] === ADMIN_EMAIL && $user['role'] !== 'admin') {
            $update['role'] = 'admin';
            $user['role'] = 'admin';
        }
        Database::update('users', $update, 'id = :id', ['id' => $user['id']]);

        $token = Auth::createToken((int) $user['id']);
        Response::json([
            'access_token' => $token,
            'token_type'   => 'bearer',
            'user'         => Present::user($user),
        ]);
    }

    public static function forgotPassword(array $p): void
    {
        $b = Request::body();
        $email = (string) ($b['email'] ?? '');
        $user = Database::one('SELECT * FROM users WHERE email = :e', ['e' => $email]);
        if ($user) {
            $token = self::tokenUrlSafe(32);
            Database::insert('password_reset_tokens', [
                'user_id'    => $user['id'],
                'token'      => $token,
                'expires_at' => gmdate('Y-m-d H:i:s', time() + 3600),
                'used'       => 0,
            ]);
            error_log("[PASSWORD RESET] Token for {$user['email']}: $token");
        }
        Response::json(['ok' => true]);
    }

    public static function resetPassword(array $p): void
    {
        $b = Request::body();
        $token = (string) Validation::require($b, 'token');
        $newPassword = Validation::password((string) Validation::require($b, 'new_password'));

        $record = Database::one('SELECT * FROM password_reset_tokens WHERE token = :t AND used = 0', ['t' => $token]);
        if (!$record || strtotime($record['expires_at']) < time()) {
            throw new ApiException(400, 'Invalid or expired reset token');
        }
        $user = Database::one('SELECT * FROM users WHERE id = :id', ['id' => $record['user_id']]);
        if (!$user) {
            throw new ApiException(400, 'User not found');
        }
        Database::update('users', ['password_hash' => Auth::hashPassword($newPassword)], 'id = :id', ['id' => $user['id']]);
        Database::update('password_reset_tokens', ['used' => 1], 'id = :id', ['id' => $record['id']]);
        Response::json(['ok' => true]);
    }

    // ── helpers ──
    public static function uuid4(): string
    {
        $d = random_bytes(16);
        $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
        $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
    }

    private static function tokenUrlSafe(int $bytes): string
    {
        return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
    }
}

<?php
/**
 * JWT (HS256) + password hashing + auth context, mirroring the Python backend.
 * Token payload: {"sub": "<user_id>", "exp": <unix>}.  30-day expiry.
 * Passwords use PHP bcrypt (fresh DB, no legacy hashes to migrate).
 */
class Auth
{
    private static ?array $cachedUser = null;
    private static bool $resolved = false;

    private static function secret(): string
    {
        return env('JWT_SECRET', 'hypermart-dev-secret-change-in-production');
    }

    // ── base64url ──
    private static function b64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function b64UrlDecode(string $data): string
    {
        $pad = strlen($data) % 4;
        if ($pad) $data .= str_repeat('=', 4 - $pad);
        return base64_decode(strtr($data, '-_', '+/'));
    }

    public static function hashPassword(string $plain): string
    {
        return password_hash($plain, PASSWORD_BCRYPT);
    }

    public static function verifyPassword(string $plain, ?string $hash): bool
    {
        if (!$hash) return false;
        return password_verify($plain, $hash);
    }

    public static function createToken(int $userId): string
    {
        $header  = ['alg' => 'HS256', 'typ' => 'JWT'];
        $payload = ['sub' => (string) $userId, 'exp' => time() + TOKEN_EXPIRY_DAYS * 86400];
        $segments = [
            self::b64UrlEncode(json_encode($header)),
            self::b64UrlEncode(json_encode($payload)),
        ];
        $signing   = implode('.', $segments);
        $signature = hash_hmac('sha256', $signing, self::secret(), true);
        $segments[] = self::b64UrlEncode($signature);
        return implode('.', $segments);
    }

    /** Decode + verify a JWT. Returns payload array or null if invalid/expired. */
    public static function decodeToken(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$h, $p, $s] = $parts;
        $expected = self::b64UrlEncode(hash_hmac('sha256', "$h.$p", self::secret(), true));
        if (!hash_equals($expected, $s)) return null;
        $payload = json_decode(self::b64UrlDecode($p), true);
        if (!is_array($payload)) return null;
        if (isset($payload['exp']) && time() >= (int) $payload['exp']) return null;
        return $payload;
    }

    /** Resolve the authenticated user from the Bearer token (or null). */
    public static function optionalUser(): ?array
    {
        if (self::$resolved) return self::$cachedUser;
        self::$resolved = true;
        $token = Request::bearerToken();
        if (!$token) return self::$cachedUser = null;
        $payload = self::decodeToken($token);
        if (!$payload || !isset($payload['sub'])) return self::$cachedUser = null;
        $user = Database::one('SELECT * FROM users WHERE id = :id', ['id' => (int) $payload['sub']]);
        if (!$user) return self::$cachedUser = null;
        // Always enforce admin role for the admin email
        if ($user['email'] === ADMIN_EMAIL && $user['role'] !== 'admin') {
            Database::update('users', ['role' => 'admin'], 'id = :id', ['id' => $user['id']]);
            $user['role'] = 'admin';
        }
        return self::$cachedUser = $user;
    }

    /** Require a logged-in user (401 otherwise). */
    public static function requireUser(): array
    {
        $token = Request::bearerToken();
        if (!$token) {
            throw new ApiException(401, 'Not authenticated');
        }
        $payload = self::decodeToken($token);
        if (!$payload || !isset($payload['sub'])) {
            throw new ApiException(401, 'Invalid or expired token');
        }
        $user = Database::one('SELECT * FROM users WHERE id = :id', ['id' => (int) $payload['sub']]);
        if (!$user) {
            throw new ApiException(401, 'User not found');
        }
        if ($user['email'] === ADMIN_EMAIL && $user['role'] !== 'admin') {
            Database::update('users', ['role' => 'admin'], 'id = :id', ['id' => $user['id']]);
            $user['role'] = 'admin';
        }
        self::$cachedUser = $user;
        self::$resolved = true;
        return $user;
    }

    /** Require one of the given roles (403 otherwise). */
    public static function requireRole(string ...$roles): array
    {
        $user = self::requireUser();
        if (!in_array($user['role'], $roles, true)) {
            throw new ApiException(403, 'Insufficient permissions');
        }
        return $user;
    }

    /** Raise 402 if an owner has no active subscription (admins exempt). */
    public static function checkSubscription(array $user): void
    {
        if ($user['role'] !== 'owner') return;
        $sub = Database::one('SELECT * FROM subscriptions WHERE user_id = :u', ['u' => $user['id']]);
        if (!$sub || $sub['status'] !== 'active') {
            throw new ApiException(402, 'Active subscription required. Subscribe for ₹10/month to manage shops.');
        }
        if (!empty($sub['expires_at']) && strtotime($sub['expires_at']) < time()) {
            Database::update('subscriptions', ['status' => 'expired'], 'id = :id', ['id' => $sub['id']]);
            throw new ApiException(402, 'Your subscription has expired. Please renew for ₹10/month.');
        }
    }

    /** Ownership check: admin always passes; owner must own the shop. */
    public static function assertShopOwnership(array $shop, array $user): void
    {
        if ($user['role'] === 'admin') return;
        if ($user['role'] === 'owner' && (int) $shop['owner_id'] === (int) $user['id']) return;
        throw new ApiException(403, 'Not authorised for this shop');
    }
}

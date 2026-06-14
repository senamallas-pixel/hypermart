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
        Notifier::notify($userId, 'welcome', 'Welcome to HyperMart!',
            'Your account has been created. Browse shops near you and start ordering.', null);
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

        // Login notification (in-app + email together) — with device + location
        $ip = self::clientIp();
        $device = self::parseDevice($_SERVER['HTTP_USER_AGENT'] ?? '');
        $location = self::geoLocate($ip);
        $msg = 'Signed in on ' . gmdate('d M Y \a\t H:i') . " UTC.\nDevice: $device";
        if ($location) $msg .= "\nLocation: $location";
        if ($ip)       $msg .= "\nIP: $ip";
        $msg .= "\nIf this wasn't you, change your password.";
        Notifier::notify((int) $user['id'], 'login', 'New sign-in to your HyperMart account', $msg, null);

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

    /** Best-effort real client IP (handles Cloudflare / proxy headers). */
    public static function clientIp(): string
    {
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'] as $k) {
            if (!empty($_SERVER[$k])) {
                $ip = trim(explode(',', $_SERVER[$k])[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }
        return '';
    }

    /** Parse a User-Agent string into "Browser on OS". */
    public static function parseDevice(string $ua): string
    {
        if ($ua === '') return 'Unknown device';
        $os = 'Unknown OS';
        if (stripos($ua, 'Windows') !== false)      $os = 'Windows';
        elseif (stripos($ua, 'iPhone') !== false || stripos($ua, 'iPad') !== false) $os = 'iOS';
        elseif (stripos($ua, 'Mac OS') !== false)   $os = 'macOS';
        elseif (stripos($ua, 'Android') !== false)  $os = 'Android';
        elseif (stripos($ua, 'Linux') !== false)    $os = 'Linux';

        $browser = 'Unknown browser';
        if (stripos($ua, 'Edg') !== false)                                      $browser = 'Edge';
        elseif (stripos($ua, 'OPR') !== false || stripos($ua, 'Opera') !== false) $browser = 'Opera';
        elseif (stripos($ua, 'Chrome') !== false)                               $browser = 'Chrome';
        elseif (stripos($ua, 'Firefox') !== false)                              $browser = 'Firefox';
        elseif (stripos($ua, 'Safari') !== false)                               $browser = 'Safari';

        return "$browser on $os";
    }

    /** Geolocate a public IP via ip-api.com (free). Empty for private/local IPs or on failure. */
    public static function geoLocate(string $ip): string
    {
        if ($ip === '' || !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return '';
        }
        try {
            $ch = curl_init("http://ip-api.com/json/$ip?fields=status,country,regionName,city");
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 4]);
            $resp = curl_exec($ch);
            curl_close($ch);
            $j = json_decode($resp ?: '', true);
            if (($j['status'] ?? '') === 'success') {
                return trim(implode(', ', array_filter([$j['city'] ?? '', $j['regionName'] ?? '', $j['country'] ?? ''])));
            }
        } catch (Throwable $e) {
            error_log('[geoLocate] ' . $e->getMessage());
        }
        return '';
    }
}

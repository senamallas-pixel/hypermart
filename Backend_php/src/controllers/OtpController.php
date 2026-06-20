<?php
/**
 * /auth/otp/* — phone OTP via Fast2SMS.
 *   POST /auth/otp/send   {phone, purpose}            -> sends a 6-digit code
 *   POST /auth/otp/verify {phone, code, purpose, ...} -> verifies; action by purpose
 *
 * purpose:
 *   login   -> find or create a customer by phone, return JWT (login + signup in one)
 *   signup  -> just confirm the phone (frontend then submits /auth/register)
 *   reset   -> return a password reset token for /auth/reset-password
 */
class OtpController
{
    public static function register(Router $r): void
    {
        $r->post('/auth/otp/send',   [self::class, 'send']);
        $r->post('/auth/otp/verify', [self::class, 'verify']);
    }

    public static function send(array $p): void
    {
        $b = Request::body();
        $phone = Sms::normalize((string) Validation::require($b, 'phone'));
        $purpose = in_array($b['purpose'] ?? 'login', ['login', 'signup', 'reset'], true) ? $b['purpose'] : 'login';
        if (!Sms::isValid($phone)) {
            throw new ApiException(422, 'Enter a valid 10-digit mobile number');
        }

        // Password reset: only send if an account with this phone exists, but don't reveal that.
        if ($purpose === 'reset' && !Database::one('SELECT id FROM users WHERE phone = :p', ['p' => $phone])) {
            Response::json(['ok' => true]);
        }

        // Rate limiting per phone.
        $last = Database::one('SELECT created_at FROM otp_codes WHERE phone = :p ORDER BY id DESC LIMIT 1', ['p' => $phone]);
        if ($last && (time() - strtotime($last['created_at'])) < 30) {
            throw new ApiException(429, 'Please wait a few seconds before requesting another OTP.');
        }
        $hourCount = (int) Database::scalar(
            'SELECT COUNT(*) FROM otp_codes WHERE phone = :p AND created_at >= :t',
            ['p' => $phone, 't' => gmdate('Y-m-d H:i:s', time() - 3600)]
        );
        if ($hourCount >= 5) {
            throw new ApiException(429, 'Too many OTP requests. Please try again later.');
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        Database::insert('otp_codes', [
            'phone'      => $phone,
            'code_hash'  => password_hash($code, PASSWORD_BCRYPT),
            'purpose'    => $purpose,
            'expires_at' => gmdate('Y-m-d H:i:s', time() + 300),  // 5 minutes
            'created_at' => now_utc(),
        ]);

        $sent = Sms::sendOtp($phone, $code);
        $resp = ['ok' => true];
        // Local/dev fallback so the flow is testable without a live SMS balance.
        if (strtolower(env('OTP_DEBUG', '')) === 'true') {
            $resp['dev_code'] = $code;
        } elseif (!$sent) {
            throw new ApiException(502, 'Could not send the OTP. Please try again.');
        }
        Response::json($resp);
    }

    public static function verify(array $p): void
    {
        $b = Request::body();
        $phone = Sms::normalize((string) Validation::require($b, 'phone'));
        $code = trim((string) Validation::require($b, 'code'));
        $purpose = in_array($b['purpose'] ?? 'login', ['login', 'signup', 'reset'], true) ? $b['purpose'] : 'login';

        $rec = Database::one(
            'SELECT * FROM otp_codes WHERE phone = :p AND purpose = :pu AND used = 0 ORDER BY id DESC LIMIT 1',
            ['p' => $phone, 'pu' => $purpose]
        );
        if (!$rec || strtotime($rec['expires_at']) < time()) {
            throw new ApiException(400, 'OTP expired. Please request a new one.');
        }
        if ((int) $rec['attempts'] >= 5) {
            throw new ApiException(429, 'Too many wrong attempts. Please request a new OTP.');
        }
        if (!password_verify($code, $rec['code_hash'])) {
            Database::update('otp_codes', ['attempts' => (int) $rec['attempts'] + 1], 'id = :id', ['id' => $rec['id']]);
            throw new ApiException(400, 'Incorrect OTP.');
        }
        Database::update('otp_codes', ['used' => 1], 'id = :id', ['id' => $rec['id']]);

        // signup: phone confirmed; frontend proceeds to /auth/register.
        if ($purpose === 'signup') {
            Response::json(['ok' => true, 'verified' => true, 'phone' => $phone]);
        }

        // reset: hand back a reset token for the existing /auth/reset-password flow.
        if ($purpose === 'reset') {
            $user = Database::one('SELECT * FROM users WHERE phone = :p', ['p' => $phone]);
            if (!$user) throw new ApiException(404, 'No account found for this number.');
            $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
            Database::insert('password_reset_tokens', [
                'user_id'    => $user['id'],
                'token'      => $token,
                'expires_at' => gmdate('Y-m-d H:i:s', time() + 900),  // 15 min
                'used'       => 0,
            ]);
            Response::json(['ok' => true, 'reset_token' => $token]);
        }

        // login (= login + signup): find or create a customer by phone, return JWT.
        $user = Database::one('SELECT * FROM users WHERE phone = :p', ['p' => $phone]);
        if (!$user) {
            $displayName = trim((string) ($b['display_name'] ?? '')) ?: ('User ' . substr($phone, -4));
            $email = $phone . '@phone.hypershopindia.com';
            $id = Database::insert('users', [
                'uid'           => AuthController::uuid4(),
                'email'         => $email,
                'display_name'  => $displayName,
                'phone'         => $phone,
                'role'          => 'customer',
                'password_hash' => null,
                'created_at'    => now_utc(),
                'last_login'    => now_utc(),
            ]);
            $user = Database::one('SELECT * FROM users WHERE id = :id', ['id' => $id]);
            Notifier::notify((int) $id, 'welcome', 'Welcome to HyperShopIndia!', 'Your account was created via phone login.', null);
        } else {
            Database::update('users', ['last_login' => now_utc()], 'id = :id', ['id' => $user['id']]);
        }

        $token = Auth::createToken((int) $user['id']);
        Response::json([
            'access_token' => $token,
            'token_type'   => 'bearer',
            'user'         => Present::user($user),
        ]);
    }
}

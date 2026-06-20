<?php
/**
 * SMS via Fast2SMS (https://www.fast2sms.com). Uses the OTP route for one-time
 * codes and the quick (q) route for transactional text (order confirmations).
 * Configured with FAST2SMS_API_KEY in the environment.
 */
class Sms
{
    public static function apiKey(): string { return env('FAST2SMS_API_KEY', ''); }
    public static function available(): bool { return self::apiKey() !== ''; }

    /** Reduce a phone to a bare 10-digit Indian number (strips +91, spaces, etc.). */
    public static function normalize(string $p): string
    {
        $d = preg_replace('/\D+/', '', $p);
        if (strlen($d) > 10 && substr($d, 0, 2) === '91') $d = substr($d, -10);
        return $d;
    }

    public static function isValid(string $p): bool
    {
        $d = self::normalize($p);
        return (bool) preg_match('/^[6-9]\d{9}$/', $d);
    }

    /** Send a numeric OTP via Fast2SMS "otp" route. Returns true on success. */
    public static function sendOtp(string $phone, string $code): bool
    {
        if (!self::available()) { error_log('[SMS] FAST2SMS_API_KEY not set'); return false; }
        $url = 'https://www.fast2sms.com/dev/bulkV2?' . http_build_query([
            'authorization'    => self::apiKey(),
            'route'            => 'otp',
            'variables_values' => $code,
            'numbers'          => self::normalize($phone),
            'flash'            => 0,
        ]);
        return self::get($url);
    }

    /** Send a plain transactional message via the quick "q" route (best-effort). */
    public static function sendText(string $phone, string $message): bool
    {
        if (!self::available()) return false;
        $ch = curl_init('https://www.fast2sms.com/dev/bulkV2');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['authorization: ' . self::apiKey(), 'Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_POSTFIELDS     => http_build_query([
                'route'    => 'q',
                'message'  => $message,
                'language' => 'english',
                'numbers'  => self::normalize($phone),
            ]),
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return self::ok($resp, $code);
    }

    private static function get(string $url): bool
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return self::ok($resp, $code);
    }

    private static function ok($resp, int $httpCode): bool
    {
        $j = json_decode($resp ?: '', true);
        $ok = $httpCode < 400 && is_array($j) && ($j['return'] ?? false) === true;
        if (!$ok) error_log('[SMS] Fast2SMS failed (HTTP ' . $httpCode . '): ' . substr((string) $resp, 0, 200));
        return $ok;
    }
}

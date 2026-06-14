<?php
/**
 * Request accessors: JSON body, query params, route params.
 */
class Request
{
    private static ?array $body = null;

    /** Parsed JSON body (cached). */
    public static function body(): array
    {
        if (self::$body === null) {
            $raw = file_get_contents('php://input');
            $decoded = json_decode($raw ?: '', true);
            self::$body = is_array($decoded) ? $decoded : [];
        }
        return self::$body;
    }

    public static function input(string $key, $default = null)
    {
        $b = self::body();
        return array_key_exists($key, $b) ? $b[$key] : $default;
    }

    public static function query(string $key, $default = null)
    {
        return array_key_exists($key, $_GET) ? $_GET[$key] : $default;
    }

    public static function bearerToken(): ?string
    {
        $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!$hdr && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            foreach ($headers as $k => $v) {
                if (strtolower($k) === 'authorization') { $hdr = $v; break; }
            }
        }
        if (!$hdr && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $hdr = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        if (stripos($hdr, 'Bearer ') === 0) {
            return trim(substr($hdr, 7));
        }
        return null;
    }
}

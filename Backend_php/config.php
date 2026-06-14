<?php
/**
 * HyperMart PHP API — Configuration / environment loader.
 * Loads api/.env (if present) without overriding real environment variables,
 * then exposes env() for the rest of the app.
 */

function env_load(string $path): void
{
    if (!is_file($path)) {
        return;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        if (strpos($line, '=') === false) {
            continue;
        }
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k);
        $v = trim($v);
        if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && substr($v, -1) === $v[0]) {
            $v = substr($v, 1, -1);
        }
        if (getenv($k) === false) {
            putenv("$k=$v");
            $_ENV[$k] = $v;
        }
    }
}

env_load(__DIR__ . '/.env');

/** Read an environment variable with a fallback default. */
function env(string $key, string $default = ''): string
{
    $v = getenv($key);
    if ($v === false || $v === '') {
        return $default;
    }
    return $v;
}

/** Current UTC timestamp as MySQL DATETIME (mirrors datetime.utcnow()). */
function now_utc(): string
{
    return gmdate('Y-m-d H:i:s');
}

// ── Constants mirroring the Python backend ──────────────────────────────────
const JWT_ALGORITHM       = 'HS256';
const TOKEN_EXPIRY_DAYS    = 30;
const ADMIN_EMAIL          = 'senamallas@gmail.com';
const SUBSCRIPTION_AMOUNT   = 10.0;          // ₹10 / month

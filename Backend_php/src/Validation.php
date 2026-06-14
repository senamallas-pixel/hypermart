<?php
/**
 * Input validation helpers mirroring the Pydantic schemas. Validation
 * failures raise ApiException(422, ...) to match FastAPI's behaviour.
 */
class Validation
{
    public static function require(array $body, string $key)
    {
        if (!array_key_exists($key, $body) || $body[$key] === null || $body[$key] === '') {
            throw new ApiException(422, "Field '$key' is required");
        }
        return $body[$key];
    }

    public static function email(string $v): string
    {
        if (!filter_var($v, FILTER_VALIDATE_EMAIL)) {
            throw new ApiException(422, 'Invalid email address');
        }
        return $v;
    }

    public static function password(string $v, string $label = 'Password'): string
    {
        if (strlen($v) < 6) {
            throw new ApiException(422, "$label must be at least 6 characters");
        }
        return $v;
    }

    /** Coerce a ShopCategory value/key to its stored key, or 422. */
    public static function category($v): string
    {
        $key = Enums::catValueToKey(is_string($v) ? $v : '');
        if ($key === null) {
            throw new ApiException(422, 'Invalid category');
        }
        return $key;
    }

    /** Coerce a ShopLocation value/key to its stored key, or 422. */
    public static function location($v): string
    {
        $key = Enums::locValueToKey(is_string($v) ? $v : '');
        if ($key === null) {
            throw new ApiException(422, 'Invalid location');
        }
        return $key;
    }

    public static function inEnum($v, array $allowed, string $label): string
    {
        if (!in_array($v, $allowed, true)) {
            throw new ApiException(422, "Invalid $label");
        }
        return $v;
    }

    public static function intVal($v, string $label): int
    {
        if (!is_numeric($v)) {
            throw new ApiException(422, "$label must be a number");
        }
        return (int) $v;
    }

    public static function floatVal($v, string $label): float
    {
        if (!is_numeric($v)) {
            throw new ApiException(422, "$label must be a number");
        }
        return (float) $v;
    }

    /** Parse an ISO date/datetime string to MySQL "Y-m-d H:i:s" or null. */
    public static function toDateTime($v): ?string
    {
        if ($v === null || $v === '') return null;
        $ts = strtotime((string) $v);
        if ($ts === false) return null;
        return date('Y-m-d H:i:s', $ts);
    }
}

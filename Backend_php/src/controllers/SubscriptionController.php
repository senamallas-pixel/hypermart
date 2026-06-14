<?php
/**
 * /subscriptions/* — owner subscription management.
 */
class SubscriptionController
{
    public static function register(Router $r): void
    {
        $r->get('/subscriptions/me',       [self::class, 'getMine']);
        $r->post('/subscriptions/activate', [self::class, 'activate']);
        $r->get('/subscriptions',          [self::class, 'listAll']);
    }

    public static function getMine(array $p): void
    {
        $user = Auth::requireRole('owner', 'admin');
        $sub = Database::one('SELECT * FROM subscriptions WHERE user_id = :u', ['u' => $user['id']]);
        if (!$sub) {
            throw new ApiException(404, 'No subscription found');
        }
        if (!empty($sub['expires_at']) && strtotime($sub['expires_at']) < time() && $sub['status'] === 'active') {
            Database::update('subscriptions', ['status' => 'expired'], 'id = :id', ['id' => $sub['id']]);
            $sub['status'] = 'expired';
        }
        Response::json(Present::subscription($sub));
    }

    public static function activate(array $p): void
    {
        $user = Auth::requireRole('owner', 'admin');
        $sub = Database::one('SELECT * FROM subscriptions WHERE user_id = :u', ['u' => $user['id']]);
        $now = now_utc();
        if ($sub) {
            $base = (!empty($sub['expires_at']) && strtotime($sub['expires_at']) > time())
                ? strtotime($sub['expires_at']) : time();
            Database::update('subscriptions', [
                'starts_at'   => $now,
                'expires_at'  => gmdate('Y-m-d H:i:s', $base + 30 * 86400),
                'status'      => 'active',
                'plan_amount' => SUBSCRIPTION_AMOUNT,
            ], 'id = :id', ['id' => $sub['id']]);
        } else {
            Database::insert('subscriptions', [
                'user_id'     => $user['id'],
                'plan_amount' => SUBSCRIPTION_AMOUNT,
                'status'      => 'active',
                'starts_at'   => $now,
                'expires_at'  => gmdate('Y-m-d H:i:s', time() + 30 * 86400),
                'created_at'  => $now,
            ]);
        }
        $sub = Database::one('SELECT * FROM subscriptions WHERE user_id = :u', ['u' => $user['id']]);
        Response::json(Present::subscription($sub));
    }

    public static function listAll(array $p): void
    {
        Auth::requireRole('admin');
        $rows = Database::all('SELECT * FROM subscriptions ORDER BY created_at DESC');
        Response::json(array_map([Present::class, 'subscription'], $rows));
    }
}

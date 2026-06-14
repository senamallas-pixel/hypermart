<?php
/**
 * /notifications/* — in-app notifications for the current user (header bell).
 */
class NotificationController
{
    public static function register(Router $r): void
    {
        $r->get('/notifications/me',              [self::class, 'listMine']);
        $r->get('/notifications/me/unread-count', [self::class, 'unreadCount']);
        $r->post('/notifications/read-all',       [self::class, 'readAll']);
        $r->patch('/notifications/{id}/read',     [self::class, 'markRead']);
    }

    public static function listMine(array $p): void
    {
        $user = Auth::requireUser();
        $limit = (int) Request::query('limit', 30);
        if ($limit < 1 || $limit > 100) $limit = 30;
        $rows = Database::all(
            "SELECT * FROM notifications WHERE user_id = :u ORDER BY created_at DESC, id DESC LIMIT $limit",
            ['u' => $user['id']]
        );
        $unread = (int) Database::scalar('SELECT COUNT(*) FROM notifications WHERE user_id = :u AND is_read = 0', ['u' => $user['id']]);
        Response::json([
            'items'        => array_map([self::class, 'present'], $rows),
            'unread_count' => $unread,
        ]);
    }

    public static function unreadCount(array $p): void
    {
        $user = Auth::requireUser();
        $unread = (int) Database::scalar('SELECT COUNT(*) FROM notifications WHERE user_id = :u AND is_read = 0', ['u' => $user['id']]);
        Response::json(['unread_count' => $unread]);
    }

    public static function markRead(array $p): void
    {
        $user = Auth::requireUser();
        $n = Database::one('SELECT * FROM notifications WHERE id = :id AND user_id = :u', ['id' => (int) $p['id'], 'u' => $user['id']]);
        if (!$n) throw new ApiException(404, 'Notification not found');
        Database::update('notifications', ['is_read' => 1], 'id = :id', ['id' => $n['id']]);
        Response::json(['ok' => true]);
    }

    public static function readAll(array $p): void
    {
        $user = Auth::requireUser();
        Database::update('notifications', ['is_read' => 1], 'user_id = :u AND is_read = 0', ['u' => $user['id']]);
        Response::json(['ok' => true]);
    }

    public static function present(array $n): array
    {
        return [
            'id'         => (int) $n['id'],
            'type'       => $n['type'],
            'title'      => $n['title'],
            'message'    => $n['message'],
            'order_id'   => $n['order_id'] !== null ? (int) $n['order_id'] : null,
            'is_read'    => (int) $n['is_read'],
            'created_at' => Present::iso($n['created_at']),
        ];
    }
}

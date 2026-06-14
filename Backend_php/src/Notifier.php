<?php
/**
 * Notifier — central notification dispatcher.
 * Every app event calls Notifier::notify(), which:
 *   1) logs an in-app notification row (powers the header bell), and
 *   2) emails the recipient via Mailer (no-op if SMTP unconfigured).
 * Both steps are best-effort and never throw into the request flow.
 */
class Notifier
{
    /** Log an in-app notification only (no email). */
    public static function log(int $userId, string $type, string $title, ?string $message = null, ?int $orderId = null): void
    {
        try {
            Database::insert('notifications', [
                'user_id'    => $userId,
                'type'       => $type,
                'title'      => $title,
                'message'    => $message,
                'order_id'   => $orderId,
                'is_read'    => 0,
                'created_at' => now_utc(),
            ]);
        } catch (Throwable $e) {
            error_log('[Notifier] log failed: ' . $e->getMessage());
        }
    }

    /** Log in-app + send an email to the user. */
    public static function notify(int $userId, string $type, string $title, ?string $message = null, ?int $orderId = null): void
    {
        self::log($userId, $type, $title, $message, $orderId);
        if (!Mailer::configured()) return;
        try {
            $u = Database::one('SELECT email, display_name FROM users WHERE id = :id', ['id' => $userId]);
            if ($u && !empty($u['email'])) {
                Mailer::send($u['email'], $title, self::emailHtml($title, $message ?? '', $u['display_name'] ?? ''));
            }
        } catch (Throwable $e) {
            error_log('[Notifier] email failed: ' . $e->getMessage());
        }
    }

    private static function emailHtml(string $title, string $message, string $name): string
    {
        $greeting = $name ? ('Hi ' . htmlspecialchars($name) . ',') : 'Hello,';
        return "<div style='font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1A1A1A'>"
            . "<h2 style='color:#5A5A40;margin:0 0 12px'>HyperMart</h2>"
            . "<h3 style='margin:0 0 8px'>" . htmlspecialchars($title) . "</h3>"
            . "<p style='font-size:14px;line-height:1.6'>$greeting</p>"
            . "<div style='font-size:14px;line-height:1.6'>" . nl2br(htmlspecialchars($message)) . "</div>"
            . "<p style='color:#999;font-size:12px;margin-top:24px'>HyperMart · hypershopindia.com</p></div>";
    }
}

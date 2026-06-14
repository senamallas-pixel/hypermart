<?php
/**
 * Minimal zero-dependency SMTP mailer (sends HTML email via Hostinger SMTP).
 * Configure via .env:
 *   SMTP_HOST=smtp.hostinger.com
 *   SMTP_PORT=465            # 465 = SSL, 587 = STARTTLS
 *   SMTP_USER=noreply@hypershopindia.com
 *   SMTP_PASS=...
 *   SMTP_FROM=noreply@hypershopindia.com
 *   SMTP_FROM_NAME=HyperMart
 * If SMTP is not configured, send() is a no-op that returns false (app keeps working).
 */
class Mailer
{
    public static function configured(): bool
    {
        return env('SMTP_HOST', '') !== '' && env('SMTP_USER', '') !== '' && env('SMTP_PASS', '') !== '';
    }

    /** Send an HTML email. Returns true on success, false otherwise (never throws). */
    public static function send(string $to, string $subject, string $html, ?string $text = null): bool
    {
        if (!self::configured()) {
            error_log("[Mailer] SMTP not configured — skipped email to $to: $subject");
            return false;
        }
        $host = env('SMTP_HOST', 'smtp.hostinger.com');
        $port = (int) env('SMTP_PORT', '465');
        $user = env('SMTP_USER', '');
        $pass = env('SMTP_PASS', '');
        $from = env('SMTP_FROM', $user);
        $fromName = env('SMTP_FROM_NAME', 'HyperMart');
        $secure = strtolower(env('SMTP_SECURE', $port === 465 ? 'ssl' : 'tls'));

        try {
            $transport = ($secure === 'ssl') ? "ssl://$host" : $host;
            $fp = @stream_socket_client("$transport:$port", $errno, $errstr, 20,
                STREAM_CLIENT_CONNECT, stream_context_create(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false]]));
            if (!$fp) { error_log("[Mailer] connect failed: $errstr ($errno)"); return false; }

            $expect = function (string $code) use ($fp): bool {
                $line = '';
                do { $line = fgets($fp, 512); } while ($line !== false && isset($line[3]) && $line[3] === '-');
                return $line !== false && strncmp($line, $code, 3) === 0;
            };
            $cmd = function (string $c) use ($fp) { fwrite($fp, $c . "\r\n"); };

            if (!$expect('220')) { fclose($fp); return false; }
            $ehlo = 'hypershopindia.com';
            $cmd("EHLO $ehlo"); if (!$expect('250')) { fclose($fp); return false; }

            if ($secure === 'tls') {
                $cmd('STARTTLS'); if (!$expect('220')) { fclose($fp); return false; }
                if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) { fclose($fp); return false; }
                $cmd("EHLO $ehlo"); if (!$expect('250')) { fclose($fp); return false; }
            }

            $cmd('AUTH LOGIN'); if (!$expect('334')) { fclose($fp); return false; }
            $cmd(base64_encode($user)); if (!$expect('334')) { fclose($fp); return false; }
            $cmd(base64_encode($pass)); if (!$expect('235')) { error_log('[Mailer] auth failed'); fclose($fp); return false; }

            $cmd("MAIL FROM:<$from>"); if (!$expect('250')) { fclose($fp); return false; }
            $cmd("RCPT TO:<$to>");     if (!$expect('250')) { fclose($fp); return false; }
            $cmd('DATA'); if (!$expect('354')) { fclose($fp); return false; }

            $boundary = 'bnd_' . bin2hex(random_bytes(8));
            $text = $text ?: trim(strip_tags($html));
            $headers = [
                'From: ' . self::encodeName($fromName) . " <$from>",
                "To: <$to>",
                'Subject: ' . self::encodeHeader($subject),
                'MIME-Version: 1.0',
                'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
                "Content-Type: multipart/alternative; boundary=\"$boundary\"",
            ];
            $body = implode("\r\n", $headers) . "\r\n\r\n"
                . "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" . $text . "\r\n"
                . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" . $html . "\r\n"
                . "--$boundary--\r\n";
            // dot-stuffing for lines starting with '.'
            $body = preg_replace('/^\./m', '..', $body);
            $cmd($body . '.');
            if (!$expect('250')) { fclose($fp); return false; }
            $cmd('QUIT'); fclose($fp);
            return true;
        } catch (Throwable $e) {
            error_log('[Mailer] error: ' . $e->getMessage());
            return false;
        }
    }

    private static function encodeHeader(string $s): string
    {
        return preg_match('/[^\x20-\x7e]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
    }
    private static function encodeName(string $s): string
    {
        return preg_match('/[^\x20-\x7e]/', $s) ? self::encodeHeader($s) : '"' . str_replace('"', '', $s) . '"';
    }
}

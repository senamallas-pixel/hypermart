"""
HyperShopIndia — Notifier + SMTP Mailer (stdlib-only).

Every app event calls notify(), which:
  1) logs an in-app notification row (powers the header bell), and
  2) emails the recipient via the SMTP mailer (no-op if SMTP unconfigured).
Both steps are best-effort and never throw into the request flow.

Mirrors Backend_php/src/Notifier.php and Backend_php/src/Mailer.php.
"""

import os
import html
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr, formatdate
from datetime import datetime
from typing import Optional

import models as M

logger = logging.getLogger("hypershopindia.notifier")


# ── SMTP Mailer ─────────────────────────────────────────────────────────────────

def _smtp_config():
    return {
        "host": os.getenv("SMTP_HOST", ""),
        "port": int(os.getenv("SMTP_PORT", "465") or "465"),
        "user": os.getenv("SMTP_USER", ""),
        "password": os.getenv("SMTP_PASS", ""),
        "from": os.getenv("SMTP_FROM", "") or os.getenv("SMTP_USER", ""),
        "from_name": os.getenv("SMTP_FROM_NAME", "HyperShopIndia"),
        "secure": os.getenv("SMTP_SECURE", "").lower(),
    }


def mailer_configured() -> bool:
    """True only when host + user + password are all set."""
    return bool(os.getenv("SMTP_HOST", "") and os.getenv("SMTP_USER", "") and os.getenv("SMTP_PASS", ""))


def send_email(to: str, subject: str, html_body: str, text: Optional[str] = None) -> bool:
    """Send an HTML email (multipart/alternative). Returns True on success, never raises."""
    if not mailer_configured():
        logger.info("[Mailer] SMTP not configured — skipped email to %s: %s", to, subject)
        return False
    cfg = _smtp_config()
    port = cfg["port"]
    secure = cfg["secure"] or ("ssl" if port == 465 else "tls")

    if text is None:
        # Crude HTML → text fallback.
        import re
        text = re.sub(r"<[^>]+>", "", html_body).strip()

    msg = MIMEMultipart("alternative")
    msg["From"] = formataddr((cfg["from_name"], cfg["from"]))
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=False)
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        if secure == "ssl":
            server = smtplib.SMTP_SSL(cfg["host"], port, timeout=20)
        else:
            server = smtplib.SMTP(cfg["host"], port, timeout=20)
            server.ehlo()
            server.starttls()
            server.ehlo()
        try:
            server.login(cfg["user"], cfg["password"])
            server.sendmail(cfg["from"], [to], msg.as_string())
        finally:
            try:
                server.quit()
            except Exception:
                pass
        return True
    except Exception as exc:
        logger.warning("[Mailer] error: %s", exc)
        return False


def _email_html(title: str, message: str, name: str) -> str:
    greeting = f"Hi {html.escape(name)}," if name else "Hello,"
    message_html = html.escape(message).replace("\n", "<br>")
    return (
        "<div style='font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1A1A1A'>"
        "<h2 style='color:#5A5A40;margin:0 0 12px'>HyperShopIndia</h2>"
        f"<h3 style='margin:0 0 8px'>{html.escape(title)}</h3>"
        f"<p style='font-size:14px;line-height:1.6'>{greeting}</p>"
        f"<div style='font-size:14px;line-height:1.6'>{message_html}</div>"
        "<p style='color:#999;font-size:12px;margin-top:24px'>HyperShopIndia · hypershopindia.com</p></div>"
    )


# ── Notifier ────────────────────────────────────────────────────────────────────

def log_notification(db, user_id: int, type: str, title: str,
                     message: Optional[str] = None, order_id: Optional[int] = None) -> None:
    """Log an in-app notification only (no email). Best-effort, never raises."""
    try:
        db.add(M.Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            order_id=order_id,
            is_read=0,
            created_at=datetime.utcnow(),
        ))
        db.flush()
    except Exception as exc:
        logger.warning("[Notifier] log failed: %s", exc)


def notify(db, user_id: int, type: str, title: str,
           message: Optional[str] = None, order_id: Optional[int] = None) -> None:
    """Log in-app + send an email to the user. Best-effort, never raises."""
    log_notification(db, user_id, type, title, message, order_id)
    if not mailer_configured():
        return
    try:
        user = db.get(M.User, user_id)
        if user and user.email:
            send_email(user.email, title, _email_html(title, message or "", user.display_name or ""))
    except Exception as exc:
        logger.warning("[Notifier] email failed: %s", exc)

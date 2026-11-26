"""
Sending email (password-reset codes) through a transactional email service's HTTP API.

EMAIL_PROVIDER picks it: "brevo" (300 a day free) or "resend" (100 a day free), with EMAIL_API_KEY and an
EMAIL_FROM address the service has verified. "console" prints the message in the server log, for development;
"off" sends nothing. Addresses on reserved test domains (example.com, *.example, *.test, ...) are never sent to:
demo, test and placeholder accounts use them.
"""
import httpx

from backend.app.core.config import settings

RESERVED_TLDS = ("example", "test", "invalid", "localhost")      # RFC 2606: never real mailboxes
RESERVED_DOMAINS = ("example.com", "example.org", "example.net")
BREVO = "https://api.brevo.com/v3/smtp/email"
RESEND = "https://api.resend.com/emails"


def enabled() -> bool:
    """Whether reset codes can reach anyone (otherwise people are sent to the Admin Office)."""
    if settings.EMAIL_PROVIDER == "console":
        return True
    return settings.EMAIL_PROVIDER in ("brevo", "resend") and bool(settings.EMAIL_API_KEY and settings.EMAIL_FROM)


def deliverable(address: str) -> bool:
    if "@" not in (address or ""):
        return False
    domain = address.rsplit("@", 1)[1].lower()
    reserved = domain.split(".")[-1] in RESERVED_TLDS or any(domain == d or domain.endswith("." + d) for d in RESERVED_DOMAINS)
    return not reserved


def send(to: str, subject: str, text: str, html: str) -> bool:
    """Send one message. Returns False (and logs why) instead of raising, so a mail outage never shows up
    as a different answer to the person asking: the reset page says the same thing either way."""
    provider = settings.EMAIL_PROVIDER
    if provider == "console":
        print(f"📧 [email to {to}] {subject}\n{text}")
        return True
    if not enabled() or not deliverable(to):
        return False
    try:
        if provider == "brevo":
            r = httpx.post(BREVO, timeout=15, headers={"api-key": settings.EMAIL_API_KEY}, json={
                "sender": {"name": settings.EMAIL_FROM_NAME, "email": settings.EMAIL_FROM},
                "to": [{"email": to}], "subject": subject, "textContent": text, "htmlContent": html})
        else:
            r = httpx.post(RESEND, timeout=15, headers={"Authorization": f"Bearer {settings.EMAIL_API_KEY}"}, json={
                "from": f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>",
                "to": [to], "subject": subject, "text": text, "html": html})
        if r.status_code >= 300:
            print(f"⚠️  Email via {provider} failed ({r.status_code}): {r.text[:200]}")
            return False
        return True
    except httpx.HTTPError as e:
        print(f"⚠️  Email via {provider} failed: {e}")
        return False

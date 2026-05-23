"""Central Neuro Flow branding — override via environment / Settings."""

from app.core.config import settings

PLATFORM_SLUG = "neuro_flow"
PLATFORM_DISPLAY_NAME = settings.platform_display_name
PLATFORM_TAGLINE = settings.platform_tagline
SUPPORT_EMAIL = settings.support_email
COOKIE_TOKEN = settings.auth_cookie_name
COOKIE_USER = settings.auth_user_cookie_name

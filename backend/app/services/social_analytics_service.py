"""
Social Analytics Service
========================
Extensible registry pattern — adding a new platform requires only:

    @SocialAnalyticsService.register("tiktok")
    def fetch_tiktok(token: str) -> list[PlatformPost]:
        ...

Each fetcher returns a list of PlatformPost dicts:
    {
        "platform":     str,          # "instagram" | "youtube" | ...
        "external_id":  str,          # platform-native post/video ID
        "title":        str | None,
        "views":        int,
        "likes":        int,
        "comments":     int,
        "shares":       int,
        "clicks":       int,
        "posted_at":    datetime | None,
    }
"""

import os
import httpx
import logging
from datetime import datetime, timezone
from typing import Callable, TypedDict, Optional

logger = logging.getLogger(__name__)


# ── Canonical data shape returned by every fetcher ────────────────────────────

class PlatformPost(TypedDict):
    platform:    str
    external_id: str
    title:       Optional[str]
    views:       int
    likes:       int
    comments:    int
    shares:      int
    clicks:      int
    posted_at:   Optional[datetime]


# ── Registry ──────────────────────────────────────────────────────────────────

_FETCHERS: dict[str, Callable[[], list[PlatformPost]]] = {}


def register(platform: str):
    """Decorator — registers a zero-argument callable as the fetcher for `platform`."""
    def decorator(fn: Callable[[], list[PlatformPost]]):
        _FETCHERS[platform] = fn
        logger.info(f"Social analytics: registered fetcher for '{platform}'")
        return fn
    return decorator


def registered_platforms() -> list[str]:
    """Return list of platform names that have a fetcher registered."""
    return list(_FETCHERS.keys())


def fetch_platform(platform: str) -> list[PlatformPost]:
    """Fetch analytics for a single platform. Raises KeyError if not registered."""
    if platform not in _FETCHERS:
        raise KeyError(f"No analytics fetcher registered for platform '{platform}'")
    return _FETCHERS[platform]()


def fetch_all() -> dict[str, list[PlatformPost]]:
    """
    Fetch analytics from every registered platform.
    Individual platform failures are logged and skipped — the rest still return.
    """
    results: dict[str, list[PlatformPost]] = {}
    for platform, fetcher in _FETCHERS.items():
        try:
            results[platform] = fetcher()
            logger.info(f"Social analytics: fetched {len(results[platform])} posts from {platform}")
        except Exception as exc:
            logger.warning(f"Social analytics: {platform} fetch failed — {exc}")
            results[platform] = []
    return results


# ── Buffer fetcher (covers Instagram, Facebook, YouTube via sent posts) ────────

def _safe_int(val) -> int:
    try:
        return int(val or 0)
    except (TypeError, ValueError):
        return 0


def _parse_buffer_update(update: dict, platform: str) -> PlatformPost:
    stats = update.get("statistics", {})
    posted_ts = update.get("sent_at") or update.get("created_at")
    posted_at = (
        datetime.fromtimestamp(posted_ts, tz=timezone.utc)
        if posted_ts else None
    )
    return PlatformPost(
        platform=platform,
        external_id=update.get("id", ""),
        title=update.get("text", "")[:120] if update.get("text") else None,
        views=_safe_int(stats.get("reach") or stats.get("impressions")),
        likes=_safe_int(stats.get("likes") or stats.get("reactions")),
        comments=_safe_int(stats.get("comments")),
        shares=_safe_int(stats.get("shares") or stats.get("retweets")),
        clicks=_safe_int(stats.get("clicks") or stats.get("link_clicks")),
        posted_at=posted_at,
    )


def _fetch_buffer_profile(profile_id: str, platform: str, count: int = 20) -> list[PlatformPost]:
    """Fetch sent posts + statistics for one Buffer profile."""
    if not profile_id:
        logger.info(f"Social analytics: no profile ID configured for {platform}, skipping")
        return []
    token = os.getenv("BUFFER_ACCESS_TOKEN", "")
    if not token:
        raise ValueError("BUFFER_ACCESS_TOKEN not set")

    with httpx.Client(timeout=20.0) as client:
        resp = client.get(
            f"https://api.bufferapp.com/1/profiles/{profile_id}/updates/sent.json",
            params={"access_token": token, "count": count, "page": 1},
        )
        if resp.status_code == 401:
            raise ValueError(
                f"Buffer token rejected for {platform} (401 Unauthorized). "
                "The token may be expired or require a Buffer Analyze subscription. "
                "Refresh it at: https://buffer.com/developers/api"
            )
        resp.raise_for_status()
        data = resp.json()

    updates = data.get("updates", []) if isinstance(data, dict) else []
    return [_parse_buffer_update(u, platform) for u in updates]


# ── Register the three Buffer-connected platforms ─────────────────────────────

@register("instagram")
def _fetch_instagram() -> list[PlatformPost]:
    profile_id = os.getenv("BUFFER_INSTAGRAM_PROFILE_ID", "")
    return _fetch_buffer_profile(profile_id, "instagram")


@register("facebook")
def _fetch_facebook() -> list[PlatformPost]:
    profile_id = os.getenv("BUFFER_FACEBOOK_PROFILE_ID", "")
    return _fetch_buffer_profile(profile_id, "facebook")


@register("youtube")
def _fetch_youtube_buffer() -> list[PlatformPost]:
    profile_id = os.getenv("BUFFER_YOUTUBE_PROFILE_ID", "")
    return _fetch_buffer_profile(profile_id, "youtube")


# ── How to add a new platform in the future ───────────────────────────────────
#
# 1. Import this module (or add below)
# 2. Write a fetcher function that returns list[PlatformPost]
# 3. Decorate it with @register("platform_name")
#
# Example — TikTok (once you have a TikTok Business API token):
#
#   @register("tiktok")
#   def _fetch_tiktok() -> list[PlatformPost]:
#       token = os.getenv("TIKTOK_ACCESS_TOKEN", "")
#       # ... call TikTok API ...
#       return [PlatformPost(platform="tiktok", ...)]
#
# That's it. The sync endpoint and summary endpoint pick it up automatically.

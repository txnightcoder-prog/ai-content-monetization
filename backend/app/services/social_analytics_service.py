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


# ── Buffer fetcher — uses the current publish.buffer.com GraphQL API ──────────
#
# Buffer v1 (api.bufferapp.com/1/) is fully deprecated.
# The new API lives at https://publish.buffer.com and accepts a Bearer token
# (the same access token, now called a "Buffer API key").
#
# GraphQL query: fetch the 20 most recent sent posts for a given channel ID,
# returning the analytics fields that are available on the free/essentials tier.

_BUFFER_GQL_URL = "https://publish.buffer.com/graphql"

_SENT_POSTS_QUERY = """
query SentPosts($channelId: String!, $count: Int!) {
  channel(id: $channelId) {
    sentPosts(first: $count) {
      edges {
        node {
          id
          text
          statistics {
            impressions
            reach
            likes
            comments
            shares
            clicks
          }
          sentAt
        }
      }
    }
  }
}
"""


def _safe_int(val) -> int:
    try:
        return int(val or 0)
    except (TypeError, ValueError):
        return 0


def _parse_gql_node(node: dict, platform: str) -> PlatformPost:
    stats = node.get("statistics") or {}
    sent_at_str = node.get("sentAt")
    posted_at: Optional[datetime] = None
    if sent_at_str:
        try:
            posted_at = datetime.fromisoformat(sent_at_str.replace("Z", "+00:00"))
        except ValueError:
            pass
    return PlatformPost(
        platform=platform,
        external_id=node.get("id", ""),
        title=(node.get("text") or "")[:120] or None,
        views=_safe_int(stats.get("reach") or stats.get("impressions")),
        likes=_safe_int(stats.get("likes")),
        comments=_safe_int(stats.get("comments")),
        shares=_safe_int(stats.get("shares")),
        clicks=_safe_int(stats.get("clicks")),
        posted_at=posted_at,
    )


def _fetch_buffer_channel(channel_id: str, platform: str, count: int = 20) -> list[PlatformPost]:
    """Fetch sent posts for one Buffer channel via the GraphQL API."""
    if not channel_id:
        logger.info(f"Social analytics: no channel ID configured for {platform}, skipping")
        return []
    token = os.getenv("BUFFER_ACCESS_TOKEN", "")
    if not token:
        raise ValueError("BUFFER_ACCESS_TOKEN not set")

    payload = {
        "query": _SENT_POSTS_QUERY,
        "variables": {"channelId": channel_id, "count": count},
    }
    with httpx.Client(timeout=20.0) as client:
        resp = client.post(
            _BUFFER_GQL_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        if resp.status_code == 401:
            raise ValueError(
                f"Buffer token rejected for {platform} (401). "
                "Regenerate the key at https://publish.buffer.com/settings/api"
            )
        resp.raise_for_status()
        data = resp.json()

    if "errors" in data:
        raise ValueError(f"Buffer GraphQL error for {platform}: {data['errors']}")

    edges = (
        data.get("data", {})
            .get("channel", {})
            .get("sentPosts", {})
            .get("edges", [])
    )
    return [_parse_gql_node(e["node"], platform) for e in edges if "node" in e]


# ── Register the three Buffer-connected platforms ─────────────────────────────
# The env var names are unchanged — they now hold Buffer *channel* IDs
# (same IDs that were called "profile IDs" in the v1 API).

@register("instagram")
def _fetch_instagram() -> list[PlatformPost]:
    channel_id = os.getenv("BUFFER_INSTAGRAM_PROFILE_ID", "")
    return _fetch_buffer_channel(channel_id, "instagram")


@register("facebook")
def _fetch_facebook() -> list[PlatformPost]:
    channel_id = os.getenv("BUFFER_FACEBOOK_PROFILE_ID", "")
    return _fetch_buffer_channel(channel_id, "facebook")


@register("youtube")
def _fetch_youtube_buffer() -> list[PlatformPost]:
    channel_id = os.getenv("BUFFER_YOUTUBE_PROFILE_ID", "")
    return _fetch_buffer_channel(channel_id, "youtube")


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

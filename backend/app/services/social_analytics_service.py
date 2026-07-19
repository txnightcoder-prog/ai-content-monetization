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


# ── TikTok — native Content Posting API v2 ────────────────────────────────────
#
# Uses the TikTok Content Posting API v2 (open.tiktokapis.com).
# Requires a user access token obtained via TikTok OAuth.
#
# Required env vars:
#   TIKTOK_ACCESS_TOKEN   — user access token (expires every 24h)
#   TIKTOK_CLIENT_KEY     — from TikTok Developer Portal (app credentials)
#   TIKTOK_CLIENT_SECRET  — from TikTok Developer Portal (app credentials)
#   TIKTOK_REFRESH_TOKEN  — long-lived refresh token (valid 365 days)
#
# How to get these:
#   1. Go to https://developers.tiktok.com → My Apps → Create an app
#   2. Enable "Content Posting API" + "Video List" scope
#   3. Complete OAuth flow once to get the initial access + refresh tokens
#      (use https://developers.tiktok.com/tools/redirect to test locally)
#   4. Paste the tokens into your .env — this fetcher auto-refreshes on expiry.
#
# Fields returned: view_count, like_count, comment_count, share_count,
#                  title (caption), create_time, id

_TIKTOK_VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/"
_TIKTOK_TOKEN_URL      = "https://open.tiktokapis.com/v2/oauth/token/"

_TIKTOK_VIDEO_FIELDS = (
    "id,title,create_time,"
    "view_count,like_count,comment_count,share_count"
)


def _tiktok_refresh_access_token() -> str:
    """
    Exchange TIKTOK_REFRESH_TOKEN for a fresh access token.
    Updates TIKTOK_ACCESS_TOKEN in the process environment so the
    same server process reuses it without hitting the token endpoint again.
    Raises ValueError if required credentials are missing.
    """
    client_key     = os.getenv("TIKTOK_CLIENT_KEY", "")
    client_secret  = os.getenv("TIKTOK_CLIENT_SECRET", "")
    refresh_token  = os.getenv("TIKTOK_REFRESH_TOKEN", "")

    if not all([client_key, client_secret, refresh_token]):
        raise ValueError(
            "TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REFRESH_TOKEN "
            "must all be set to auto-refresh the TikTok access token."
        )

    with httpx.Client(timeout=15) as client:
        resp = client.post(
            _TIKTOK_TOKEN_URL,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "client_key":    client_key,
                "client_secret": client_secret,
                "grant_type":    "refresh_token",
                "refresh_token": refresh_token,
            },
        )
        resp.raise_for_status()
        body = resp.json()

    if body.get("error"):
        raise ValueError(
            f"TikTok token refresh failed: {body.get('error')} — "
            f"{body.get('error_description', '')}"
        )

    new_token = body["data"]["access_token"]
    # Store in the process env so other calls within this process reuse it
    os.environ["TIKTOK_ACCESS_TOKEN"] = new_token
    logger.info("TikTok: access token refreshed successfully")
    return new_token


def _tiktok_video_list(access_token: str, max_count: int = 20) -> list[dict]:
    """
    Call POST /v2/video/list/ and return the raw video objects.
    Handles pagination cursor automatically for up to max_count videos.
    """
    videos: list[dict] = []
    cursor: Optional[int] = None

    while len(videos) < max_count:
        page_size = min(20, max_count - len(videos))  # TikTok max per page = 20
        payload: dict = {"max_count": page_size}
        if cursor is not None:
            payload["cursor"] = cursor

        with httpx.Client(timeout=20) as client:
            resp = client.post(
                _TIKTOK_VIDEO_LIST_URL,
                params={"fields": _TIKTOK_VIDEO_FIELDS},
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

        if resp.status_code == 401:
            # Token expired — bubble up so caller can refresh and retry
            raise PermissionError("TikTok access token expired (401)")

        resp.raise_for_status()
        body = resp.json()

        error = body.get("error", {})
        if error.get("code") and error["code"] != "ok":
            raise ValueError(
                f"TikTok API error: {error.get('code')} — {error.get('message', '')}"
            )

        data    = body.get("data", {})
        batch   = data.get("videos", [])
        videos.extend(batch)

        if not data.get("has_more") or not batch:
            break
        cursor = data.get("cursor")

    return videos


def _parse_tiktok_video(v: dict) -> PlatformPost:
    """Convert a TikTok video object to the canonical PlatformPost shape."""
    create_time = v.get("create_time")
    posted_at: Optional[datetime] = None
    if create_time:
        try:
            posted_at = datetime.fromtimestamp(int(create_time), tz=timezone.utc)
        except (ValueError, TypeError):
            pass

    # TikTok captions live in "title"; truncate to 120 chars
    title = (v.get("title") or "")[:120] or None

    return PlatformPost(
        platform    = "tiktok",
        external_id = v.get("id", ""),
        title       = title,
        views       = _safe_int(v.get("view_count")),
        likes       = _safe_int(v.get("like_count")),
        comments    = _safe_int(v.get("comment_count")),
        shares      = _safe_int(v.get("share_count")),
        clicks      = 0,   # TikTok doesn't expose click data via this API
        posted_at   = posted_at,
    )


@register("tiktok")
def _fetch_tiktok() -> list[PlatformPost]:
    """
    Fetch TikTok video stats via the Content Posting API v2.

    Auto-refreshes the access token on 401 if TIKTOK_CLIENT_KEY,
    TIKTOK_CLIENT_SECRET, and TIKTOK_REFRESH_TOKEN are all set.

    Falls back gracefully if no token is configured at all.
    """
    access_token = os.getenv("TIKTOK_ACCESS_TOKEN", "")
    if not access_token:
        logger.info("TikTok: TIKTOK_ACCESS_TOKEN not set — skipping")
        return []

    try:
        videos = _tiktok_video_list(access_token)
    except PermissionError:
        # 401 — try to refresh and retry once
        logger.info("TikTok: access token expired, attempting refresh…")
        try:
            access_token = _tiktok_refresh_access_token()
            videos = _tiktok_video_list(access_token)
        except Exception as exc:
            raise ValueError(
                f"TikTok token refresh failed: {exc}. "
                "Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REFRESH_TOKEN "
                "to enable auto-refresh, or paste a fresh TIKTOK_ACCESS_TOKEN."
            ) from exc

    result = [_parse_tiktok_video(v) for v in videos]
    logger.info("TikTok: fetched %d videos", len(result))
    return result


# ── How to add a new platform in the future ───────────────────────────────────
#
# 1. Write a fetcher function that returns list[PlatformPost]
# 2. Decorate it with @register("platform_name")
# That's it — sync, summary, and the performance monitor pick it up automatically.

"""
Direct Social Media Publisher
==============================
Replaces Buffer. Posts videos directly to each platform's native API.

Supported platforms:
  tiktok     — TikTok Content Posting API v2 (access token required)
  instagram  — Meta Graph API / Instagram Reels (access token required)
  facebook   — Meta Graph API / Facebook Reels (same token as Instagram)
  twitter    — Twitter/X API v2 (bearer + OAuth1 keys required)
  youtube    — YouTube Data API v3 (handled separately via youtube_service.py)

All methods return a dict:
  { "platform": str, "status": "posted"|"skipped"|"failed",
    "external_id": str|None, "url": str|None, "error": str|None }
"""

import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)


# ── TikTok ────────────────────────────────────────────────────────────────────

async def post_to_tiktok(
    video_url: str,
    caption: str,
    access_token: Optional[str] = None,
) -> dict:
    """
    Upload a video to TikTok using the Content Posting API v2.
    Requires TIKTOK_ACCESS_TOKEN with scope: video.upload, video.publish
    """
    token = access_token or os.getenv("TIKTOK_ACCESS_TOKEN", "")
    if not token:
        return {"platform": "tiktok", "status": "skipped",
                "external_id": None, "url": None,
                "error": "TIKTOK_ACCESS_TOKEN not set"}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Step 1 — initialise upload
            init_resp = await client.post(
                "https://open.tiktokapis.com/v2/post/publish/video/init/",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=UTF-8"},
                json={
                    "post_info": {
                        "title": caption[:2200],
                        "privacy_level": "PUBLIC_TO_EVERYONE",
                        "disable_duet": False,
                        "disable_comment": False,
                        "disable_stitch": False,
                        "video_cover_timestamp_ms": 1000,
                    },
                    "source_info": {
                        "source": "PULL_FROM_URL",
                        "video_url": video_url,
                    },
                },
            )
            init_data = init_resp.json()
            if init_resp.status_code != 200 or "data" not in init_data:
                err = init_data.get("error", {}).get("message", init_resp.text[:200])
                return {"platform": "tiktok", "status": "failed",
                        "external_id": None, "url": None, "error": f"TikTok init: {err}"}

            publish_id = init_data["data"].get("publish_id", "")
            logger.info("TikTok upload initiated — publish_id=%s", publish_id)
            return {
                "platform": "tiktok", "status": "posted",
                "external_id": publish_id, "url": None, "error": None,
            }

    except Exception as exc:
        logger.error("TikTok post failed: %s", exc)
        return {"platform": "tiktok", "status": "failed",
                "external_id": None, "url": None, "error": str(exc)}


# ── Instagram Reels ───────────────────────────────────────────────────────────

async def post_to_instagram(
    video_url: str,
    caption: str,
    access_token: Optional[str] = None,
    ig_user_id: Optional[str] = None,
) -> dict:
    """
    Post a Reel to Instagram via the Meta Graph API.
    Requires:
      INSTAGRAM_ACCESS_TOKEN — page/IG user long-lived token
      INSTAGRAM_USER_ID      — numeric Instagram Business account ID
    """
    token   = access_token or os.getenv("INSTAGRAM_ACCESS_TOKEN", "")
    user_id = ig_user_id   or os.getenv("INSTAGRAM_USER_ID", "")

    if not token or not user_id:
        missing = []
        if not token:   missing.append("INSTAGRAM_ACCESS_TOKEN")
        if not user_id: missing.append("INSTAGRAM_USER_ID")
        return {"platform": "instagram", "status": "skipped",
                "external_id": None, "url": None,
                "error": f"Missing: {', '.join(missing)}"}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Step 1 — create media container
            create_resp = await client.post(
                f"https://graph.facebook.com/v21.0/{user_id}/media",
                params={
                    "media_type": "REELS",
                    "video_url": video_url,
                    "caption": caption[:2200],
                    "access_token": token,
                },
            )
            create_data = create_resp.json()
            if "id" not in create_data:
                err = create_data.get("error", {}).get("message", create_resp.text[:200])
                return {"platform": "instagram", "status": "failed",
                        "external_id": None, "url": None, "error": f"IG container: {err}"}

            container_id = create_data["id"]
            logger.info("Instagram container created: %s", container_id)

            # Step 2 — publish container
            pub_resp = await client.post(
                f"https://graph.facebook.com/v21.0/{user_id}/media_publish",
                params={"creation_id": container_id, "access_token": token},
            )
            pub_data = pub_resp.json()
            if "id" not in pub_data:
                err = pub_data.get("error", {}).get("message", pub_resp.text[:200])
                return {"platform": "instagram", "status": "failed",
                        "external_id": None, "url": None, "error": f"IG publish: {err}"}

            post_id = pub_data["id"]
            logger.info("Instagram Reel published: %s", post_id)
            return {
                "platform": "instagram", "status": "posted",
                "external_id": post_id,
                "url": f"https://www.instagram.com/p/{post_id}/",
                "error": None,
            }

    except Exception as exc:
        logger.error("Instagram post failed: %s", exc)
        return {"platform": "instagram", "status": "failed",
                "external_id": None, "url": None, "error": str(exc)}


# ── Facebook Reels ────────────────────────────────────────────────────────────

async def post_to_facebook(
    video_url: str,
    caption: str,
    access_token: Optional[str] = None,
    page_id: Optional[str] = None,
) -> dict:
    """
    Post a Reel to a Facebook Page via the Meta Graph API.
    Requires:
      FACEBOOK_PAGE_ACCESS_TOKEN — Page access token (not user token)
      FACEBOOK_PAGE_ID           — numeric Facebook Page ID
    """
    token   = access_token or os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN", "")
    page_id = page_id      or os.getenv("FACEBOOK_PAGE_ID", "")

    if not token or not page_id:
        missing = []
        if not token:   missing.append("FACEBOOK_PAGE_ACCESS_TOKEN")
        if not page_id: missing.append("FACEBOOK_PAGE_ID")
        return {"platform": "facebook", "status": "skipped",
                "external_id": None, "url": None,
                "error": f"Missing: {', '.join(missing)}"}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Upload reel to page
            resp = await client.post(
                f"https://graph.facebook.com/v21.0/{page_id}/videos",
                params={
                    "file_url": video_url,
                    "description": caption[:63206],
                    "published": "true",
                    "access_token": token,
                },
            )
            data = resp.json()
            if "id" not in data:
                err = data.get("error", {}).get("message", resp.text[:200])
                return {"platform": "facebook", "status": "failed",
                        "external_id": None, "url": None, "error": f"FB video: {err}"}

            video_id = data["id"]
            logger.info("Facebook video published: %s", video_id)
            return {
                "platform": "facebook", "status": "posted",
                "external_id": video_id,
                "url": f"https://www.facebook.com/video/{video_id}",
                "error": None,
            }

    except Exception as exc:
        logger.error("Facebook post failed: %s", exc)
        return {"platform": "facebook", "status": "failed",
                "external_id": None, "url": None, "error": str(exc)}


# ── Twitter / X ───────────────────────────────────────────────────────────────

async def post_to_twitter(
    video_url: str,
    caption: str,
) -> dict:
    """
    Tweet a video link on Twitter/X.
    Twitter's media upload API requires OAuth1 — complex to set up.
    For now posts a text tweet with the video URL embedded.
    Requires:
      TWITTER_API_KEY, TWITTER_API_SECRET
      TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET
    """
    api_key        = os.getenv("TWITTER_API_KEY", "")
    api_secret     = os.getenv("TWITTER_API_SECRET", "")
    access_token   = os.getenv("TWITTER_ACCESS_TOKEN", "")
    access_secret  = os.getenv("TWITTER_ACCESS_TOKEN_SECRET", "")

    if not all([api_key, api_secret, access_token, access_secret]):
        return {"platform": "twitter", "status": "skipped",
                "external_id": None, "url": None,
                "error": "Missing TWITTER_API_KEY / TWITTER_API_SECRET / TWITTER_ACCESS_TOKEN / TWITTER_ACCESS_TOKEN_SECRET"}

    try:
        import hmac, hashlib, base64, time, urllib.parse, secrets as _secrets

        # Build OAuth1 header
        def _pct(s: str) -> str:
            return urllib.parse.quote(str(s), safe="")

        url   = "https://api.twitter.com/2/tweets"
        nonce = _secrets.token_hex(16)
        ts    = str(int(time.time()))

        oauth_params = {
            "oauth_consumer_key":     api_key,
            "oauth_nonce":            nonce,
            "oauth_signature_method": "HMAC-SHA1",
            "oauth_timestamp":        ts,
            "oauth_token":            access_token,
            "oauth_version":          "1.0",
        }

        # Signature base string
        base_str = "&".join([
            "POST",
            _pct(url),
            _pct("&".join(f"{_pct(k)}={_pct(v)}" for k, v in sorted(oauth_params.items()))),
        ])
        signing_key = f"{_pct(api_secret)}&{_pct(access_secret)}"
        sig = base64.b64encode(
            hmac.new(signing_key.encode(), base_str.encode(), hashlib.sha1).digest()
        ).decode()

        oauth_params["oauth_signature"] = sig
        auth_header = "OAuth " + ", ".join(
            f'{_pct(k)}="{_pct(v)}"' for k, v in sorted(oauth_params.items())
        )

        tweet_text = f"{caption[:250]}\n{video_url}" if video_url not in caption else caption[:280]

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                url,
                headers={"Authorization": auth_header, "Content-Type": "application/json"},
                json={"text": tweet_text[:280]},
            )
            data = resp.json()
            if "data" not in data:
                err = data.get("detail", data.get("title", resp.text[:200]))
                return {"platform": "twitter", "status": "failed",
                        "external_id": None, "url": None, "error": f"Twitter: {err}"}

            tweet_id = data["data"]["id"]
            logger.info("Tweet posted: %s", tweet_id)
            return {
                "platform": "twitter", "status": "posted",
                "external_id": tweet_id,
                "url": f"https://twitter.com/i/web/status/{tweet_id}",
                "error": None,
            }

    except Exception as exc:
        logger.error("Twitter post failed: %s", exc)
        return {"platform": "twitter", "status": "failed",
                "external_id": None, "url": None, "error": str(exc)}


# ── Dispatcher ────────────────────────────────────────────────────────────────

async def publish_to_platform(platform: str, video_url: str, caption: str) -> dict:
    """Route to the correct publisher based on platform name."""
    p = platform.lower()
    if p == "tiktok":
        return await post_to_tiktok(video_url, caption)
    if p == "instagram":
        return await post_to_instagram(video_url, caption)
    if p == "facebook":
        return await post_to_facebook(video_url, caption)
    if p in ("twitter", "x"):
        return await post_to_twitter(video_url, caption)
    return {"platform": p, "status": "skipped",
            "external_id": None, "url": None,
            "error": f"Platform '{p}' not supported by direct publisher (use youtube endpoint)"}

# Made with Bob

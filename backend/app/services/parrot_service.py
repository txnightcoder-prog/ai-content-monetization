"""
Parrot Service — analyse a YouTube video and generate a full production Blueprint.

How it works:
1. Extract the video ID from any YouTube URL format.
2. Fetch title, description, tags, category and view/like counts via the
   YouTube Data API v3 (public data, no OAuth needed).
   Falls back to OpenAI-only mode if YOUTUBE_DATA_API_KEY is not set.
3. Feed that metadata + the creator's own production preferences into OpenAI
   and generate a complete Blueprint including:
   - Source analysis (hook style, structure, tone, why it works)
   - Cinematic shot list with camera angles, movement, and lighting
   - Scene-by-scene breakdown with B-roll suggestions
   - Full voiceover script (hook → body → CTA)
   - Audio direction (music style, SFX, voiceover tone)
   - Thumbnail ideas and metadata
"""

import json
import logging
import os
import re
from typing import Any, Dict, Optional

import httpx

from app.services.openai_service import OpenAIService

logger = logging.getLogger(__name__)

_YT_API_BASE = "https://www.googleapis.com/youtube/v3"


def _extract_video_id(url: str) -> str:
    """Pull the 11-char video ID out of any YouTube URL format."""
    patterns = [
        r"(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})",
    ]
    for pat in patterns:
        m = re.search(pat, url)
        if m:
            return m.group(1)
    raise ValueError(f"Could not extract a YouTube video ID from: {url!r}")


async def _fetch_yt_metadata(video_id: str, api_key: str) -> Dict[str, Any]:
    """Fetch public video metadata from YouTube Data API v3."""
    params = {
        "part": "snippet,statistics,contentDetails",
        "id": video_id,
        "key": api_key,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{_YT_API_BASE}/videos", params=params)
        resp.raise_for_status()
        data = resp.json()

    items = data.get("items", [])
    if not items:
        raise ValueError(f"YouTube returned no data for video ID {video_id!r}. "
                         "The video may be private or deleted.")
    item = items[0]
    snippet = item.get("snippet", {})
    stats   = item.get("statistics", {})
    content = item.get("contentDetails", {})

    return {
        "video_id":    video_id,
        "title":       snippet.get("title", ""),
        "description": (snippet.get("description", "") or "")[:1000],
        "tags":        snippet.get("tags", [])[:20],
        "category_id": snippet.get("categoryId", ""),
        "duration":    content.get("duration", ""),      # ISO 8601 e.g. PT3M42S
        "views":       stats.get("viewCount", "unknown"),
        "likes":       stats.get("likeCount", "unknown"),
        "channel":     snippet.get("channelTitle", ""),
    }


class ParrotService:
    """
    Analyse a YouTube video and produce a full production Blueprint that mirrors
    its structure / style but targets your own niche and topic.

    Enhanced with cinematic production options:
    - style: cinematic style preference (e.g. "documentary", "fast-paced", "educational")
    - duration: target video length (e.g. "60 seconds", "5 minutes", "10 minutes")
    - aspect_ratio: output ratio (e.g. "9:16" for Shorts/TikTok, "16:9" for YouTube)
    - audio_style: music and audio direction (e.g. "upbeat background music", "dramatic orchestral")
    - camera_notes: any specific camera or visual preferences
    """

    def __init__(self, openai_service: OpenAIService):
        self.openai = openai_service
        self._yt_api_key = os.getenv("YOUTUBE_DATA_API_KEY")

    async def parrot(
        self,
        youtube_url: str,
        niche: str = "AI tools",
        your_topic: Optional[str] = None,
        # ── Production customisation ─────────────────────────────────────────
        style: Optional[str] = None,
        duration: Optional[str] = None,
        aspect_ratio: Optional[str] = None,
        audio_style: Optional[str] = None,
        camera_notes: Optional[str] = None,
        video_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Analyse a YouTube video and generate a full production Blueprint.

        Args:
            youtube_url:   Any valid YouTube URL.
            niche:         Your content niche (used for the generated Blueprint).
            your_topic:    Optional override topic. If omitted, OpenAI picks one.
            style:         Cinematic style (e.g. "documentary", "fast-paced").
            duration:      Target length (e.g. "60 seconds", "5 minutes").
            aspect_ratio:  Output ratio ("9:16", "16:9", "1:1").
            audio_style:   Music/audio direction (e.g. "upbeat", "dramatic orchestral").
            camera_notes:  Any specific visual or camera preferences.
            video_prompt:  Free-form description of the video you want to create.

        Returns a full Blueprint dict including shot list, scenes, voiceover script,
        and audio direction.
        """
        video_id = _extract_video_id(youtube_url)

        # ── 1. Get source video metadata ─────────────────────────────────────
        if self._yt_api_key:
            logger.info("Parrot: fetching YouTube metadata for %s", video_id)
            try:
                meta = await _fetch_yt_metadata(video_id, self._yt_api_key)
            except Exception as exc:
                logger.warning("Parrot: YouTube API failed (%s) — using URL only", exc)
                meta = {"video_id": video_id, "title": "", "description": "",
                        "tags": [], "views": "unknown", "likes": "unknown",
                        "channel": "", "duration": ""}
        else:
            logger.info("Parrot: no YOUTUBE_DATA_API_KEY — AI will infer from URL")
            meta = {"video_id": video_id, "title": "", "description": "",
                    "tags": [], "views": "unknown", "likes": "unknown",
                    "channel": "", "duration": ""}

        yt_url = f"https://www.youtube.com/watch?v={video_id}"

        # ── 2. Build production context block ────────────────────────────────
        topic_instruction = (
            f"The creator's target topic is: {your_topic}"
            if your_topic
            else f"Choose a high-CPM topic that fits the '{niche}' niche and mirrors the source video's theme."
        )

        production_block = "\n".join(filter(None, [
            f"- Cinematic style: {style}"          if style         else None,
            f"- Target duration: {duration}"        if duration      else None,
            f"- Aspect ratio: {aspect_ratio}"       if aspect_ratio  else None,
            f"- Audio direction: {audio_style}"     if audio_style   else None,
            f"- Camera / visual notes: {camera_notes}" if camera_notes else None,
            f"- Creator's video description: {video_prompt}" if video_prompt else None,
        ])) or "No specific production preferences provided — use sensible defaults."

        meta_block = (
            f"Title: {meta['title'] or '(not available)'}\n"
            f"Channel: {meta['channel'] or '(not available)'}\n"
            f"Views: {meta['views']}  |  Likes: {meta['likes']}\n"
            f"Duration: {meta['duration'] or '(not available)'}\n"
            f"Description (first 1000 chars): {meta['description'] or '(not available)'}\n"
            f"Tags: {', '.join(meta['tags']) or '(none)'}\n"
            f"URL: {yt_url}"
        )

        prompt = f"""
You are a viral content strategist and cinematic video director. Analyse the following
YouTube video and create a complete Video Production Blueprint for a creator in the "{niche}" niche.

=== SOURCE VIDEO ===
{meta_block}

=== CREATOR'S PRODUCTION PREFERENCES ===
{production_block}

=== YOUR TASK ===
1. Analyse what makes the source video successful (hook, structure, tone, pacing).
2. {topic_instruction}
3. Generate a complete Blueprint that MIRRORS THE STRUCTURE AND STYLE of the source
   video but uses ORIGINAL content for the creator's own niche/topic.

The Blueprint must include:
- A full cinematic SHOT LIST (each scene: shot type, camera movement, lighting, duration)
- A scene-by-scene BREAKDOWN with B-roll suggestions and on-screen text ideas
- A complete VOICEOVER SCRIPT written out word-for-word (hook → body → CTA)
- AUDIO DIRECTION (music style, tempo, SFX moments, voiceover tone/pace)
- THUMBNAIL IDEAS (3 options with visual description + headline copy)

Return ONLY valid JSON (no markdown fences) with this exact shape:
{{
  "source_analysis": {{
    "hook_style": "...",
    "structure": "...",
    "tone": "...",
    "pacing": "...",
    "why_it_works": "..."
  }},
  "title": "Your compelling video title",
  "topic": "Main topic/theme",
  "niche": "{niche}",
  "production": {{
    "style": "{style or 'auto'}",
    "duration": "{duration or 'auto'}",
    "aspect_ratio": "{aspect_ratio or '16:9'}",
    "audio_style": "{audio_style or 'auto'}"
  }},
  "structure": {{
    "hook": "Attention-grabbing hook (first 5-10 seconds)",
    "intro": "Brief introduction",
    "sections": [
      {{"title": "Section title", "content": "Detailed content", "tips": ["tip1", "tip2"]}}
    ],
    "outro": "Call to action and closing"
  }},
  "voiceover_script": {{
    "hook": "Word-for-word hook voiceover text",
    "body": "Word-for-word full body narration",
    "cta": "Word-for-word call to action"
  }},
  "shot_list": [
    {{
      "scene": 1,
      "description": "What the viewer sees",
      "shot_type": "Wide / Close-up / Medium / Drone / POV / etc.",
      "camera_movement": "Static / Pan left / Zoom in / Handheld / etc.",
      "lighting": "Natural / Studio / Golden hour / etc.",
      "duration_seconds": 5,
      "broll_suggestion": "Suggested stock footage or b-roll to source",
      "on_screen_text": "Optional caption or title card"
    }}
  ],
  "audio_direction": {{
    "music_style": "Description of background music genre and mood",
    "music_tempo": "BPM range or descriptor (e.g. 90-110 BPM, energetic)",
    "voiceover_tone": "How the narrator should sound (calm, excited, authoritative...)",
    "voiceover_pace": "Words per minute or descriptor (conversational, rapid-fire...)",
    "sfx_notes": "Key sound effect moments (e.g. whoosh on cuts, ding on key points)"
  }},
  "thumbnail_ideas": [
    {{"visual": "Visual description", "headline": "Headline copy", "style": "Design style"}}
  ],
  "metadata": {{
    "target_audience": "Who this is for",
    "estimated_length": "X-Y minutes",
    "cpm_potential": "High/Medium/Low — reason"
  }}
}}
"""

        raw = await self.openai.generate_completion(
            prompt=prompt,
            system_message=(
                "You are an expert content strategist and video director who reverse-engineers "
                "successful YouTube videos and creates complete cinematic production blueprints "
                "for new creators. Always return valid JSON only."
            ),
            temperature=0.75,
            max_tokens=4000,
        )

        # Strip markdown fences if present
        cleaned = raw.strip()
        for fence in ("```json", "```"):
            if cleaned.startswith(fence):
                cleaned = cleaned[len(fence):]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            blueprint = json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("Parrot: JSON parse failed, wrapping raw response")
            blueprint = {
                "title": meta["title"] or "Parrot Blueprint",
                "topic": your_topic or niche,
                "niche": niche,
                "production": {
                    "style": style or "auto",
                    "duration": duration or "auto",
                    "aspect_ratio": aspect_ratio or "16:9",
                    "audio_style": audio_style or "auto",
                },
                "structure": {
                    "hook": "",
                    "intro": "",
                    "sections": [{"title": "Content", "content": cleaned[:800], "tips": []}],
                    "outro": "",
                },
                "voiceover_script": {"hook": "", "body": cleaned[:800], "cta": ""},
                "shot_list": [],
                "audio_direction": {},
                "thumbnail_ideas": [],
                "metadata": {
                    "target_audience": "General",
                    "estimated_length": duration or "5-10 minutes",
                    "cpm_potential": "Medium",
                },
            }

        return {
            "source_video": {
                "url":     yt_url,
                "title":   meta["title"],
                "channel": meta["channel"],
                "views":   meta["views"],
                "likes":   meta["likes"],
            },
            "blueprint": blueprint,
        }

# Made with Bob

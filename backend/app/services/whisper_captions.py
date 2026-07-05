"""
Whisper Captions Service
========================
Transcribes a voiceover MP3 using OpenAI Whisper (word-level timestamps)
and burns timed karaoke-style subtitles into the video via FFmpeg.

Flow:
  transcribe(mp3_path) → list of {word, start, end}
  write_srt(words, srt_path) → SRT file on disk
  burn_subtitles(video_path, srt_path, output_path) → MP4 with burned-in captions

Style: large white bold text centred in the lower third, black outline,
semi-transparent background pill — the style proven to maximise engagement
on Shorts and Reels.

Required env vars:
  OPENAI_API_KEY  — same key used for script generation; Whisper is very cheap
                    (~$0.006 / minute of audio)

Falls back gracefully: if transcription fails the caller receives an empty
word list and the video is returned without timed captions.
"""

import logging
import os
import subprocess
import tempfile
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

# Caption styling constants
_FONT_SIZE   = 56
_FONT_COLOR  = "&H00FFFFFF"    # white  (ASS colour format)
_OUTLINE_COLOR = "&H00000000"  # black
_BACK_COLOR  = "&H80000000"    # semi-transparent black background
_OUTLINE_W   = 3
_SHADOW_W    = 2


# ── SRT generation ─────────────────────────────────────────────────────────────

def _seconds_to_srt_time(seconds: float) -> str:
    """Convert float seconds → SRT timestamp HH:MM:SS,mmm"""
    ms  = int(round(seconds * 1000))
    h   = ms // 3_600_000;  ms %= 3_600_000
    m   = ms // 60_000;     ms %= 60_000
    s   = ms // 1_000;      ms %= 1_000
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(words: List[dict], srt_path: str, words_per_line: int = 4) -> None:
    """
    Group words into caption lines and write an SRT file.

    Each caption covers ``words_per_line`` words. This creates the
    "word-at-a-time pop" feel when played back.

    words: list of {"word": str, "start": float, "end": float}
    """
    if not words:
        Path(srt_path).write_text("")
        return

    entries = []
    i = 0
    idx = 1
    while i < len(words):
        chunk = words[i : i + words_per_line]
        text  = " ".join(w["word"].strip() for w in chunk)
        start = chunk[0]["start"]
        end   = chunk[-1]["end"]
        entries.append(f"{idx}\n{_seconds_to_srt_time(start)} --> {_seconds_to_srt_time(end)}\n{text}\n")
        i   += words_per_line
        idx += 1

    Path(srt_path).write_text("\n".join(entries), encoding="utf-8")
    logger.info("Whisper captions: wrote %d SRT entries to %s", len(entries), srt_path)


# ── Transcription ──────────────────────────────────────────────────────────────

async def transcribe_words(audio_path: str) -> List[dict]:
    """
    Transcribe ``audio_path`` via OpenAI Whisper and return word-level timestamps.

    Returns list of {"word": str, "start": float, "end": float}.
    Returns [] if the key is not set or transcription fails (caller handles gracefully).
    """
    import asyncio

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        logger.warning("Whisper captions: OPENAI_API_KEY not set — skipping timed captions")
        return []

    try:
        result = await asyncio.to_thread(_transcribe_blocking, audio_path, api_key)
        logger.info("Whisper captions: transcribed %d words", len(result))
        return result
    except Exception as exc:
        logger.warning("Whisper captions: transcription failed (%s) — skipping", exc)
        return []


def _transcribe_blocking(audio_path: str, api_key: str) -> List[dict]:
    """Blocking Whisper call — runs in a thread pool."""
    from openai import OpenAI  # noqa: PLC0415

    client = OpenAI(api_key=api_key)
    with open(audio_path, "rb") as f:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            response_format="verbose_json",
            timestamp_granularities=["word"],
        )

    # Extract word-level timestamps
    words = []
    raw_words = getattr(response, "words", None) or []
    for w in raw_words:
        words.append({
            "word":  getattr(w, "word",  ""),
            "start": float(getattr(w, "start", 0)),
            "end":   float(getattr(w, "end",   0)),
        })
    return words


# ── FFmpeg subtitle burn ───────────────────────────────────────────────────────

def burn_subtitles(video_path: str, srt_path: str, output_path: str) -> None:
    """
    Burn the SRT file into the video using FFmpeg's subtitles filter.

    Uses ASS-style forced styling for large, readable captions.
    On Linux the default DejaVu font is used; on Windows Arial.
    """
    from app.services.video_assembler import _get_ffmpeg  # noqa: PLC0415

    if not Path(srt_path).exists() or Path(srt_path).stat().st_size == 0:
        logger.warning("Whisper captions: SRT file empty or missing — copying video as-is")
        import shutil
        shutil.copy2(video_path, output_path)
        return

    # Escape the SRT path for ffmpeg subtitles filter (colons, backslashes)
    safe_srt = str(Path(srt_path).resolve()).replace("\\", "/").replace(":", "\\:")

    # Force styling via ASS override
    force_style = (
        f"FontSize={_FONT_SIZE},"
        f"PrimaryColour={_FONT_COLOR},"
        f"OutlineColour={_OUTLINE_COLOR},"
        f"BackColour={_BACK_COLOR},"
        f"Bold=1,"
        f"Outline={_OUTLINE_W},"
        f"Shadow={_SHADOW_W},"
        f"Alignment=2,"        # bottom centre
        f"MarginV=120"         # 120px from bottom
    )

    subtitle_filter = f"subtitles='{safe_srt}':force_style='{force_style}'"

    cmd = [
        _get_ffmpeg(), "-y", "-i", video_path,
        "-vf", subtitle_filter,
        "-c:v", "libx264", "-crf", "23", "-preset", "fast",
        "-c:a", "copy",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error("Whisper captions: FFmpeg subtitle burn failed:\n%s", result.stderr[-1000:])
        # Fall back: copy the video without subtitles rather than crashing
        import shutil
        shutil.copy2(video_path, output_path)
    else:
        logger.info("Whisper captions: burned subtitles → %s", output_path)


# ── Full pipeline helper ──────────────────────────────────────────────────────

async def add_timed_captions(
    video_path: str,
    audio_path: str,
    output_path: str,
    words_per_line: int = 4,
) -> str:
    """
    High-level helper: transcribe audio, write SRT, burn into video.

    Returns ``output_path`` on success.
    If transcription fails, copies ``video_path`` to ``output_path`` unchanged.
    """
    with tempfile.NamedTemporaryFile(suffix=".srt", delete=False) as f:
        srt_path = f.name
    try:
        words = await transcribe_words(audio_path)
        write_srt(words, srt_path, words_per_line=words_per_line)
        burn_subtitles(video_path, srt_path, output_path)
    finally:
        if os.path.exists(srt_path):
            os.unlink(srt_path)
    return output_path

# Made with Bob

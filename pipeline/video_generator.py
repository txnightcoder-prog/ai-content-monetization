"""
Local video generator using FFmpeg + gTTS + Pexels stock footage.

Output: 1080x1920 vertical MP4 (Instagram/YouTube Shorts/Facebook Reels format)
  - Relevant Pexels stock video background (auto-searched by topic)
  - Dark tint overlay so text is readable
  - White bold caption text (Pillow PNG -> FFmpeg overlay)
  - AI voiceover (gTTS -> MP3 -> merged into video)
  - Uploaded to Azure Blob Storage -> permanent public HTTPS URL
"""

import os
import asyncio
import subprocess
import textwrap
import logging
import urllib.request
import urllib.parse
import json
import tempfile
from pathlib import Path
from gtts import gTTS

logger = logging.getLogger(__name__)

# Where to save rendered videos
# On Azure Linux the pipeline dir is read-only (file share mount) — use /tmp instead
# Use /tmp/videos when /tmp exists AND the local dir is not writable.
_local_dir = Path(__file__).parent / "videos"
if os.path.exists("/tmp") and not os.access(_local_dir.parent, os.W_OK):
    VIDEO_DIR = Path("/tmp/videos")
else:
    VIDEO_DIR = _local_dir
try:
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    # Fallback: if chosen dir can't be created (e.g. permissions), use /tmp
    VIDEO_DIR = Path("/tmp/videos")
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)

PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "")

# Keyword mapping — maps niche/topic keywords to good Pexels search terms for vertical video
TOPIC_KEYWORDS = {
    "ai":           "computer coding",
    "productivity": "working laptop office",
    "money":        "finance business",
    "income":       "success business",
    "finance":      "finance investing",
    "fitness":      "fitness workout",
    "health":       "nature wellness",
    "crypto":       "digital technology",
    "marketing":    "digital marketing",
    "business":     "business professional",
    "mindset":      "motivation mountain",
    "travel":       "travel landscape",
    "food":         "food cooking",
    "coding":       "computer programming",
    "default":      "technology laptop",
}


# ── FFmpeg path detection ──────────────────────────────────────────────────────

def _find_ffmpeg() -> str:
    # Check PATH first (works on both Linux and Windows)
    for candidate in ["ffmpeg", "ffmpeg.exe"]:
        try:
            subprocess.run([candidate, "-version"], capture_output=True, check=True)
            return candidate
        except (FileNotFoundError, subprocess.CalledProcessError):
            pass
    # Linux system paths
    for path in ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]:
        if os.path.exists(path):
            return path
    # Windows WinGet paths
    import glob as _glob
    for pattern in [
        r"C:\Program Files\FFmpeg*\bin\ffmpeg.exe",
        r"C:\Users\*\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg*\ffmpeg-*\bin\ffmpeg.exe",
    ]:
        matches = _glob.glob(pattern, recursive=True)
        if matches:
            return matches[0]
    raise FileNotFoundError("ffmpeg not found. On Linux: apt-get install ffmpeg  On Windows: winget install Gyan.FFmpeg")

# Lazy-load FFMPEG path — only resolved when actually rendering a video
# (avoids crashing on import in environments where FFmpeg isn't installed)
_FFMPEG: str | None = None

def _get_ffmpeg() -> str:
    global _FFMPEG
    if _FFMPEG is None:
        _FFMPEG = _find_ffmpeg()
    return _FFMPEG


# ── Main entry point ───────────────────────────────────────────────────────────

async def create_video_local(script: dict, index: int) -> dict:
    """
    Generate a vertical video:
    1. Search Pexels for a stock video matching the topic
    2. Download the clip
    3. gTTS -> MP3 voiceover
    4. FFmpeg -> stock video + dark tint + caption PNG + voiceover -> MP4
    5. Upload to Azure Blob Storage -> public URL
    """
    full_text = f"{script['hook']} {script['body']} {script['cta']}".strip()
    topic     = script.get("topic", f"video_{index}")
    safe_slug = "".join(c for c in topic if c.isalnum() or c in " _-")[:40].strip().replace(" ", "_").lower()

    mp3_path = VIDEO_DIR / f"{safe_slug}_{index}.mp3"
    mp4_path = VIDEO_DIR / f"{safe_slug}_{index}.mp4"
    bg_path  = VIDEO_DIR / f"{safe_slug}_{index}_bg.mp4"

    loop = asyncio.get_event_loop()

    # Step 1 — find + download Pexels background
    search_term = _pick_search_term(topic)
    logger.info(f"    Searching Pexels for: '{search_term}'")
    bg_url = await loop.run_in_executor(None, _search_pexels_video, search_term)
    if bg_url:
        logger.info(f"    Downloading background: {bg_url[:60]}...")
        await loop.run_in_executor(None, _download_file, bg_url, str(bg_path))
    else:
        logger.warning("    No Pexels video found — using solid background")
        bg_path = None

    # Step 2 — generate voiceover
    await loop.run_in_executor(None, _make_mp3, full_text, str(mp3_path))
    logger.info(f"    Voiceover generated: {mp3_path.name}")

    # Step 3 — render caption PNG
    caption_lines = _wrap_caption(full_text)
    png_path = str(mp4_path).replace(".mp4", "_caption.png")
    font = _find_font()
    await loop.run_in_executor(None, _make_caption_png, caption_lines, png_path, font)

    # Step 4 — render final video
    await loop.run_in_executor(None, _render_video, str(mp3_path), str(bg_path) if bg_path else None, png_path, str(mp4_path))
    size_kb = mp4_path.stat().st_size // 1024
    logger.info(f"    Video rendered: {mp4_path.name} ({size_kb} KB)")

    # Cleanup temp files
    mp3_path.unlink(missing_ok=True)
    if bg_path and Path(bg_path).exists():
        Path(bg_path).unlink(missing_ok=True)
    if Path(png_path).exists():
        Path(png_path).unlink(missing_ok=True)

    # Step 5 — upload to Azure
    public_url = await loop.run_in_executor(None, _upload_video, str(mp4_path))
    logger.info(f"    Uploaded: {public_url}")
    size_kb = mp4_path.stat().st_size // 1024

    return {
        "path":      str(mp4_path),
        "url":       public_url,
        "blob_name": mp4_path.name,
        "size_kb":   size_kb,
        "provider":  "local",
    }


# ── Pexels integration ─────────────────────────────────────────────────────────

def _pick_search_term(topic: str) -> str:
    """Pick the best Pexels search term based on the topic text."""
    topic_lower = topic.lower()
    for keyword, search in TOPIC_KEYWORDS.items():
        if keyword in topic_lower:
            return search
    return TOPIC_KEYWORDS["default"]


def _search_pexels_video(query: str) -> str | None:
    """Search Pexels for a vertical video and return a download URL."""
    if not PEXELS_API_KEY:
        return None
    encoded = urllib.parse.quote(query)
    url = f"https://api.pexels.com/videos/search?query={encoded}&orientation=portrait&size=medium&per_page=10"
    req = urllib.request.Request(url, headers={
        "Authorization": PEXELS_API_KEY,
        "User-Agent": "AI-Pipeline/1.0",
    })
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        data = json.loads(resp.read())
        videos = data.get("videos", [])
        if not videos:
            return None
        # Pick the first video that has an HD or SD file
        for video in videos:
            files = video.get("video_files", [])
            if not files:
                continue
            # Prefer HD portrait, fallback to any
            for f in sorted(files, key=lambda x: x.get("width", 0), reverse=True):
                if f.get("width", 0) <= 1080:  # don't grab 4K files
                    return f["link"]
            # All files were >1080 wide — fall back to the smallest available
            return min(files, key=lambda x: x.get("width", 0))["link"]
        return None
    except Exception as e:
        logger.warning(f"    Pexels search failed: {e}")
        return None


def _download_file(url: str, dest: str) -> None:
    """Download a file from URL to local path."""
    req = urllib.request.Request(url, headers={"User-Agent": "AI-Pipeline/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp, open(dest, "wb") as f:
        while chunk := resp.read(65536):
            f.write(chunk)


# ── Video rendering ────────────────────────────────────────────────────────────

def _render_video(mp3_path: str, bg_path: str | None, png_path: str, out_path: str) -> None:
    """
    FFmpeg pipeline:
    - If bg_path: scale/crop stock video to 1080x1920, add dark tint, loop to match audio
    - If no bg_path: solid dark background
    - Overlay caption PNG near bottom
    - Merge voiceover audio
    """
    # Shared FFmpeg flags — use ultrafast preset + 2 threads for Azure container speed
    _common = [
        "-shortest",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
        "-threads", "2",
        "-c:a", "aac", "-b:a", "96k",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        out_path,
    ]

    if bg_path and Path(bg_path).exists():
        # Stock video background with dark overlay tint
        filter_complex = (
            "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920[bg];"
            "[bg]curves=all='0/0 1/0.55'[tinted];"
            "[tinted][2:v]overlay=0:0[out]"
        )
        cmd = [
            _get_ffmpeg(), "-y",
            "-stream_loop", "-1", "-i", bg_path,
            "-i", mp3_path,
            "-i", png_path,
            "-filter_complex", filter_complex,
            "-map", "[out]", "-map", "1:a",
        ] + _common
    else:
        # Fallback: solid dark background
        cmd = [
            _get_ffmpeg(), "-y",
            "-f", "lavfi", "-i", "color=c=0x1a1a2e:size=1080x1920:rate=30",
            "-i", mp3_path,
            "-i", png_path,
            "-filter_complex", "[0][2]overlay=0:0",
            "-map", "0:v", "-map", "1:a",
        ] + _common

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed:\n{result.stderr[-1200:]}")


# ── Caption PNG ────────────────────────────────────────────────────────────────

def _wrap_caption(text: str, max_chars: int = 36) -> list[str]:
    text = text.replace("**", "").replace("*", "")
    return textwrap.wrap(text, width=max_chars)[:14]


def _make_caption_png(lines: list[str], out_path: str, font_path: str) -> None:
    """
    Render a full overlay PNG with:
    - Semi-transparent caption block (bottom area)
    - 'FOLLOW FOR MORE' badge at the top
    Both on a transparent background sized 1080x1920.
    """
    from PIL import Image, ImageDraw, ImageFont

    W, H = 1080, 1920

    # Font sizes
    caption_size = 48
    follow_size  = 38
    line_gap     = 14
    padding      = 28
    shadow_off   = 3

    try:
        caption_font = ImageFont.truetype(font_path, caption_size)
        follow_font  = ImageFont.truetype(font_path, follow_size)
    except Exception:
        caption_font = ImageFont.load_default()
        follow_font  = caption_font

    # ── Measure caption block ──────────────────────────────────────────────────
    dummy = Image.new("RGBA", (1, 1))
    draw  = ImageDraw.Draw(dummy)
    widths, heights = [], []
    for line in lines:
        bb = draw.textbbox((0, 0), line, font=caption_font)
        widths.append(bb[2] - bb[0])
        heights.append(bb[3] - bb[1])

    cap_w = min(max(widths) + padding * 2, 1040) if widths else 100
    cap_h = sum(heights) + line_gap * max(len(lines) - 1, 0) + padding * 2

    # ── Full-frame transparent canvas ─────────────────────────────────────────
    img  = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ── Top badges: LIKE + FOLLOW ──────────────────────────────────────────────
    badge_pad = 16
    badge_y   = 55

    for badge_text, badge_color in [
        ("👍 LIKE IF THIS HELPED",          (200, 40, 40, 230)),
        ("➕ FOLLOW FOR MORE TIPS",         (59, 130, 212, 230)),
    ]:
        fb  = draw.textbbox((0, 0), badge_text, font=follow_font)
        fw, fh = fb[2] - fb[0], fb[3] - fb[1]
        bx  = (W - fw - badge_pad * 2) // 2
        draw.rectangle([bx, badge_y, bx + fw + badge_pad * 2, badge_y + fh + badge_pad],
                       fill=badge_color, outline=(255, 255, 255, 160), width=2)
        draw.text((bx + badge_pad, badge_y + badge_pad // 2), badge_text,
                  font=follow_font, fill=(255, 255, 255, 255))
        badge_y += fh + badge_pad + 10

    # ── Platform follow row: Facebook · Instagram · YouTube ───────────────────
    badge_y += 6
    platform_text = "Facebook  •  Instagram  •  YouTube"
    pb  = draw.textbbox((0, 0), platform_text, font=follow_font)
    pw, ph = pb[2] - pb[0], pb[3] - pb[1]
    px  = (W - pw - badge_pad * 2) // 2
    draw.rectangle([px, badge_y, px + pw + badge_pad * 2, badge_y + ph + badge_pad],
                   fill=(30, 30, 30, 200), outline=(255, 255, 255, 120), width=1)
    draw.text((px + badge_pad, badge_y + badge_pad // 2), platform_text,
              font=follow_font, fill=(255, 255, 255, 220))
    badge_y += ph + badge_pad + 10

    # ── "Helps me create better content" nudge ─────────────────────────────────
    try:
        small_font = ImageFont.truetype(font_path, 28)
    except Exception:
        small_font = follow_font
    nudge = "Your like & follow helps me create better content!"
    nb  = draw.textbbox((0, 0), nudge, font=small_font)
    nw, nh = nb[2] - nb[0], nb[3] - nb[1]
    nx  = (W - nw) // 2
    # drop shadow then white text
    draw.text((nx + 2, badge_y + 2), nudge, font=small_font, fill=(0, 0, 0, 180))
    draw.text((nx, badge_y), nudge, font=small_font, fill=(255, 220, 80, 255))

    # ── Caption block — bottom center ─────────────────────────────────────────
    cap_x = (W - cap_w) // 2
    cap_y = H - cap_h - 100          # 100px from bottom
    draw.rectangle(
        [cap_x, cap_y, cap_x + cap_w, cap_y + cap_h],
        fill=(0, 0, 0, 170)
    )

    y = cap_y + padding
    for line, lh in zip(lines, heights):
        bb  = draw.textbbox((0, 0), line, font=caption_font)
        lw  = bb[2] - bb[0]
        x   = cap_x + (cap_w - lw) // 2
        draw.text((x + shadow_off, y + shadow_off), line, font=caption_font, fill=(0, 0, 0, 200))
        draw.text((x, y), line, font=caption_font, fill=(255, 255, 255, 255))
        y  += lh + line_gap

    img.save(out_path, "PNG")


# ── TTS ────────────────────────────────────────────────────────────────────────

def _make_mp3(text: str, out_path: str) -> None:
    tts = gTTS(text=text, lang="en", slow=False)
    tts.save(out_path)


# ── Font detection ─────────────────────────────────────────────────────────────

def _find_font() -> str:
    candidates = [
        # Linux (Azure container — DejaVu + Liberation fonts installed via apt)
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        # Windows (local dev machine)
        r"C:/Windows/Fonts/arialbd.ttf",
        r"C:/Windows/Fonts/arial.ttf",
        r"C:/Windows/Fonts/calibrib.ttf",
        r"C:/Windows/Fonts/verdanab.ttf",
        r"C:/Windows/Fonts/verdana.ttf",
        r"C:/Windows/Fonts/tahoma.ttf",
    ]
    for f in candidates:
        if os.path.exists(f):
            return f.replace("\\", "/")
    raise FileNotFoundError("No font found. On Linux run: apt-get install fonts-dejavu-core")


# ── Azure Blob upload ──────────────────────────────────────────────────────────

def _upload_video(mp4_path: str) -> str:
    """Upload to Azure Blob Storage. Falls back to catbox.moe if not configured."""
    conn_str  = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
    container = os.environ.get("AZURE_STORAGE_CONTAINER", "videos")
    if conn_str:
        return _upload_to_azure(mp4_path, conn_str, container)
    return _upload_to_catbox(mp4_path)


def _upload_to_azure(mp4_path: str, conn_str: str, container: str) -> str:
    from azure.storage.blob import BlobServiceClient, ContentSettings
    filename = Path(mp4_path).name
    client   = BlobServiceClient.from_connection_string(conn_str)
    blob     = client.get_blob_client(container=container, blob=filename)
    with open(mp4_path, "rb") as f:
        blob.upload_blob(f, overwrite=True, content_settings=ContentSettings(content_type="video/mp4"))
    return f"https://{client.account_name}.blob.core.windows.net/{container}/{filename}"


def _upload_to_catbox(mp4_path: str) -> str:
    """Fallback upload when Azure not configured."""
    import httpx
    filename = Path(mp4_path).name
    with open(mp4_path, "rb") as f:
        file_data = f.read()
    resp = httpx.post(
        "https://catbox.moe/user/api.php",
        data={"reqtype": "fileupload"},
        files={"fileToUpload": (filename, file_data, "video/mp4")},
        timeout=120,
    )
    resp.raise_for_status()
    url = resp.text.strip()
    if url.startswith("https://"):
        return url
    raise RuntimeError(f"catbox upload failed: {url}")

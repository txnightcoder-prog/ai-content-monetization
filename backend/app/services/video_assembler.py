"""
Video Assembler Service
========================
Assembles a faceless short-form video from:
  1. Stock video clips  (downloaded from Pexels)
  2. AI voiceover       (MP3 from ElevenLabs)
  3. Auto-captions      (burned in via FFmpeg drawtext)

Output: a single 9:16 portrait MP4 ready to upload to YouTube Shorts / Reels / TikTok.

Requires: ffmpeg installed on the system (available in the Docker image).

Pipeline:
  assemble(script, voice_mp3, clip_urls) -> output_mp4_path
    1. Download each clip to a temp dir
    2. Re-encode all clips to a common format (1080x1920, 30fps)
    3. Concatenate clips to match voiceover duration
    4. Mix voiceover audio over clips
    5. Burn captions (hook text) at the bottom of the video
    6. Write final MP4 to output_path
"""

import asyncio
import logging
import os
import subprocess
import tempfile
from pathlib import Path
from typing import List, Optional

import httpx

logger = logging.getLogger(__name__)

# Target format for all output videos
VIDEO_WIDTH  = 1080
VIDEO_HEIGHT = 1920
VIDEO_FPS    = 30
VIDEO_CRF    = 23   # quality: lower = better, 23 is a good default


class VideoAssembler:
    """Assemble stock clips + voiceover + captions into a single MP4."""

    # ------------------------------------------------------------------
    async def assemble(
        self,
        clip_urls: List[str],
        voice_mp3_path: str,
        output_path: str,
        caption_text: Optional[str] = None,
        bg_music_path: Optional[str] = None,
    ) -> str:
        """
        Full assembly pipeline.

        Args:
            clip_urls:       List of Pexels MP4 URLs to use as visuals.
            voice_mp3_path:  Path to the ElevenLabs voiceover MP3.
            output_path:     Where to write the finished MP4.
            caption_text:    Short caption burned onto the video (hook line).
            bg_music_path:   Optional background music MP3 (mixed at low volume).

        Returns:
            ``output_path`` on success.
        """
        with tempfile.TemporaryDirectory(prefix="vidasm_") as tmpdir:
            tmp = Path(tmpdir)

            # 1. Download clips
            clip_paths = await self._download_clips(clip_urls, tmp)
            if not clip_paths:
                raise RuntimeError("No video clips could be downloaded from Pexels.")

            # 2. Re-encode each clip to common 9:16 format
            normalised = self._normalise_clips(clip_paths, tmp)

            # 3. Get voiceover duration
            voice_duration = self._get_duration(voice_mp3_path)

            # 4. Build a looped/trimmed clip sequence that matches voiceover length
            concat_path = str(tmp / "concat.mp4")
            self._concat_to_duration(normalised, voice_duration, concat_path)

            # 5. Mix voiceover (+ optional bg music) over visuals
            mixed_path = str(tmp / "mixed.mp4")
            self._mix_audio(concat_path, voice_mp3_path, mixed_path, bg_music_path)

            # 6. Burn captions if provided
            if caption_text:
                captioned_path = str(tmp / "captioned.mp4")
                self._burn_captions(mixed_path, caption_text, captioned_path)
                final_source = captioned_path
            else:
                final_source = mixed_path

            # 7. Copy to output
            import shutil
            shutil.copy2(final_source, output_path)

        logger.info("VideoAssembler: wrote %s", output_path)
        return output_path

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _download_clips(self, urls: List[str], tmpdir: Path) -> List[str]:
        paths = []
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            for i, url in enumerate(urls):
                try:
                    r = await client.get(url)
                    r.raise_for_status()
                    p = str(tmpdir / f"clip_{i}.mp4")
                    with open(p, "wb") as f:
                        f.write(r.content)
                    paths.append(p)
                    logger.debug("Downloaded clip %d: %s", i, url)
                except Exception as exc:
                    logger.warning("Failed to download clip %s: %s", url, exc)
        return paths

    def _normalise_clips(self, paths: List[str], tmpdir: Path) -> List[str]:
        """Re-encode each clip to 1080x1920 @ 30fps, stripping audio."""
        out = []
        for i, p in enumerate(paths):
            dst = str(tmpdir / f"norm_{i}.mp4")
            cmd = [
                "ffmpeg", "-y", "-i", p,
                "-vf", f"scale={VIDEO_WIDTH}:{VIDEO_HEIGHT}:force_original_aspect_ratio=increase,"
                       f"crop={VIDEO_WIDTH}:{VIDEO_HEIGHT},fps={VIDEO_FPS}",
                "-an",   # strip original audio
                "-c:v", "libx264", "-crf", str(VIDEO_CRF), "-preset", "fast",
                "-pix_fmt", "yuv420p",
                dst,
            ]
            self._run(cmd)
            out.append(dst)
        return out

    def _get_duration(self, path: str) -> float:
        """Return duration of a media file in seconds using ffprobe."""
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, check=True,
        )
        return float(result.stdout.strip())

    def _concat_to_duration(self, clips: List[str], target_duration: float, out: str) -> None:
        """Concatenate (and loop if needed) clips until they reach ``target_duration``."""
        # Write a concat list, repeating clips if needed
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            total = 0.0
            while total < target_duration:
                for clip in clips:
                    d = self._get_duration(clip)
                    f.write(f"file '{clip}'\n")
                    total += d
                    if total >= target_duration:
                        break
            list_path = f.name

        cmd = [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0", "-i", list_path,
            "-t", str(target_duration),
            "-c:v", "libx264", "-crf", str(VIDEO_CRF), "-preset", "fast",
            "-pix_fmt", "yuv420p",
            out,
        ]
        self._run(cmd)
        os.unlink(list_path)

    def _mix_audio(self, video_path: str, voice_path: str, out: str,
                   bg_music_path: Optional[str] = None) -> None:
        """Replace video audio with voiceover (+ optional quiet bg music)."""
        if bg_music_path:
            # Mix voice (full volume) + bg music (20% volume)
            cmd = [
                "ffmpeg", "-y",
                "-i", video_path,
                "-i", voice_path,
                "-i", bg_music_path,
                "-filter_complex",
                "[1:a]volume=1.0[voice];[2:a]volume=0.15,aloop=loop=-1:size=2e+09[bg];"
                "[voice][bg]amix=inputs=2:duration=first[audio]",
                "-map", "0:v", "-map", "[audio]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-shortest", out,
            ]
        else:
            cmd = [
                "ffmpeg", "-y",
                "-i", video_path,
                "-i", voice_path,
                "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-shortest", out,
            ]
        self._run(cmd)

    def _burn_captions(self, video_path: str, text: str, out: str) -> None:
        """Burn caption text onto the bottom third of the video."""
        # Escape special chars for ffmpeg drawtext
        safe = text.replace("'", "\\'").replace(":", "\\:").replace("\\", "\\\\")[:120]
        drawtext = (
            f"drawtext=text='{safe}':"
            f"fontsize=52:fontcolor=white:bordercolor=black:borderw=3:"
            f"x=(w-text_w)/2:y=h*0.78:"
            f"line_spacing=8:expansion=none"
        )
        cmd = [
            "ffmpeg", "-y", "-i", video_path,
            "-vf", drawtext,
            "-c:v", "libx264", "-crf", str(VIDEO_CRF), "-preset", "fast",
            "-c:a", "copy",
            out,
        ]
        self._run(cmd)

    @staticmethod
    def _run(cmd: List[str]) -> None:
        logger.debug("FFmpeg: %s", " ".join(cmd))
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(
                f"FFmpeg failed (exit {result.returncode}):\n{result.stderr[-2000:]}"
            )

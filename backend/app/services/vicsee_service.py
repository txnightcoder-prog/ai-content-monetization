import os
import httpx
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import asyncio


class VicseeService:
    """Service for interacting with Vicsee API for AI video generation"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Vicsee service.
        
        Args:
            api_key: Vicsee API key. If not provided, reads from VICSEE_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("VICSEE_API_KEY")
        if not self.api_key:
            raise ValueError("Vicsee API key not provided. Set VICSEE_API_KEY environment variable.")
        
        self.base_url = os.getenv("VICSEE_BASE_URL", "https://api.vicsee.com/v1")
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    async def create_video(
        self,
        script: str,
        voice_id: str = "default",
        avatar_id: str = "default",
        background: str = "default",
        aspect_ratio: str = "9:16"
    ) -> Dict[str, Any]:
        """
        Create a new video from script.
        
        Args:
            script: The video script text
            voice_id: Voice ID to use for narration
            avatar_id: Avatar ID to use in video
            background: Background style/template
            aspect_ratio: Video aspect ratio (9:16 for vertical, 16:9 for horizontal)
            
        Returns:
            Dictionary with video_id and status
        """
        payload = {
            "script": script,
            "voice_id": voice_id,
            "avatar_id": avatar_id,
            "background": background,
            "settings": {
                "aspect_ratio": aspect_ratio,
                "resolution": "1080p",
                "format": "mp4"
            }
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/videos",
                json=payload,
                headers=self.headers
            )
            response.raise_for_status()
            data = response.json()
        
        return {
            "video_id": data.get("id") or data.get("video_id"),
            "status": data.get("status", "processing"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "estimated_completion": data.get("estimated_completion")
        }
    
    async def get_video_status(self, video_id: str) -> Dict[str, Any]:
        """
        Check the status of a video generation job.
        
        Args:
            video_id: The Vicsee video ID
            
        Returns:
            Dictionary with status, progress, and video_url if complete
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/videos/{video_id}",
                headers=self.headers
            )
            response.raise_for_status()
            data = response.json()
        
        return {
            "video_id": video_id,
            "status": data.get("status"),  # processing, completed, failed
            "progress": data.get("progress", 0),  # 0-100
            "video_url": data.get("video_url") or data.get("download_url"),
            "thumbnail_url": data.get("thumbnail_url"),
            "duration": data.get("duration"),
            "error": data.get("error")
        }
    
    async def download_video(self, video_url: str, save_path: str) -> str:
        """
        Download a completed video.
        
        Args:
            video_url: URL of the video to download
            save_path: Local path to save the video
            
        Returns:
            Path to the downloaded video file
        """
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(video_url)
            response.raise_for_status()
            
            with open(save_path, 'wb') as f:
                f.write(response.content)
        
        return save_path
    
    async def wait_for_completion(
        self,
        video_id: str,
        max_wait_seconds: int = 600,
        poll_interval: int = 10
    ) -> Dict[str, Any]:
        """
        Wait for video generation to complete.
        
        Args:
            video_id: The Vicsee video ID
            max_wait_seconds: Maximum time to wait (default: 10 minutes)
            poll_interval: Seconds between status checks (default: 10 seconds)
            
        Returns:
            Final video status dictionary
            
        Raises:
            TimeoutError: If video doesn't complete within max_wait_seconds
            RuntimeError: If video generation fails
        """
        start_time = datetime.now(timezone.utc)
        
        while True:
            status_data = await self.get_video_status(video_id)
            
            if status_data["status"] == "completed":
                return status_data
            
            if status_data["status"] == "failed":
                error_msg = status_data.get("error", "Unknown error")
                raise RuntimeError(f"Video generation failed: {error_msg}")
            
            # Check timeout
            elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
            if elapsed > max_wait_seconds:
                raise TimeoutError(
                    f"Video generation timed out after {max_wait_seconds} seconds. "
                    f"Current status: {status_data['status']}, Progress: {status_data['progress']}%"
                )
            
            # Wait before next poll
            await asyncio.sleep(poll_interval)
    
    async def cancel_video(self, video_id: str) -> bool:
        """
        Cancel a video generation job.
        
        Args:
            video_id: The Vicsee video ID
            
        Returns:
            True if cancelled successfully
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                f"{self.base_url}/videos/{video_id}",
                headers=self.headers
            )
            response.raise_for_status()
        
        return True
    
    async def list_voices(self) -> list[Dict[str, Any]]:
        """
        Get list of available voices.
        
        Returns:
            List of voice dictionaries with id, name, language, etc.
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/voices",
                headers=self.headers
            )
            response.raise_for_status()
            data = response.json()
        
        return data.get("voices", [])
    
    async def list_avatars(self) -> list[Dict[str, Any]]:
        """
        Get list of available avatars.
        
        Returns:
            List of avatar dictionaries with id, name, preview_url, etc.
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/avatars",
                headers=self.headers
            )
            response.raise_for_status()
            data = response.json()
        
        return data.get("avatars", [])
    
    async def get_account_info(self) -> Dict[str, Any]:
        """
        Get account information and usage stats.
        
        Returns:
            Dictionary with credits, usage, limits, etc.
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/account",
                headers=self.headers
            )
            response.raise_for_status()
            data = response.json()
        
        return {
            "credits_remaining": data.get("credits_remaining"),
            "videos_created": data.get("videos_created"),
            "plan": data.get("plan"),
            "monthly_limit": data.get("monthly_limit")
        }


class VicseeVideoGenerator:
    """High-level service for generating videos with Vicsee"""
    
    def __init__(self, vicsee_service: VicseeService, storage_service=None):
        """
        Initialize video generator.
        
        Args:
            vicsee_service: Vicsee service instance
            storage_service: Optional storage service for uploading videos
        """
        self.vicsee = vicsee_service
        self.storage = storage_service
    
    async def generate_video_from_script(
        self,
        script_text: str,
        wait_for_completion: bool = False,
        upload_to_storage: bool = False
    ) -> Dict[str, Any]:
        """
        Generate a video from a script with optional waiting and upload.
        
        Args:
            script_text: The video script
            wait_for_completion: If True, wait for video to finish generating
            upload_to_storage: If True, upload completed video to storage
            
        Returns:
            Dictionary with video information
        """
        # Create video
        result = await self.vicsee.create_video(
            script=script_text,
            aspect_ratio="9:16"  # Vertical for TikTok/Reels/Shorts
        )
        
        video_id = result["video_id"]
        
        # Optionally wait for completion
        if wait_for_completion:
            try:
                status = await self.vicsee.wait_for_completion(video_id)
                result.update(status)
                
                # Optionally upload to storage
                if upload_to_storage and self.storage and status.get("video_url"):
                    storage_url = await self._upload_to_storage(
                        video_url=status["video_url"],
                        video_id=video_id
                    )
                    result["storage_url"] = storage_url
                    
            except (TimeoutError, RuntimeError) as e:
                result["error"] = str(e)
                result["status"] = "failed"
        
        return result
    
    async def _upload_to_storage(self, video_url: str, video_id: str) -> str:
        """
        Upload video to cloud storage.
        
        Args:
            video_url: URL of the video to download
            video_id: Video ID for naming
            
        Returns:
            Storage URL of uploaded video
        """
        if not self.storage:
            return video_url
        
        # Download video temporarily
        temp_path = f"/tmp/video_{video_id}.mp4"
        await self.vicsee.download_video(video_url, temp_path)
        
        # Upload to storage (implementation depends on storage service)
        storage_url = await self.storage.upload_file(
            file_path=temp_path,
            destination=f"videos/{video_id}.mp4"
        )
        
        # Clean up temp file
        import os
        os.remove(temp_path)
        
        return storage_url

# Made with Bob
import os
import httpx
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta


class BufferService:
    """
    Service for interacting with Buffer API for social media posting.
    
    Supports posting to:
    - TikTok
    - Instagram (Feed & Reels)
    - Facebook (Page & Reels)
    - YouTube (Shorts)
    - Twitter/X
    - LinkedIn
    """
    
    BASE_URL = "https://api.bufferapp.com/1"
    
    def __init__(self, access_token: Optional[str] = None):
        """
        Initialize Buffer service.
        
        Args:
            access_token: Buffer access token. If not provided, reads from BUFFER_ACCESS_TOKEN env var.
        """
        self.access_token = access_token or os.getenv("BUFFER_ACCESS_TOKEN")
        if not self.access_token:
            raise ValueError("Buffer access token not provided. Set BUFFER_ACCESS_TOKEN environment variable.")
        
        self.client = httpx.Client(timeout=30.0)
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Make a request to Buffer API.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint (without base URL)
            params: Query parameters
            data: Request body data
            
        Returns:
            Response data as dictionary
        """
        url = f"{self.BASE_URL}/{endpoint.lstrip('/')}"
        
        # Add access token to params
        if params is None:
            params = {}
        params["access_token"] = self.access_token
        
        response = self.client.request(
            method=method,
            url=url,
            params=params,
            json=data
        )
        response.raise_for_status()
        return response.json()
    
    def get_profiles(self) -> List[Dict[str, Any]]:
        """
        Get all connected social media profiles.
        
        Returns:
            List of profile dictionaries with id, service, username, etc.
        """
        response = self._make_request("GET", "/profiles.json")
        # Buffer API returns an array directly for profiles
        return response if isinstance(response, list) else []
    
    def get_profile(self, profile_id: str) -> Dict[str, Any]:
        """
        Get details for a specific profile.
        
        Args:
            profile_id: Buffer profile ID
            
        Returns:
            Profile details
        """
        return self._make_request("GET", f"/profiles/{profile_id}.json")
    
    def create_post(
        self,
        profile_ids: List[str],
        text: str,
        media: Optional[Dict[str, Any]] = None,
        scheduled_at: Optional[datetime] = None,
        shorten: bool = True,
        now: bool = False
    ) -> Dict[str, Any]:
        """
        Create a new post to one or more social media profiles.
        
        Args:
            profile_ids: List of Buffer profile IDs to post to
            text: Post text/caption
            media: Media attachment (photo, video, link)
            scheduled_at: When to post (None for queue, datetime for specific time)
            shorten: Whether to shorten links
            now: Whether to post immediately (overrides scheduled_at)
            
        Returns:
            Created update details
            
        Example media dict:
            {
                "photo": "https://example.com/image.jpg",  # For images
                "video": "https://example.com/video.mp4",  # For videos
                "thumbnail": "https://example.com/thumb.jpg"  # Video thumbnail
            }
        """
        data = {
            "profile_ids": profile_ids,
            "text": text,
            "shorten": shorten,
            "now": now
        }
        
        # Add media if provided
        if media:
            if "photo" in media:
                data["media"] = {"photo": media["photo"]}
            elif "video" in media:
                data["media"] = {
                    "video": media["video"],
                    "thumbnail": media.get("thumbnail", "")
                }
            elif "link" in media:
                data["media"] = {"link": media["link"]}
        
        # Add scheduled time if provided and not posting now
        if scheduled_at and not now:
            data["scheduled_at"] = int(scheduled_at.timestamp())
        
        return self._make_request("POST", "/updates/create.json", data=data)
    
    def get_pending_posts(self, profile_id: str) -> List[Dict[str, Any]]:
        """
        Get pending (scheduled) posts for a profile.
        
        Args:
            profile_id: Buffer profile ID
            
        Returns:
            List of pending posts
        """
        response = self._make_request("GET", f"/profiles/{profile_id}/updates/pending.json")
        return response.get("updates", []) if isinstance(response, dict) else []
    
    def get_sent_posts(self, profile_id: str, page: int = 1, count: int = 10) -> List[Dict[str, Any]]:
        """
        Get sent posts for a profile.
        
        Args:
            profile_id: Buffer profile ID
            page: Page number
            count: Number of posts per page
            
        Returns:
            List of sent posts
        """
        params = {"page": page, "count": count}
        response = self._make_request("GET", f"/profiles/{profile_id}/updates/sent.json", params=params)
        return response.get("updates", []) if isinstance(response, dict) else []
    
    def get_post(self, post_id: str) -> Dict[str, Any]:
        """
        Get details for a specific post.
        
        Args:
            post_id: Buffer update ID
            
        Returns:
            Post details
        """
        return self._make_request("GET", f"/updates/{post_id}.json")
    
    def update_post(
        self,
        post_id: str,
        text: Optional[str] = None,
        media: Optional[Dict[str, Any]] = None,
        scheduled_at: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Update an existing scheduled post.
        
        Args:
            post_id: Buffer update ID
            text: New post text
            media: New media attachment
            scheduled_at: New scheduled time
            
        Returns:
            Updated post details
        """
        data = {}
        
        if text is not None:
            data["text"] = text
        
        if media is not None:
            if "photo" in media:
                data["media"] = {"photo": media["photo"]}
            elif "video" in media:
                data["media"] = {
                    "video": media["video"],
                    "thumbnail": media.get("thumbnail", "")
                }
        
        if scheduled_at is not None:
            data["scheduled_at"] = int(scheduled_at.timestamp())
        
        return self._make_request("POST", f"/updates/{post_id}/update.json", data=data)
    
    def delete_post(self, post_id: str) -> Dict[str, Any]:
        """
        Delete a scheduled post.
        
        Args:
            post_id: Buffer update ID
            
        Returns:
            Deletion confirmation
        """
        return self._make_request("POST", f"/updates/{post_id}/destroy.json")
    
    def share_now(self, post_id: str) -> Dict[str, Any]:
        """
        Share a scheduled post immediately.
        
        Args:
            post_id: Buffer update ID
            
        Returns:
            Updated post details
        """
        return self._make_request("POST", f"/updates/{post_id}/share.json")
    
    def move_to_top(self, post_id: str) -> Dict[str, Any]:
        """
        Move a post to the top of the queue.
        
        Args:
            post_id: Buffer update ID
            
        Returns:
            Updated post details
        """
        return self._make_request("POST", f"/updates/{post_id}/move_to_top.json")
    
    def get_profile_schedules(self, profile_id: str) -> List[Dict[str, Any]]:
        """
        Get posting schedule for a profile.
        
        Args:
            profile_id: Buffer profile ID
            
        Returns:
            List of scheduled posting times
        """
        response = self._make_request("GET", f"/profiles/{profile_id}/schedules.json")
        return response.get("schedules", []) if isinstance(response, dict) else []
    
    def schedule_post_in_queue(
        self,
        profile_ids: List[str],
        text: str,
        media: Optional[Dict[str, Any]] = None,
        top: bool = False
    ) -> Dict[str, Any]:
        """
        Add post to the queue (will be posted at next available slot).
        
        Args:
            profile_ids: List of Buffer profile IDs
            text: Post text/caption
            media: Media attachment
            top: Whether to add to top of queue
            
        Returns:
            Created update details
        """
        data = {
            "profile_ids": profile_ids,
            "text": text,
            "shorten": True,
            "top": top
        }
        
        if media:
            if "photo" in media:
                data["media"] = {"photo": media["photo"]}
            elif "video" in media:
                data["media"] = {
                    "video": media["video"],
                    "thumbnail": media.get("thumbnail", "")
                }
        
        return self._make_request("POST", "/updates/create.json", data=data)
    
    def get_analytics(self, profile_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """
        Get analytics for a profile (requires Buffer Analyze subscription).
        
        Args:
            profile_id: Buffer profile ID
            start_date: Start date for analytics
            end_date: End date for analytics
            
        Returns:
            Analytics data
        """
        params = {
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d")
        }
        return self._make_request("GET", f"/profiles/{profile_id}/analytics.json", params=params)
    
    def post_to_all_platforms(
        self,
        text: str,
        video_url: str,
        thumbnail_url: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
        platforms: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Post a video to multiple platforms at once.
        
        Args:
            text: Post caption/description
            video_url: URL to video file
            thumbnail_url: URL to thumbnail image
            scheduled_at: When to post (None for immediate)
            platforms: List of platforms to post to (instagram, facebook, tiktok, youtube)
                      If None, posts to all configured platforms
            
        Returns:
            Dictionary with results for each platform
        """
        # Get profile IDs from environment
        profile_ids_map = get_profile_ids()
        
        # Filter by requested platforms
        if platforms:
            profile_ids_map = {k: v for k, v in profile_ids_map.items() if k in platforms}
        
        # Remove empty profile IDs
        profile_ids = [v for v in profile_ids_map.values() if v]
        
        if not profile_ids:
            raise ValueError("No Buffer profile IDs configured. Set BUFFER_*_PROFILE_ID environment variables.")
        
        # Create the post
        media = {"video": video_url}
        if thumbnail_url:
            media["thumbnail"] = thumbnail_url
        
        return self.create_post(
            profile_ids=profile_ids,
            text=text,
            media=media,
            scheduled_at=scheduled_at,
            now=(scheduled_at is None)
        )
    
    def close(self):
        """Close the HTTP client"""
        self.client.close()
    
    def __enter__(self):
        """Context manager entry"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()


# Helper function to get profile IDs from environment
def get_profile_ids() -> Dict[str, str]:
    """
    Get Buffer profile IDs from environment variables.
    
    Returns:
        Dictionary with platform names as keys and profile IDs as values
    """
    return {
        "instagram": os.getenv("BUFFER_INSTAGRAM_PROFILE_ID", ""),
        "facebook": os.getenv("BUFFER_FACEBOOK_PROFILE_ID", ""),
        "tiktok": os.getenv("BUFFER_TIKTOK_PROFILE_ID", ""),
        "youtube": os.getenv("BUFFER_YOUTUBE_PROFILE_ID", ""),
        "twitter": os.getenv("BUFFER_TWITTER_PROFILE_ID", ""),
        "linkedin": os.getenv("BUFFER_LINKEDIN_PROFILE_ID", "")
    }


# Made with Bob
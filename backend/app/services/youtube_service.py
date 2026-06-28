import os
import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime


class YouTubeService:
    """
    Service for direct YouTube API integration.
    Supports uploading videos, managing playlists, and getting analytics.
    
    Note: Buffer can also post to YouTube Shorts. Use this service for:
    - Direct uploads with more control
    - YouTube-specific features (playlists, live streams)
    - Detailed analytics
    """
    
    BASE_URL = "https://www.googleapis.com/youtube/v3"
    UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
    
    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        refresh_token: Optional[str] = None
    ):
        """
        Initialize YouTube service.
        
        Args:
            client_id: YouTube OAuth client ID
            client_secret: YouTube OAuth client secret
            refresh_token: YouTube OAuth refresh token
        """
        self.client_id = client_id or os.getenv("YOUTUBE_CLIENT_ID")
        self.client_secret = client_secret or os.getenv("YOUTUBE_CLIENT_SECRET")
        self.refresh_token = refresh_token or os.getenv("YOUTUBE_REFRESH_TOKEN")
        
        if not all([self.client_id, self.client_secret, self.refresh_token]):
            raise ValueError(
                "YouTube credentials not provided. Set YOUTUBE_CLIENT_ID, "
                "YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN environment variables."
            )
        
        self.client = httpx.Client(timeout=60.0)
        self.access_token = None
        self._refresh_access_token()
    
    def _refresh_access_token(self):
        """Refresh the OAuth access token using refresh token"""
        response = self.client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": self.refresh_token,
                "grant_type": "refresh_token"
            }
        )
        response.raise_for_status()
        data = response.json()
        self.access_token = data["access_token"]
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        json_data: Optional[Dict] = None,
        files: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make a request to YouTube API"""
        url = f"{self.BASE_URL}/{endpoint.lstrip('/')}"
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        response = self.client.request(
            method=method,
            url=url,
            params=params,
            json=json_data,
            files=files,
            headers=headers
        )
        
        # Retry once if token expired
        if response.status_code == 401:
            self._refresh_access_token()
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.client.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                files=files,
                headers=headers
            )
        
        response.raise_for_status()
        return response.json()
    
    def upload_video(
        self,
        video_path: str,
        title: str,
        description: str,
        tags: Optional[List[str]] = None,
        category_id: str = "22",  # 22 = People & Blogs
        privacy_status: str = "public",  # public, private, unlisted
        made_for_kids: bool = False,
        is_short: bool = True
    ) -> Dict[str, Any]:
        """
        Upload a video to YouTube.
        
        Args:
            video_path: Path to video file
            title: Video title (max 100 chars)
            description: Video description (max 5000 chars)
            tags: List of tags (max 500 chars total)
            category_id: YouTube category ID
            privacy_status: Video privacy (public, private, unlisted)
            made_for_kids: Whether video is made for kids
            is_short: Whether this is a YouTube Short (vertical video <60s)
            
        Returns:
            Uploaded video details including video ID
        """
        # Prepare metadata
        metadata = {
            "snippet": {
                "title": title[:100],  # Max 100 chars
                "description": description[:5000],  # Max 5000 chars
                "tags": tags or [],
                "categoryId": category_id
            },
            "status": {
                "privacyStatus": privacy_status,
                "selfDeclaredMadeForKids": made_for_kids
            }
        }
        
        # Add #Shorts to description if it's a Short
        if is_short and "#Shorts" not in metadata["snippet"]["description"]:
            metadata["snippet"]["description"] += "\n\n#Shorts"
        
        # Upload video
        with open(video_path, "rb") as video_file:
            response = self.client.post(
                self.UPLOAD_URL,
                params={
                    "part": "snippet,status",
                    "uploadType": "multipart"
                },
                headers={"Authorization": f"Bearer {self.access_token}"},
                files={
                    "metadata": (None, str(metadata), "application/json"),
                    "media": (os.path.basename(video_path), video_file, "video/*")
                }
            )
        
        response.raise_for_status()
        return response.json()
    
    def update_video(
        self,
        video_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        privacy_status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update video metadata.
        
        Args:
            video_id: YouTube video ID
            title: New title
            description: New description
            tags: New tags
            privacy_status: New privacy status
            
        Returns:
            Updated video details
        """
        # Get current video details
        current = self.get_video(video_id)
        
        # Prepare update data
        update_data = {
            "id": video_id,
            "snippet": current["snippet"],
            "status": current["status"]
        }
        
        # Update fields if provided
        if title is not None:
            update_data["snippet"]["title"] = title[:100]
        if description is not None:
            update_data["snippet"]["description"] = description[:5000]
        if tags is not None:
            update_data["snippet"]["tags"] = tags
        if privacy_status is not None:
            update_data["status"]["privacyStatus"] = privacy_status
        
        return self._make_request(
            "PUT",
            "/videos",
            params={"part": "snippet,status"},
            json_data=update_data
        )
    
    def get_video(self, video_id: str) -> Dict[str, Any]:
        """
        Get video details.
        
        Args:
            video_id: YouTube video ID
            
        Returns:
            Video details
        """
        return self._make_request(
            "GET",
            "/videos",
            params={
                "part": "snippet,status,statistics,contentDetails",
                "id": video_id
            }
        )
    
    def delete_video(self, video_id: str) -> bool:
        """
        Delete a video.
        
        Args:
            video_id: YouTube video ID
            
        Returns:
            True if successful
        """
        self._make_request("DELETE", "/videos", params={"id": video_id})
        return True
    
    def get_channel_info(self) -> Dict[str, Any]:
        """
        Get authenticated user's channel information.
        
        Returns:
            Channel details
        """
        return self._make_request(
            "GET",
            "/channels",
            params={
                "part": "snippet,statistics,contentDetails",
                "mine": "true"
            }
        )
    
    def list_videos(
        self,
        max_results: int = 10,
        order: str = "date"  # date, rating, relevance, title, videoCount, viewCount
    ) -> List[Dict[str, Any]]:
        """
        List videos from authenticated user's channel.
        
        Args:
            max_results: Maximum number of results
            order: Sort order
            
        Returns:
            List of videos
        """
        # Get channel ID first
        channel = self.get_channel_info()
        channel_id = channel["items"][0]["id"]
        
        response = self._make_request(
            "GET",
            "/search",
            params={
                "part": "snippet",
                "channelId": channel_id,
                "maxResults": max_results,
                "order": order,
                "type": "video"
            }
        )
        
        return response.get("items", [])
    
    def get_video_analytics(
        self,
        video_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get analytics for a video (requires YouTube Analytics API).
        
        Args:
            video_id: YouTube video ID
            start_date: Start date for analytics
            end_date: End date for analytics
            
        Returns:
            Analytics data
        """
        # Note: This requires YouTube Analytics API to be enabled
        # For now, return basic statistics from video details
        video = self.get_video(video_id)
        return video.get("statistics", {})
    
    def create_playlist(self, title: str, description: str, privacy: str = "public") -> Dict[str, Any]:
        """
        Create a new playlist.
        
        Args:
            title: Playlist title
            description: Playlist description
            privacy: Playlist privacy (public, private, unlisted)
            
        Returns:
            Created playlist details
        """
        return self._make_request(
            "POST",
            "/playlists",
            params={"part": "snippet,status"},
            json_data={
                "snippet": {
                    "title": title,
                    "description": description
                },
                "status": {
                    "privacyStatus": privacy
                }
            }
        )
    
    def add_video_to_playlist(self, playlist_id: str, video_id: str) -> Dict[str, Any]:
        """
        Add a video to a playlist.
        
        Args:
            playlist_id: YouTube playlist ID
            video_id: YouTube video ID
            
        Returns:
            Playlist item details
        """
        return self._make_request(
            "POST",
            "/playlistItems",
            params={"part": "snippet"},
            json_data={
                "snippet": {
                    "playlistId": playlist_id,
                    "resourceId": {
                        "kind": "youtube#video",
                        "videoId": video_id
                    }
                }
            }
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


# Made with Bob
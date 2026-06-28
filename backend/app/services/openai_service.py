import os
from typing import Optional
from openai import AsyncOpenAI
import httpx


class OpenAIService:
    """Service for interacting with OpenAI API"""
    
    def __init__(self, api_key: Optional[str] = None, timeout: int = 60):
        """
        Initialize OpenAI service.
        
        Args:
            api_key: OpenAI API key. If not provided, reads from OPENAI_API_KEY env var.
            timeout: Request timeout in seconds (default: 60)
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key not provided. Set OPENAI_API_KEY environment variable.")
        
        # Create async client with timeout configuration
        self.client = AsyncOpenAI(
            api_key=self.api_key,
            timeout=httpx.Timeout(timeout, connect=10.0),
            max_retries=2
        )
        self.default_model = "gpt-4"  # or "gpt-3.5-turbo" for lower cost
    
    async def generate_completion(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
        system_message: Optional[str] = None
    ) -> str:
        """
        Generate a completion using OpenAI's chat API (async).
        
        Args:
            prompt: The user prompt
            model: Model to use (defaults to gpt-4)
            temperature: Creativity level (0-2, higher = more creative)
            max_tokens: Maximum tokens in response
            system_message: Optional system message to set context
            
        Returns:
            Generated text response
        """
        messages = []
        
        if system_message:
            messages.append({"role": "system", "content": system_message})
        
        messages.append({"role": "user", "content": prompt})
        
        response = await self.client.chat.completions.create(
            model=model or self.default_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        return response.choices[0].message.content.strip()
    
    async def generate_topics(self, niche: str, count: int = 5) -> list[str]:
        """
        Generate video topic ideas for a specific niche (async).
        
        Args:
            niche: The content niche (e.g., "AI tools", "productivity")
            count: Number of topics to generate
            
        Returns:
            List of topic ideas
        """
        system_message = (
            "You are a viral content strategist specializing in short-form video content. "
            "Generate engaging, attention-grabbing video topics that will perform well on "
            "TikTok, Instagram Reels, and YouTube Shorts."
        )
        
        prompt = (
            f"Generate {count} viral video topic ideas for the '{niche}' niche. "
            f"Each topic should:\n"
            f"- Be attention-grabbing and curiosity-inducing\n"
            f"- Be suitable for 30-60 second videos\n"
            f"- Have clear value proposition\n"
            f"- Use numbers or specific claims when possible\n\n"
            f"Format: Return only the topics, one per line, without numbering."
        )
        
        response = await self.generate_completion(
            prompt=prompt,
            system_message=system_message,
            temperature=0.8,
            max_tokens=300
        )
        
        # Split response into individual topics
        topics = [line.strip() for line in response.split('\n') if line.strip()]
        return topics[:count]  # Ensure we return exactly the requested count

# Made with Bob

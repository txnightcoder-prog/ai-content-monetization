from typing import Dict, Any, List
from app.services.openai_service import OpenAIService
import logging
import time
import json

logger = logging.getLogger(__name__)


class ScriptGenerator:
    """Service for generating video scripts using OpenAI"""
    
    def __init__(self, openai_service: OpenAIService):
        """
        Initialize script generator.
        
        Args:
            openai_service: OpenAI service instance
        """
        self.openai = openai_service
    
    async def generate_script(self, topic: str, niche: str = "AI tools") -> Dict[str, Any]:
        """
        Generate a complete video script with hook, body, and CTA (async).
        
        Args:
            topic: The video topic
            niche: Content niche (default: "AI tools")
            
        Returns:
            Dictionary with hook, body, cta, and metadata
        """
        start_time = time.time()
        logger.info(f"🎬 Starting script generation for topic: '{topic}' (niche: {niche})")
        
        system_message = (
            "You are an expert short-form video scriptwriter. "
            "You create engaging 30-60 second scripts optimized for TikTok, Instagram Reels, and YouTube Shorts. "
            "Your scripts follow the proven formula: Hook (3-5 sec) → Problem/Value (10-15 sec) → Solution (10-15 sec) → CTA (3-5 sec)."
        )
        
        prompt = f"""
Create a viral short-form video script for this topic: "{topic}"
Niche: {niche}

Requirements:
1. HOOK (3-5 seconds): Start with an attention-grabbing statement or question. Make it impossible to scroll past.
2. BODY (20-30 seconds): Deliver the main value. Be specific, actionable, and engaging. Use storytelling or surprising facts.
3. CTA (3-5 seconds): Clear call-to-action. Tell viewers exactly what to do next (follow, check link in bio, etc.).

Format your response EXACTLY like this:
HOOK: [Your hook here]
BODY: [Your body content here]
CTA: [Your call-to-action here]

Make it conversational, energetic, and valuable. Use "you" to speak directly to the viewer.
"""
        
        logger.info(f"📡 Calling OpenAI API for topic: '{topic}'...")
        try:
            response = await self.openai.generate_completion(
                prompt=prompt,
                system_message=system_message,
                temperature=0.8,
                max_tokens=400
            )
            api_duration = time.time() - start_time
            logger.info(f"✓ OpenAI API responded in {api_duration:.2f}s")
        except Exception as e:
            api_duration = time.time() - start_time
            logger.error(f"✗ OpenAI API failed after {api_duration:.2f}s: {str(e)}")
            raise
        
        # Parse the response
        logger.info(f"📝 Parsing script response...")
        script_parts = self._parse_script_response(response)
        
        # Add metadata
        script_parts["metadata"] = {
            "topic": topic,
            "niche": niche,
            "estimated_duration": self._estimate_duration(script_parts),
            "word_count": self._count_words(script_parts)
        }
        
        total_duration = time.time() - start_time
        logger.info(f"✓ Script generation completed in {total_duration:.2f}s for topic: '{topic}'")
        
        return script_parts
    
    def _parse_script_response(self, response: str) -> Dict[str, str]:
        """
        Parse OpenAI response into hook, body, and CTA.
        
        Args:
            response: Raw OpenAI response
            
        Returns:
            Dictionary with hook, body, and cta keys
        """
        lines = response.strip().split('\n')
        script = {"hook": "", "body": "", "cta": ""}
        
        current_section = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Check for section headers
            if line.upper().startswith("HOOK:"):
                current_section = "hook"
                content = line[5:].strip()
                if content:
                    script["hook"] = content
            elif line.upper().startswith("BODY:"):
                current_section = "body"
                content = line[5:].strip()
                if content:
                    script["body"] = content
            elif line.upper().startswith("CTA:"):
                current_section = "cta"
                content = line[4:].strip()
                if content:
                    script["cta"] = content
            elif current_section:
                # Continue adding to current section
                if script[current_section]:
                    script[current_section] += " " + line
                else:
                    script[current_section] = line
        
        # Fallback if parsing fails
        if not script["hook"] or not script["body"] or not script["cta"]:
            # Try to split by common patterns
            parts = response.split('\n\n')
            if len(parts) >= 3:
                script["hook"] = parts[0].replace("HOOK:", "").strip()
                script["body"] = parts[1].replace("BODY:", "").strip()
                script["cta"] = parts[2].replace("CTA:", "").strip()
            else:
                # Last resort: use the whole response as body
                script["hook"] = "Check this out!"
                script["body"] = response.strip()
                script["cta"] = "Follow for more tips!"
        
        return script
    
    def _estimate_duration(self, script: Dict[str, str]) -> int:
        """
        Estimate video duration in seconds based on word count.
        Average speaking rate: ~150 words per minute = 2.5 words per second
        
        Args:
            script: Script dictionary with hook, body, cta
            
        Returns:
            Estimated duration in seconds
        """
        total_words = self._count_words(script)
        # Average speaking rate: 2.5 words per second
        duration = int(total_words / 2.5)
        return max(30, min(duration, 60))  # Clamp between 30-60 seconds
    
    def _count_words(self, script: Dict[str, str]) -> int:
        """
        Count total words in script.
        
        Args:
            script: Script dictionary with hook, body, cta
            
        Returns:
            Total word count
        """
        text = f"{script.get('hook', '')} {script.get('body', '')} {script.get('cta', '')}"
        return len(text.split())
    
    async def generate_multiple_scripts(
        self,
        topics: list[str],
        niche: str = "AI tools"
    ) -> list[Dict[str, Any]]:
        """
        Generate scripts for multiple topics concurrently (parallel, not serial).
        """
        import asyncio as _asyncio  # noqa: PLC0415

        logger.info(f"🎬 Starting parallel batch generation for {len(topics)} topics")

        async def _safe_generate(topic: str) -> Dict[str, Any] | None:
            try:
                script = await self.generate_script(topic, niche)
                script["topic"] = topic
                return script
            except Exception as e:
                logger.error(f"✗ Error generating script for topic '{topic}': {e}")
                return None

        results = await _asyncio.gather(*[_safe_generate(t) for t in topics])
        scripts = [r for r in results if r is not None]

        logger.info(f"✓ Batch generation completed: {len(scripts)}/{len(topics)} successful")
        return scripts
    
    async def generate_topic_ideas(self, niche: str = "AI tools", count: int = 5) -> List[str]:
        """
        Generate topic ideas for a given niche using AI.
        
        Args:
            niche: Content niche
            count: Number of topic ideas to generate
            
        Returns:
            List of topic ideas
        """
        start_time = time.time()
        logger.info(f"💡 Generating {count} topic ideas for niche: '{niche}'")
        
        system_message = (
            "You are an expert content strategist specializing in viral video topics. "
            "You understand what makes content engaging, shareable, and monetizable."
        )
        
        prompt = f"""
Generate {count} viral video topic ideas for the "{niche}" niche.

Requirements:
- Each topic should be specific and actionable
- Focus on high-engagement topics that solve problems or provide value
- Make them curiosity-driven and click-worthy
- Optimize for short-form video content (30-60 seconds)
- Consider monetization potential (high CPM niches)

Format: Return ONLY a JSON array of topic strings, nothing else.
Example: ["Topic 1", "Topic 2", "Topic 3"]
"""
        
        try:
            response = await self.openai.generate_completion(
                prompt=prompt,
                system_message=system_message,
                temperature=0.9,
                max_tokens=300
            )
            
            # Parse JSON response
            try:
                ideas = json.loads(response.strip())
                if isinstance(ideas, list):
                    duration = time.time() - start_time
                    logger.info(f"✓ Generated {len(ideas)} topic ideas in {duration:.2f}s")
                    return ideas[:count]
            except json.JSONDecodeError:
                # Fallback: split by newlines
                ideas = [line.strip().strip('"').strip("'").strip('-').strip()
                        for line in response.strip().split('\n')
                        if line.strip() and not line.strip().startswith('[') and not line.strip().startswith(']')]
                duration = time.time() - start_time
                logger.info(f"✓ Generated {len(ideas)} topic ideas (fallback parsing) in {duration:.2f}s")
                return ideas[:count]
                
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"✗ Failed to generate topic ideas after {duration:.2f}s: {str(e)}")
            raise
    
    async def generate_blueprint(self, instructions: str, niche: str = "AI tools") -> Dict[str, Any]:
        """
        Generate a comprehensive video blueprint from detailed instructions.
        
        Args:
            instructions: Detailed video instructions or blueprint
            niche: Content niche
            
        Returns:
            Dictionary with structured blueprint data
        """
        start_time = time.time()
        logger.info(f"📋 Generating video blueprint for niche: '{niche}'")
        logger.info(f"Instructions length: {len(instructions)} characters")
        
        system_message = (
            "You are an expert video content strategist and scriptwriter. "
            "You create comprehensive video blueprints with detailed structure, hooks, sections, "
            "thumbnail ideas, and monetization strategies. You understand what makes videos viral "
            "and how to maximize engagement and revenue."
        )
        
        prompt = f"""
Create a comprehensive video blueprint based on these instructions:

{instructions}

Niche: {niche}

Generate a detailed video blueprint with the following structure (return as JSON):

{{
  "title": "Compelling video title",
  "topic": "Main topic/theme",
  "niche": "{niche}",
  "structure": {{
    "hook": "Attention-grabbing hook (first 5-10 seconds)",
    "intro": "Brief introduction explaining what viewers will get",
    "sections": [
      {{
        "title": "Section title",
        "content": "Detailed content for this section",
        "tips": ["Tip 1", "Tip 2"]
      }}
    ],
    "outro": "Call to action and closing"
  }},
  "thumbnail_ideas": ["Thumbnail idea 1", "Thumbnail idea 2", "Thumbnail idea 3"],
  "metadata": {{
    "target_audience": "Who this video is for",
    "estimated_length": "8-12 minutes",
    "cpm_potential": "High/Medium/Low with explanation"
  }}
}}

Make it comprehensive, actionable, and optimized for engagement and monetization.
Return ONLY valid JSON, no additional text.
"""
        
        try:
            response = await self.openai.generate_completion(
                prompt=prompt,
                system_message=system_message,
                temperature=0.7,
                max_tokens=2000
            )
            
            # Parse JSON response
            try:
                # Clean up response - remove markdown code blocks if present
                cleaned_response = response.strip()
                if cleaned_response.startswith('```json'):
                    cleaned_response = cleaned_response[7:]
                if cleaned_response.startswith('```'):
                    cleaned_response = cleaned_response[3:]
                if cleaned_response.endswith('```'):
                    cleaned_response = cleaned_response[:-3]
                cleaned_response = cleaned_response.strip()
                
                blueprint = json.loads(cleaned_response)
                duration = time.time() - start_time
                logger.info(f"✓ Blueprint generated successfully in {duration:.2f}s")
                return blueprint
                
            except json.JSONDecodeError as e:
                logger.error(f"✗ Failed to parse blueprint JSON: {str(e)}")
                logger.error(f"Response was: {response[:500]}...")
                
                # Fallback: create a basic structure
                duration = time.time() - start_time
                logger.info(f"⚠ Using fallback blueprint structure after {duration:.2f}s")
                return {
                    "title": "Video Blueprint",
                    "topic": instructions[:100],
                    "niche": niche,
                    "structure": {
                        "hook": "Attention-grabbing opening",
                        "intro": "Introduction to the topic",
                        "sections": [
                            {
                                "title": "Main Content",
                                "content": response[:500],
                                "tips": []
                            }
                        ],
                        "outro": "Call to action"
                    },
                    "thumbnail_ideas": ["Engaging thumbnail concept"],
                    "metadata": {
                        "target_audience": "General audience",
                        "estimated_length": "5-10 minutes",
                        "cpm_potential": "Medium"
                    }
                }
                
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"✗ Failed to generate blueprint after {duration:.2f}s: {str(e)}")
            raise

# Made with Bob

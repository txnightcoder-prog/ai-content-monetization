"""
AI Prompt Builder Service
=========================
Turns a child profile (hair, eyes, age, extra features) into a detailed
text-to-video prompt that can be fed straight into Runway, Kling, Veo,
or any other video-generation engine.

No external API is called here — the prompt is constructed deterministically
so you can inspect and audit it before sending to the video engine.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Base story templates by product type ────────────────────────────────────

_STORY_TEMPLATES = {
    "default": (
        "A heartwarming personalised storybook video for a child named {name}. "
        "The main character is a {age}-year-old child with {hair} hair and {eyes} eyes{features_clause}. "
        "The story unfolds in a magical, colourful world full of adventure and friendship. "
        "Bright, cheerful animation style. Safe for all ages. No text overlays."
    ),
    "birthday": (
        "A joyful birthday celebration video for {name}. "
        "The birthday child is {age} years old, has {hair} hair and {eyes} eyes{features_clause}. "
        "Confetti, balloons, cake candles, and a personalised birthday song. "
        "Warm, vibrant 3-D animation. Child-safe content."
    ),
    "adventure": (
        "An exciting adventure video starring {name}, a brave {age}-year-old hero "
        "with {hair} hair and {eyes} eyes{features_clause}. "
        "They embark on a quest through an enchanted forest to find a hidden treasure. "
        "Dynamic camera movements, magical creatures, triumphant music. Child-safe."
    ),
}

_DEFAULT_HAIR   = "brown"
_DEFAULT_EYES   = "brown"
_DEFAULT_AGE    = "young"
_DEFAULT_NAME   = "the child"


class PromptBuilderService:
    """
    Constructs an AI video prompt from a child profile.

    Usage::

        builder = PromptBuilderService()
        prompt  = builder.build(
            child_name="Emma",
            age="6",
            hair_colour="blonde",
            eye_colour="blue",
            extra_features="loves dinosaurs",
            story_type="adventure",
        )
    """

    def build(
        self,
        child_name:     Optional[str] = None,
        age:            Optional[str] = None,
        hair_colour:    Optional[str] = None,
        eye_colour:     Optional[str] = None,
        extra_features: Optional[str] = None,
        story_type:     str = "default",
    ) -> str:
        name     = (child_name     or _DEFAULT_NAME).strip()
        hair     = (hair_colour    or _DEFAULT_HAIR).strip().lower()
        eyes     = (eye_colour     or _DEFAULT_EYES).strip().lower()
        age_str  = (age            or _DEFAULT_AGE ).strip().lower()

        features_clause = ""
        if extra_features and extra_features.strip():
            features_clause = f", {extra_features.strip()}"

        template = _STORY_TEMPLATES.get(story_type, _STORY_TEMPLATES["default"])

        prompt = template.format(
            name=name,
            age=age_str,
            hair=hair,
            eyes=eyes,
            features_clause=features_clause,
        )

        logger.info(
            "PromptBuilderService: built %s-type prompt for child '%s' (age=%s)",
            story_type, name, age_str,
        )
        return prompt

    def story_types(self) -> list[str]:
        """Return the available story template keys."""
        return list(_STORY_TEMPLATES.keys())

# Made with Bob

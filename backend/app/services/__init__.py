# Lazy imports — services are imported directly where needed.
# Both OpenAIService and GeminiService are available; selection is automatic.
from app.services.script_generator import ScriptGenerator

__all__ = ["ScriptGenerator"]

# Made with Bob

# Backend Startup

## Install
```powershell
cd C:/Users/JohnKirshy/Desktop/ai-content-monetization/backend
python -m pip install -r requirements.txt
```

## Run
```powershell
cd C:/Users/JohnKirshy/Desktop/ai-content-monetization/backend
python -m uvicorn app.main:app --reload --port 8000
```

## Endpoints
- `GET /health`
- `GET /api/v1/dashboard`

## Notes
This is the initial FastAPI scaffold for the AI-tools auto-publishing MVP. Real integrations for OpenAI, video generation, and platform publishing still need to be implemented.
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import time
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.scripts import router as scripts_router
from app.api.routes.videos import router as videos_router
from app.api.routes.posts import router as posts_router
from app.api.routes.leads import router as leads_router
from app.api.routes.products import router as products_router
from app.api.routes.conversions import router as conversions_router
from app.api.routes.integrations import router as integrations_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.health_checks import router as health_router
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    Initializes database on startup.
    """
    # Startup: Initialize database
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized successfully!")

    yield

    logger.info("Shutting down...")


app = FastAPI(
    title="AI Content Monetization API",
    version="0.1.0",
    description="MVP API for AI-tools video generation and publishing workflows.",
    lifespan=lifespan
)

# Request monitoring middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """
    Middleware to log all requests and detect hanging requests.
    Logs request start, duration, and warns if request takes too long.
    """
    start_time = time.time()
    request_id = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{id(request)}"
    
    # Log request start
    logger.info(f"[{request_id}] ▶ START: {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        
        # Log completion with duration
        if duration > 5.0:
            logger.warning(f"[{request_id}] ⚠ SLOW ({duration:.2f}s): {request.method} {request.url.path} - Status: {response.status_code}")
        else:
            logger.info(f"[{request_id}] ✓ DONE ({duration:.2f}s): {request.method} {request.url.path} - Status: {response.status_code}")
        
        return response
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"[{request_id}] ✗ ERROR ({duration:.2f}s): {request.method} {request.url.path} - {str(e)}")
        raise

import os as _os

_raw_origins = _os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
)
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"https://[a-z0-9\-]+\.azurecontainerapps\.io$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

app.include_router(dashboard_router)
app.include_router(scripts_router)
app.include_router(videos_router)
app.include_router(posts_router)
app.include_router(leads_router)
app.include_router(products_router)
app.include_router(conversions_router)
app.include_router(integrations_router)
app.include_router(analytics_router)
app.include_router(health_router)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok", "app": "ai-content-monetization-api"}

# Made with Bob

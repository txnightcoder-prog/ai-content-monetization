# Backend Setup Guide

## What We've Built

### ✅ Database Models (Complete)
Created 7 SQLAlchemy models representing the entire data structure:

1. **ContentScript** - AI-generated video scripts
   - Fields: topic, hook, body, cta, status, metadata
   - Status: draft, approved, rejected

2. **Video** - Generated videos from HeyGen
   - Fields: script_id, heygen_video_id, video_url, thumbnail_url, duration, status
   - Status: generating, ready, posted, failed

3. **Post** - Social media posts
   - Fields: video_id, platform, post_url, scheduled_at, posted_at, status
   - Platforms: tiktok, instagram, youtube
   - Status: scheduled, posted, failed

4. **Lead** - Captured email leads
   - Fields: email, name, source, beehiiv_subscriber_id, tags

5. **Product** - Products for sale
   - Fields: name, price, description, stan_store_product_id, active

6. **Conversion** - Sales tracking
   - Fields: lead_id, product_id, amount, stan_store_order_id

7. **Analytics** - Post performance metrics
   - Fields: post_id, video_id, views, likes, comments, shares, clicks

### 🔧 Infrastructure
- **Database Configuration** (`app/core/database.py`)
  - SQLite for local development
  - Easy PostgreSQL migration for production
  - Session management with dependency injection
  - Auto-initialization on startup

- **Updated Dependencies** (`requirements.txt`)
  - SQLAlchemy 2.0.23 - ORM
  - Alembic 1.13.0 - Database migrations
  - OpenAI 1.3.0 - AI integration
  - FastAPI, Uvicorn, Pydantic (existing)

## Installation

### 1. Install Dependencies
```powershell
cd ai-content-monetization/backend
python -m pip install -r requirements.txt
```

### 2. Run the Backend
```powershell
python -m uvicorn app.main:app --reload --port 8000
```

The database will automatically initialize on first run, creating:
- `ai_content_monetization.db` (SQLite file)
- All 7 tables with proper relationships

### 3. Test the API
Open your browser to:
- http://localhost:8000/docs - Interactive API documentation
- http://localhost:8000/health - Health check endpoint
- http://localhost:8000/api/v1/dashboard - Dashboard data

## Database Schema

```
content_scripts
├── id (UUID, PK)
├── topic (TEXT)
├── hook (TEXT)
├── body (TEXT)
├── cta (TEXT)
├── status (ENUM)
├── metadata (JSONB)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

videos
├── id (UUID, PK)
├── script_id (UUID, FK → content_scripts)
├── heygen_video_id (STRING)
├── video_url (STRING)
├── thumbnail_url (STRING)
├── duration (INTEGER)
├── status (ENUM)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

posts
├── id (UUID, PK)
├── video_id (UUID, FK → videos)
├── platform (ENUM)
├── post_url (STRING)
├── scheduled_at (TIMESTAMP)
├── posted_at (TIMESTAMP)
├── status (ENUM)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

leads
├── id (UUID, PK)
├── email (STRING, UNIQUE)
├── name (STRING)
├── source (STRING)
├── beehiiv_subscriber_id (STRING)
├── tags (ARRAY)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

products
├── id (UUID, PK)
├── name (STRING)
├── price (DECIMAL)
├── description (TEXT)
├── stan_store_product_id (STRING)
├── active (BOOLEAN)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

conversions
├── id (UUID, PK)
├── lead_id (UUID, FK → leads)
├── product_id (UUID, FK → products)
├── amount (DECIMAL)
├── stan_store_order_id (STRING)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

analytics
├── id (UUID, PK)
├── post_id (UUID, FK → posts)
├── video_id (UUID, FK → videos)
├── views (INTEGER)
├── likes (INTEGER)
├── comments (INTEGER)
├── shares (INTEGER)
├── clicks (INTEGER)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

## Next Steps

### Immediate (Ready to Build)
1. **Pydantic Schemas** - Create request/response models
2. **CRUD Operations** - Build API endpoints for each model
3. **OpenAI Integration** - Script generation service
4. **HeyGen Integration** - Video creation service

### Short Term
5. **Buffer Integration** - Social media scheduling
6. **Stan Store Integration** - Product sales tracking
7. **Beehiiv Integration** - Email marketing
8. **Analytics Dashboard** - Frontend UI

### Long Term
9. **Authentication** - User management
10. **n8n Workflows** - Full automation
11. **Production Deployment** - Azure/Docker
12. **Monitoring & Logging** - Observability

## Environment Variables

Create a `.env` file in the backend directory:

```env
# Database (optional, defaults to SQLite)
DATABASE_URL=sqlite:///./ai_content_monetization.db

# OpenAI (when ready to test)
OPENAI_API_KEY=your_key_here

# HeyGen (when ready to test)
HEYGEN_API_KEY=your_key_here

# Buffer (when ready to test)
BUFFER_ACCESS_TOKEN=your_token_here

# Stan Store (when ready to test)
STAN_STORE_API_KEY=your_key_here

# Beehiiv (when ready to test)
BEEHIIV_API_KEY=your_key_here
```

## Troubleshooting

### Import Errors in VS Code
The import errors you see are normal before installing dependencies. They will resolve after running:
```powershell
python -m pip install -r requirements.txt
```

### Database Issues
If you need to reset the database:
1. Stop the server
2. Delete `ai_content_monetization.db`
3. Restart the server (it will recreate the database)

### Port Already in Use
If port 8000 is busy, use a different port:
```powershell
python -m uvicorn app.main:app --reload --port 8001
```

## Architecture Notes

### Why SQLite for Development?
- Zero configuration
- File-based (easy to backup/reset)
- Perfect for local testing
- Easy migration to PostgreSQL later

### Why UUID Primary Keys?
- Globally unique (no collisions)
- Better for distributed systems
- More secure (not sequential)
- Industry standard

### Why Enums?
- Type safety
- Database constraints
- Clear status values
- Easy to extend

## Made with Bob 🤖
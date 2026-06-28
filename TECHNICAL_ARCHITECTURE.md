# AI Content Monetization System - Technical Architecture

## System Components Overview

### 1. Core Backend Services

#### 1.1 API Gateway (FastAPI)
**Purpose**: Central REST API for all system operations

**Key Features**:
- JWT authentication
- Rate limiting
- Request validation
- CORS handling
- API documentation (Swagger/OpenAPI)

**Endpoints Structure**:
```
/api/v1/
  ├── auth/          # Authentication & authorization
  ├── scripts/       # Content script management
  ├── videos/        # Video generation & management
  ├── posts/         # Social media post scheduling
  ├── leads/         # Lead capture & management
  ├── products/      # Product catalog
  ├── analytics/     # Metrics & reporting
  └── webhooks/      # External service callbacks
```

#### 1.2 Content Generation Service
**Purpose**: AI-powered script and video creation

**Components**:
- **Script Generator**: OpenAI GPT-4 integration
- **Video Creator**: HeyGen API integration
- **Template Manager**: Reusable content templates
- **Quality Checker**: Content validation

**Flow**:
```
Topic Selection → Script Generation → Review → Video Creation → Storage
```

#### 1.3 Distribution Service
**Purpose**: Multi-platform content distribution

**Components**:
- **Buffer Integration**: Social media scheduling
- **Platform Adapters**: TikTok, Instagram, YouTube
- **Queue Manager**: Post scheduling queue
- **Retry Handler**: Failed post recovery

#### 1.4 Funnel Service
**Purpose**: Lead capture and conversion

**Components**:
- **Stan Store Integration**: Product sales & lead capture
- **Beehiiv Integration**: Email marketing automation
- **Lead Scorer**: Lead quality assessment
- **Conversion Tracker**: Sales attribution

#### 1.5 Analytics Service
**Purpose**: Data collection and reporting

**Components**:
- **Metrics Collector**: Platform API polling
- **Data Aggregator**: Metric consolidation
- **Report Generator**: Dashboard data preparation
- **Alert Manager**: Threshold-based notifications

### 2. Database Architecture

#### 2.1 PostgreSQL Schema

**Core Tables**:

```sql
-- Content Management
CREATE TABLE content_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    hook TEXT NOT NULL,
    body TEXT NOT NULL,
    cta TEXT NOT NULL,
    target_platform TEXT[],
    generated_at TIMESTAMP DEFAULT NOW(),
    status TEXT CHECK (status IN ('draft', 'approved', 'rejected', 'archived')),
    metadata JSONB,
    created_by UUID REFERENCES users(id),
    CONSTRAINT valid_metadata CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX idx_scripts_status ON content_scripts(status);
CREATE INDEX idx_scripts_generated_at ON content_scripts(generated_at DESC);

-- Video Management
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID REFERENCES content_scripts(id) ON DELETE CASCADE,
    heygen_video_id TEXT UNIQUE,
    video_url TEXT,
    thumbnail_url TEXT,
    duration INTEGER, -- in seconds
    file_size BIGINT, -- in bytes
    status TEXT CHECK (status IN ('queued', 'generating', 'ready', 'failed', 'archived')),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    metadata JSONB
);

CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_script_id ON videos(script_id);

-- Social Media Posts
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    platform TEXT CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'facebook')),
    post_url TEXT,
    caption TEXT,
    hashtags TEXT[],
    scheduled_at TIMESTAMP NOT NULL,
    posted_at TIMESTAMP,
    status TEXT CHECK (status IN ('scheduled', 'posting', 'posted', 'failed', 'cancelled')),
    buffer_post_id TEXT,
    error_message TEXT,
    metadata JSONB
);

CREATE INDEX idx_posts_scheduled_at ON posts(scheduled_at);
CREATE INDEX idx_posts_status_platform ON posts(status, platform);

-- Lead Management
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    source TEXT, -- 'stan_store', 'landing_page', 'manual'
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    captured_at TIMESTAMP DEFAULT NOW(),
    beehiiv_subscriber_id TEXT,
    tags TEXT[],
    lead_score INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('new', 'engaged', 'customer', 'churned')),
    metadata JSONB
);

CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_captured_at ON leads(captured_at DESC);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    stan_store_product_id TEXT UNIQUE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Conversions
CREATE TABLE conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    converted_at TIMESTAMP DEFAULT NOW(),
    stan_store_order_id TEXT UNIQUE,
    attribution_source TEXT, -- which post/campaign led to conversion
    metadata JSONB
);

CREATE INDEX idx_conversions_lead_id ON conversions(lead_id);
CREATE INDEX idx_conversions_converted_at ON conversions(converted_at DESC);

-- Analytics
CREATE TABLE post_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5, 2),
    recorded_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, recorded_at)
);

CREATE INDEX idx_analytics_post_id ON post_analytics(post_id);
CREATE INDEX idx_analytics_recorded_at ON post_analytics(recorded_at DESC);

-- Email Campaigns
CREATE TABLE email_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    beehiiv_campaign_id TEXT,
    sequence_day INTEGER, -- Day in email sequence (0, 1, 3, 5, etc.)
    product_id UUID REFERENCES products(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Email Sends
CREATE TABLE email_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES email_campaigns(id),
    lead_id UUID REFERENCES leads(id),
    sent_at TIMESTAMP DEFAULT NOW(),
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    converted BOOLEAN DEFAULT false,
    beehiiv_send_id TEXT
);

CREATE INDEX idx_email_sends_lead_id ON email_sends(lead_id);
CREATE INDEX idx_email_sends_campaign_id ON email_sends(campaign_id);

-- Users (for admin access)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT CHECK (role IN ('admin', 'editor', 'viewer')),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);
```

#### 2.2 Redis Cache Structure

**Key Patterns**:
```
# Session Management
session:{user_id} → {session_data}
TTL: 24 hours

# API Rate Limiting
ratelimit:{ip}:{endpoint} → {request_count}
TTL: 1 minute

# Video Generation Queue
queue:video_generation → [video_ids]

# Analytics Cache
analytics:dashboard:{date} → {dashboard_data}
TTL: 1 hour

# Lead Scoring Cache
lead_score:{lead_id} → {score}
TTL: 6 hours
```

### 3. n8n Workflow Specifications

#### 3.1 Daily Content Generation Workflow

**Trigger**: Cron (6:00 AM daily)

**Nodes**:
1. **Cron Trigger** → Starts workflow
2. **HTTP Request** → GET /api/v1/scripts/topics (fetch trending topics)
3. **Loop Over Items** → For each topic
4. **OpenAI Node** → Generate script
5. **HTTP Request** → POST /api/v1/scripts (save script)
6. **HTTP Request** → POST /api/v1/videos/create (create video)
7. **Wait** → Poll video status every 30 seconds
8. **Condition** → Check if video ready
9. **HTTP Request** → POST /api/v1/posts/schedule (schedule post)
10. **Slack/Email** → Notify on completion

**Error Handling**:
- Retry failed API calls 3 times
- Send alert if workflow fails
- Log all errors to database

#### 3.2 Lead Capture & Email Automation

**Trigger**: Webhook from Stan Store

**Nodes**:
1. **Webhook Trigger** → Receive lead data
2. **Data Transformation** → Parse and validate
3. **HTTP Request** → POST /api/v1/leads (save lead)
4. **Beehiiv API** → Add subscriber
5. **Wait** → 5 minutes
6. **Beehiiv API** → Send welcome email (Day 0)
7. **Schedule Trigger** → Day 1 email
8. **Schedule Trigger** → Day 3 email
9. **Schedule Trigger** → Day 5 email (Starter Kit pitch)
10. **Schedule Trigger** → Day 7 email (urgency)
11. **Schedule Trigger** → Day 10 email (Notion System pitch)

**Branching Logic**:
- If lead purchases Starter Kit → Skip to Notion System sequence
- If lead opens but doesn't click → Send re-engagement email
- If lead clicks but doesn't purchase → Send objection handler

#### 3.3 Analytics Collection Workflow

**Trigger**: Cron (Every 6 hours)

**Nodes**:
1. **Cron Trigger** → Starts workflow
2. **HTTP Request** → GET /api/v1/posts?status=posted&days=7
3. **Loop Over Posts** → For each post
4. **Switch** → Route by platform
5. **TikTok API** → Fetch metrics
6. **Instagram API** → Fetch metrics
7. **YouTube API** → Fetch metrics
8. **HTTP Request** → POST /api/v1/analytics (save metrics)
9. **Calculate KPIs** → Engagement rate, CTR, etc.
10. **Condition** → Check if metrics below threshold
11. **Alert** → Send notification if underperforming

### 4. API Integration Specifications

#### 4.1 OpenAI Integration

**Endpoint**: `https://api.openai.com/v1/chat/completions`

**Script Generation Prompt**:
```python
system_prompt = """
You are an expert short-form video script writer specializing in viral content.
Create engaging 30-45 second scripts that follow this structure:
1. Hook (3-5 sec): Attention-grabbing opening
2. Problem (5-10 sec): Identify pain point
3. Solution (10-15 sec): Present method
4. Proof (5-10 sec): Show result
5. CTA (3-5 sec): Clear next step

Target audience: Entrepreneurs and content creators
Tone: Conversational, energetic, authentic
"""

user_prompt = f"""
Create a video script about: {topic}
Include a strong hook and clear CTA to visit link in bio.
"""
```

**Configuration**:
- Model: `gpt-4-turbo-preview`
- Temperature: 0.7
- Max tokens: 500
- Top P: 0.9

#### 4.2 HeyGen Integration

**Endpoint**: `https://api.heygen.com/v1/video.generate`

**Request Format**:
```json
{
  "video_inputs": [{
    "character": {
      "type": "avatar",
      "avatar_id": "your_avatar_id",
      "avatar_style": "normal"
    },
    "voice": {
      "type": "text",
      "input_text": "script_content",
      "voice_id": "your_voice_id",
      "speed": 1.0
    },
    "background": {
      "type": "color",
      "value": "#FFFFFF"
    }
  }],
  "dimension": {
    "width": 1080,
    "height": 1920
  },
  "aspect_ratio": "9:16"
}
```

**Webhook Callback**:
```json
{
  "video_id": "generated_video_id",
  "status": "completed",
  "video_url": "https://...",
  "thumbnail_url": "https://...",
  "duration": 35
}
```

#### 4.3 Buffer Integration

**Endpoint**: `https://api.bufferapp.com/1/updates/create.json`

**Request Format**:
```json
{
  "profile_ids": ["tiktok_profile_id", "instagram_profile_id"],
  "text": "caption_with_hashtags",
  "media": {
    "video": "video_url",
    "thumbnail": "thumbnail_url"
  },
  "scheduled_at": "2024-01-15T14:00:00Z",
  "shorten": false
}
```

#### 4.4 Stan Store Integration

**Webhook Payload** (Lead Capture):
```json
{
  "event": "order.created",
  "data": {
    "order_id": "order_123",
    "customer": {
      "email": "customer@example.com",
      "name": "John Doe"
    },
    "items": [{
      "product_id": "prod_123",
      "name": "Starter Kit",
      "price": 19.00
    }],
    "total": 19.00,
    "created_at": "2024-01-15T14:00:00Z"
  }
}
```

#### 4.5 Beehiiv Integration

**Add Subscriber**:
```
POST https://api.beehiiv.com/v2/publications/{pub_id}/subscriptions
{
  "email": "subscriber@example.com",
  "reactivate_existing": false,
  "send_welcome_email": true,
  "utm_source": "stan_store",
  "utm_medium": "funnel"
}
```

**Send Campaign**:
```
POST https://api.beehiiv.com/v2/publications/{pub_id}/campaigns
{
  "subject": "Welcome to the community!",
  "preview_text": "Here's your free guide...",
  "content": "email_html_content",
  "segment_ids": ["segment_123"]
}
```

### 5. Frontend Architecture

#### 5.1 Dashboard Components

**Main Dashboard**:
- Revenue metrics (daily, weekly, monthly)
- Conversion funnel visualization
- Recent posts performance
- Lead capture rate
- Email campaign stats

**Content Manager**:
- Script library with filters
- Video generation queue
- Post scheduler calendar
- Performance by content type

**Analytics View**:
- Platform comparison charts
- Engagement trends over time
- Top performing content
- Conversion attribution

**Lead Manager**:
- Lead list with filters
- Lead scoring visualization
- Email sequence status
- Conversion history

#### 5.2 Tech Stack

**Framework**: React 18 + TypeScript
**Routing**: React Router v6
**State**: Zustand (lightweight, simple)
**UI Components**: shadcn/ui + Tailwind CSS
**Charts**: Recharts
**Forms**: React Hook Form + Zod validation
**API Client**: Axios with interceptors
**Date Handling**: date-fns

**Project Structure**:
```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn components
│   │   ├── dashboard/       # Dashboard widgets
│   │   ├── content/         # Content management
│   │   ├── analytics/       # Charts and reports
│   │   └── leads/           # Lead management
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Content.tsx
│   │   ├── Analytics.tsx
│   │   ├── Leads.tsx
│   │   └── Settings.tsx
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── contentStore.ts
│   │   └── analyticsStore.ts
│   ├── api/
│   │   └── client.ts        # Axios instance
│   ├── hooks/
│   │   └── useAuth.ts
│   ├── utils/
│   │   └── formatters.ts
│   └── App.tsx
```

### 6. Deployment Architecture

#### 6.1 Docker Compose Setup

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: content_monetization
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://admin:${DB_PASSWORD}@postgres:5432/content_monetization
      REDIS_URL: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      HEYGEN_API_KEY: ${HEYGEN_API_KEY}
      BUFFER_ACCESS_TOKEN: ${BUFFER_ACCESS_TOKEN}
    depends_on:
      - postgres
      - redis
    ports:
      - "8000:8000"

  celery_worker:
    build: ./backend
    command: celery -A app.celery worker --loglevel=info
    environment:
      DATABASE_URL: postgresql://admin:${DB_PASSWORD}@postgres:5432/content_monetization
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

  celery_beat:
    build: ./backend
    command: celery -A app.celery beat --loglevel=info
    environment:
      DATABASE_URL: postgresql://admin:${DB_PASSWORD}@postgres:5432/content_monetization
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

  n8n:
    image: n8nio/n8n
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
  n8n_data:
```

### 7. Security Considerations

**Authentication**:
- JWT tokens with 24-hour expiry
- Refresh token rotation
- Password hashing with bcrypt

**API Security**:
- Rate limiting (100 requests/minute per IP)
- CORS whitelist
- Input validation and sanitization
- SQL injection prevention (parameterized queries)

**Data Protection**:
- Encrypt sensitive data at rest
- HTTPS only in production
- API keys stored in environment variables
- Regular security audits

### 8. Monitoring & Logging

**Metrics to Track**:
- API response times
- Error rates by endpoint
- Database query performance
- Video generation success rate
- Email delivery rate
- System resource usage

**Logging Strategy**:
- Structured JSON logs
- Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
- Centralized log aggregation
- Retention: 30 days

**Alerting Rules**:
- API error rate > 5%
- Video generation failure rate > 10%
- Database connection failures
- Disk space < 20%
- Memory usage > 80%

### 9. Performance Optimization

**Backend**:
- Database connection pooling
- Redis caching for frequent queries
- Async processing for long-running tasks
- CDN for video delivery

**Frontend**:
- Code splitting and lazy loading
- Image optimization
- Memoization of expensive computations
- Virtual scrolling for large lists

**Database**:
- Proper indexing strategy
- Query optimization
- Regular VACUUM and ANALYZE
- Partitioning for large tables

### 10. Backup & Recovery

**Database Backups**:
- Daily automated backups
- Retention: 30 days
- Point-in-time recovery capability
- Backup verification tests

**Disaster Recovery**:
- RTO (Recovery Time Objective): 4 hours
- RPO (Recovery Point Objective): 1 hour
- Documented recovery procedures
- Regular DR drills

This technical architecture provides a solid foundation for building a scalable, maintainable AI content monetization system.
# AI Content Monetization System

A fully automated platform for generating AI-powered short-form videos, managing multi-platform distribution, capturing leads, and converting them into customers through automated email sequences.

## 🎯 Overview

This system automates the entire content monetization funnel:
- **Generate**: AI-powered video scripts and content creation
- **Distribute**: Multi-platform social media posting
- **Capture**: Lead generation through optimized funnels
- **Convert**: Automated email sequences and product sales
- **Analyze**: Real-time metrics and performance tracking

## � Business Model

- **Traffic**: Short-form videos (TikTok, Instagram Reels, YouTube Shorts)
- **Lead Magnet**: Free guides and resources
- **Products**: 
  - Starter Kit ($19)
  - Notion Automation System ($49)
- **Goal**: Scale from $0 to $10K/month

## 🏗️ System Architecture

```
Content Generation → Distribution → Lead Capture → Email Automation → Sales
     (OpenAI)         (Buffer)      (Stan Store)     (Beehiiv)      (Products)
```

## 🛠️ Technology Stack

### Backend
- **Python 3.11+** with FastAPI
- **PostgreSQL** for data storage
- **Redis** for caching and queues
- **Celery** for background tasks
- **n8n** for workflow automation

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** + shadcn/ui
- **Recharts** for analytics
- **Zustand** for state management

### Integrations
- OpenAI (GPT-4 for scripts)
- HeyGen (AI video creation)
- Buffer (social media scheduling)
- Stan Store (product sales)
- Beehiiv (email marketing)

## 📋 Prerequisites

Before you begin, ensure you have:

1. **API Keys**:
   - OpenAI API key
   - HeyGen API key
   - Buffer access token
   - Stan Store API credentials
   - Beehiiv API key

2. **Software**:
   - Docker & Docker Compose
   - Python 3.11+
   - Node.js 18+
   - PostgreSQL 15+
   - Redis 7+

3. **Accounts**:
   - Social media accounts (TikTok, Instagram, YouTube)
   - Stan Store account
   - Beehiiv account
   - n8n instance (self-hosted or cloud)

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Create project directory
mkdir ai-content-monetization
cd ai-content-monetization

# Initialize git repository
git init

# Create environment file
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` file with your credentials:

```env
# Database
DATABASE_URL=postgresql://admin:password@localhost:5432/content_monetization
REDIS_URL=redis://localhost:6379

# API Keys
OPENAI_API_KEY=sk-...
HEYGEN_API_KEY=...
BUFFER_ACCESS_TOKEN=...
STAN_STORE_API_KEY=...
BEEHIIV_API_KEY=...

# JWT Secret
JWT_SECRET=your-secret-key-here

# n8n
N8N_PASSWORD=your-n8n-password
```

### 3. Start with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Initialize Database

```bash
# Run migrations
docker-compose exec backend alembic upgrade head

# Create admin user
docker-compose exec backend python scripts/create_admin.py
```

### 5. Access Services

- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Frontend**: http://localhost:3000
- **n8n**: http://localhost:5678

## 📁 Project Structure

```
ai-content-monetization/
├── backend/
│   ├── app/
│   │   ├── api/              # API endpoints
│   │   ├── models/           # Database models
│   │   ├── services/         # Business logic
│   │   ├── integrations/     # External API integrations
│   │   ├── tasks/            # Celery tasks
│   │   └── core/             # Core utilities
│   ├── alembic/              # Database migrations
│   ├── tests/                # Backend tests
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── stores/           # State management
│   │   ├── api/              # API client
│   │   └── utils/            # Utilities
│   ├── package.json
│   └── Dockerfile
├── n8n/
│   └── workflows/            # n8n workflow exports
├── docs/
│   ├── IMPLEMENTATION_PLAN.md
│   ├── TECHNICAL_ARCHITECTURE.md
│   └── API_DOCUMENTATION.md
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🔄 Workflows

### Daily Content Generation

Automated workflow that runs every morning at 6 AM:

1. Fetch trending topics
2. Generate 5 video scripts using OpenAI
3. Create videos with HeyGen
4. Schedule posts across platforms
5. Send notification on completion

### Lead Capture & Email Automation

Triggered when someone opts in through Stan Store:

1. Capture lead information
2. Add to Beehiiv email list
3. Send welcome email with free guide
4. Trigger automated email sequence:
   - Day 0: Welcome + Free Guide
   - Day 1: Quick Win Tutorial
   - Day 3: Case Study
   - Day 5: Starter Kit Pitch
   - Day 7: Urgency + Bonus
   - Day 10: Notion System Pitch

### Analytics Collection

Runs every 6 hours to collect performance metrics:

1. Fetch recent posts
2. Query platform APIs for metrics
3. Calculate engagement rates
4. Update analytics dashboard
5. Send alerts for underperforming content

## � Key Metrics

### Content Performance
- **Views**: Target 10K+ per video
- **Engagement Rate**: Target 5%+
- **Click-Through Rate**: Target 2%+
- **Follower Growth**: Target 1K/week

### Funnel Performance
- **Lead Capture Rate**: Target 5% of clicks
- **Email Open Rate**: Target 40%+
- **Email Click Rate**: Target 10%+
- **Conversion Rate**: Target 3%+

### Revenue Metrics
- **Daily Revenue**: Target $100+
- **Average Order Value**: Target $30
- **Customer Lifetime Value**: Target $75

## 🎬 Content Strategy

### Script Template

Every video follows this proven structure:

1. **Hook** (3-5 sec): Attention-grabbing opening
2. **Problem** (5-10 sec): Identify pain point
3. **Solution** (10-15 sec): Present your method
4. **Proof** (5-10 sec): Show results
5. **CTA** (3-5 sec): Clear next step

### Content Pillars

- **Educational**: How-to guides, tutorials (40%)
- **Inspirational**: Success stories, transformations (30%)
- **Entertaining**: Relatable content, humor (20%)
- **Promotional**: Product features, offers (10%)

### Posting Schedule

- **TikTok**: 3-5 videos/day (8 AM, 12 PM, 5 PM, 8 PM)
- **Instagram Reels**: 2-3 videos/day (9 AM, 3 PM, 7 PM)
- **YouTube Shorts**: 2-3 videos/day (10 AM, 2 PM, 6 PM)

## 🔧 Configuration

### OpenAI Settings

```python
{
  "model": "gpt-4-turbo-preview",
  "temperature": 0.7,
  "max_tokens": 500,
  "top_p": 0.9
}
```

### HeyGen Settings

```python
{
  "dimension": {
    "width": 1080,
    "height": 1920
  },
  "aspect_ratio": "9:16",
  "voice_speed": 1.0
}
```

### Buffer Settings

```python
{
  "platforms": ["tiktok", "instagram", "youtube"],
  "optimal_times": ["08:00", "12:00", "17:00", "20:00"],
  "timezone": "America/Chicago"
}
```

## 📈 Scaling Roadmap

### Phase 1: Validation ($0 - $1K/month)
- ✅ Set up all integrations
- ✅ Post 3 videos/day
- ✅ Test hooks and CTAs
- ✅ Validate product-market fit
- 🎯 Goal: First 10 sales

### Phase 2: Optimization ($1K - $3K/month)
- ✅ Automate content generation
- ✅ A/B test hooks and thumbnails
- ✅ Optimize email sequences
- ✅ Improve conversion rates
- 🎯 Goal: 2-3 sales/day

### Phase 3: Scaling ($3K - $10K/month)
- ✅ Increase to 5 videos/day
- ✅ Expand to more platforms
- ✅ Launch affiliate program
- ✅ Create higher-ticket product ($197)
- 🎯 Goal: 5-10 sales/day

## � Security

- JWT authentication with 24-hour expiry
- Rate limiting (100 requests/minute)
- Input validation and sanitization
- HTTPS only in production
- API keys in environment variables
- Regular security audits

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test

# Integration tests
docker-compose -f docker-compose.test.yml up
```

## 📚 API Documentation

Full API documentation is available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## 🐛 Troubleshooting

### Video Generation Fails

```bash
# Check HeyGen API status
curl -X GET https://api.heygen.com/v1/status \
  -H "Authorization: Bearer YOUR_API_KEY"

# Check logs
docker-compose logs backend | grep heygen
```

### Email Not Sending

```bash
# Verify Beehiiv connection
docker-compose exec backend python scripts/test_beehiiv.py

# Check email queue
docker-compose exec redis redis-cli LLEN email_queue
```

### Database Connection Issues

```bash
# Check PostgreSQL status
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U admin -d content_monetization
```

## 📞 Support

For issues and questions:
- Check the [documentation](docs/)
- Review [common issues](docs/TROUBLESHOOTING.md)
- Open an issue on GitHub

## 📄 License

This project is proprietary software. All rights reserved.

## 🙏 Acknowledgments

Built with:
- [FastAPI](https://fastapi.tiangolo.com/)
- [React](https://react.dev/)
- [n8n](https://n8n.io/)
- [OpenAI](https://openai.com/)
- [HeyGen](https://heygen.com/)

---

**Ready to start generating income with AI content?** Follow the Quick Start guide above and you'll be up and running in minutes!
<!-- trigger build -->

<!-- retrigger after secrets added -->

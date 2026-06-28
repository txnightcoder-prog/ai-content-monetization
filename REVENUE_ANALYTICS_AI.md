# AI-Powered Revenue Analytics
## Track What Makes Money & Get AI Insights

Complete system for tracking video performance, revenue, and using AI to identify profitable content patterns.

---

## 🎯 System Overview

```
┌─────────────────────────────────────────────────────────┐
│              Analytics Dashboard                         │
│  • Revenue tracking                                      │
│  • Performance metrics                                   │
│  • AI insights                                           │
│  • Trend analysis                                        │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│           Data Collection & Processing                   │
│  • Platform APIs (YouTube, TikTok, FB, IG)              │
│  • Revenue data aggregation                              │
│  • Performance metrics                                   │
│  • Database storage                                      │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              AI Analysis Engine                          │
│  • OpenAI GPT-4 analysis                                │
│  • Pattern recognition                                   │
│  • Trend prediction                                      │
│  • Content recommendations                               │
└─────────────────────────────────────────────────────────┘
```

---

## 💰 Revenue Tracking

### Data Model

```python
# backend/app/models/analytics.py
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

class VideoAnalytics(Base):
    __tablename__ = "video_analytics"
    
    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey("videos.id"))
    platform = Column(String)  # youtube, tiktok, facebook, instagram
    platform_video_id = Column(String)
    
    # Performance Metrics
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    watch_time_minutes = Column(Float, default=0)
    engagement_rate = Column(Float, default=0)
    
    # Revenue Metrics
    revenue_usd = Column(Float, default=0)
    rpm = Column(Float, default=0)  # Revenue per 1000 views
    cpm = Column(Float, default=0)  # Cost per 1000 impressions
    
    # Timestamps
    published_at = Column(DateTime)
    last_updated = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    video = relationship("Video", back_populates="analytics")


class RevenueReport(Base):
    __tablename__ = "revenue_reports"
    
    id = Column(Integer, primary_key=True)
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    
    # Platform Breakdown
    youtube_revenue = Column(Float, default=0)
    tiktok_revenue = Column(Float, default=0)
    facebook_revenue = Column(Float, default=0)
    instagram_revenue = Column(Float, default=0)
    
    # Totals
    total_revenue = Column(Float, default=0)
    total_views = Column(Integer, default=0)
    total_videos = Column(Integer, default=0)
    
    # AI Insights
    ai_insights = Column(String)  # JSON string
    top_performing_topics = Column(String)  # JSON string
    recommendations = Column(String)  # JSON string
    
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## 📊 Analytics Collection Service

```python
# backend/app/services/analytics_collector.py
from typing import Dict, List
import asyncio

class AnalyticsCollector:
    def __init__(self, db_session):
        self.db = db_session
        self.youtube = YouTubePublisher()
        self.tiktok = TikTokPublisher()
        self.facebook = FacebookPublisher()
        self.instagram = InstagramPublisher()
    
    async def collect_all_analytics(self):
        """Collect analytics from all platforms"""
        tasks = [
            self.collect_youtube_analytics(),
            self.collect_tiktok_analytics(),
            self.collect_facebook_analytics(),
            self.collect_instagram_analytics()
        ]
        
        results = await asyncio.gather(*tasks)
        return self.aggregate_results(results)
    
    async def collect_youtube_analytics(self):
        """Collect YouTube analytics and revenue"""
        videos = self.db.query(Video).filter(
            Video.platform_ids.contains('youtube')
        ).all()
        
        analytics_data = []
        
        for video in videos:
            youtube_id = video.platform_ids['youtube']
            
            # Get video statistics
            stats = self.youtube.get_video_analytics(youtube_id)
            
            # Get revenue data (requires YouTube Partner Program)
            revenue = await self.youtube.get_revenue_data(youtube_id)
            
            analytics = VideoAnalytics(
                video_id=video.id,
                platform='youtube',
                platform_video_id=youtube_id,
                views=int(stats.get('viewCount', 0)),
                likes=int(stats.get('likeCount', 0)),
                comments=int(stats.get('commentCount', 0)),
                revenue_usd=revenue.get('estimated_revenue', 0),
                rpm=revenue.get('rpm', 0)
            )
            
            analytics_data.append(analytics)
        
        return analytics_data
    
    async def collect_tiktok_analytics(self):
        """Collect TikTok analytics"""
        videos = self.db.query(Video).filter(
            Video.platform_ids.contains('tiktok')
        ).all()
        
        analytics_data = []
        
        for video in videos:
            tiktok_id = video.platform_ids['tiktok']
            stats = self.tiktok.get_video_analytics(tiktok_id)
            
            # TikTok Creator Fund revenue (if eligible)
            revenue = stats.get('estimated_earnings', 0)
            
            analytics = VideoAnalytics(
                video_id=video.id,
                platform='tiktok',
                platform_video_id=tiktok_id,
                views=stats.get('view_count', 0),
                likes=stats.get('like_count', 0),
                comments=stats.get('comment_count', 0),
                shares=stats.get('share_count', 0),
                revenue_usd=revenue
            )
            
            analytics_data.append(analytics)
        
        return analytics_data
```

---

## 🤖 AI Analysis Engine

```python
# backend/app/services/ai_analytics.py
from openai import OpenAI
import json

class AIAnalytics:
    def __init__(self, openai_api_key: str):
        self.client = OpenAI(api_key=openai_api_key)
    
    async def analyze_profitable_content(self, analytics_data: List[VideoAnalytics]):
        """
        Use AI to analyze what content makes money
        
        Returns insights on:
        - Most profitable topics
        - Best performing formats
        - Optimal posting times
        - Content recommendations
        """
        # Prepare data for AI analysis
        data_summary = self._prepare_data_summary(analytics_data)
        
        prompt = f"""
        Analyze this video performance data and identify patterns in profitable content:
        
        {json.dumps(data_summary, indent=2)}
        
        Provide insights on:
        1. Which topics/themes generate the most revenue
        2. What video characteristics correlate with high earnings
        3. Platform-specific performance patterns
        4. Recommendations for future content
        5. Trending topics to capitalize on
        
        Format your response as JSON with these keys:
        - top_topics: List of most profitable topics
        - success_patterns: Key characteristics of high-earning videos
        - platform_insights: Platform-specific recommendations
        - content_recommendations: 5 specific video ideas to create next
        - revenue_forecast: Predicted earnings for recommended content
        """
        
        response = self.client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert data analyst specializing in social media monetization and content strategy."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        insights = json.loads(response.choices[0].message.content)
        return insights
    
    def _prepare_data_summary(self, analytics_data: List[VideoAnalytics]):
        """Prepare analytics data for AI analysis"""
        summary = {
            "total_videos": len(analytics_data),
            "total_revenue": sum(a.revenue_usd for a in analytics_data),
            "total_views": sum(a.views for a in analytics_data),
            "videos": []
        }
        
        for analytics in analytics_data:
            video = analytics.video
            summary["videos"].append({
                "topic": video.script.topic,
                "niche": video.script.niche,
                "platform": analytics.platform,
                "views": analytics.views,
                "engagement_rate": analytics.engagement_rate,
                "revenue": analytics.revenue_usd,
                "rpm": analytics.rpm,
                "published_date": analytics.published_at.isoformat()
            })
        
        return summary
    
    async def generate_content_ideas(self, profitable_topics: List[str]):
        """Generate new content ideas based on profitable topics"""
        prompt = f"""
        Based on these profitable topics: {', '.join(profitable_topics)}
        
        Generate 10 specific video script ideas that are likely to perform well.
        Each idea should:
        - Be related to proven profitable topics
        - Have viral potential
        - Be suitable for 30-60 second videos
        - Include a compelling hook
        
        Format as JSON array with: topic, hook, estimated_appeal_score (1-10)
        """
        
        response = self.client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a viral content strategist."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        ideas = json.loads(response.choices[0].message.content)
        return ideas
```

---

## 📈 Analytics Dashboard API

```python
# backend/app/api/routes/analytics.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/dashboard")
async def get_dashboard_data(
    period_days: int = 30,
    db: Session = Depends(get_db)
):
    """Get dashboard overview data"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=period_days)
    
    # Get analytics for period
    analytics = db.query(VideoAnalytics).filter(
        VideoAnalytics.published_at >= start_date,
        VideoAnalytics.published_at <= end_date
    ).all()
    
    # Calculate totals
    total_revenue = sum(a.revenue_usd for a in analytics)
    total_views = sum(a.views for a in analytics)
    total_videos = len(set(a.video_id for a in analytics))
    
    # Platform breakdown
    platform_stats = {}
    for platform in ['youtube', 'tiktok', 'facebook', 'instagram']:
        platform_analytics = [a for a in analytics if a.platform == platform]
        platform_stats[platform] = {
            'revenue': sum(a.revenue_usd for a in platform_analytics),
            'views': sum(a.views for a in platform_analytics),
            'videos': len(platform_analytics)
        }
    
    return {
        'period': {'start': start_date, 'end': end_date, 'days': period_days},
        'totals': {
            'revenue': total_revenue,
            'views': total_views,
            'videos': total_videos,
            'avg_rpm': total_revenue / (total_views / 1000) if total_views > 0 else 0
        },
        'platforms': platform_stats
    }

@router.get("/top-performing")
async def get_top_performing_videos(
    limit: int = 10,
    metric: str = "revenue",  # revenue, views, engagement
    db: Session = Depends(get_db)
):
    """Get top performing videos"""
    query = db.query(VideoAnalytics).join(Video)
    
    if metric == "revenue":
        query = query.order_by(VideoAnalytics.revenue_usd.desc())
    elif metric == "views":
        query = query.order_by(VideoAnalytics.views.desc())
    elif metric == "engagement":
        query = query.order_by(VideoAnalytics.engagement_rate.desc())
    
    top_videos = query.limit(limit).all()
    
    return [
        {
            'video_id': a.video_id,
            'topic': a.video.script.topic,
            'platform': a.platform,
            'views': a.views,
            'revenue': a.revenue_usd,
            'engagement_rate': a.engagement_rate,
            'published_at': a.published_at
        }
        for a in top_videos
    ]

@router.post("/ai-insights")
async def generate_ai_insights(
    period_days: int = 30,
    db: Session = Depends(get_db)
):
    """Generate AI-powered insights on profitable content"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=period_days)
    
    # Get analytics data
    analytics = db.query(VideoAnalytics).filter(
        VideoAnalytics.published_at >= start_date
    ).all()
    
    # Generate AI insights
    ai_analytics = AIAnalytics(openai_api_key=settings.OPENAI_API_KEY)
    insights = await ai_analytics.analyze_profitable_content(analytics)
    
    # Save insights to database
    report = RevenueReport(
        period_start=start_date,
        period_end=end_date,
        total_revenue=sum(a.revenue_usd for a in analytics),
        total_views=sum(a.views for a in analytics),
        total_videos=len(analytics),
        ai_insights=json.dumps(insights)
    )
    db.add(report)
    db.commit()
    
    return insights

@router.get("/content-recommendations")
async def get_content_recommendations(db: Session = Depends(get_db)):
    """Get AI-generated content recommendations based on profitable topics"""
    # Get most recent insights
    latest_report = db.query(RevenueReport).order_by(
        RevenueReport.created_at.desc()
    ).first()
    
    if not latest_report:
        return {"error": "No analytics data available. Generate insights first."}
    
    insights = json.loads(latest_report.ai_insights)
    profitable_topics = insights.get('top_topics', [])
    
    # Generate new content ideas
    ai_analytics = AIAnalytics(openai_api_key=settings.OPENAI_API_KEY)
    ideas = await ai_analytics.generate_content_ideas(profitable_topics)
    
    return ideas
```

---

## 🎨 Frontend Analytics Dashboard

```typescript
// frontend/src/pages/Analytics.tsx
import { useState, useEffect } from 'react';

interface DashboardData {
  period: { start: string; end: string; days: number };
  totals: {
    revenue: number;
    views: number;
    videos: number;
    avg_rpm: number;
  };
  platforms: {
    [key: string]: {
      revenue: number;
      views: number;
      videos: number;
    };
  };
}

interface AIInsights {
  top_topics: string[];
  success_patterns: string[];
  platform_insights: { [key: string]: string };
  content_recommendations: Array<{
    topic: string;
    hook: string;
    estimated_revenue: number;
  }>;
}

function AnalyticsDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const fetchDashboardData = async () => {
    const response = await fetch(`http://localhost:8010/api/analytics/dashboard?period_days=${period}`);
    const data = await response.json();
    setDashboardData(data);
    setLoading(false);
  };

  const generateInsights = async () => {
    setLoading(true);
    const response = await fetch('http://localhost:8010/api/analytics/ai-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_days: period })
    });
    const data = await response.json();
    setInsights(data);
    setLoading(false);
  };

  if (loading) return <div>Loading analytics...</div>;

  return (
    <div className="analytics-dashboard">
      <h1>Revenue Analytics</h1>
      
      {/* Period Selector */}
      <div className="period-selector">
        <button onClick={() => setPeriod(7)}>Last 7 Days</button>
        <button onClick={() => setPeriod(30)}>Last 30 Days</button>
        <button onClick={() => setPeriod(90)}>Last 90 Days</button>
      </div>

      {/* Revenue Overview */}
      <div className="revenue-overview">
        <div className="stat-card">
          <h3>Total Revenue</h3>
          <p className="stat-value">${dashboardData?.totals.revenue.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Total Views</h3>
          <p className="stat-value">{dashboardData?.totals.views.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <h3>Videos Published</h3>
          <p className="stat-value">{dashboardData?.totals.videos}</p>
        </div>
        <div className="stat-card">
          <h3>Average RPM</h3>
          <p className="stat-value">${dashboardData?.totals.avg_rpm.toFixed(2)}</p>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="platform-breakdown">
        <h2>Platform Performance</h2>
        {Object.entries(dashboardData?.platforms || {}).map(([platform, stats]) => (
          <div key={platform} className="platform-card">
            <h3>{platform.charAt(0).toUpperCase() + platform.slice(1)}</h3>
            <p>Revenue: ${stats.revenue.toFixed(2)}</p>
            <p>Views: {stats.views.toLocaleString()}</p>
            <p>Videos: {stats.videos}</p>
          </div>
        ))}
      </div>

      {/* AI Insights */}
      <div className="ai-insights-section">
        <h2>AI-Powered Insights</h2>
        <button onClick={generateInsights} disabled={loading}>
          {loading ? 'Generating Insights...' : 'Generate AI Insights'}
        </button>

        {insights && (
          <div className="insights-content">
            <div className="insight-card">
              <h3>🎯 Top Profitable Topics</h3>
              <ul>
                {insights.top_topics.map((topic, i) => (
                  <li key={i}>{topic}</li>
                ))}
              </ul>
            </div>

            <div className="insight-card">
              <h3>✨ Success Patterns</h3>
              <ul>
                {insights.success_patterns.map((pattern, i) => (
                  <li key={i}>{pattern}</li>
                ))}
              </ul>
            </div>

            <div className="insight-card">
              <h3>💡 Content Recommendations</h3>
              {insights.content_recommendations.map((rec, i) => (
                <div key={i} className="recommendation">
                  <h4>{rec.topic}</h4>
                  <p>{rec.hook}</p>
                  <span>Est. Revenue: ${rec.estimated_revenue}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 🔄 Automated Analytics Collection

```python
# backend/app/tasks/analytics_tasks.py
from celery import Celery
from app.services.analytics_collector import AnalyticsCollector

celery_app = Celery('analytics_tasks')

@celery_app.task
def collect_analytics_daily():
    """Run daily analytics collection"""
    collector = AnalyticsCollector(db_session)
    results = await collector.collect_all_analytics()
    return results

@celery_app.task
def generate_weekly_insights():
    """Generate AI insights weekly"""
    ai_analytics = AIAnalytics(openai_api_key=settings.OPENAI_API_KEY)
    
    # Get last 7 days of data
    analytics = db.query(VideoAnalytics).filter(
        VideoAnalytics.published_at >= datetime.utcnow() - timedelta(days=7)
    ).all()
    
    insights = await ai_analytics.analyze_profitable_content(analytics)
    
    # Send email notification with insights
    send_insights_email(insights)
    
    return insights

# Schedule tasks
celery_app.conf.beat_schedule = {
    'collect-analytics-daily': {
        'task': 'analytics_tasks.collect_analytics_daily',
        'schedule': crontab(hour=2, minute=0)  # 2 AM daily
    },
    'generate-weekly-insights': {
        'task': 'analytics_tasks.generate_weekly_insights',
        'schedule': crontab(day_of_week=1, hour=9, minute=0)  # Monday 9 AM
    }
}
```

---

## 📊 Key Metrics Tracked

### Revenue Metrics:
- Total revenue per video
- Revenue per platform
- RPM (Revenue per 1000 views)
- CPM (Cost per 1000 impressions)
- Revenue trends over time

### Performance Metrics:
- Views, likes, comments, shares
- Watch time
- Engagement rate
- Click-through rate
- Audience retention

### Content Metrics:
- Top performing topics
- Best video formats
- Optimal video length
- Best posting times
- Trending hashtags

---

## 🎯 AI Insights Examples

### What AI Can Tell You:

1. **"Videos about 'ChatGPT tutorials' generate 3x more revenue than other topics"**

2. **"Your 45-second videos perform 40% better than 60-second videos"**

3. **"TikTok generates highest engagement but YouTube generates highest revenue"**

4. **"Videos posted on Tuesday at 2 PM get 2x more views"**

5. **"Adding 'AI' in the title increases views by 35%"**

### Content Recommendations:

```json
{
  "recommendations": [
    {
      "topic": "Top 5 AI Tools That Will Replace Your Job",
      "hook": "Your job might disappear in 6 months...",
      "estimated_revenue": "$150",
      "confidence": 0.85
    },
    {
      "topic": "ChatGPT vs Claude: Which AI is Better?",
      "hook": "I tested both AIs for 30 days...",
      "estimated_revenue": "$120",
      "confidence": 0.78
    }
  ]
}
```

---

## 💡 Implementation Checklist

### Backend:
- [ ] Create analytics data models
- [ ] Implement analytics collector service
- [ ] Build AI analysis engine
- [ ] Create analytics API endpoints
- [ ] Setup automated collection tasks
- [ ] Add revenue tracking

### Frontend:
- [ ] Create analytics dashboard page
- [ ] Add revenue overview cards
- [ ] Build platform comparison charts
- [ ] Add AI insights display
- [ ] Create content recommendations UI
- [ ] Add export/reporting features

### Integration:
- [ ] Connect to YouTube Analytics API
- [ ] Connect to TikTok Analytics API
- [ ] Connect to Facebook Insights API
- [ ] Connect to Instagram Insights API
- [ ] Setup OpenAI for analysis
- [ ] Configure automated tasks

---

## 🚀 Quick Start

1. **Setup Analytics Collection:**
```bash
# Install dependencies
pip install celery redis

# Start Redis
redis-server

# Start Celery worker
celery -A app.tasks.analytics_tasks worker --loglevel=info

# Start Celery beat (scheduler)
celery -A app.tasks.analytics_tasks beat --loglevel=info
```

2. **Configure Environment:**
```env
OPENAI_API_KEY=your_key
YOUTUBE_API_KEY=your_key
TIKTOK_API_KEY=your_key
FACEBOOK_API_KEY=your_key
INSTAGRAM_API_KEY=your_key
```

3. **Run First Analysis:**
```bash
# Collect analytics
curl -X POST http://localhost:8010/api/analytics/collect

# Generate insights
curl -X POST http://localhost:8010/api/analytics/ai-insights
```

---

**This system will tell you exactly what content makes money and what to create next!**

Made with Bob
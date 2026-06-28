# Video Generation Integration Guide
## Multiple AI Video Services

This guide covers integration with popular AI video generation platforms for creating faceless videos and AI-generated content.

---

## 🎬 Supported Video Generation Services

### 1. **Pictory.ai** (Recommended for Faceless Videos)
**Best for:** Text-to-video, script-based videos, stock footage
**Pricing:** $19-47/month
**API:** Available

### 2. **Runway ML Gen-2/Gen-3** 
**Best for:** AI-generated video, creative content
**Pricing:** $12-76/month
**API:** Available

### 3. **Synthesia**
**Best for:** AI avatars, talking head videos
**Pricing:** $22-67/month
**API:** Available

### 4. **D-ID**
**Best for:** Talking avatars, photo animation
**Pricing:** $5.9-196/month
**API:** Available

### 5. **InVideo AI**
**Best for:** Faceless videos, stock footage automation
**Pricing:** $20-60/month
**API:** Limited

### 6. **Lumen5**
**Best for:** Social media videos, blog-to-video
**Pricing:** $19-149/month
**API:** Limited

### 7. **Fliki**
**Best for:** Text-to-video, AI voices
**Pricing:** $21-66/month
**API:** Available

---

## 🚀 Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend UI                          │
│  • Select video service                                 │
│  • Configure video settings                             │
│  • Monitor generation progress                          │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  Backend API Layer                      │
│  • Video service router                                 │
│  • Job queue management                                 │
│  • Webhook handlers                                     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Video Service Integrations                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Pictory  │  │  Runway  │  │ Synthesia│             │
│  └──────────┘  └──────────┘  └──────────┘             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │   D-ID   │  │  InVideo │  │  Fliki   │             │
│  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Plan

### Phase 2A: Core Video Generation Infrastructure

#### Backend Tasks:
1. **Create video service abstraction layer**
   ```python
   # backend/app/services/video_generator_base.py
   class VideoGeneratorBase:
       def generate_video(script, settings)
       def check_status(job_id)
       def download_video(job_id)
   ```

2. **Implement service-specific adapters**
   - Pictory adapter
   - Runway adapter
   - Synthesia adapter
   - D-ID adapter

3. **Add job queue system**
   - Celery + Redis for background processing
   - Job status tracking
   - Webhook handling

4. **Create video management endpoints**
   - POST `/api/videos/generate`
   - GET `/api/videos/{id}/status`
   - GET `/api/videos/{id}/download`

#### Frontend Tasks:
1. **Create Videos page**
2. **Add service selector**
3. **Build configuration forms**
4. **Add progress tracking**
5. **Video preview/download**

---

## 🔧 Service-Specific Integration Details

### 1. Pictory.ai Integration

#### API Setup:
```bash
# Get API key from: https://pictory.ai/api
```

#### Backend Implementation:
```python
# backend/app/services/pictory_service.py
import requests

class PictoryService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.pictory.ai/v1"
    
    def create_video_from_script(self, script: dict, settings: dict):
        """
        Create video from script using Pictory
        
        Args:
            script: {hook, body, cta}
            settings: {
                template: "modern" | "minimal" | "bold",
                voice: "male" | "female",
                music: "upbeat" | "calm" | "none",
                duration: 30-60
            }
        """
        payload = {
            "text": f"{script['hook']} {script['body']} {script['cta']}",
            "template": settings.get("template", "modern"),
            "voice": settings.get("voice", "male"),
            "music": settings.get("music", "upbeat"),
            "duration": settings.get("duration", 45)
        }
        
        response = requests.post(
            f"{self.base_url}/videos",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json=payload
        )
        
        return response.json()
    
    def get_video_status(self, job_id: str):
        response = requests.get(
            f"{self.base_url}/videos/{job_id}",
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        return response.json()
```

#### Configuration:
```env
# .env
PICTORY_API_KEY=your_pictory_api_key
```

---

### 2. Runway ML Integration

#### API Setup:
```bash
# Get API key from: https://runwayml.com/
```

#### Backend Implementation:
```python
# backend/app/services/runway_service.py
import requests

class RunwayService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.runwayml.com/v1"
    
    def generate_video(self, prompt: str, settings: dict):
        """
        Generate video using Runway Gen-2/Gen-3
        
        Args:
            prompt: Text description of video
            settings: {
                model: "gen2" | "gen3",
                duration: 4-16 seconds,
                aspect_ratio: "16:9" | "9:16" | "1:1",
                style: "realistic" | "artistic" | "cinematic"
            }
        """
        payload = {
            "prompt": prompt,
            "model": settings.get("model", "gen3"),
            "duration": settings.get("duration", 8),
            "aspect_ratio": settings.get("aspect_ratio", "9:16"),
            "style": settings.get("style", "realistic")
        }
        
        response = requests.post(
            f"{self.base_url}/generate",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        
        return response.json()
    
    def check_generation_status(self, task_id: str):
        response = requests.get(
            f"{self.base_url}/tasks/{task_id}",
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        return response.json()
```

#### Configuration:
```env
# .env
RUNWAY_API_KEY=your_runway_api_key
```

---

### 3. Synthesia Integration

#### API Setup:
```bash
# Get API key from: https://www.synthesia.io/api
```

#### Backend Implementation:
```python
# backend/app/services/synthesia_service.py
import requests

class SynthesiaService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.synthesia.io/v2"
    
    def create_avatar_video(self, script: dict, settings: dict):
        """
        Create video with AI avatar
        
        Args:
            script: {hook, body, cta}
            settings: {
                avatar: "anna" | "james" | "sarah",
                voice: "en-US-Neural2-A",
                background: "office" | "studio" | "green",
                aspect_ratio: "16:9" | "9:16"
            }
        """
        full_script = f"{script['hook']} {script['body']} {script['cta']}"
        
        payload = {
            "input": [
                {
                    "avatarSettings": {
                        "voice": settings.get("voice", "en-US-Neural2-A"),
                        "horizontalAlign": "center"
                    },
                    "avatar": settings.get("avatar", "anna"),
                    "background": settings.get("background", "studio"),
                    "script": full_script
                }
            ],
            "aspectRatio": settings.get("aspect_ratio", "9:16")
        }
        
        response = requests.post(
            f"{self.base_url}/videos",
            headers={
                "Authorization": self.api_key,
                "Content-Type": "application/json"
            },
            json=payload
        )
        
        return response.json()
```

---

### 4. D-ID Integration

#### API Setup:
```bash
# Get API key from: https://www.d-id.com/api/
```

#### Backend Implementation:
```python
# backend/app/services/did_service.py
import requests

class DIDService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.d-id.com"
    
    def create_talking_avatar(self, script: dict, settings: dict):
        """
        Create talking avatar video
        
        Args:
            script: {hook, body, cta}
            settings: {
                source_url: URL to image,
                voice_id: "en-US-JennyNeural",
                driver_url: "bank://lively" | "bank://subtle"
            }
        """
        full_script = f"{script['hook']} {script['body']} {script['cta']}"
        
        payload = {
            "source_url": settings.get("source_url"),
            "script": {
                "type": "text",
                "input": full_script,
                "provider": {
                    "type": "microsoft",
                    "voice_id": settings.get("voice_id", "en-US-JennyNeural")
                }
            },
            "config": {
                "driver_url": settings.get("driver_url", "bank://lively")
            }
        }
        
        response = requests.post(
            f"{self.base_url}/talks",
            headers={
                "Authorization": f"Basic {self.api_key}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        
        return response.json()
```

---

## 🎨 Frontend Implementation

### Videos Page Component

```typescript
// frontend/src/pages/Videos.tsx
interface VideoSettings {
  service: 'pictory' | 'runway' | 'synthesia' | 'did';
  template?: string;
  voice?: string;
  avatar?: string;
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

function VideosPage() {
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [service, setService] = useState<string>('pictory');
  const [settings, setSettings] = useState<VideoSettings>({});
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateVideo = async () => {
    setGenerating(true);
    
    const response = await fetch('http://localhost:8010/api/videos/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script_id: selectedScript.id,
        service: service,
        settings: settings
      })
    });
    
    const job = await response.json();
    pollVideoStatus(job.id);
  };

  const pollVideoStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      const response = await fetch(`http://localhost:8010/api/videos/${jobId}/status`);
      const status = await response.json();
      
      setProgress(status.progress);
      
      if (status.status === 'completed') {
        clearInterval(interval);
        setGenerating(false);
        // Download or display video
      }
    }, 5000);
  };

  return (
    <div>
      <h1>Generate Video</h1>
      
      {/* Service Selector */}
      <select value={service} onChange={(e) => setService(e.target.value)}>
        <option value="pictory">Pictory (Faceless Videos)</option>
        <option value="runway">Runway ML (AI Generated)</option>
        <option value="synthesia">Synthesia (AI Avatar)</option>
        <option value="did">D-ID (Talking Avatar)</option>
      </select>
      
      {/* Service-specific settings */}
      {service === 'pictory' && <PictorySettings />}
      {service === 'runway' && <RunwaySettings />}
      {service === 'synthesia' && <SynthesiaSettings />}
      {service === 'did' && <DIDSettings />}
      
      <button onClick={generateVideo} disabled={generating}>
        {generating ? `Generating... ${progress}%` : 'Generate Video'}
      </button>
    </div>
  );
}
```

---

## 💰 Cost Comparison

| Service | Entry Plan | Videos/Month | Best For |
|---------|-----------|--------------|----------|
| **Pictory** | $19/mo | 30 videos | Faceless, stock footage |
| **Runway** | $12/mo | 125 credits | AI-generated, creative |
| **Synthesia** | $22/mo | 10 minutes | Professional avatars |
| **D-ID** | $5.9/mo | 20 credits | Quick talking heads |
| **InVideo** | $20/mo | Unlimited | Social media content |
| **Fliki** | $21/mo | 180 minutes | Text-to-speech videos |

---

## 🔄 Workflow Example

### Complete Video Generation Flow:

1. **User generates script** (Phase 1 ✅)
2. **User selects video service** (Pictory, Runway, etc.)
3. **User configures settings** (template, voice, style)
4. **Backend creates video job**
5. **Service generates video** (async, 2-10 minutes)
6. **Webhook notifies completion**
7. **User downloads/previews video**
8. **User publishes to platforms** (Phase 3)

---

## 📝 Implementation Checklist

### Backend:
- [ ] Create video service base class
- [ ] Implement Pictory adapter
- [ ] Implement Runway adapter
- [ ] Implement Synthesia adapter
- [ ] Implement D-ID adapter
- [ ] Add job queue (Celery + Redis)
- [ ] Create video endpoints
- [ ] Add webhook handlers
- [ ] Implement video storage

### Frontend:
- [ ] Create Videos page
- [ ] Add service selector
- [ ] Build Pictory settings form
- [ ] Build Runway settings form
- [ ] Build Synthesia settings form
- [ ] Build D-ID settings form
- [ ] Add progress tracking
- [ ] Add video preview
- [ ] Add download functionality

### Testing:
- [ ] Test each service integration
- [ ] Test job queue
- [ ] Test webhooks
- [ ] Test error handling
- [ ] Test video download

---

## 🚀 Quick Start

### 1. Get API Keys:
- Pictory: https://pictory.ai/api
- Runway: https://runwayml.com/
- Synthesia: https://www.synthesia.io/api
- D-ID: https://www.d-id.com/api/

### 2. Add to .env:
```env
PICTORY_API_KEY=your_key
RUNWAY_API_KEY=your_key
SYNTHESIA_API_KEY=your_key
DID_API_KEY=your_key
```

### 3. Install Dependencies:
```bash
cd backend
pip install celery redis requests
```

### 4. Start Redis:
```bash
# Windows
# Download from: https://github.com/microsoftarchive/redis/releases
redis-server
```

---

## 📚 Additional Resources

- **Pictory API Docs:** https://docs.pictory.ai/
- **Runway API Docs:** https://docs.runwayml.com/
- **Synthesia API Docs:** https://docs.synthesia.io/
- **D-ID API Docs:** https://docs.d-id.com/

---

**Next Steps:** Choose 1-2 services to implement first (recommend Pictory + Runway)

Made with Bob
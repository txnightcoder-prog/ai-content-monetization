import { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

interface Script {
  id: string;
  topic: string;
  hook: string;
  body: string;
  cta: string;
  script_metadata?: { niche?: string; [key: string]: unknown };
  created_at: string;
}

interface VideoRecord {
  id: string;
  script_id: string;
  status: 'generating' | 'ready' | 'posted' | 'failed';
  video_url: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  created_at: string;
}

interface VideoBlueprint {
  id: number;
  title: string;
  topic: string;
  niche: string;
  structure: {
    hook?: string;
    intro?: string;
    sections?: Array<{
      title: string;
      content: string;
      tips?: string[];
    }>;
    outro?: string;
  };
  thumbnail_ideas?: string[];
  metadata?: {
    target_audience?: string;
    estimated_length?: string;
    cpm_potential?: string;
  };
  created_at: string;
}

// ── Trending types ────────────────────────────────────────────────────────────
interface TrendingItem {
  rank: number;
  title: string;
  creator: string;
  views: string;
  tags: string[];
  why_trending: string;
  use_for_niche: string;
  url?: string;
}

interface TrendingResult {
  youtube: TrendingItem[];
  tiktok: TrendingItem[];
  instagram: TrendingItem[];
}

// ── Parrot types ──────────────────────────────────────────────────────────────
interface ParrotResult {
  id: string;
  source_video: { url: string; title: string; channel: string; views: string; likes: string };
  blueprint: {
    source_analysis?: { hook_style: string; structure: string; tone: string; why_it_works: string };
    title: string;
    topic: string;
    niche: string;
    structure: { hook?: string; intro?: string; sections?: Array<{ title: string; content: string; tips?: string[] }>; outro?: string };
    thumbnail_ideas?: string[];
    metadata?: { target_audience?: string; estimated_length?: string; cpm_potential?: string };
  };
}

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'scripts' | 'blueprint' | 'videos' | 'parrot' | 'trending' | 'help'>('home');
  const [topic, setTopic] = useState('');
  const [niche, setNiche] = useState('AI tools');
  const [loading, setLoading] = useState(false);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [error, setError] = useState('');
  const [generatedScript, setGeneratedScript] = useState<Script | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [topicIdeas, setTopicIdeas] = useState<string[]>([]);
  const [showIdeas, setShowIdeas] = useState(false);
  
  // Blueprint state
  const [blueprintInput, setBlueprintInput] = useState('');
  const [generatedBlueprint, setGeneratedBlueprint] = useState<VideoBlueprint | null>(null);
  const [blueprints, setBlueprints] = useState<VideoBlueprint[]>([]);

  // ── Video page state ──────────────────────────────────────────────────────
  const [videoScriptId, setVideoScriptId]   = useState('');
  const [videoLoading, setVideoLoading]     = useState(false);
  const [videoError, setVideoError]         = useState('');
  const [activeVideo, setActiveVideo]       = useState<VideoRecord | null>(null);
  const [videoHistory, setVideoHistory]     = useState<VideoRecord[]>([]);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling when component unmounts or page changes away from videos
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startGenerate = async () => {
    if (!videoScriptId.trim()) { setVideoError('Paste a Script ID first'); return; }
    setVideoLoading(true); setVideoError(''); setActiveVideo(null); setPublishSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/videos/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_id: videoScriptId.trim() }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const video: VideoRecord = await res.json();
      setActiveVideo(video);
      setVideoHistory(h => [video, ...h]);
      // Start polling every 10 s
      pollRef.current = setInterval(() => pollVideo(video.id), 10_000);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Failed to start generation');
    } finally {
      setVideoLoading(false);
    }
  };

  const pollVideo = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/videos/${id}`);
      if (!res.ok) return;
      const video: VideoRecord = await res.json();
      setActiveVideo(video);
      setVideoHistory(h => h.map(v => v.id === id ? video : v));
      if (video.status === 'ready' || video.status === 'failed') {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    } catch { /* ignore transient errors */ }
  };

  const publishVideo = async (id: string) => {
    setPublishLoading(true); setVideoError(''); setPublishSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/videos/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: ['tiktok', 'instagram', 'youtube', 'facebook'] }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const posts = await res.json();
      setPublishSuccess(`✅ Scheduled on ${posts.length} platform${posts.length !== 1 ? 's' : ''}!`);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishLoading(false);
    }
  };

  const statusColor = (s: VideoRecord['status']) =>
    ({ generating: '#f59e0b', ready: '#10b981', posted: '#3b82f6', failed: '#ef4444' })[s];

  const statusLabel = (s: VideoRecord['status']) =>
    ({ generating: '⏳ Generating…', ready: '✅ Ready', posted: '📤 Posted', failed: '❌ Failed' })[s];

  const renderVideos = () => (
    <div className="videos-page">
      <h1>🎬 Video Generator</h1>
      <p className="subtitle">Generate a video from a script and publish it to your social platforms</p>

      {/* Step 1 — paste script ID */}
      <div className="generator-form">
        <p className="videos-tip">
          💡 First generate a script on the <button className="inline-link" onClick={() => setCurrentPage('scripts')}>Scripts page</button>, then copy its ID and paste it below.
        </p>
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label htmlFor="scriptId">Script ID</label>
          <input
            id="scriptId"
            type="text"
            value={videoScriptId}
            onChange={e => setVideoScriptId(e.target.value)}
            placeholder="e.g. cadb45d7-623f-4364-91e5-f3b017a1892c"
            disabled={videoLoading}
          />
        </div>
        {videoError && <div className="error-message">{videoError}</div>}
        <button className="generate-button" onClick={startGenerate} disabled={videoLoading}>
          {videoLoading ? '🚀 Starting…' : '🎬 Generate Video'}
        </button>
      </div>

      {/* Active video status card */}
      {activeVideo && (
        <div className="video-status-card" style={{ borderColor: statusColor(activeVideo.status) }}>
          <div className="video-status-header">
            <span className="video-status-badge" style={{ background: statusColor(activeVideo.status) }}>
              {statusLabel(activeVideo.status)}
            </span>
            <span className="video-id-label">ID: {activeVideo.id.slice(0, 8)}…</span>
          </div>

          {activeVideo.status === 'generating' && (
            <div className="video-progress">
              <div className="progress-bar">
                <div className="progress-fill" />
              </div>
              <p>Video is being created by Vicsee — check back in 2–5 minutes. This page auto-refreshes every 10 s.</p>
            </div>
          )}

          {activeVideo.status === 'ready' && (
            <div className="video-ready">
              {activeVideo.thumbnail_url && (
                <img src={activeVideo.thumbnail_url} alt="thumbnail" className="video-thumbnail" />
              )}
              {activeVideo.video_url && (
                <a href={activeVideo.video_url} target="_blank" rel="noopener noreferrer" className="video-download-link">
                  ⬇️ Download / Preview Video
                </a>
              )}
              {activeVideo.duration && (
                <p className="video-duration">Duration: {activeVideo.duration}s</p>
              )}
              {publishSuccess
                ? <div className="publish-success">{publishSuccess}</div>
                : (
                  <button
                    className="publish-button"
                    onClick={() => publishVideo(activeVideo.id)}
                    disabled={publishLoading}
                  >
                    {publishLoading ? '📤 Scheduling…' : '📤 Publish to All Platforms'}
                  </button>
                )
              }
            </div>
          )}

          {activeVideo.status === 'failed' && (
            <p style={{ color: '#fca5a5', marginTop: '1rem' }}>
              Generation failed. Check that your VICSEE_API_KEY is valid, then try again.
            </p>
          )}
        </div>
      )}

      {/* History */}
      {videoHistory.length > 1 && (
        <div className="scripts-history" style={{ marginTop: '2rem' }}>
          <h2>Recent Videos ({videoHistory.length})</h2>
          <div className="scripts-list">
            {videoHistory.map(v => (
              <div
                key={v.id}
                className="script-card"
                onClick={() => setActiveVideo(v)}
                style={{ borderColor: activeVideo?.id === v.id ? statusColor(v.status) : undefined }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="script-preview"><strong>ID:</strong> {v.id.slice(0, 16)}…</span>
                  <span className="video-status-badge" style={{ background: statusColor(v.status), fontSize: '0.75rem' }}>
                    {statusLabel(v.status)}
                  </span>
                </div>
                <p className="script-niche" style={{ marginTop: '0.5rem' }}>{new Date(v.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Parrot state ─────────────────────────────────────────────────────────
  const [parrotUrl, setParrotUrl]           = useState('');
  const [parrotTopic, setParrotTopic]       = useState('');
  const [parrotNiche, setParrotNiche]       = useState('AI tools');
  const [parrotLoading, setParrotLoading]   = useState(false);
  const [parrotError, setParrotError]       = useState('');
  const [parrotResult, setParrotResult]     = useState<ParrotResult | null>(null);

  const runParrot = async () => {
    if (!parrotUrl.trim()) { setParrotError('Paste a YouTube URL first'); return; }
    setParrotLoading(true); setParrotError(''); setParrotResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/scripts/parrot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtube_url: parrotUrl.trim(), niche: parrotNiche, your_topic: parrotTopic || undefined }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      setParrotResult(await res.json());
    } catch (err) { setParrotError(err instanceof Error ? err.message : 'Parrot failed'); }
    finally { setParrotLoading(false); }
  };

  const renderParrot = () => (
    <div className="videos-page">
      <h1>🦜 Parrot a Video</h1>
      <p className="subtitle">Find a YouTube video you love → AI reverse-engineers its structure → creates a Blueprint in your niche</p>

      <div className="generator-form">
        <div className="form-group">
          <label>YouTube URL *</label>
          <input type="url" value={parrotUrl} onChange={e => setParrotUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..." disabled={parrotLoading} />
        </div>
        <div className="form-group">
          <label>Your Niche *</label>
          <select value={parrotNiche} onChange={e => setParrotNiche(e.target.value)} disabled={parrotLoading}>
            <option value="AI tools">💰 AI Tools / Online Business</option>
            <option value="technology">💰 Technology / Gadget Reviews</option>
            <option value="education">💰 Education (Skills, Tutorials)</option>
            <option value="health">💰 Health &amp; Fitness</option>
            <option value="side hustles">💰 Side Hustles / Productivity</option>
            <option value="finance">💰 Finance / Investing</option>
          </select>
        </div>
        <div className="form-group">
          <label>Your Topic (optional)</label>
          <input type="text" value={parrotTopic} onChange={e => setParrotTopic(e.target.value)}
            placeholder="Leave blank and AI will choose the best topic for you" disabled={parrotLoading} />
        </div>
        {parrotError && <div className="error-message">{parrotError}</div>}
        <button className="generate-button" onClick={runParrot} disabled={parrotLoading}>
          {parrotLoading ? '🦜 Analysing…' : '🦜 Parrot This Video'}
        </button>
      </div>

      {parrotResult && (() => {
        const { source_video, blueprint } = parrotResult;
        const sa = blueprint.source_analysis;
        return (
          <div>
            {/* Source video card */}
            <div className="video-status-card" style={{ borderColor: '#8b5cf6', marginTop: '1.5rem' }}>
              <h3 style={{ color: '#a78bfa', marginBottom: '0.75rem' }}>📺 Source Video Analysed</h3>
              <p style={{ color: '#e2e8f0', fontWeight: 600 }}>{source_video.title || '(title via AI)'}</p>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0.25rem 0' }}>by {source_video.channel || 'unknown'} · {source_video.views} views · {source_video.likes} likes</p>
              {source_video.url && <a href={source_video.url} target="_blank" rel="noopener noreferrer" className="video-download-link" style={{ marginTop: '0.75rem', display: 'inline-block' }}>▶ Open on YouTube</a>}
            </div>

            {/* Analysis */}
            {sa && (
              <div className="video-status-card" style={{ borderColor: '#f59e0b', marginTop: '1rem' }}>
                <h3 style={{ color: '#fbbf24', marginBottom: '1rem' }}>🔍 Why It Works</h3>
                <div className="blueprint-section"><strong style={{ color: '#fbbf24' }}>Hook style:</strong> <span style={{ color: '#cbd5e1' }}>{sa.hook_style}</span></div>
                <div className="blueprint-section"><strong style={{ color: '#fbbf24' }}>Structure:</strong> <span style={{ color: '#cbd5e1' }}>{sa.structure}</span></div>
                <div className="blueprint-section"><strong style={{ color: '#fbbf24' }}>Tone:</strong> <span style={{ color: '#cbd5e1' }}>{sa.tone}</span></div>
                <div className="blueprint-section"><strong style={{ color: '#fbbf24' }}>Why it works:</strong> <span style={{ color: '#cbd5e1' }}>{sa.why_it_works}</span></div>
              </div>
            )}

            {/* Blueprint */}
            <div className="generated-blueprint" style={{ marginTop: '1rem' }}>
              <h2>📋 Your Blueprint: {blueprint.title}</h2>
              <div className="blueprint-metadata">
                <span>🎯 {blueprint.niche}</span>
                {blueprint.metadata?.estimated_length && <span>⏱️ {blueprint.metadata.estimated_length}</span>}
                {blueprint.metadata?.cpm_potential && <span>💰 {blueprint.metadata.cpm_potential}</span>}
              </div>
              <p className="script-id-copy">🆔 Saved as Script ID: <strong>{parrotResult.id}</strong> — use this in the Videos tab</p>
              {blueprint.structure.hook && <div className="blueprint-section"><h3>🔥 Hook</h3><p>{blueprint.structure.hook}</p></div>}
              {blueprint.structure.intro && <div className="blueprint-section"><h3>🧠 Intro</h3><p>{blueprint.structure.intro}</p></div>}
              {blueprint.structure.sections?.map((s, i) => (
                <div key={i} className="blueprint-section">
                  <h4>{i + 1}. {s.title}</h4><p>{s.content}</p>
                  {s.tips && s.tips.length > 0 && <ul className="section-tips">{s.tips.map((t, j) => <li key={j}>{t}</li>)}</ul>}
                </div>
              ))}
              {blueprint.structure.outro && <div className="blueprint-section"><h3>💡 Outro / CTA</h3><p>{blueprint.structure.outro}</p></div>}
              {blueprint.thumbnail_ideas && blueprint.thumbnail_ideas.length > 0 && (
                <div className="blueprint-section"><h3>🧲 Thumbnail Ideas</h3><ul className="thumbnail-ideas">{blueprint.thumbnail_ideas.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );

  // ── Trending state ────────────────────────────────────────────────────────
  const [trendNiche, setTrendNiche]           = useState('AI tools');
  const [trendLoading, setTrendLoading]       = useState(false);
  const [trendError, setTrendError]           = useState('');
  const [trendResult, setTrendResult]         = useState<TrendingResult | null>(null);
  const [trendTab, setTrendTab]               = useState<'youtube' | 'tiktok' | 'instagram'>('youtube');

  const fetchTrending = async () => {
    setTrendLoading(true); setTrendError(''); setTrendResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/scripts/trending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: trendNiche, count: 8 }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      setTrendResult(await res.json());
    } catch (err) { setTrendError(err instanceof Error ? err.message : 'Trending fetch failed'); }
    finally { setTrendLoading(false); }
  };

  const platformColor = (p: string) => ({ youtube: '#ef4444', tiktok: '#a78bfa', instagram: '#f59e0b' }[p] ?? '#3b82f6');
  const platformIcon  = (p: string) => ({ youtube: '▶️', tiktok: '🎵', instagram: '📸' }[p] ?? '📱');

  const renderTrendingItems = (items: TrendingItem[], platform: string) => {
    if (!items.length) return <p style={{ color: '#94a3b8' }}>No data available.</p>;
    return (
      <div className="scripts-list">
        {items.map((item) => (
          <div key={item.rank} className="script-card" style={{ borderLeft: `4px solid ${platformColor(platform)}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span style={{ background: platformColor(platform), color: '#fff', borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>#{item.rank}</span>
              <span style={{ color: '#64748b', fontSize: '0.8125rem', flexShrink: 0 }}>{item.views}</span>
            </div>
            <h3 style={{ color: '#f1f5f9', margin: '0.6rem 0 0.25rem', lineHeight: 1.4 }}>{item.title}</h3>
            {item.creator && <p style={{ color: '#94a3b8', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>by {item.creator}</p>}
            <p style={{ color: '#cbd5e1', fontSize: '0.875rem', marginBottom: '0.5rem' }}><strong style={{ color: '#fbbf24' }}>Why trending:</strong> {item.why_trending}</p>
            <p style={{ color: '#10b981', fontSize: '0.875rem', marginBottom: '0.5rem' }}><strong>Your angle:</strong> {item.use_for_niche}</p>
            {item.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                {item.tags.map((t, i) => <span key={i} style={{ background: 'rgba(148,163,184,0.1)', color: '#94a3b8', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>#{t}</span>)}
              </div>
            )}
            {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="video-download-link" style={{ marginTop: '0.75rem', display: 'inline-block', fontSize: '0.875rem' }}>▶ Watch</a>}
          </div>
        ))}
      </div>
    );
  };

  const renderTrending = () => (
    <div className="videos-page">
      <h1>🔥 Trending Now</h1>
      <p className="subtitle">See what's hot across YouTube, TikTok and Instagram — with a suggested angle for your niche</p>

      <div className="generator-form">
        <div className="form-group">
          <label>Your Niche</label>
          <select value={trendNiche} onChange={e => setTrendNiche(e.target.value)} disabled={trendLoading}>
            <option value="AI tools">💰 AI Tools / Online Business</option>
            <option value="technology">💰 Technology / Gadget Reviews</option>
            <option value="education">💰 Education (Skills, Tutorials)</option>
            <option value="health">💰 Health &amp; Fitness</option>
            <option value="side hustles">💰 Side Hustles / Productivity</option>
            <option value="finance">💰 Finance / Investing</option>
          </select>
        </div>
        {trendError && <div className="error-message">{trendError}</div>}
        <button className="generate-button" onClick={fetchTrending} disabled={trendLoading}>
          {trendLoading ? '🔍 Fetching trends…' : '🔥 Fetch Trending Now'}
        </button>
      </div>

      {trendResult && (
        <div>
          {/* Platform tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', margin: '1.5rem 0 1rem', flexWrap: 'wrap' }}>
            {(['youtube', 'tiktok', 'instagram'] as const).map(p => (
              <button key={p} onClick={() => setTrendTab(p)}
                style={{ padding: '0.5rem 1.25rem', borderRadius: '999px', border: `2px solid ${platformColor(p)}`,
                  background: trendTab === p ? platformColor(p) : 'transparent',
                  color: trendTab === p ? '#fff' : platformColor(p),
                  fontWeight: 700, cursor: 'pointer', fontSize: '0.9375rem', transition: 'all 0.2s' }}>
                {platformIcon(p)} {p.charAt(0).toUpperCase() + p.slice(1)}
                <span style={{ marginLeft: '0.4rem', opacity: 0.8 }}>({trendResult[p].length})</span>
              </button>
            ))}
          </div>
          {renderTrendingItems(trendResult[trendTab], trendTab)}
        </div>
      )}
    </div>
  );

  const getTopicIdeas = async () => {
    setLoadingIdeas(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE}/api/v1/scripts/topic-ideas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ niche }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTopicIdeas(data.ideas);
      setShowIdeas(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get topic ideas');
    } finally {
      setLoadingIdeas(false);
    }
  };

  const selectTopicIdea = (idea: string) => {
    setTopic(idea);
    setShowIdeas(false);
  };

  const generateScript = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedScript(null);

    try {
      // Use query parameters to match backend
      const params = new URLSearchParams({
        topic: topic,
        niche: niche
      });
      
      const response = await fetch(`${API_BASE}/api/v1/scripts/generate?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setGeneratedScript(data);
      setScripts([data, ...scripts]);
      setTopic('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate script');
    } finally {
      setLoading(false);
    }
  };

  const generateBlueprint = async () => {
    if (!blueprintInput.trim()) {
      setError('Please enter video instructions or paste a blueprint');
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedBlueprint(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/scripts/blueprint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instructions: blueprintInput,
          niche
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setGeneratedBlueprint(data);
      setBlueprints([data, ...blueprints]);
      setBlueprintInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate blueprint');
    } finally {
      setLoading(false);
    }
  };

  const renderHome = () => (
    <div className="home">
      <h1>🎬 AI Content Monetization Platform</h1>
      <p className="subtitle">
        Generate viral video scripts, create content with AI, and automate your YouTube workflow
      </p>

      <section className="pipeline">
        <h2>🚀 Your Content Pipeline</h2>
        <ul>
          <li>✅ Generate AI-powered video scripts</li>
          <li>✅ Create comprehensive video blueprints</li>
          <li>🎨 Create videos manually (Canva) or automate (D-ID)</li>
          <li>📤 Upload to YouTube automatically</li>
          <li>📊 Track performance and monetization</li>
        </ul>
      </section>

      <div className="quick-start-box" style={{
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginTop: '2rem',
        marginBottom: '2rem'
      }}>
        <h3 style={{ color: '#60a5fa', marginTop: 0 }}>🎯 Quick Start Guide</h3>
        <p style={{ marginBottom: '1rem' }}>New here? Check out the complete workflow guide to get started:</p>
        <button
          className="cta-button"
          onClick={() => setCurrentPage('help')}
          style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
        >
          📖 View Workflow Guide
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="cta-button" onClick={() => setCurrentPage('scripts')}>
          ⚡ Quick Scripts →
        </button>
        <button className="cta-button" onClick={() => setCurrentPage('blueprint')}>
          📋 Video Blueprints →
        </button>
      </div>
    </div>
  );

  const renderScripts = () => (
    <div className="scripts-page">
      <h1>Script Generator</h1>
      <p className="subtitle">Generate viral short-form video scripts with AI</p>

      <div className="generator-form">
        <div className="form-group">
          <label htmlFor="topic">Video Topic *</label>
          <input
            id="topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Best AI Tools for Content Creation"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="niche">Profitable Niche *</label>
          <select
            id="niche"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            disabled={loading}
          >
            <option value="AI tools">💰 AI Tools / Online Business</option>
            <option value="technology">💰 Technology / Gadget Reviews</option>
            <option value="education">💰 Education (Skills, Tutorials)</option>
            <option value="health">💰 Health & Fitness</option>
            <option value="side hustles">💰 Side Hustles / Productivity</option>
          </select>
          <small style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
            💰 = High revenue potential niches
          </small>
        </div>

        <button
          className="idea-button"
          onClick={getTopicIdeas}
          disabled={loadingIdeas || loading}
          type="button"
        >
          {loadingIdeas ? '🤔 Getting Ideas...' : '💡 Get AI Topic Ideas'}
        </button>

        {showIdeas && topicIdeas.length > 0 && (
          <div className="topic-ideas">
            <h3>💡 Recommended Topics for {niche}</h3>
            <p className="ideas-subtitle">Click any topic to use it:</p>
            <div className="ideas-list">
              {topicIdeas.map((idea, index) => (
                <button
                  key={index}
                  className="idea-card"
                  onClick={() => selectTopicIdea(idea)}
                  type="button"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <button
          className="generate-button"
          onClick={generateScript}
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Generate Script'}
        </button>
      </div>

      {generatedScript && (
        <div className="generated-script">
          <h2>Generated Script</h2>
          <div className="script-metadata">
            <span>Topic: {generatedScript.topic}</span>
            <span>Niche: {generatedScript.script_metadata?.niche ?? niche}</span>
          </div>
          <p className="script-id-copy">
            🆔 Script ID (copy for Videos page): <strong>{generatedScript.id}</strong>
          </p>

          <div className="script-section">
            <h3>🎣 Hook (3-5 seconds)</h3>
            <p>{generatedScript.hook}</p>
          </div>

          <div className="script-section">
            <h3>📝 Body (20-30 seconds)</h3>
            <p>{generatedScript.body}</p>
          </div>

          <div className="script-section">
            <h3>📢 Call to Action (3-5 seconds)</h3>
            <p>{generatedScript.cta}</p>
          </div>
        </div>
      )}

      {scripts.length > 0 && (
        <div className="scripts-history">
          <h2>Recent Scripts ({scripts.length})</h2>
          <div className="scripts-list">
            {scripts.map((script) => (
              <div key={script.id} className="script-card">
                <h3>{script.topic}</h3>
                <p className="script-niche">{script.script_metadata?.niche ?? ''}</p>
                <div className="script-preview">
                  <strong>Hook:</strong> {script.hook.substring(0, 100)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderBlueprint = () => (
    <div className="blueprint-page">
      <h1>Video Blueprint Generator</h1>
      <p className="subtitle">Create comprehensive video plans with detailed structure, hooks, and monetization strategies</p>

      <div className="generator-form">
        <div className="form-group">
          <label htmlFor="niche">Profitable Niche *</label>
          <select
            id="niche"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            disabled={loading}
          >
            <option value="AI tools">💰 AI Tools / Online Business</option>
            <option value="technology">💰 Technology / Gadget Reviews</option>
            <option value="education">💰 Education (Skills, Tutorials)</option>
            <option value="health">💰 Health & Fitness</option>
            <option value="side hustles">💰 Side Hustles / Productivity</option>
            <option value="finance">💰 Finance / Investing</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="blueprint">Video Instructions / Blueprint *</label>
          <textarea
            id="blueprint"
            value={blueprintInput}
            onChange={(e) => setBlueprintInput(e.target.value)}
            placeholder="Paste your detailed video blueprint here, or describe what you want to create...

Example:
- Video topic: Best AI Tools for Passive Income
- Include: Hook, intro, 5-7 main sections
- Add thumbnail ideas
- Target audience: entrepreneurs
- Estimated length: 8-12 minutes"
            disabled={loading}
            rows={12}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '0.5rem',
              color: '#e2e8f0',
              fontSize: '0.9375rem',
              fontFamily: 'inherit',
              lineHeight: '1.6',
              resize: 'vertical'
            }}
          />
          <small style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
            💡 Tip: The more detailed your instructions, the better the blueprint. Include structure, target audience, key points, and monetization goals.
          </small>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          className="generate-button"
          onClick={generateBlueprint}
          disabled={loading}
        >
          {loading ? '🎬 Generating Blueprint...' : '🎬 Generate Video Blueprint'}
        </button>
      </div>

      {generatedBlueprint && (
        <div className="generated-blueprint">
          <h2>📋 {generatedBlueprint.title}</h2>
          
          <div className="blueprint-metadata">
            <span>🎯 {generatedBlueprint.niche}</span>
            {generatedBlueprint.metadata?.estimated_length && (
              <span>⏱️ {generatedBlueprint.metadata.estimated_length}</span>
            )}
            {generatedBlueprint.metadata?.cpm_potential && (
              <span>💰 {generatedBlueprint.metadata.cpm_potential}</span>
            )}
          </div>

          {generatedBlueprint.structure.hook && (
            <div className="blueprint-section">
              <h3>🔥 Hook (First 5-10 seconds)</h3>
              <p>{generatedBlueprint.structure.hook}</p>
            </div>
          )}

          {generatedBlueprint.structure.intro && (
            <div className="blueprint-section">
              <h3>🧠 Intro</h3>
              <p>{generatedBlueprint.structure.intro}</p>
            </div>
          )}

          {generatedBlueprint.structure.sections && generatedBlueprint.structure.sections.length > 0 && (
            <div className="blueprint-sections">
              <h3>📝 Main Content Sections</h3>
              {generatedBlueprint.structure.sections.map((section, index) => (
                <div key={index} className="blueprint-section">
                  <h4>{index + 1}. {section.title}</h4>
                  <p>{section.content}</p>
                  {section.tips && section.tips.length > 0 && (
                    <ul className="section-tips">
                      {section.tips.map((tip, tipIndex) => (
                        <li key={tipIndex}>{tip}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {generatedBlueprint.structure.outro && (
            <div className="blueprint-section">
              <h3>💡 Outro / Call to Action</h3>
              <p>{generatedBlueprint.structure.outro}</p>
            </div>
          )}

          {generatedBlueprint.thumbnail_ideas && generatedBlueprint.thumbnail_ideas.length > 0 && (
            <div className="blueprint-section">
              <h3>🧲 Thumbnail Ideas</h3>
              <ul className="thumbnail-ideas">
                {generatedBlueprint.thumbnail_ideas.map((idea, index) => (
                  <li key={index}>{idea}</li>
                ))}
              </ul>
            </div>
          )}

          {generatedBlueprint.metadata?.target_audience && (
            <div className="blueprint-section">
              <h3>🎯 Target Audience</h3>
              <p>{generatedBlueprint.metadata.target_audience}</p>
            </div>
          )}
        </div>
      )}

      {blueprints.length > 0 && (
        <div className="blueprints-history">
          <h2>Recent Blueprints ({blueprints.length})</h2>
          <div className="blueprints-list">
            {blueprints.map((blueprint) => (
              <div key={blueprint.id} className="blueprint-card" onClick={() => setGeneratedBlueprint(blueprint)}>
                <h3>{blueprint.title}</h3>
                <p className="blueprint-niche">🎯 {blueprint.niche}</p>
                {blueprint.metadata?.estimated_length && (
                  <p className="blueprint-meta">⏱️ {blueprint.metadata.estimated_length}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderHelp = () => (
    <div className="help-page">
      <h1>📖 Workflow Guide & Help</h1>
      <p className="subtitle">Complete guide to creating and monetizing video content</p>

      <div className="help-section">
        <h2>🎯 Current Workflow (Manual Video Creation)</h2>
        
        <div className="workflow-step">
          <h3>Step 1: Generate Scripts ✅</h3>
          <p>Use the <strong>Scripts</strong> or <strong>Blueprints</strong> page to generate AI-powered video scripts.</p>
          <ul>
            <li>Choose your niche (AI tools, tech, education, etc.)</li>
            <li>Enter a topic or get AI suggestions</li>
            <li>Generate complete video scripts with hooks, body, and CTAs</li>
          </ul>
          <button className="cta-button" onClick={() => setCurrentPage('scripts')}>
            Go to Scripts →
          </button>
        </div>

        <div className="workflow-step">
          <h3>Step 2: Create Videos 🎨</h3>
          <p><strong>Manual Creation (FREE):</strong></p>
          <ul>
            <li><strong>Canva:</strong> Create video slides and graphics</li>
            <li><strong>CapCut:</strong> Add voiceover, edit, and export as MP4</li>
            <li><strong>Pexels:</strong> Free stock footage and images</li>
          </ul>
          <p style={{ marginTop: '1rem' }}><strong>Automated Creation (Coming Soon):</strong></p>
          <ul>
            <li>Add D-ID API key to automate video generation ($5.90/month)</li>
            <li>Videos created automatically from scripts</li>
          </ul>
        </div>

        <div className="workflow-step">
          <h3>Step 3: Upload to YouTube 📤</h3>
          <p>Two options available:</p>
          <ul>
            <li><strong>Manual:</strong> Upload via YouTube Studio</li>
            <li><strong>API:</strong> Use the upload endpoint (requires video file)</li>
          </ul>
        </div>
      </div>

      <div className="help-section" style={{ marginTop: '2rem' }}>
        <h2>📊 Feature Status</h2>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '0.5rem',
          overflow: 'hidden'
        }}>
          <thead>
            <tr style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Feature</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>Script Generation</td>
              <td style={{ padding: '0.75rem', textAlign: 'center', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>✅ Working</td>
              <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>~$0.01/script</td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>Manual Video Creation</td>
              <td style={{ padding: '0.75rem', textAlign: 'center', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>✅ Available</td>
              <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>Free</td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>Automated Video (D-ID)</td>
              <td style={{ padding: '0.75rem', textAlign: 'center', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>⏳ Pending Setup</td>
              <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>$5.90/month</td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>YouTube Upload</td>
              <td style={{ padding: '0.75rem', textAlign: 'center', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>✅ Working</td>
              <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>Free</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="help-section" style={{ marginTop: '2rem' }}>
        <h2>🔗 Quick Links</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <a
            href={`${API_BASE}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="help-link-card"
            style={{
              display: 'block',
              padding: '1rem',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              color: '#e2e8f0',
              transition: 'all 0.2s'
            }}
          >
            <strong>📚 API Documentation</strong>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem' }}>
              View all available API endpoints
            </p>
          </a>
          
          <a
            href="https://canva.com"
            target="_blank"
            rel="noopener noreferrer"
            className="help-link-card"
            style={{
              display: 'block',
              padding: '1rem',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              color: '#e2e8f0',
              transition: 'all 0.2s'
            }}
          >
            <strong>🎨 Canva</strong>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem' }}>
              Create video graphics and slides
            </p>
          </a>
          
          <a
            href="https://studio.youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="help-link-card"
            style={{
              display: 'block',
              padding: '1rem',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              color: '#e2e8f0',
              transition: 'all 0.2s'
            }}
          >
            <strong>📺 YouTube Studio</strong>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem' }}>
              Upload and manage your videos
            </p>
          </a>
        </div>
      </div>

      <div className="help-section" style={{
        marginTop: '2rem',
        background: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: '0.75rem',
        padding: '1.5rem'
      }}>
        <h2 style={{ color: '#4ade80' }}>💡 Pro Tips</h2>
        <ul>
          <li>Start with 2-3 test videos to validate your workflow</li>
          <li>Use the Blueprint generator for longer, more detailed videos</li>
          <li>Keep videos 3-8 minutes for best engagement</li>
          <li>Add captions in Canva for better accessibility</li>
          <li>Consider D-ID automation once you're creating 5+ videos/week</li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
          For detailed documentation, see <code>WORKFLOW_GUIDE.md</code> in the project folder
        </p>
        <button className="cta-button" onClick={() => setCurrentPage('home')}>
          ← Back to Home
        </button>
      </div>
    </div>
  );

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand">AI Content Publisher</div>
        <div className="nav-links">
          <button
            className={currentPage === 'home' ? 'active' : ''}
            onClick={() => setCurrentPage('home')}
          >
            Home
          </button>
          <button
            className={currentPage === 'scripts' ? 'active' : ''}
            onClick={() => setCurrentPage('scripts')}
          >
            Scripts
          </button>
          <button
            className={currentPage === 'blueprint' ? 'active' : ''}
            onClick={() => setCurrentPage('blueprint')}
          >
            Blueprints
          </button>
          <button
            className={currentPage === 'videos' ? 'active' : ''}
            onClick={() => setCurrentPage('videos')}
          >
            🎬 Videos
          </button>
          <button
            className={currentPage === 'parrot' ? 'active' : ''}
            onClick={() => setCurrentPage('parrot')}
          >
            🦜 Parrot
          </button>
          <button
            className={currentPage === 'trending' ? 'active' : ''}
            onClick={() => setCurrentPage('trending')}
          >
            🔥 Trending
          </button>
          <button
            className={currentPage === 'help' ? 'active' : ''}
            onClick={() => setCurrentPage('help')}
          >
            📖 Help
          </button>
        </div>
      </nav>

      <main className="main-content">
        {currentPage === 'home' ? renderHome() :
         currentPage === 'scripts' ? renderScripts() :
         currentPage === 'blueprint' ? renderBlueprint() :
         currentPage === 'videos' ? renderVideos() :
         currentPage === 'parrot' ? renderParrot() :
         currentPage === 'trending' ? renderTrending() :
         renderHelp()}
      </main>

      <footer className="footer">
        <p>AI Content Monetization Platform • Made with Bob</p>
      </footer>
    </div>
  );
}

export default App;

// Made with Bob

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
  error_message: string | null;
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

// ── Analytics types ───────────────────────────────────────────────────────────
interface AnalyticsTotals {
  total_posts: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_clicks: number;
  avg_engagement_rate: number;
}
interface AnalyticsByPlatform {
  platform: string;
  posts: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_clicks: number;
}
interface AnalyticsSummary {
  totals: AnalyticsTotals;
  by_platform: AnalyticsByPlatform[];
  last_synced: string | null;
}
interface TopPost {
  id: string;
  platform: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  posted_at: string | null;
}
interface DashboardMetrics {
  overview: {
    total_scripts: number;
    total_videos: number;
    total_posts: number;
    total_leads: number;
    revenue_30d: number;
  };
  videos_by_status: Record<string, number>;
  scripts_by_status: Record<string, number>;
  posts_by_status: Record<string, number>;
}

// ── Parrot types ──────────────────────────────────────────────────────────────
interface ParrotShotScene {
  scene: number;
  description: string;
  shot_type: string;
  camera_movement: string;
  lighting: string;
  duration_seconds: number;
  broll_suggestion?: string;
  on_screen_text?: string;
}
interface ParrotResult {
  id: string;
  source_video: { url: string; title: string; channel: string; views: string; likes: string };
  blueprint: {
    source_analysis?: { hook_style: string; structure: string; tone: string; pacing?: string; why_it_works: string };
    title: string;
    topic: string;
    niche: string;
    production?: { style?: string; duration?: string; aspect_ratio?: string; audio_style?: string };
    structure: { hook?: string; intro?: string; sections?: Array<{ title: string; content: string; tips?: string[] }>; outro?: string };
    voiceover_script?: { hook?: string; body?: string; cta?: string };
    shot_list?: ParrotShotScene[];
    audio_direction?: { music_style?: string; music_tempo?: string; voiceover_tone?: string; voiceover_pace?: string; sfx_notes?: string };
    thumbnail_ideas?: Array<{ visual?: string; headline?: string; style?: string } | string>;
    metadata?: { target_audience?: string; estimated_length?: string; cpm_potential?: string };
  };
}

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'source' | 'script' | 'scripts' | 'blueprint' | 'videos' | 'parrot' | 'trending' | 'diagnostics' | 'monetize' | 'analytics' | 'help'>('home');
  const [sourceTab, setSourceTab] = useState<'parrot' | 'trending'>('parrot');
  const [scriptTab, setScriptTab] = useState<'quick' | 'blueprint'>('quick');
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

  // ── Analytics state ───────────────────────────────────────────────────────
  const [analyticsSummary, setAnalyticsSummary]     = useState<AnalyticsSummary | null>(null);
  const [analyticsTopPosts, setAnalyticsTopPosts]   = useState<TopPost[]>([]);
  const [dashboardMetrics, setDashboardMetrics]     = useState<DashboardMetrics | null>(null);
  const [analyticsLoading, setAnalyticsLoading]     = useState(false);
  const [analyticsError, setAnalyticsError]         = useState('');
  const [analyticsSyncing, setAnalyticsSyncing]     = useState(false);
  const [analyticsSyncMsg, setAnalyticsSyncMsg]     = useState('');
  const [analyticsTopMetric, setAnalyticsTopMetric] = useState<'views'|'likes'|'comments'|'shares'>('views');


  // ── Video page state ──────────────────────────────────────────────────────
  const [videoProvider, setVideoProvider]       = useState<{provider:string;label:string;detail:string;color:string}|null>(null);
  const [videoScriptId, setVideoScriptId]       = useState('');
  const [videoLoading, setVideoLoading]         = useState(false);
  const [videoError, setVideoError]             = useState('');
  const [activeVideo, setActiveVideo]           = useState<VideoRecord | null>(null);
  const [videoHistory, setVideoHistory]         = useState<VideoRecord[]>([]);
  const [allVideos, setAllVideos]               = useState<VideoRecord[]>([]);
  const [allVideosLoading, setAllVideosLoading] = useState(false);
  const [publishLoading, setPublishLoading]     = useState(false);
  const [publishSuccess, setPublishSuccess]     = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Script preview + edit
  const [previewScript, setPreviewScript]       = useState<Script | null>(null);
  const [scriptPreviewLoading, setScriptPreviewLoading] = useState(false);
  const [editingScript, setEditingScript]       = useState(false);
  const [editHook, setEditHook]                 = useState('');
  const [editBody, setEditBody]                 = useState('');
  const [editCta, setEditCta]                   = useState('');
  const [editSaving, setEditSaving]             = useState(false);
  const [editSaved, setEditSaved]               = useState(false);

  // AI Assistant state
  const [askQuestion, setAskQuestion]     = useState('');
  const [askAnswer, setAskAnswer]         = useState('');
  const [askLoading, setAskLoading]       = useState(false);
  const [askError, setAskError]           = useState('');
  const [askOpen, setAskOpen]             = useState(false);
  const [copiedId, setCopiedId]           = useState('');

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const submitAsk = async (q?: string) => {
    const question = (q ?? askQuestion).trim();
    if (!question) return;
    setAskLoading(true); setAskError(''); setAskAnswer('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/scripts/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const data = await res.json();
      setAskAnswer(data.answer);
      setAskOpen(true);
    } catch (err) { setAskError(err instanceof Error ? err.message : 'AI unavailable'); }
    finally { setAskLoading(false); }
  };

  // Stop polling when component unmounts or page changes away from videos
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Fetch video provider + all videos + dashboard metrics once on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/health/video-provider`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setVideoProvider(d); })
      .catch(() => {});
    loadAllVideos();
    fetch(`${API_BASE}/api/v1/dashboard/metrics`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDashboardMetrics(d); })
      .catch(() => {});
  }, []);

  const loadAllVideos = async () => {
    setAllVideosLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/videos/?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setAllVideos(data.items ?? []);
      }
    } catch { /* ignore */ }
    finally { setAllVideosLoading(false); }
  };

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
      setAllVideos(prev => [video, ...prev.filter(v => v.id !== video.id)]);
      // Start polling every 10 s
      pollRef.current = setInterval(() => pollVideo(video.id), 10_000);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Failed to start generation');
    } finally {
      setVideoLoading(false);
    }
  };

  const retryVideo = (v: VideoRecord) => {
    // Pre-fill the script ID field and load the script preview, then scroll to the form
    setVideoScriptId(v.script_id);
    loadScript(v.script_id);
    setActiveVideo(null);
    setPublishSuccess('');
    setVideoError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadScript = async (id: string) => {
    if (!id.trim()) { setPreviewScript(null); return; }
    setScriptPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/scripts/${id.trim()}`);
      if (!res.ok) { setPreviewScript(null); return; }
      const s: Script = await res.json();
      setPreviewScript(s);
      setEditHook(s.hook ?? '');
      setEditBody(s.body ?? '');
      setEditCta(s.cta ?? '');
      setEditingScript(false);
      setEditSaved(false);
    } catch { setPreviewScript(null); }
    finally { setScriptPreviewLoading(false); }
  };

  const saveScriptEdits = async () => {
    if (!previewScript) return;
    setEditSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/scripts/${previewScript.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hook: editHook, body: editBody, cta: editCta }),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated: Script = await res.json();
      setPreviewScript(updated);
      setEditingScript(false);
      setEditSaved(true);
    } catch { /* show nothing, user can retry */ }
    finally { setEditSaving(false); }
  };

  const pollVideo = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/videos/${id}`);
      if (!res.ok) return;
      const video: VideoRecord = await res.json();
      setActiveVideo(video);
      setVideoHistory(h => h.map(v => v.id === id ? video : v));
      setAllVideos(prev => prev.map(v => v.id === id ? video : v));
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
        body: JSON.stringify({ platforms: ['youtube'] }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const posts = await res.json();
      const post = posts[0];
      setPublishSuccess(
        post?.status === 'posted'
          ? `✅ Uploaded to YouTube! Video ID: ${post.external_id ?? 'check YouTube Studio'}`
          : `⚠️ Upload queued (status: ${post?.status ?? 'unknown'})`
      );
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Failed to upload');
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

      {/* ── Active provider banner ── */}
      {videoProvider && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: `${videoProvider.color}14`, border: `1px solid ${videoProvider.color}40`, borderRadius: '0.75rem', padding: '0.85rem 1.25rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span style={{ background: videoProvider.color, color: '#fff', borderRadius: '999px', padding: '0.2rem 0.75rem', fontWeight: 700, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
            {videoProvider.provider === 'local' ? '🎞️' : '⚠️'} {videoProvider.label}
          </span>
          <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{videoProvider.detail}</span>
          {videoProvider.provider === 'none' && (
            <button className="inline-link" onClick={() => setCurrentPage('diagnostics')} style={{ marginLeft: 'auto' }}>
              Fix in Diagnostics →
            </button>
          )}
        </div>
      )}

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
            onBlur={e => loadScript(e.target.value)}
            placeholder="e.g. cadb45d7-623f-4364-91e5-f3b017a1892c"
            disabled={videoLoading}
          />
        </div>

        {/* ── Script preview card ── */}
        {scriptPreviewLoading && (
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0.5rem 0' }}>Loading script…</p>
        )}
        {previewScript && !scriptPreviewLoading && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '1.25rem', margin: '1rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <p style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>
                📄 {previewScript.topic}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {editSaved && !editingScript && (
                  <span style={{ color: '#34d399', fontSize: '0.8125rem', alignSelf: 'center' }}>✓ Saved</span>
                )}
                <button
                  onClick={() => { setEditingScript(e => !e); setEditSaved(false); }}
                  style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa', borderRadius: '0.5rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
                  {editingScript ? '✕ Cancel' : '✏️ Edit Script'}
                </button>
              </div>
            </div>

            {editingScript ? (
              /* ── Edit mode ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.3rem' }}>Hook</label>
                  <textarea
                    value={editHook}
                    onChange={e => setEditHook(e.target.value)}
                    rows={2}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.5rem', color: '#f1f5f9', padding: '0.6rem 0.75rem', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.3rem' }}>Body</label>
                  <textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    rows={5}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.5rem', color: '#f1f5f9', padding: '0.6rem 0.75rem', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.3rem' }}>Call to Action</label>
                  <textarea
                    value={editCta}
                    onChange={e => setEditCta(e.target.value)}
                    rows={2}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.5rem', color: '#f1f5f9', padding: '0.6rem 0.75rem', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <button
                  onClick={saveScriptEdits}
                  disabled={editSaving}
                  style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399', borderRadius: '0.5rem', padding: '0.6rem 1rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                  {editSaving ? '💾 Saving…' : '💾 Save Changes'}
                </button>
              </div>
            ) : (
              /* ── Read mode ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hook</span>
                  <p style={{ color: '#e2e8f0', fontSize: '0.875rem', margin: '0.2rem 0 0' }}>{previewScript.hook}</p>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Body</span>
                  <p style={{ color: '#cbd5e1', fontSize: '0.875rem', margin: '0.2rem 0 0', whiteSpace: 'pre-wrap' }}>{previewScript.body}</p>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CTA</span>
                  <p style={{ color: '#e2e8f0', fontSize: '0.875rem', margin: '0.2rem 0 0' }}>{previewScript.cta}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {videoError && <div className="error-message">{videoError}</div>}
        <button className="generate-button" onClick={startGenerate} disabled={videoLoading || editingScript}>
          {videoLoading ? '🚀 Starting…' : editingScript ? '💾 Save edits before generating' : '🎬 Generate Video'}
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
              <p>Video is being assembled — voiceover + stock footage + captions. Check back in 3–8 minutes. This page auto-refreshes every 10 s.</p>
            </div>
          )}

          {activeVideo.status === 'ready' && (
            <div className="video-ready">
              {activeVideo.thumbnail_url && (
                <img src={activeVideo.thumbnail_url} alt="thumbnail" className="video-thumbnail" />
              )}
              {/* Preview modal trigger */}
              {activeVideo.video_url && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button className="publish-button"
                    style={{ background: 'rgba(59,130,246,0.8)', flex: 1 }}
                    onClick={() => setPreviewUrl(activeVideo.video_url)}>
                    ▶ Preview Video
                  </button>
                  <a href={activeVideo.video_url} target="_blank" rel="noopener noreferrer"
                    className="video-download-link" style={{ flex: 1, textAlign: 'center' }}>
                    ⬇️ Download
                  </a>
                </div>
              )}
              {activeVideo.duration && (
                <p className="video-duration">Duration: {activeVideo.duration}s</p>
              )}
              <p className="script-id-copy">🆔 Video ID: <strong>{activeVideo.id}</strong></p>
              {publishSuccess
                ? <div className="publish-success">{publishSuccess}</div>
                : (
                  <button className="publish-button"
                    onClick={() => publishVideo(activeVideo.id)}
                    disabled={publishLoading}>
                    {publishLoading ? '⏳ Uploading to YouTube…' : '▶ Upload to YouTube'}
                  </button>
                )
              }
              <button className="idea-button" style={{ marginTop: '0.5rem' }}
                onClick={() => { setScheduleVideoId(activeVideo.id); document.getElementById('scheduler')?.scrollIntoView({ behavior: 'smooth' }); }}>
                📅 Schedule for Later
              </button>
            </div>
          )}

          {activeVideo.status === 'failed' && (
            <div style={{ marginTop: '1rem' }}>
              {/* Real error from backend */}
              {activeVideo.error_message && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
                  <p style={{ color: '#fca5a5', fontSize: '0.875rem', margin: 0, fontWeight: 600 }}>❌ {activeVideo.error_message}</p>
                </div>
              )}
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                Go to <button className="inline-link" onClick={() => setCurrentPage('diagnostics')}>🔧 Diagnostics</button> to run all checks
                {' — verify your ElevenLabs and Pexels keys'}.
              </p>
              <button
                onClick={() => retryVideo(activeVideo)}
                style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa', borderRadius: '0.5rem', padding: '0.6rem 1.1rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                🔁 Edit Script & Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Preview modal */}
      {previewUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setPreviewUrl(null)}>
          <div style={{ background: '#0f172a', borderRadius: '1rem', overflow: 'hidden', maxWidth: '400px', width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <video src={previewUrl} controls autoPlay style={{ width: '100%', display: 'block' }} />
            <div style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <a href={previewUrl} download target="_blank" rel="noopener noreferrer"
                className="video-download-link" style={{ flex: 1, textAlign: 'center', fontSize: '0.875rem' }}>
                ⬇️ Download
              </a>
              <button onClick={() => setPreviewUrl(null)}
                style={{ flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: '0.5rem', padding: '0.6rem', cursor: 'pointer', fontWeight: 600 }}>
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Studio quick-launch */}
      <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.75rem', padding: '1.25rem', margin: '1.5rem 0' }}>
        <h3 style={{ color: '#fca5a5', marginBottom: '0.75rem', fontSize: '1rem' }}>▶ YouTube Studio</h3>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>
          After uploading, manage your video in YouTube Studio — add chapters, cards, end screens and check analytics.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer"
            className="idea-button" style={{ flex: '1 1 auto', textAlign: 'center', textDecoration: 'none', display: 'block', margin: 0, background: 'rgba(239,68,68,0.15)' }}>
            🎬 YouTube Studio
          </a>
          <a href="https://studio.youtube.com/channel/UC/videos" target="_blank" rel="noopener noreferrer"
            className="idea-button" style={{ flex: '1 1 auto', textAlign: 'center', textDecoration: 'none', display: 'block', margin: 0, background: 'rgba(239,68,68,0.1)' }}>
            📋 My Videos
          </a>
          <a href="https://studio.youtube.com/channel/UC/analytics" target="_blank" rel="noopener noreferrer"
            className="idea-button" style={{ flex: '1 1 auto', textAlign: 'center', textDecoration: 'none', display: 'block', margin: 0, background: 'rgba(239,68,68,0.1)' }}>
            📊 Analytics
          </a>
        </div>
      </div>

      {/* Scheduler section */}
      <div id="scheduler">{renderScheduler()}</div>

      {/* ── All videos from DB ── */}
      <div className="scripts-history" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>
            📼 My Videos {allVideos.length > 0 && `(${allVideos.length})`}
          </h2>
          <button
            onClick={loadAllVideos}
            disabled={allVideosLoading}
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', borderRadius: '0.5rem', padding: '0.35rem 0.85rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
            {allVideosLoading ? '⏳' : '🔄 Refresh'}
          </button>
        </div>

        {allVideosLoading && <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading…</p>}

        {!allVideosLoading && allVideos.length === 0 && (
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No videos yet — generate one above.</p>
        )}

        {allVideos.length > 0 && (
          <div className="scripts-list">
            {allVideos.map(v => (
              <div
                key={v.id}
                className="script-card"
                onClick={() => { setActiveVideo(v); setPublishSuccess(''); setVideoError(''); }}
                style={{ borderLeft: `4px solid ${statusColor(v.status)}`, borderColor: activeVideo?.id === v.id ? statusColor(v.status) : undefined, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="video-status-badge" style={{ background: statusColor(v.status), fontSize: '0.75rem' }}>
                    {statusLabel(v.status)}
                  </span>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {v.id.slice(0, 8)}…
                  </span>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: '0.4rem 0 0' }}>
                  {new Date(v.created_at).toLocaleString()}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                  {v.video_url && (
                    <a href={v.video_url} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="video-download-link" style={{ fontSize: '0.8125rem', padding: '0.3rem 0.75rem' }}>
                      ▶ Preview / Download
                    </a>
                  )}
                  {v.status === 'ready' && (
                    <button
                      onClick={e => { e.stopPropagation(); setActiveVideo(v); setPublishSuccess(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: '0.375rem', padding: '0.3rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                      ▶ Upload to YouTube
                    </button>
                  )}
                  {v.status === 'failed' && (
                    <button
                      onClick={e => { e.stopPropagation(); retryVideo(v); }}
                      style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa', borderRadius: '0.375rem', padding: '0.3rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                      🔁 Edit & Retry
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Parrot state ─────────────────────────────────────────────────────────
  const [parrotUrl, setParrotUrl]               = useState('');
  const [parrotTopic, setParrotTopic]           = useState('');
  const [parrotNiche, setParrotNiche]           = useState('AI tools');
  const [parrotVideoPrompt, setParrotVideoPrompt] = useState('');
  const [parrotStyle, setParrotStyle]           = useState('');
  const [parrotDuration, setParrotDuration]     = useState('');
  const [parrotAspect, setParrotAspect]         = useState('16:9');
  const [parrotAudio, setParrotAudio]           = useState('');
  const [parrotCamera, setParrotCamera]         = useState('');
  const [parrotLoading, setParrotLoading]       = useState(false);
  const [parrotError, setParrotError]           = useState('');
  const [parrotResult, setParrotResult]         = useState<ParrotResult | null>(null);
  const [parrotTab, setParrotTab]               = useState<'blueprint' | 'voiceover' | 'shots' | 'audio'>('blueprint');

  const runParrot = async () => {
    if (!parrotUrl.trim()) { setParrotError('Paste a YouTube URL first'); return; }
    setParrotLoading(true); setParrotError(''); setParrotResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/scripts/parrot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtube_url:  parrotUrl.trim(),
          niche:        parrotNiche,
          your_topic:   parrotTopic   || undefined,
          video_prompt: parrotVideoPrompt || undefined,
          style:        parrotStyle   || undefined,
          duration:     parrotDuration || undefined,
          aspect_ratio: parrotAspect  || undefined,
          audio_style:  parrotAudio   || undefined,
          camera_notes: parrotCamera  || undefined,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const raw = await res.json();
      const normalised: ParrotResult = {
        id: raw.id ?? '',
        source_video: raw.source_video ?? { url: '', title: '', channel: '', views: '', likes: '' },
        blueprint: raw.blueprint ?? {
          title: raw.title, topic: raw.topic, niche: raw.niche,
          structure: raw.structure, thumbnail_ideas: raw.thumbnail_ideas,
          metadata: raw.metadata, source_analysis: raw.source_analysis,
        },
      };
      setParrotResult(normalised);
      setParrotTab('blueprint');
    } catch (err) { setParrotError(err instanceof Error ? err.message : 'Parrot failed'); }
    finally { setParrotLoading(false); }
  };

  const [parrotScriptLoading, setParrotScriptLoading] = useState(false);
  const [parrotScriptError, setParrotScriptError]     = useState('');

  const generateScriptFromParrot = async () => {
    if (!parrotResult) return;
    const topic = parrotResult.blueprint.title;
    const niche = parrotResult.blueprint.niche ?? 'AI tools';
    setParrotScriptLoading(true); setParrotScriptError('');
    try {
      const params = new URLSearchParams({ topic, niche });
      const res = await fetch(`${API_BASE}/api/v1/scripts/generate?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const script: Script = await res.json();
      // Pre-load into the Scripts page state and navigate there
      setGeneratedScript(script);
      setScripts(prev => [script, ...prev]);
      setCurrentPage('scripts');
    } catch (err) {
      setParrotScriptError(err instanceof Error ? err.message : 'Script generation failed');
    } finally {
      setParrotScriptLoading(false);
    }
  };

  const renderSource = () => (
    <div className="videos-page">
      <h1>🎯 Source</h1>
      <p className="subtitle">Find inspiration — parrot a proven video or browse what's trending right now</p>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setSourceTab('parrot')}
          style={{ padding: '0.55rem 1.5rem', borderRadius: '999px', border: `2px solid #a78bfa`,
            background: sourceTab === 'parrot' ? '#a78bfa' : 'transparent',
            color: sourceTab === 'parrot' ? '#fff' : '#a78bfa',
            fontWeight: 700, cursor: 'pointer', fontSize: '0.9375rem' }}>
          🦜 Parrot a Video
        </button>
        <button
          onClick={() => setSourceTab('trending')}
          style={{ padding: '0.55rem 1.5rem', borderRadius: '999px', border: `2px solid #ef4444`,
            background: sourceTab === 'trending' ? '#ef4444' : 'transparent',
            color: sourceTab === 'trending' ? '#fff' : '#ef4444',
            fontWeight: 700, cursor: 'pointer', fontSize: '0.9375rem' }}>
          🔥 Trending Now
        </button>
      </div>
      {sourceTab === 'parrot' ? renderParrot() : renderTrending()}
    </div>
  );

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
            <option value="kids">🧒 Kids &amp; Family</option>
            <option value="gaming">🎮 Gaming</option>
            <option value="music">🎵 Music &amp; Entertainment</option>
            <option value="comedy">😂 Comedy &amp; Skits</option>
            <option value="beauty">💄 Beauty &amp; Fashion</option>
            <option value="food">🍕 Food &amp; Cooking</option>
            <option value="travel">✈️ Travel &amp; Adventure</option>
            <option value="sports">⚽ Sports &amp; Fitness</option>
            <option value="news">📰 News &amp; Current Events</option>
            <option value="pets">🐾 Pets &amp; Animals</option>
            <option value="diy">🔨 DIY &amp; Home Improvement</option>
            <option value="cars">🚗 Cars &amp; Automotive</option>
            <option value="motivation">🔥 Motivation &amp; Self-Help</option>
            <option value="paranormal">👻 True Crime &amp; Paranormal</option>
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
            {/* ── TOP action bar — visible immediately without scrolling ── */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '1.5rem 0 1rem' }}>
              <button
                onClick={generateScriptFromParrot}
                disabled={parrotScriptLoading}
                style={{ flex: '1 1 200px', background: 'linear-gradient(135deg,#a78bfa 0%,#7c3aed 100%)', color: '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.85rem 1.5rem', fontWeight: 800, fontSize: '1.0625rem', cursor: parrotScriptLoading ? 'not-allowed' : 'pointer', opacity: parrotScriptLoading ? 0.7 : 1, boxShadow: '0 2px 12px rgba(124,58,237,0.4)', textAlign: 'center' }}>
                {parrotScriptLoading ? '✍️ Generating Script…' : '✍️ Step 1 — Turn into Script'}
              </button>
              <button
                onClick={() => { setVideoScriptId(parrotResult.id); setCurrentPage('videos'); }}
                style={{ flex: '1 1 200px', background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)', color: '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.85rem 1.5rem', fontWeight: 800, fontSize: '1.0625rem', cursor: 'pointer', boxShadow: '0 2px 12px rgba(16,185,129,0.4)', textAlign: 'center' }}>
                🎬 Step 2 — Generate Video →
              </button>
            </div>
            {parrotScriptError && <div className="error-message" style={{ marginBottom: '1rem' }}>{parrotScriptError}</div>}

            {/* Source video card */}
            <div className="video-status-card" style={{ borderColor: '#8b5cf6', marginTop: '0' }}>
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

              {/* ── Secondary actions (copy/save) ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', margin: '0 0 1rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.8rem', fontFamily: 'monospace' }}>ID: {parrotResult.id.slice(0,8)}…</span>
                <button
                  onClick={() => copyId(parrotResult.id)}
                  style={{ background: copiedId === parrotResult.id ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)', border: `1px solid ${copiedId === parrotResult.id ? 'rgba(16,185,129,0.4)' : 'rgba(148,163,184,0.25)'}`, color: copiedId === parrotResult.id ? '#34d399' : '#94a3b8', borderRadius: '0.375rem', padding: '0.25rem 0.6rem', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                  {copiedId === parrotResult.id ? '✓ Copied' : '📋 Copy ID'}
                </button>
                <button
                  onClick={() => {
                    const lines = [
                      `BLUEPRINT: ${blueprint.title}`,
                      `NICHE: ${blueprint.niche}`,
                      `ID: ${parrotResult.id}`,
                      ``,
                      `SOURCE VIDEO: ${source_video.title || source_video.url}`,
                      ``,
                      `HOOK`, blueprint.structure.hook ?? '',
                      ``, `INTRO`, blueprint.structure.intro ?? '',
                      ...(blueprint.structure.sections?.flatMap(s => [``, `## ${s.title}`, s.content]) ?? []),
                      ``, `OUTRO / CTA`, blueprint.structure.outro ?? '',
                      ``, `THUMBNAIL IDEAS`,
                      ...(blueprint.thumbnail_ideas?.map(t => `• ${t}`) ?? []),
                    ].join('\n');
                    const blob = new Blob([lines], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `blueprint-${blueprint.title.replace(/[^a-z0-9]/gi,'-').toLowerCase().slice(0,40)}.txt`; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', borderRadius: '0.375rem', padding: '0.25rem 0.6rem', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                  💾 Save .txt
                </button>
              </div>
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
                <div className="blueprint-section">
                  <h3>🧲 Thumbnail Ideas</h3>
                  <ul className="thumbnail-ideas">
                    {blueprint.thumbnail_ideas.map((t, i) => (
                      <li key={i}>
                        {typeof t === 'string' ? t : `${t.headline ?? ''}${t.visual ? ` — ${t.visual}` : ''}${t.style ? ` (${t.style})` : ''}`}
                      </li>
                    ))}
                  </ul>
                </div>
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

  const [trendingScriptLoading, setTrendingScriptLoading] = useState<number | null>(null);

  const generateScriptFromTrending = async (item: TrendingItem, itemNiche: string) => {
    setTrendingScriptLoading(item.rank);
    try {
      const topic = item.use_for_niche || item.title;
      const params = new URLSearchParams({ topic, niche: itemNiche });
      const res = await fetch(`${API_BASE}/api/v1/scripts/generate?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const script: Script = await res.json();
      setGeneratedScript(script);
      setScripts(prev => [script, ...prev]);
      setCurrentPage('scripts');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Script generation failed');
    } finally {
      setTrendingScriptLoading(null);
    }
  };

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
            {/* ── Action buttons ── */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => generateScriptFromTrending(item, trendNiche)}
                disabled={trendingScriptLoading === item.rank}
                style={{ flex: '1 1 140px', background: 'linear-gradient(135deg,#a78bfa 0%,#7c3aed 100%)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.55rem 1rem', fontWeight: 700, fontSize: '0.875rem', cursor: trendingScriptLoading === item.rank ? 'not-allowed' : 'pointer', opacity: trendingScriptLoading === item.rank ? 0.7 : 1 }}>
                {trendingScriptLoading === item.rank ? '✍️ Generating…' : '✍️ Write Script'}
              </button>
              <button
                onClick={() => { setTopic(item.use_for_niche || item.title); setNiche(trendNiche); setCurrentPage('blueprint'); }}
                style={{ flex: '1 1 140px', background: 'linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.55rem 1rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                📋 Blueprint
              </button>
              {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="video-download-link" style={{ flex: '1 1 80px', marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', borderRadius: '0.5rem', padding: '0.55rem 1rem', textDecoration: 'none' }}>▶ Watch</a>}
            </div>
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
            <option value="kids">🧒 Kids &amp; Family</option>
            <option value="gaming">🎮 Gaming</option>
            <option value="music">🎵 Music &amp; Entertainment</option>
            <option value="comedy">😂 Comedy &amp; Skits</option>
            <option value="beauty">💄 Beauty &amp; Fashion</option>
            <option value="food">🍕 Food &amp; Cooking</option>
            <option value="travel">✈️ Travel &amp; Adventure</option>
            <option value="sports">⚽ Sports &amp; Fitness</option>
            <option value="news">📰 News &amp; Current Events</option>
            <option value="pets">🐾 Pets &amp; Animals</option>
            <option value="diy">🔨 DIY &amp; Home Improvement</option>
            <option value="cars">🚗 Cars &amp; Automotive</option>
            <option value="motivation">🔥 Motivation &amp; Self-Help</option>
            <option value="paranormal">👻 True Crime &amp; Paranormal</option>
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

  // ── Diagnostics state ────────────────────────────────────────────────────
  const [diagLoading, setDiagLoading]   = useState(false);
  const [diagResult, setDiagResult]     = useState<null | { summary: { total: number; passed: number; failed: number; warned: number }; checks: Array<{ name: string; status: 'pass'|'fail'|'warn'; detail: string; hint: string }> }>(null);
  const [restartBackendState, setRestartBackendState] = useState<'idle'|'loading'|'ok'|'error'>('idle');
  const [restartFrontendState, setRestartFrontendState] = useState<'idle'|'loading'|'ok'|'error'>('idle');
  const [restartMsg, setRestartMsg] = useState('');

  const runDiagnostics = async () => {
    setDiagLoading(true); setDiagResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/health/checks`);
      setDiagResult(await res.json());
    } catch { setDiagResult(null); }
    finally { setDiagLoading(false); }
  };

  const restartService = async (service: 'backend' | 'frontend') => {
    const set = service === 'backend' ? setRestartBackendState : setRestartFrontendState;
    set('loading'); setRestartMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/health/restart/${service}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? res.statusText);
      set('ok');
      setRestartMsg(`✅ ${data.message}`);
    } catch (err) {
      set('error');
      setRestartMsg(`❌ ${err instanceof Error ? err.message : 'Restart failed'}`);
    }
  };

  const diagColor = (s: string) => ({ pass: '#10b981', fail: '#ef4444', warn: '#f59e0b' })[s] ?? '#94a3b8';
  const diagIcon  = (s: string) => ({ pass: '✅', fail: '❌', warn: '⚠️' })[s] ?? '•';

  const renderDiagnostics = () => (
    <div className="videos-page">
      <h1>🔧 System Diagnostics</h1>
      <p className="subtitle">Run all checks to see exactly what's working and what needs fixing</p>

      <div className="generator-form">
        <button className="generate-button" onClick={runDiagnostics} disabled={diagLoading}>
          {diagLoading ? '🔍 Running checks…' : '🔧 Run All Checks'}
        </button>
      </div>

      {/* ── Restart controls ── */}
      <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '1rem', padding: '1.5rem', margin: '1.5rem 0' }}>
        <h2 style={{ color: '#f1f5f9', marginBottom: '0.4rem', fontSize: '1.25rem' }}>🔄 Restart Services</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          Restarts the Azure Container App. The service will be back online within ~30 seconds.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => restartService('backend')}
            disabled={restartBackendState === 'loading'}
            style={{
              flex: '1 1 200px', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontWeight: 700,
              fontSize: '0.9375rem', cursor: restartBackendState === 'loading' ? 'not-allowed' : 'pointer',
              opacity: restartBackendState === 'loading' ? 0.6 : 1,
              background: restartBackendState === 'ok' ? 'rgba(16,185,129,0.15)' : restartBackendState === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.15)',
              border: `1px solid ${restartBackendState === 'ok' ? 'rgba(16,185,129,0.4)' : restartBackendState === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(59,130,246,0.35)'}`,
              color: restartBackendState === 'ok' ? '#34d399' : restartBackendState === 'error' ? '#fca5a5' : '#60a5fa',
            }}>
            {restartBackendState === 'loading' ? '⏳ Restarting…' : '🔵 Restart Backend'}
          </button>
          <button
            onClick={() => restartService('frontend')}
            disabled={restartFrontendState === 'loading'}
            style={{
              flex: '1 1 200px', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontWeight: 700,
              fontSize: '0.9375rem', cursor: restartFrontendState === 'loading' ? 'not-allowed' : 'pointer',
              opacity: restartFrontendState === 'loading' ? 0.6 : 1,
              background: restartFrontendState === 'ok' ? 'rgba(16,185,129,0.15)' : restartFrontendState === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(139,92,246,0.15)',
              border: `1px solid ${restartFrontendState === 'ok' ? 'rgba(16,185,129,0.4)' : restartFrontendState === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(139,92,246,0.35)'}`,
              color: restartFrontendState === 'ok' ? '#34d399' : restartFrontendState === 'error' ? '#fca5a5' : '#a78bfa',
            }}>
            {restartFrontendState === 'loading' ? '⏳ Restarting…' : '🟣 Restart Frontend'}
          </button>
        </div>
        {restartMsg && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: restartMsg.startsWith('✅') ? '#34d399' : '#fca5a5' }}>
            {restartMsg}
          </p>
        )}
        <p style={{ marginTop: '0.75rem', color: '#475569', fontSize: '0.8125rem' }}>
          ⚠️ Restarting the backend will interrupt any in-progress video generations.
        </p>
      </div>

      {diagResult && (
        <div>
          {/* Summary bar */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '1rem 0' }}>
            {[
              { label: 'Passed', count: diagResult.summary.passed, color: '#10b981' },
              { label: 'Failed', count: diagResult.summary.failed, color: '#ef4444' },
              { label: 'Warnings', count: diagResult.summary.warned, color: '#f59e0b' },
            ].map(b => (
              <div key={b.label} style={{ background: `${b.color}22`, border: `1px solid ${b.color}`, borderRadius: '0.5rem', padding: '0.6rem 1rem', textAlign: 'center', minWidth: '80px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: b.color }}>{b.count}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{b.label}</div>
              </div>
            ))}
          </div>

          {/* Check list */}
          <div className="scripts-list">
            {diagResult.checks.map((c, i) => (
              <div key={i} className="script-card" style={{ borderLeft: `4px solid ${diagColor(c.status)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '1rem' }}>{diagIcon(c.status)} {c.name}</span>
                  <span style={{ background: diagColor(c.status), color: '#fff', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>{c.status.toUpperCase()}</span>
                </div>
                <p style={{ color: '#cbd5e1', fontSize: '0.875rem', margin: '0.5rem 0 0' }}>{c.detail}</p>
                {c.hint && (
                  <div style={{ marginTop: '0.5rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.375rem', padding: '0.5rem 0.75rem' }}>
                    <p style={{ color: '#fca5a5', fontSize: '0.8125rem' }}>💡 Fix: {c.hint}</p>
                    {c.name === 'ElevenLabs API Key' && (
                      <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: '0.4rem', color: '#60a5fa', fontSize: '0.8125rem', textDecoration: 'underline' }}>
                        👉 Get free ElevenLabs key →
                      </a>
                    )}
                    {c.name === 'Pexels API Key' && (
                      <a href="https://www.pexels.com/api/" target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: '0.4rem', color: '#60a5fa', fontSize: '0.8125rem', textDecoration: 'underline' }}>
                        👉 Get free Pexels API key →
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Schedule state (used inside Videos page) ──────────────────────────────
  const [scheduleVideoId, setScheduleVideoId]     = useState('');
  const [schedPlatforms, setSchedPlatforms]       = useState<string[]>(['tiktok', 'instagram', 'youtube']);
  const [schedDate, setSchedDate]                 = useState('');
  const [schedTime, setSchedTime]                 = useState('09:00');
  const [schedCaption, setSchedCaption]           = useState('');
  const [schedLoading, setSchedLoading]           = useState(false);
  const [schedResult, setSchedResult]             = useState('');
  const [schedError, setSchedError]               = useState('');
  const [previewUrl, setPreviewUrl]               = useState<string | null>(null);

  // ── iPhone upload state ───────────────────────────────────────────────────
  const [uploadFile, setUploadFile]               = useState<File | null>(null);
  const [uploadTitle, setUploadTitle]             = useState('');
  const [uploadLoading, setUploadLoading]         = useState(false);
  const [uploadProgress, setUploadProgress]       = useState(0);
  const [uploadError, setUploadError]             = useState('');
  const [uploadSuccess, setUploadSuccess]         = useState('');

  const uploadIphoneVideo = async () => {
    if (!uploadFile) { setUploadError('Choose a video file first'); return; }
    setUploadLoading(true); setUploadError(''); setUploadSuccess(''); setUploadProgress(0);
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      if (uploadTitle.trim()) form.append('title', uploadTitle.trim());

      // Use XMLHttpRequest so we can track upload progress
      const result = await new Promise<VideoRecord>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', e => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try { reject(new Error(JSON.parse(xhr.responseText).detail ?? xhr.statusText)); }
            catch { reject(new Error(xhr.statusText)); }
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
        xhr.open('POST', `${API_BASE}/api/v1/videos/upload`);
        xhr.send(form);
      });

      setUploadSuccess(`✅ Uploaded! Video ID: ${result.id}`);
      setActiveVideo(result);
      setUploadFile(null);
      setUploadTitle('');
      setAllVideos(prev => [result, ...prev]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadLoading(false);
      setUploadProgress(0);
    }
  };

  const togglePlatform = (p: string) =>
    setSchedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const submitSchedule = async () => {
    if (!scheduleVideoId.trim()) { setSchedError('Enter a Video ID'); return; }
    if (!schedDate) { setSchedError('Pick a date'); return; }
    if (!schedPlatforms.length) { setSchedError('Select at least one platform'); return; }
    setSchedLoading(true); setSchedError(''); setSchedResult('');
    try {
      const iso = new Date(`${schedDate}T${schedTime}:00Z`).toISOString();
      const res = await fetch(`${API_BASE}/api/v1/videos/${scheduleVideoId.trim()}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: schedPlatforms, scheduled_at: iso, caption: schedCaption || undefined }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const posts = await res.json();
      setSchedResult(`✅ Scheduled on ${posts.length} platform${posts.length !== 1 ? 's' : ''} for ${new Date(iso).toLocaleString()}`);
    } catch (err) { setSchedError(err instanceof Error ? err.message : 'Schedule failed'); }
    finally { setSchedLoading(false); }
  };

  const renderScheduler = () => (
    <div style={{ marginTop: '2rem' }}>
      <div className="generator-form">
        <h2 style={{ color: '#f1f5f9', marginBottom: '1rem' }}>📅 Schedule a Video</h2>
        <div className="form-group">
          <label>Video ID (must be status: ready)</label>
          <input type="text" value={scheduleVideoId} onChange={e => setScheduleVideoId(e.target.value)}
            placeholder="Paste video ID from above" disabled={schedLoading} />
        </div>
        <div className="form-group">
          <label>Date</label>
          <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]} disabled={schedLoading}
            style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '0.5rem', color: '#e2e8f0', padding: '0.75rem', width: '100%', fontSize: '1rem' }} />
        </div>
        <div className="form-group">
          <label>Time (UTC)</label>
          <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)}
            disabled={schedLoading}
            style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '0.5rem', color: '#e2e8f0', padding: '0.75rem', width: '100%', fontSize: '1rem' }} />
        </div>
        <div className="form-group">
          <label>Platforms</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['tiktok','instagram','youtube','facebook','twitter','linkedin'].map(p => (
              <button key={p} type="button" onClick={() => togglePlatform(p)}
                style={{ padding: '0.4rem 0.9rem', borderRadius: '999px', border: `2px solid ${platformColor(p)}`,
                  background: schedPlatforms.includes(p) ? platformColor(p) : 'transparent',
                  color: schedPlatforms.includes(p) ? '#fff' : platformColor(p),
                  fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s' }}>
                {platformIcon(p)} {p}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Caption (optional — defaults to hook + CTA)</label>
          <input type="text" value={schedCaption} onChange={e => setSchedCaption(e.target.value)}
            placeholder="Custom caption for this post" disabled={schedLoading} />
        </div>
        {schedError && <div className="error-message">{schedError}</div>}
        {schedResult && <div className="publish-success">{schedResult}</div>}
        <button className="publish-button" onClick={submitSchedule} disabled={schedLoading}>
          {schedLoading ? '📅 Scheduling…' : '📅 Schedule Post'}
        </button>
      </div>
    </div>
  );


  // ── Analytics page ────────────────────────────────────────────────────────
  const fetchAnalytics = async (metric: 'views'|'likes'|'comments'|'shares' = analyticsTopMetric) => {
    setAnalyticsLoading(true); setAnalyticsError('');
    try {
      const [summaryRes, topRes, dashRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/analytics/summary`),
        fetch(`${API_BASE}/api/v1/analytics/top-posts?limit=10&metric=${metric}`),
        fetch(`${API_BASE}/api/v1/dashboard/metrics`),
      ]);
      if (summaryRes.ok) setAnalyticsSummary(await summaryRes.json());
      if (topRes.ok) { const d = await topRes.json(); setAnalyticsTopPosts(d.posts ?? []); }
      if (dashRes.ok) setDashboardMetrics(await dashRes.json());
    } catch (err) { setAnalyticsError(err instanceof Error ? err.message : 'Failed to load analytics'); }
    finally { setAnalyticsLoading(false); }
  };

  const syncAnalytics = async () => {
    setAnalyticsSyncing(true); setAnalyticsSyncMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/analytics/sync`, { method: 'POST' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const d = await res.json();
      setAnalyticsSyncMsg(`✅ Synced ${d.total_records} records at ${new Date(d.synced_at).toLocaleTimeString()}`);
      await fetchAnalytics();
    } catch (err) { setAnalyticsSyncMsg(`❌ ${err instanceof Error ? err.message : 'Sync failed'}`); }
    finally { setAnalyticsSyncing(false); }
  };

  const fmt = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(1)}K` : String(n);

  const renderAnalytics = () => (
    <div className="videos-page">
      <h1>📊 Analytics Dashboard</h1>
      <p className="subtitle">Performance across all connected social platforms</p>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
        <button className="generate-button" style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
          onClick={() => fetchAnalytics()} disabled={analyticsLoading}>
          {analyticsLoading ? '⏳ Loading…' : '🔄 Refresh'}
        </button>
        <button className="publish-button" style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
          onClick={syncAnalytics} disabled={analyticsSyncing}>
          {analyticsSyncing ? '⏳ Syncing…' : '☁️ Sync from Platforms'}
        </button>
        {analyticsSyncMsg && <span style={{ color: analyticsSyncMsg.startsWith('✅') ? '#10b981' : '#ef4444', fontSize: '0.875rem' }}>{analyticsSyncMsg}</span>}
        {analyticsSummary?.last_synced && (
          <span style={{ color: '#64748b', fontSize: '0.8125rem', marginLeft: 'auto' }}>
            Last synced: {new Date(analyticsSummary.last_synced).toLocaleString()}
          </span>
        )}
      </div>

      {analyticsError && <div className="error-message">{analyticsError}</div>}

      {!analyticsSummary && !dashboardMetrics && !analyticsLoading && (
        <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>No analytics data yet.</p>
          <p style={{ fontSize: '0.875rem' }}>Click <strong>Sync from Platforms</strong> to pull live stats, or <strong>Refresh</strong> to load any stored records.</p>
        </div>
      )}

      {/* Pipeline overview — from dashboard/metrics */}
      {dashboardMetrics && (
        <>
          <h2 style={{ color: '#f1f5f9', marginBottom: '1rem' }}>📋 Pipeline Overview</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Scripts', value: dashboardMetrics.overview.total_scripts, color: '#a78bfa' },
              { label: 'Videos', value: dashboardMetrics.overview.total_videos, color: '#3b82f6' },
              { label: 'Posts', value: dashboardMetrics.overview.total_posts, color: '#10b981' },
              { label: 'Revenue 30d', value: `$${dashboardMetrics.overview.revenue_30d.toFixed(2)}`, color: '#f59e0b' },
            ].map(c => (
              <div key={c.label} style={{ background: `${c.color}12`, border: `1px solid ${c.color}40`, borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: c.color }}>{c.value}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.8125rem', marginTop: '0.25rem' }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Video status breakdown */}
          {Object.keys(dashboardMetrics.videos_by_status).length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {Object.entries(dashboardMetrics.videos_by_status).map(([status, count]) => {
                const color = ({ generating: '#f59e0b', ready: '#10b981', posted: '#3b82f6', failed: '#ef4444' } as Record<string,string>)[status] ?? '#94a3b8';
                return (
                  <span key={status} style={{ background: `${color}20`, color, border: `1px solid ${color}50`, borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600 }}>
                    {status}: {count}
                  </span>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Aggregated totals */}
      {analyticsSummary && (
        <>
          <h2 style={{ color: '#f1f5f9', marginBottom: '1rem' }}>📈 Social Performance</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Total Posts', value: fmt(analyticsSummary.totals.total_posts), color: '#3b82f6' },
              { label: 'Views', value: fmt(analyticsSummary.totals.total_views), color: '#10b981' },
              { label: 'Likes', value: fmt(analyticsSummary.totals.total_likes), color: '#f59e0b' },
              { label: 'Comments', value: fmt(analyticsSummary.totals.total_comments), color: '#a78bfa' },
              { label: 'Shares', value: fmt(analyticsSummary.totals.total_shares), color: '#06b6d4' },
              { label: 'Engagement', value: `${analyticsSummary.totals.avg_engagement_rate}%`, color: '#ef4444' },
            ].map(c => (
              <div key={c.label} style={{ background: `${c.color}12`, border: `1px solid ${c.color}40`, borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: c.color }}>{c.value}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.8125rem', marginTop: '0.25rem' }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Per-platform breakdown */}
          {analyticsSummary.by_platform.length > 0 && (
            <>
              <h2 style={{ color: '#f1f5f9', marginBottom: '1rem' }}>🌐 By Platform</h2>
              <div className="scripts-list" style={{ marginBottom: '1.5rem' }}>
                {analyticsSummary.by_platform.map(p => (
                  <div key={p.platform} className="script-card" style={{ borderLeft: `4px solid ${platformColor(p.platform)}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ color: '#f1f5f9', fontSize: '1rem' }}>{platformIcon(p.platform)} {p.platform.charAt(0).toUpperCase() + p.platform.slice(1)}</h3>
                      <span style={{ background: `${platformColor(p.platform)}22`, color: platformColor(p.platform), borderRadius: '999px', padding: '0.2rem 0.7rem', fontSize: '0.8125rem', fontWeight: 700 }}>{p.posts} posts</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.5rem' }}>
                      {[
                        ['👁 Views', fmt(p.total_views)],
                        ['❤️ Likes', fmt(p.total_likes)],
                        ['💬 Comments', fmt(p.total_comments)],
                        ['🔁 Shares', fmt(p.total_shares)],
                      ].map(([label, val]) => (
                        <div key={label} style={{ textAlign: 'center', background: 'rgba(148,163,184,0.06)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                          <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>{val}</div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Top posts */}
      {analyticsSummary && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <h2 style={{ color: '#f1f5f9' }}>🏆 Top Posts</h2>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {(['views','likes','comments','shares'] as const).map(m => (
                <button key={m} type="button"
                  style={{ padding: '0.25rem 0.65rem', borderRadius: '999px', border: '1px solid rgba(148,163,184,0.3)',
                    background: analyticsTopMetric === m ? '#3b82f6' : 'transparent',
                    color: analyticsTopMetric === m ? '#fff' : '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
                  onClick={() => { setAnalyticsTopMetric(m); fetchAnalytics(m); }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          {analyticsTopPosts.length === 0
            ? <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No posts synced yet — hit Sync from Platforms to pull data.</p>
            : (
              <div className="scripts-list">
                {analyticsTopPosts.map((post, i) => (
                  <div key={post.id} className="script-card" style={{ borderLeft: `4px solid ${platformColor(post.platform)}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <span style={{ background: platformColor(post.platform), color: '#fff', borderRadius: '999px', padding: '0.15rem 0.55rem', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>#{i+1}</span>
                      <span style={{ background: `${platformColor(post.platform)}22`, color: platformColor(post.platform), borderRadius: '999px', padding: '0.15rem 0.55rem', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>{platformIcon(post.platform)} {post.platform}</span>
                    </div>
                    <p style={{ color: '#e2e8f0', margin: '0.6rem 0 0.5rem', fontWeight: 600, lineHeight: 1.4 }}>{post.title || '(untitled)'}</p>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
                      <span style={{ color: '#10b981' }}>👁 {fmt(post.views)}</span>
                      <span style={{ color: '#f59e0b' }}>❤️ {fmt(post.likes)}</span>
                      <span style={{ color: '#a78bfa' }}>💬 {fmt(post.comments)}</span>
                      <span style={{ color: '#06b6d4' }}>🔁 {fmt(post.shares)}</span>
                    </div>
                    {post.posted_at && <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.4rem' }}>Posted {new Date(post.posted_at).toLocaleDateString()}</p>}
                  </div>
                ))}
              </div>
            )
          }
        </>
      )}
    </div>
  );


  // ── Monetize page ─────────────────────────────────────────────────────────
  const renderMonetize = () => (
    <div className="videos-page">
      <h1>💰 Monetization Hub</h1>
      <p className="subtitle">Ways to make money with this platform — from day one</p>

      {/* Affiliate banner */}
      <div style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(59,130,246,0.15))', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#a78bfa', marginBottom: '0.5rem' }}>🎙️ Earn with ElevenLabs Affiliate</h2>
        <p style={{ color: '#cbd5e1', marginBottom: '1rem' }}>Share ElevenLabs with other creators and earn commission on every signup. It powers the voiceovers in every video you publish.</p>
        <a href="https://elevenlabs.io/affiliate" target="_blank" rel="noopener noreferrer"
          className="publish-button" style={{ display: 'inline-block', textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontSize: '1rem', textAlign: 'center' }}>
          🔗 ElevenLabs Affiliate Link →
        </a>
        <p style={{ color: '#64748b', fontSize: '0.8125rem', marginTop: '0.75rem' }}>elevenlabs.io/affiliate</p>
      </div>

      {/* Revenue streams grid */}
      {[
        {
          icon: '📺', title: 'YouTube Ad Revenue', est: '$3–25 CPM',
          color: '#ef4444',
          steps: [
            'Hit 1,000 subscribers + 4,000 watch hours to unlock monetization',
            'Target Finance/AI/Tech niches for highest CPM ($8–25)',
            'Use blueprints to create 8–15 min videos (longer = more ad breaks)',
            'Post 3–5 videos/week using the Generate + Publish flow',
          ],
        },
        {
          icon: '🤝', title: 'Affiliate Marketing', est: '$50–500/sale',
          color: '#10b981',
          steps: [
            'Promote ElevenLabs in every video description with your affiliate link',
            'Join ClickBank, Impact, or PartnerStack for AI tool offers',
            'Add affiliate links in video descriptions and pinned comments',
            'Create "Best AI Tools" videos — highest-converting affiliate content',
          ],
          link: { label: '🔗 ElevenLabs Affiliate Link', url: 'https://elevenlabs.io/affiliate' },
        },
        {
          icon: '📱', title: 'TikTok Creator Fund / Series', est: '$0.02–0.04/view',
          color: '#a78bfa',
          steps: [
            'Use the Generate + Publish flow to post 3 videos/day on TikTok',
            'Enable TikTok Creator Fund at 10K followers',
            'Sell TikTok Series (paid content) once you have an engaged audience',
            'Add a link-in-bio to your affiliate offers or digital products',
          ],
        },
        {
          icon: '💼', title: 'Sell Digital Products', est: '$27–297/sale',
          color: '#f59e0b',
          steps: [
            'Package your video blueprints as a "Content Creation Course"',
            'Sell an AI tools guide as an ebook ($27–97)',
            'Offer a "Done-For-You" video script service to other creators',
            'Use Gumroad, Stan Store, or Teachable — zero upfront cost',
          ],
        },
        {
          icon: '🏢', title: 'Brand Sponsorships', est: '$200–5000/video',
          color: '#3b82f6',
          steps: [
            'At 10K followers, start reaching out to AI/SaaS companies',
            'Use your view stats from the Analytics tab to pitch sponsors',
            'Charge $200–500/video at 10K, $1000–5000 at 100K',
            'Platforms: AspireIQ, Grapevine, direct email outreach',
          ],
        },
        {
          icon: '🔁', title: 'Repurpose + License Content', est: 'Passive income',
          color: '#06b6d4',
          steps: [
            'License your viral video scripts to other creators for $50–200/script',
            'Turn blueprints into newsletter issues (Beehiiv, Substack)',
            'Repurpose every long video into 5 Shorts automatically',
            'Sell access to your blueprint library as a monthly membership',
          ],
        },
      ].map((stream, i) => (
        <div key={i} className="script-card" style={{ borderLeft: `4px solid ${stream.color}`, marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: '1.1rem' }}>{stream.icon} {stream.title}</h3>
            <span style={{ background: `${stream.color}22`, color: stream.color, borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.8125rem', fontWeight: 700 }}>{stream.est}</span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {stream.steps.map((s, j) => (
              <li key={j} style={{ color: '#cbd5e1', fontSize: '0.875rem', padding: '0.25rem 0 0.25rem 1.25rem', position: 'relative', lineHeight: 1.5 }}>
                <span style={{ position: 'absolute', left: 0, color: stream.color }}>▸</span>{s}
              </li>
            ))}
          </ul>
          {stream.link && (
            <a href={stream.link.url} target="_blank" rel="noopener noreferrer"
              className="video-download-link" style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.875rem' }}>
              {stream.link.label}
            </a>
          )}
        </div>
      ))}

      <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '0.75rem', padding: '1.25rem', marginTop: '1rem' }}>
        <h3 style={{ color: '#10b981', marginBottom: '0.5rem' }}>📊 Realistic Income Timeline</h3>
        {[
          { month: 'Month 1–2', income: '$0–50', action: 'Setup, post daily, build audience. Focus on affiliate links.' },
          { month: 'Month 3–4', income: '$50–300', action: 'First affiliate commissions + YouTube unlocks. Scale to 5 videos/day.' },
          { month: 'Month 5–6', income: '$300–1,000', action: 'Brand deals start. Sell first digital product. TikTok fund active.' },
          { month: 'Month 7–12', income: '$1,000–5,000', action: 'Sponsorships + course income + YouTube ads. Fully automated.' },
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0', borderBottom: i < 3 ? '1px solid rgba(148,163,184,0.1)' : 'none', flexWrap: 'wrap' }}>
            <span style={{ color: '#10b981', fontWeight: 700, minWidth: '110px', fontSize: '0.875rem' }}>{row.month}</span>
            <span style={{ color: '#34d399', fontWeight: 700, minWidth: '90px', fontSize: '0.875rem' }}>{row.income}</span>
            <span style={{ color: '#94a3b8', fontSize: '0.875rem', flex: 1 }}>{row.action}</span>
          </div>
        ))}
      </div>
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
          <li>🎨 Create videos manually (Canva) or automate with AI voiceover + stock footage</li>
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
            <option value="finance">💰 Finance / Investing</option>
            <option value="kids">🧒 Kids & Family</option>
            <option value="gaming">🎮 Gaming</option>
            <option value="music">🎵 Music & Entertainment</option>
            <option value="comedy">😂 Comedy & Skits</option>
            <option value="beauty">💄 Beauty & Fashion</option>
            <option value="food">🍕 Food & Cooking</option>
            <option value="travel">✈️ Travel & Adventure</option>
            <option value="sports">⚽ Sports & Fitness</option>
            <option value="news">📰 News & Current Events</option>
            <option value="pets">🐾 Pets & Animals</option>
            <option value="diy">🔨 DIY & Home Improvement</option>
            <option value="cars">🚗 Cars & Automotive</option>
            <option value="motivation">🔥 Motivation & Self-Help</option>
            <option value="paranormal">👻 True Crime & Paranormal</option>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', margin: '0.5rem 0 1rem' }}>
            <p className="script-id-copy" style={{ margin: 0 }}>
              🆔 Script ID: <strong style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{generatedScript.id}</strong>
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const text = [
                    `TOPIC: ${generatedScript.topic}`,
                    `NICHE: ${generatedScript.script_metadata?.niche ?? niche}`,
                    `ID: ${generatedScript.id}`,
                    ``,
                    `HOOK (3-5 seconds)`,
                    generatedScript.hook,
                    ``,
                    `BODY (20-30 seconds)`,
                    generatedScript.body,
                    ``,
                    `CALL TO ACTION (3-5 seconds)`,
                    generatedScript.cta,
                  ].join('\n');
                  const blob = new Blob([text], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `script-${generatedScript.topic.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#60a5fa', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                💾 Save as .txt
              </button>
              <button
                onClick={() => copyId(generatedScript.id)}
                style={{ background: copiedId === generatedScript.id ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)', border: `1px solid ${copiedId === generatedScript.id ? 'rgba(16,185,129,0.4)' : 'rgba(148,163,184,0.25)'}`, color: copiedId === generatedScript.id ? '#34d399' : '#94a3b8', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {copiedId === generatedScript.id ? '✓ Copied!' : '📋 Copy ID'}
              </button>
              <button
                onClick={() => { setVideoScriptId(generatedScript.id); setCurrentPage('videos'); }}
                style={{ background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(16,185,129,0.35)' }}>
                🎬 Generate Video →
              </button>
            </div>
          </div>

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

          <div className="make-video-bar">
            <p>✅ Script ready — make a video from it now</p>
            <button className="btn-green" onClick={() => { setVideoScriptId(generatedScript.id); loadScript(generatedScript.id); setCurrentPage('videos'); }}>
              🎬 Step 3: Make Video →
            </button>
          </div>
        </div>
      )}

      {scripts.length > 0 && (
        <div className="scripts-history">
          <h2>Recent Scripts ({scripts.length})</h2>
          <div className="scripts-list">
            {scripts.map((script) => (
              <div key={script.id} className="script-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0 }}>{script.topic}</h3>
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); copyId(script.id); }}
                      style={{ background: copiedId === script.id ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)', border: `1px solid ${copiedId === script.id ? 'rgba(16,185,129,0.4)' : 'rgba(148,163,184,0.25)'}`, color: copiedId === script.id ? '#34d399' : '#94a3b8', borderRadius: '0.375rem', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {copiedId === script.id ? '✓' : '📋'}
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setVideoScriptId(script.id); setCurrentPage('videos'); }}
                      style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399', borderRadius: '0.375rem', padding: '0.25rem 0.65rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      🎬 Use
                    </button>
                  </div>
                </div>
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
            <option value="kids">🧒 Kids & Family</option>
            <option value="gaming">🎮 Gaming</option>
            <option value="music">🎵 Music & Entertainment</option>
            <option value="comedy">😂 Comedy & Skits</option>
            <option value="beauty">💄 Beauty & Fashion</option>
            <option value="food">🍕 Food & Cooking</option>
            <option value="travel">✈️ Travel & Adventure</option>
            <option value="sports">⚽ Sports & Fitness</option>
            <option value="news">📰 News & Current Events</option>
            <option value="pets">🐾 Pets & Animals</option>
            <option value="diy">🔨 DIY & Home Improvement</option>
            <option value="cars">🚗 Cars & Automotive</option>
            <option value="motivation">🔥 Motivation & Self-Help</option>
            <option value="paranormal">👻 True Crime & Paranormal</option>
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
            <li>Set ELEVENLABS_API_KEY + PEXELS_API_KEY to automate video generation (free tier available)</li>
            <li>Videos created automatically: AI voiceover + stock footage + captions</li>
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
              <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>Automated Video (ElevenLabs + Pexels)</td>
              <td style={{ padding: '0.75rem', textAlign: 'center', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>⏳ Needs API Keys</td>
              <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>Free tier available</td>
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
          <li>Use ElevenLabs + Pexels automation once you're creating 5+ videos/week</li>
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
        
        <div className="nav-workflow">
          <div className="nav-step">
            <button className={`nav-step-btn ${currentPage === 'home' ? 'active' : ''}`} onClick={() => setCurrentPage('home')}>
              <span className="nav-step-num">⌂</span>
              <span>Home</span>
            </button>
            <span className="nav-step-arrow">→</span>
          </div>
          <div className="nav-step">
            <button className={`nav-step-btn ${currentPage === 'source' ? 'active' : ''}`} onClick={() => setCurrentPage('source')}>
              <span className="nav-step-num">1</span>
              <span>Source</span>
            </button>
            <span className="nav-step-arrow">→</span>
          </div>
          <div className="nav-step">
            <button className={`nav-step-btn ${currentPage === 'scripts' ? 'active' : ''}`} onClick={() => setCurrentPage('scripts')}>
              <span className="nav-step-num">2</span>
              <span>Script</span>
            </button>
            <span className="nav-step-arrow">→</span>
          </div>
          <div className="nav-step">
            <button className={`nav-step-btn ${currentPage === 'videos' ? 'active' : ''}`} onClick={() => setCurrentPage('videos')}>
              <span className="nav-step-num">3</span>
              <span>Video</span>
            </button>
          </div>
        </div>

        <div className="nav-utils">
          <button className={`nav-util-btn ${currentPage === 'analytics' ? 'active' : ''}`} onClick={() => { setCurrentPage('analytics'); fetchAnalytics(); }}>
            📊
          </button>
          <button className={`nav-util-btn ${currentPage === 'diagnostics' ? 'active' : ''}`} onClick={() => setCurrentPage('diagnostics')}>
            🔧
          </button>
          <button className={`nav-util-btn ${currentPage === 'help' ? 'active' : ''}`} onClick={() => setCurrentPage('help')}>
            📖
          </button>
        </div>
      </nav>

      {/* ── AI Assistant bar ── */}
      <div style={{ background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid rgba(59,130,246,0.2)', padding: '0.5rem 1rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ color: '#3b82f6', fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>🤖 Ask AI</span>
            <input
              type="text"
              value={askQuestion}
              onChange={e => setAskQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !askLoading) submitAsk(); }}
              placeholder="Ask anything about the platform, content strategy, monetization…"
              style={{ flex: 1, background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '0.4rem', color: '#e2e8f0', padding: '0.4rem 0.75rem', fontSize: '0.875rem', outline: 'none' }}
              disabled={askLoading}
            />
            <button onClick={() => submitAsk()} disabled={askLoading || !askQuestion.trim()}
              style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', borderRadius: '0.4rem', padding: '0.4rem 0.85rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {askLoading ? '…' : 'Ask'}
            </button>
            <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
              {['How do I make money?', 'How to generate a video?', 'What is the Parrot feature?'].map(q => (
                <button key={q} onClick={() => { setAskQuestion(q); submitAsk(q); }}
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#94a3b8', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Answer panel */}
          {(askAnswer || askError) && askOpen && (
            <div style={{ marginTop: '0.5rem', background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '0.5rem', padding: '0.75rem 1rem', position: 'relative' }}>
              <button onClick={() => setAskOpen(false)}
                style={{ position: 'absolute', top: '0.5rem', right: '0.75rem', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>
                ✕
              </button>
              {askError
                ? <p style={{ color: '#fca5a5', fontSize: '0.875rem', margin: 0 }}>⚠️ {askError}</p>
                : <p style={{ color: '#e2e8f0', fontSize: '0.875rem', margin: 0, whiteSpace: 'pre-wrap', paddingRight: '1.5rem' }}>{askAnswer}</p>
              }
            </div>
          )}
        </div>
      </div>

      <main className="main-content">
        {currentPage === 'home' ? renderHome() :
         currentPage === 'source' ? renderSource() :
         currentPage === 'scripts' ? renderScripts() :
         currentPage === 'blueprint' ? renderBlueprint() :
         currentPage === 'videos' ? renderVideos() :
         currentPage === 'parrot' ? renderParrot() :
         currentPage === 'trending' ? renderTrending() :
         currentPage === 'diagnostics' ? renderDiagnostics() :
         currentPage === 'analytics' ? renderAnalytics() :
         currentPage === 'monetize' ? renderMonetize() :
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

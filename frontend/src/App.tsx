import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
if (!API_BASE) console.warn('[App] VITE_API_URL is not set — all API calls will fail. Check your Azure build args.');

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
  script_id: string | null;   // null for manually-uploaded videos
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

// ── Optimize / Keywords / Channel Audit types ─────────────────────────────────
interface OptimizeTitle { title: string; style: string; ctr_score: number; }
interface OptimizeResult {
  titles: OptimizeTitle[];
  description: string;
  tags: string[];
  content_pack: { recommended_title: string; target_audience: string; best_posting_time: string; estimated_cpm: string; seo_tips: string[] };
}
interface KeywordItem {
  keyword: string; search_volume: string; competition: string; opportunity_score: number;
  intent: string; suggested_title: string; why: string; result_count?: number;
}
interface KeywordResult {
  seed_keyword: string; keywords: KeywordItem[]; long_tail: string[];
  recommended_primary: string; niche_tips: string[];
}
interface AuditScore { score: number; label: string; detail: string; }
interface ChannelAuditResult {
  overall_score: number; grade: string; summary: string;
  scores: Record<string, AuditScore>;
  strengths: string[];
  improvements: Array<{ priority: string; action: string; impact: string }>;
  next_5_videos: Array<{ title: string; why: string; keyword: string }>;
  monetization_readiness: { adsense_eligible: boolean; estimated_monthly_revenue: string; recommendation: string };
  channel: { title: string; subscribers: number; total_views: number; video_count: number; avg_views: number; channel_id: string };
}

// ── AI Visuals / DALL·E 3 types ──────────────────────────────────────────────
interface AIImage {
  url: string;
  revised_prompt: string;
  provider: string;
}

// ── Workflow steps banner ─────────────────────────────────────────────────────
function WorkflowSteps({ steps }: { steps: { n: number; label: string; detail: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: '0.875rem', overflow: 'hidden', flexWrap: 'wrap' }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ flex: '1 1 160px', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.875rem 1rem', borderRight: i < steps.length - 1 ? '1px solid #e5e7eb' : 'none', background: 'transparent' }}>
          <div style={{ minWidth: '1.75rem', height: '1.75rem', borderRadius: '50%', background: '#3b82d4', color: '#fff', fontWeight: 800, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.05rem' }}>{s.n}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#1f2328', lineHeight: 1.3 }}>{s.label}</div>
            <div style={{ fontSize: '0.75rem', color: '#57606a', marginTop: '0.2rem', lineHeight: 1.4 }}>{s.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Login screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading]   = React.useState(false);
  const [error, setError]       = React.useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, totp_code: '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Login failed');
      localStorage.setItem('auth_token', data.access_token);
      onLogin(data.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f8fa' }}>
      <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '1rem', padding: '2.5rem 2rem', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>🎬</div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1f2328', margin: 0 }}>KidVid Creator</h1>
          <p style={{ color: '#57606a', fontSize: '0.875rem', margin: '0.3rem 0 0' }}>Sign in to your dashboard</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#57606a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Username</label>
          <input
            type="text" value={username} onChange={e => setUsername(e.target.value)}
            placeholder="admin" autoComplete="username" required disabled={loading}
            style={{ padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.9375rem', outline: 'none', background: '#f7f8fa' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#57606a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Password</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" autoComplete="current-password" required disabled={loading}
            style={{ padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.9375rem', outline: 'none', background: '#f7f8fa' }}
          />
        </div>

        {error && (
          <div style={{ background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: '0.5rem', padding: '0.6rem 0.85rem', color: '#dc2626', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading || !username || !password}
          style={{ background: loading ? '#93c5a8' : '#2a9d5c', color: '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.8rem', fontWeight: 800, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p style={{ textAlign: 'center', color: '#8c959f', fontSize: '0.78rem', margin: 0 }}>
          Credentials are set via GitHub Secrets
        </p>
      </form>
    </div>
  );
}

function App() {
  // ── Auth state ── (must be declared before any other hooks — no early return)
  const [authToken, setAuthToken] = React.useState<string | null>(() => localStorage.getItem('auth_token'));

  const handleLogin = (token: string) => setAuthToken(token);
  const handleLogout = () => { localStorage.removeItem('auth_token'); setAuthToken(null); };

  // apiFetch: auto-inject Bearer token on every /api/ call
  const apiFetch = React.useCallback((url: string, init?: RequestInit): Promise<Response> => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { ...(init?.headers as Record<string, string> ?? {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, { ...init, headers });
  }, []);

  const [currentPage, setCurrentPage] = useState<'home' | 'source' | 'scripts' | 'blueprint' | 'videos' | 'parrot' | 'trending' | 'diagnostics' | 'monetize' | 'analytics' | 'help' | 'visuals' | 'monitor' | 'orders' | 'influencer' | 'users' | 'gumroad' | 'funnel' | 'advisor' | 'granny' | 'voice'>('home');
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
  // Top Performers feedback loop
  const [topPerfLoading, setTopPerfLoading]         = useState(false);
  const [topPerfDataAvailable, setTopPerfDataAvailable] = useState(false);
  const [topPerfNote, setTopPerfNote]               = useState('');
  
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

  // ── Growth Advisor state ──────────────────────────────────────────────────
  interface AdvisorTask {
    id: string;
    category: 'grow_followers' | 'fix_issues' | 'sell_products' | 'content_ideas';
    priority: 'high' | 'medium' | 'low';
    title: string;
    detail: string;
    impact: string;
    page: string | null;
  }
  interface AdvisorData {
    summary: string;
    score: number;
    tasks: AdvisorTask[];
    quick_wins: string[];
    weekly_focus: string;
  }
  const [advisorData, setAdvisorData]         = useState<AdvisorData | null>(null);
  const [advisorLoading, setAdvisorLoading]   = useState(false);
  const [advisorError, setAdvisorError]       = useState('');
  const [advisorDone, setAdvisorDone]         = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('advisor_done') || '[]')); } catch { return new Set(); }
  });
  const [advisorFilter, setAdvisorFilter]     = useState<string>('all');

  const fetchAdvisor = React.useCallback(async () => {
    setAdvisorLoading(true); setAdvisorError('');
    try {
      const metrics = dashboardMetrics;
      const summary = analyticsSummary;
      const body = {
        niche: niche || 'AI tools',
        total_videos:  metrics?.overview?.total_videos  ?? 0,
        total_scripts: metrics?.overview?.total_scripts ?? 0,
        total_posts:   summary?.totals?.total_posts     ?? 0,
        total_views:   summary?.totals?.total_views     ?? 0,
        total_likes:   summary?.totals?.total_likes     ?? 0,
        revenue_30d:   metrics?.overview?.revenue_30d   ?? 0,
        connected_platforms: ['youtube', 'gumroad'],
        missing_platforms:   ['tiktok', 'instagram'],
        has_google_api: true,
        has_buffer: true,
      };
      const r = await apiFetch(`${API_BASE}/api/v1/scripts/growth-advisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail ?? 'Advisor failed'); }
      const data: AdvisorData = await r.json();
      setAdvisorData(data);
    } catch (err) {
      setAdvisorError(err instanceof Error ? err.message : 'Failed to load advisor');
    } finally {
      setAdvisorLoading(false);
    }
  }, [dashboardMetrics, analyticsSummary, niche, apiFetch]);

  const toggleAdvisorDone = (id: string) => {
    setAdvisorDone(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('advisor_done', JSON.stringify([...next]));
      return next;
    });
  };

  // ── Performance Monitor state ─────────────────────────────────────────────
  interface MonitorData {
    period_days: number;
    last_synced: string | null;
    social: {
      total_posts: number; total_views: number; total_likes: number;
      total_comments: number; total_shares: number; total_clicks: number;
      avg_engagement_rate: number;
      by_platform: Array<{platform:string;posts:number;views:number;likes:number;comments:number;shares:number;engagement_rate:number}>;
    };
    revenue: { total: number; conversions: number; avg_order: number };
    pipeline: { videos_by_status: Record<string,number>; posts_published: number };
    low_performer_count: number;
    top_posts: Array<{id:string;platform:string;title:string|null;views:number;likes:number;comments:number;shares:number;posted_at:string|null}>;
    affiliates: Array<{name:string;category:string;commission:string;est_monthly:string;link:string;why:string}>;
  }
  interface ImproveSuggestions {
    threshold_views: number; avg_views: number; low_performer_count: number;
    low_performers: Array<{title:string|null;platform:string;views:number;likes:number;comments:number}>;
    suggestions: Array<{title:string;platform:string;tactics:string[]}>;
    general_tips: string[];
  }
  const [monitorData,        setMonitorData]        = useState<MonitorData | null>(null);
  const [monitorLoading,     setMonitorLoading]     = useState(false);
  const [monitorError,       setMonitorError]       = useState('');
  const [monitorDays,        setMonitorDays]        = useState(30);
  const [monitorSyncing,     setMonitorSyncing]     = useState(false);
  const [monitorSyncMsg,     setMonitorSyncMsg]     = useState('');
  const [monitorTab,         setMonitorTab]         = useState<'overview'|'platforms'|'topvids'|'affiliate'|'ai-coach'|'connections'>('overview');
  const [improveData,        setImproveData]        = useState<ImproveSuggestions | null>(null);
  const [improveLoading,     setImproveLoading]     = useState(false);
  const [improveError,       setImproveError]       = useState('');
  const [improveThreshold,   setImproveThreshold]   = useState(500);
  interface PlatformStatus {
    platform: string; label: string; connected: boolean; auto_refresh: boolean;
    missing: string[]; setup_url: string; scope_needed: string; notes: string;
  }
  interface ConnectionStatus {
    platforms: PlatformStatus[]; connected_count: number; total: number; all_connected: boolean;
  }
  const [connStatus,   setConnStatus]   = useState<ConnectionStatus | null>(null);
  const [connLoading,  setConnLoading]  = useState(false);

  // ── Orders Management state ───────────────────────────────────────────────
  interface ChildProfileRecord {
    id: string; order_id: string;
    child_name: string | null; age: string | null;
    hair_colour: string | null; eye_colour: string | null; features: string | null;
    created_at: string;
  }
  interface OrderRecord {
    id: string; gumroad_sale_id: string; product_name: string | null;
    price_cents: number | null; customer_email: string; customer_name: string | null;
    status: 'received' | 'queued' | 'generating' | 'storing' | 'delivering' | 'delivered' | 'failed';
    error_message: string | null;
    generated_prompt: string | null; video_local_path: string | null;
    video_storage_url: string | null; email_message_id: string | null;
    created_at: string; updated_at: string;
    child_profile: ChildProfileRecord | null;
  }
  const [ordersList,      setOrdersList]      = useState<OrderRecord[]>([]);
  const [ordersTotal,     setOrdersTotal]     = useState(0);
  const [ordersLoading,   setOrdersLoading]   = useState(false);
  const [ordersError,     setOrdersError]     = useState('');
  const [ordersFilter,    setOrdersFilter]    = useState<string>('all');
  const [ordersPage,      setOrdersPage]      = useState(1);
  const [selectedOrder,   setSelectedOrder]   = useState<OrderRecord | null>(null);
  const [orderRetrying,   setOrderRetrying]   = useState<string | null>(null);
  const [orderRetryMsg,   setOrderRetryMsg]   = useState('');

  // Helper: return backend streaming URL for a video record
  const videoStreamUrl = (v: VideoRecord) =>
    v.video_url ? `${API_BASE}/api/v1/videos/${v.id}/stream` : null;

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

  // ── AI Video Editor state ─────────────────────────────────────────────────
  type VoiceOption  = { id: string; label: string };
  type MusicTrack   = { id: string; label: string; url: string | null };
  type CaptionStyle = { id: string; label: string };
  const [editorOpen, setEditorOpen]           = useState(false);
  const [editorVideoId, setEditorVideoId]     = useState('');
  const [editorVoiceId, setEditorVoiceId]     = useState('');
  const [editorBroll, setEditorBroll]         = useState('');
  const [editorMusicId, setEditorMusicId]     = useState('none');
  const [editorMusicVol, setEditorMusicVol]   = useState(0.15);
  const [editorCaptionStyle, setEditorCaptionStyle] = useState('timed');
  const [editorLoading, setEditorLoading]     = useState(false);
  const [editorError, setEditorError]         = useState('');
  const [voices, setVoices]                   = useState<VoiceOption[]>([]);
  const [musicTracks, setMusicTracks]         = useState<MusicTrack[]>([]);
  const [captionStyles, setCaptionStyles]     = useState<CaptionStyle[]>([]);

  // ── Trending auto-queue state ─────────────────────────────────────────────
  const [autoQueueLoading, setAutoQueueLoading] = useState(false);
  const [autoQueueResult, setAutoQueueResult]   = useState<{count:number;topics:string[];scripts:{id:string;topic:string;hook:string}[]} | null>(null);
  const [autoQueueError, setAutoQueueError]     = useState('');
  const [bulkGenLoading,  setBulkGenLoading]    = useState(false);
  const [bulkGenProgress, setBulkGenProgress]   = useState<{done:number;total:number;current:string;log:string[]}>({ done:0, total:0, current:'', log:[] });
  const [bulkGenError,    setBulkGenError]      = useState('');
  const [bulkGenDone,     setBulkGenDone]       = useState(false);
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
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/ask`, {
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
    apiFetch(`${API_BASE}/api/v1/health/video-provider`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setVideoProvider(d); })
      .catch(() => {});
    loadAllVideos();
    apiFetch(`${API_BASE}/api/v1/dashboard/metrics`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDashboardMetrics(d); })
      .catch(() => {});
  }, []);

  const loadAllVideos = async () => {
    setAllVideosLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/videos/?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setAllVideos(data.items ?? []);
      }
    } catch { /* ignore */ }
    finally { setAllVideosLoading(false); }
  };

  // Load editor reference data once
  const loadEditorOptions = async () => {
    try {
      const [vRes, mRes, cRes] = await Promise.all([
        apiFetch(`${API_BASE}/api/v1/videos/voices`),
        apiFetch(`${API_BASE}/api/v1/videos/music-tracks`),
        apiFetch(`${API_BASE}/api/v1/videos/caption-styles`),
      ]);
      if (vRes.ok) setVoices((await vRes.json()).voices ?? []);
      if (mRes.ok) setMusicTracks((await mRes.json()).tracks ?? []);
      if (cRes.ok) setCaptionStyles((await cRes.json()).styles ?? []);
    } catch { /* silently ignore — editor still works with defaults */ }
  };

  const openEditor = (videoId: string) => {
    setEditorVideoId(videoId);
    setEditorVoiceId('');
    setEditorBroll('');
    setEditorMusicId('none');
    setEditorMusicVol(0.15);
    setEditorCaptionStyle('timed');
    setEditorError('');
    setEditorOpen(true);
    if (voices.length === 0) loadEditorOptions();
  };

  const submitEdit = async () => {
    if (!editorVideoId) return;
    setEditorLoading(true); setEditorError('');
    try {
      const body: Record<string, unknown> = {};
      if (editorVoiceId)  body.voice_id = editorVoiceId;
      if (editorBroll.trim()) body.broll_keywords = editorBroll.trim();
      if (editorMusicId !== 'none') body.music_id = editorMusicId;
      body.caption_style = editorCaptionStyle;
      body.music_volume = editorMusicVol;

      const res = await apiFetch(`${API_BASE}/api/v1/videos/${editorVideoId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const video: VideoRecord = await res.json();
      setActiveVideo(video);
      setAllVideos(prev => prev.map(v => v.id === video.id ? video : v));
      setEditorOpen(false);
      // Start polling
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => pollVideo(video.id), 10_000);
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Edit failed');
    } finally {
      setEditorLoading(false);
    }
  };

  // Auto-queue: fetch trending → generate scripts for all in one click
  const runAutoQueue = async () => {
    setAutoQueueLoading(true); setAutoQueueError(''); setAutoQueueResult(null);
    setBulkGenDone(false); setBulkGenError('');
    setBulkGenProgress({ done: 0, total: 0, current: '', log: [] });
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/trending-to-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: trendNiche, count: 5 }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const data = await res.json();
      setAutoQueueResult(data);
      if (data.scripts?.length) {
        setScripts(prev => [...(data.scripts as Script[]), ...prev]);
      }
    } catch (err) {
      setAutoQueueError(err instanceof Error ? err.message : 'Auto-queue failed');
    } finally {
      setAutoQueueLoading(false);
    }
  };

  // Bulk: generate a Veo video for every script then publish to all connected platforms
  const runGenerateAndPublishAll = async () => {
    if (!autoQueueResult?.scripts?.length) return;
    const scripts = autoQueueResult.scripts;
    setBulkGenLoading(true); setBulkGenError(''); setBulkGenDone(false);
    setBulkGenProgress({ done: 0, total: scripts.length, current: '', log: [] });

    const addLog = (msg: string) =>
      setBulkGenProgress(p => ({ ...p, log: [...p.log, msg] }));

    try {
      for (let i = 0; i < scripts.length; i++) {
        const s = scripts[i];
        setBulkGenProgress(p => ({ ...p, current: s.topic, done: i }));

        // ── 1. Kick off video generation ──────────────────────────────────
        addLog(`🎬 [${i + 1}/${scripts.length}] Generating video: "${s.topic}"`);
        let videoId: string;
        try {
          const genRes = await apiFetch(`${API_BASE}/api/v1/videos/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script_id: s.id }),
          });
          if (!genRes.ok) { const e = await genRes.json(); throw new Error(e.detail ?? genRes.statusText); }
          const video: VideoRecord = await genRes.json();
          videoId = video.id;
        } catch (err) {
          addLog(`  ❌ Generation failed: ${err instanceof Error ? err.message : 'unknown error'}`);
          continue;
        }

        // ── 2. Poll until ready (max 5 min) ───────────────────────────────
        addLog(`  ⏳ Waiting for Veo 3 to finish…`);
        let ready = false;
        for (let attempt = 0; attempt < 30; attempt++) {
          await new Promise(r => setTimeout(r, 10_000));
          try {
            const pollRes = await apiFetch(`${API_BASE}/api/v1/videos/${videoId}`);
            if (pollRes.ok) {
              const v: VideoRecord = await pollRes.json();
              if (v.status === 'ready') { ready = true; break; }
              if (v.status === 'failed') { addLog(`  ❌ Veo generation failed: ${v.error_message ?? 'unknown'}`); break; }
            }
          } catch { /* transient — keep polling */ }
        }
        if (!ready) { addLog(`  ⚠️ Timed out waiting for video — skipping publish`); continue; }

        // ── 3. Publish to all platforms via Buffer ────────────────────────
        addLog(`  📤 Publishing to social media…`);
        try {
          const pubRes = await apiFetch(`${API_BASE}/api/v1/videos/${videoId}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platforms: ['youtube', 'tiktok', 'instagram', 'facebook'] }),
          });
          if (!pubRes.ok) { const e = await pubRes.json(); throw new Error(e.detail ?? pubRes.statusText); }
          const posts = await pubRes.json();
          const platforms = Array.isArray(posts) ? posts.map((p: {platform?:string}) => p.platform ?? '').filter(Boolean).join(', ') : 'queued';
          addLog(`  ✅ Posted to: ${platforms || 'all platforms'}`);
        } catch (err) {
          addLog(`  ⚠️ Publish failed: ${err instanceof Error ? err.message : 'unknown'}`);
        }

        setBulkGenProgress(p => ({ ...p, done: i + 1 }));
      }
      setBulkGenDone(true);
      addLog(`🎉 Done! ${scripts.length} videos generated and posted.`);
    } catch (err) {
      setBulkGenError(err instanceof Error ? err.message : 'Bulk pipeline failed');
    } finally {
      setBulkGenLoading(false);
      setBulkGenProgress(p => ({ ...p, current: '' }));
    }
  };

  const startGenerate = async () => {
    if (!videoScriptId.trim()) { setVideoError('Paste a Script ID first'); return; }
    setVideoLoading(true); setVideoError(''); setActiveVideo(null); setPublishSuccess('');
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/videos/generate`, {
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
    if (!v.script_id) { setVideoError('This video has no linked script — upload a new video instead.'); return; }
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
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/${id.trim()}`);
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
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/${previewScript.id}`, {
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
      const res = await apiFetch(`${API_BASE}/api/v1/videos/${id}`);
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
      const res = await apiFetch(`${API_BASE}/api/v1/videos/${id}/publish`, {
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

      {/* ── Active provider banner — promoted to page header ── */}
      {videoProvider ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          background: `${videoProvider.color}18`,
          border: `1px solid ${videoProvider.color}50`,
          borderRadius: '0.875rem', padding: '1rem 1.5rem',
          marginBottom: '1.5rem', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ background: videoProvider.color, color: '#fff', borderRadius: '999px', padding: '0.25rem 0.85rem', fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                {videoProvider.provider === 'veo' ? '🎬' : videoProvider.provider === 'local' ? '🎞️' : '⚠️'} {videoProvider.label}
              </span>
              {videoProvider.provider === 'veo' && (
                <span style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid #b7e4cc', color: '#2a9d5c', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  ✨ AI-generated clips via Google AI Studio
                </span>
              )}
              {videoProvider.provider === 'local' && (
                <span style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#3b82f6', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  🗣️ Timed captions + stock footage
                </span>
              )}
            </div>
            <span style={{ color: '#637381', fontSize: '0.875rem', marginTop: '0.25rem' }}>{videoProvider.detail}</span>
          </div>
          {videoProvider.provider === 'none' && (
            <button className="inline-link" onClick={() => setCurrentPage('diagnostics')}>
              Fix in Diagnostics →
            </button>
          )}
        </div>
      ) : (
        <p className="subtitle">Generate a video from a script and publish it to your social platforms</p>
      )}

      {/* ── Davinci.ai launcher + Import ── */}
      <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '0.875rem', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ color: '#a78bfa', margin: 0, fontSize: '1rem' }}>📥 Import Video</h3>
          <span style={{ color: '#637381', fontSize: '0.8rem' }}>Create on Davinci.ai, HeyGen, CapCut, or any other tool — then import here</span>
        </div>

        {/* ── Step 1: Davinci.ai launch button ── */}
        <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.12))', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span style={{ background: '#6366f1', color: '#fff', borderRadius: '999px', padding: '0.15rem 0.55rem', fontSize: '0.72rem', fontWeight: 700 }}>Step 1</span>
                <span style={{ color: '#1c2b33', fontWeight: 700, fontSize: '0.9rem' }}>Create your video on Davinci.ai</span>
              </div>
              <p style={{ color: '#637381', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
                AI-powered video editor — use your script, add AI avatars, voiceover &amp; captions, then export as MP4.
              </p>
            </div>
            <a
              href="https://davinci.ai/app/home"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                color: '#fff', borderRadius: '0.5rem', padding: '0.65rem 1.25rem',
                fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Open Davinci.ai →
            </a>
          </div>
        </div>

        {/* ── Step 2: paste URL or upload file ── */}
        <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ background: '#a78bfa', color: '#fff', borderRadius: '999px', padding: '0.15rem 0.55rem', fontSize: '0.72rem', fontWeight: 700 }}>Step 2</span>
            <span style={{ color: '#1c2b33', fontWeight: 700, fontSize: '0.9rem' }}>Import your finished video</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input
              type="text"
              value={uploadTitle}
              onChange={e => setUploadTitle(e.target.value)}
              placeholder="Video title (optional)"
              disabled={uploadLoading}
              style={{ background: '#f4f6f8', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.65rem 0.85rem', fontSize: '0.875rem' }}
            />

            {/* URL import row */}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <input
                type="url"
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                placeholder="Paste Davinci.ai MP4 download link — or use file upload below"
                disabled={importUrlLoading}
                style={{ flex: '1 1 260px', background: '#f4f6f8', border: '1px solid rgba(99,102,241,0.35)', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.65rem 0.85rem', fontSize: '0.875rem' }}
              />
              <button
                onClick={submitImportUrl}
                disabled={importUrlLoading || !importUrl.trim()}
                style={{ flex: '0 0 auto', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.65rem 1.1rem', fontWeight: 700, fontSize: '0.875rem', cursor: importUrlLoading || !importUrl.trim() ? 'not-allowed' : 'pointer', opacity: importUrlLoading || !importUrl.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                {importUrlLoading ? '⏳ Importing…' : '🔗 Import URL'}
              </button>
            </div>
            {importUrlError   && <div className="error-message">{importUrlError}</div>}
            {importUrlSuccess && <div className="publish-success">{importUrlSuccess}</div>}

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(148,163,184,0.12)' }} />
              <span style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 600 }}>OR UPLOAD FILE</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(148,163,184,0.12)' }} />
            </div>

            {/* File upload row */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{
                flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '0.6rem',
                background: 'rgba(139,92,246,0.1)', border: '2px dashed rgba(139,92,246,0.4)',
                borderRadius: '0.5rem', padding: '0.75rem 1rem', cursor: 'pointer', color: '#a78bfa', fontWeight: 600, fontSize: '0.875rem'
              }}>
                <input type="file" accept="video/*" style={{ display: 'none' }}
                  onChange={e => setUploadFile(e.target.files?.[0] ?? null)} disabled={uploadLoading} />
                📂 {uploadFile ? uploadFile.name : 'Choose video file (MP4, MOV, WebM)'}
              </label>
              <button
                onClick={uploadIphoneVideo}
                disabled={uploadLoading || !uploadFile}
                style={{ flex: '0 0 auto', background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.75rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: uploadLoading || !uploadFile ? 'not-allowed' : 'pointer', opacity: uploadLoading || !uploadFile ? 0.6 : 1 }}>
                {uploadLoading ? `⏳ Uploading ${uploadProgress}%…` : '📥 Import File'}
              </button>
            </div>
            {uploadError   && <div className="error-message">{uploadError}</div>}
            {uploadSuccess && <div className="publish-success">{uploadSuccess} — find it in My Videos below to publish to YouTube.</div>}
            {uploadLoading && uploadProgress > 0 && (
              <div style={{ background: 'rgba(139,92,246,0.1)', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                <div style={{ background: '#a78bfa', height: '100%', width: `${uploadProgress}%`, transition: 'width 0.3s' }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Creatify AI Avatar Video Creator ── */}
      <CreatifyPanel
        apiBase={API_BASE}
        onVideoCreated={(video: VideoRecord) => {
          setActiveVideo(video);
          setAllVideos(prev => [video, ...prev.filter(v => v.id !== video.id)]);
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = setInterval(() => pollVideo(video.id), 10_000);
        }}
        onNavigateScripts={() => setCurrentPage('scripts')}
      />

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
          <p style={{ color: '#637381', fontSize: '0.875rem', margin: '0.5rem 0' }}>Loading script…</p>
        )}
        {previewScript && !scriptPreviewLoading && (
          <div style={{ background: '#f4f6f8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '1.25rem', margin: '1rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <p style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>
                📄 {previewScript.topic}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {editSaved && !editingScript && (
                  <span style={{ color: '#2a9d5c', fontSize: '0.8125rem', alignSelf: 'center' }}>✓ Saved</span>
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
                  <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.3rem' }}>Hook</label>
                  <textarea
                    value={editHook}
                    onChange={e => setEditHook(e.target.value)}
                    rows={2}
                    style={{ width: '100%', background: '#f4f6f8', border: '1px solid #e3e8ef', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.6rem 0.75rem', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.3rem' }}>Body</label>
                  <textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    rows={5}
                    style={{ width: '100%', background: '#f4f6f8', border: '1px solid #e3e8ef', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.6rem 0.75rem', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.3rem' }}>Call to Action</label>
                  <textarea
                    value={editCta}
                    onChange={e => setEditCta(e.target.value)}
                    rows={2}
                    style={{ width: '100%', background: '#f4f6f8', border: '1px solid #e3e8ef', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.6rem 0.75rem', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <button
                  onClick={saveScriptEdits}
                  disabled={editSaving}
                  style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)', color: '#2a9d5c', borderRadius: '0.5rem', padding: '0.6rem 1rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                  {editSaving ? '💾 Saving…' : '💾 Save Changes'}
                </button>
              </div>
            ) : (
              /* ── Read mode ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div>
                  <span style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hook</span>
                  <p style={{ color: '#1c2b33', fontSize: '0.875rem', margin: '0.2rem 0 0' }}>{previewScript.hook}</p>
                </div>
                <div>
                  <span style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Body</span>
                  <p style={{ color: '#637381', fontSize: '0.875rem', margin: '0.2rem 0 0', whiteSpace: 'pre-wrap' }}>{previewScript.body}</p>
                </div>
                <div>
                  <span style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CTA</span>
                  <p style={{ color: '#1c2b33', fontSize: '0.875rem', margin: '0.2rem 0 0' }}>{previewScript.cta}</p>
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
              <p>
                {videoProvider?.provider === 'veo'
                  ? 'Generating AI video clips via Veo 3 (Google AI Studio), adding voiceover and captions. This takes 5–10 minutes. Auto-refreshes every 10 s.'
                  : 'Video is being assembled — voiceover + stock footage + captions. Check back in 3–8 minutes. Auto-refreshes every 10 s.'}
              </p>
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
                    onClick={() => setPreviewUrl(videoStreamUrl(activeVideo))}>
                    ▶ Preview Video
                  </button>
                  <a href={videoStreamUrl(activeVideo) ?? '#'} target="_blank" rel="noopener noreferrer"
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
              {activeVideo.script_id && (
                <button className="idea-button" style={{ marginTop: '0.5rem', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#d97706' }}
                  onClick={() => { setVarSourceId(activeVideo.script_id!); document.getElementById('variations')?.scrollIntoView({ behavior: 'smooth' }); }}>
                  🔄 Make Viral Variations
                </button>
              )}
            </div>
          )}

          {activeVideo.status === 'failed' && (() => {
            const err = activeVideo.error_message ?? '';
            const isVeoPermission = err.includes('PERMISSION_DENIED') || err.includes('403') || err.includes('denied access');
            const isVeoQuota      = err.includes('quota') || err.includes('exhausted');
            const isVeoIssue      = isVeoPermission || isVeoQuota || err.includes('Veo');
            return (
              <div style={{ marginTop: '1rem' }}>
                {/* Error message */}
                {err && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
                    <p style={{ color: '#fca5a5', fontSize: '0.875rem', margin: '0 0 0.4rem', fontWeight: 600 }}>❌ {err}</p>
                    {isVeoPermission && (
                      <p style={{ color: '#fbbf24', fontSize: '0.8rem', margin: 0 }}>
                        ⚠️ Veo 3 requires your Google project to be explicitly allowlisted.{' '}
                        <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#fbbf24', fontWeight: 700 }}>
                          Request access at aistudio.google.com →
                        </a>
                      </p>
                    )}
                    {isVeoQuota && (
                      <p style={{ color: '#fbbf24', fontSize: '0.8rem', margin: 0 }}>
                        ⚠️ Daily Veo quota hit — resets at midnight UTC. Use Import from URL below in the meantime.
                      </p>
                    )}
                  </div>
                )}

                {/* Immediate workaround — Import from URL */}
                {isVeoIssue && (
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid #6ee7b7', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
                    <p style={{ color: '#34d399', fontSize: '0.8125rem', fontWeight: 700, margin: '0 0 0.3rem' }}>✅ Workaround: Import a video from URL</p>
                    <p style={{ color: '#6ee7b7', fontSize: '0.8rem', margin: '0 0 0.5rem', lineHeight: 1.5 }}>
                      Generate your video in CapCut, HeyGen, or Davinci.ai — then paste the direct MP4 link below to import it as ready-to-publish.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <a href="https://capcut.com" target="_blank" rel="noopener noreferrer"
                        style={{ background: '#1c2b33', color: '#fff', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}>CapCut →</a>
                      <a href="https://heygen.com" target="_blank" rel="noopener noreferrer"
                        style={{ background: '#8b5cf6', color: '#fff', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}>HeyGen →</a>
                      <a href="https://davinci.ai" target="_blank" rel="noopener noreferrer"
                        style={{ background: '#3b82f6', color: '#fff', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}>Davinci.ai →</a>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    onClick={() => retryVideo(activeVideo)}
                    style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa', borderRadius: '0.5rem', padding: '0.6rem 1.1rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                    🔁 Edit Script & Retry
                  </button>
                  <button className="inline-link" onClick={() => setCurrentPage('diagnostics')} style={{ fontSize: '0.8125rem' }}>
                    🔧 Run Diagnostics
                  </button>
                </div>
              </div>
            );
          })()}
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
        <p style={{ color: '#637381', fontSize: '0.875rem', marginBottom: '1rem' }}>
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

      {/* Viral Variations section */}
      {renderVariations()}

      {/* ── AI Video Editor modal ── */}
      {editorOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setEditorOpen(false)}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '1rem', padding: '1.75rem', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ color: '#a78bfa', margin: 0, fontSize: '1.1rem' }}>✏️ AI Video Editor</h2>
              <button onClick={() => setEditorOpen(false)}
                style={{ background: 'none', border: 'none', color: '#637381', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}>✕</button>
            </div>
            <p style={{ color: '#637381', fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
              Editing video <code style={{ color: '#a78bfa' }}>{editorVideoId.slice(0, 12)}…</code> — choose new voice, B-roll keywords, music and caption style. A new version will be generated.
            </p>

            {/* Voice picker */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' }}>Voice (ElevenLabs)</label>
              <select value={editorVoiceId} onChange={e => setEditorVoiceId(e.target.value)}
                style={{ width: '100%', background: '#f4f6f8', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.6rem 0.85rem', fontSize: '0.875rem' }}>
                <option value="">Keep current voice</option>
                {voices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>

            {/* B-roll keywords */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' }}>B-Roll Keywords (Pexels)</label>
              <input type="text" value={editorBroll} onChange={e => setEditorBroll(e.target.value)}
                placeholder="e.g. technology, office, coding"
                style={{ width: '100%', background: '#f4f6f8', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.6rem 0.85rem', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              <p style={{ color: '#637381', fontSize: '0.75rem', margin: '0.3rem 0 0' }}>Comma-separated. Leave blank to keep existing footage.</p>
            </div>

            {/* Music picker */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' }}>Background Music</label>
              <select value={editorMusicId} onChange={e => setEditorMusicId(e.target.value)}
                style={{ width: '100%', background: '#f4f6f8', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.6rem 0.85rem', fontSize: '0.875rem' }}>
                {musicTracks.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              {editorMusicId !== 'none' && (
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label style={{ color: '#637381', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Volume: {Math.round(editorMusicVol * 100)}%</label>
                  <input type="range" min={0} max={1} step={0.05} value={editorMusicVol}
                    onChange={e => setEditorMusicVol(parseFloat(e.target.value))}
                    style={{ flex: 1 }} />
                </div>
              )}
            </div>

            {/* Caption style */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' }}>Caption Style</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {captionStyles.length > 0
                  ? captionStyles.map(c => (
                      <button key={c.id} onClick={() => setEditorCaptionStyle(c.id)}
                        style={{ flex: 1, background: editorCaptionStyle === c.id ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${editorCaptionStyle === c.id ? '#a78bfa' : 'rgba(148,163,184,0.2)'}`, color: editorCaptionStyle === c.id ? '#a78bfa' : '#94a3b8', borderRadius: '0.375rem', padding: '0.5rem 0', cursor: 'pointer', fontWeight: editorCaptionStyle === c.id ? 700 : 400, fontSize: '0.8rem' }}>
                        {c.label}
                      </button>
                    ))
                  : [['timed','Timed'],['none','None']].map(([id, label]) => (
                      <button key={id} onClick={() => setEditorCaptionStyle(id)}
                        style={{ flex: 1, background: editorCaptionStyle === id ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${editorCaptionStyle === id ? '#a78bfa' : 'rgba(148,163,184,0.2)'}`, color: editorCaptionStyle === id ? '#a78bfa' : '#94a3b8', borderRadius: '0.375rem', padding: '0.5rem 0', cursor: 'pointer', fontWeight: editorCaptionStyle === id ? 700 : 400, fontSize: '0.8rem' }}>
                        {label}
                      </button>
                    ))
                }
              </div>
            </div>

            {editorError && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: '0.5rem', padding: '0.6rem 0.85rem', color: '#fca5a5', fontSize: '0.875rem', marginBottom: '1rem' }}>{editorError}</div>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={submitEdit} disabled={editorLoading}
                style={{ flex: 1, background: editorLoading ? 'rgba(167,139,250,0.25)' : 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.85rem', fontWeight: 800, fontSize: '0.95rem', cursor: editorLoading ? 'not-allowed' : 'pointer' }}>
                {editorLoading ? '⏳ Regenerating…' : '🎬 Regenerate Video'}
              </button>
              <button onClick={() => setEditorOpen(false)}
                style={{ background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.3)', color: '#637381', borderRadius: '0.6rem', padding: '0.85rem 1.25rem', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

        {allVideosLoading && <p style={{ color: '#637381', fontSize: '0.875rem' }}>Loading…</p>}

        {!allVideosLoading && allVideos.length === 0 && (
          <p style={{ color: '#637381', fontSize: '0.875rem' }}>No videos yet — generate one above.</p>
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
                  <span style={{ color: '#637381', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {v.id.slice(0, 8)}…
                  </span>
                </div>
                <p style={{ color: '#637381', fontSize: '0.8125rem', margin: '0.4rem 0 0' }}>
                  {new Date(v.created_at).toLocaleString()}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                  {v.video_url && (
                    <button
                      onClick={e => { e.stopPropagation(); setPreviewUrl(videoStreamUrl(v)); }}
                      style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', borderRadius: '0.375rem', padding: '0.3rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                      ▶ Preview
                    </button>
                  )}
                  {v.video_url && (
                    <a href={videoStreamUrl(v) ?? '#'} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="video-download-link" style={{ fontSize: '0.8125rem', padding: '0.3rem 0.75rem' }}>
                      ⬇️ Download
                    </a>
                  )}
                  {v.status === 'ready' && (
                    <button
                      onClick={e => { e.stopPropagation(); setActiveVideo(v); setPublishSuccess(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: '0.375rem', padding: '0.3rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                      ▶ Upload to YouTube
                    </button>
                  )}
                  {v.status === 'ready' && (
                    <a href={`${API_BASE}/api/v1/videos/${v.id}/srt`} download
                      onClick={e => e.stopPropagation()}
                      style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#2a9d5c', borderRadius: '0.375rem', padding: '0.3rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
                      📝 SRT
                    </a>
                  )}
                  {(v.status === 'ready' || v.status === 'failed') && (
                    <button
                      onClick={e => { e.stopPropagation(); openEditor(v.id); }}
                      style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa', borderRadius: '0.375rem', padding: '0.3rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                      ✏️ Edit
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

  // ── Viral Variations state ────────────────────────────────────────────────
  const [varLoading, setVarLoading]           = useState(false);
  const [varError, setVarError]               = useState('');
  const [varResults, setVarResults]           = useState<Script[]>([]);
  const [varSourceId, setVarSourceId]         = useState('');

  const generateVariations = async (scriptId: string) => {
    if (!scriptId.trim()) { setVarError('No script selected'); return; }
    setVarLoading(true); setVarError(''); setVarResults([]);
    setVarSourceId(scriptId);
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/${scriptId.trim()}`);
      if (!res.ok) throw new Error('Script not found');
      const original: Script = await res.json();
      // Ask AI to generate 3 variations by generating new scripts on the same topic
      const promises = ['curiosity-gap hook', 'shocking statistic hook', 'story-based hook'].map(async (style) => {
        const params = new URLSearchParams({
          topic: `${original.topic} — ${style}`,
          niche: original.script_metadata?.niche as string ?? 'AI tools',
        });
        const r = await apiFetch(`${API_BASE}/api/v1/scripts/generate?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!r.ok) throw new Error('Variation generation failed');
        return r.json() as Promise<Script>;
      });
      const scripts = await Promise.all(promises);
      setVarResults(scripts);
      setScripts(prev => [...scripts, ...prev]);
    } catch (err) { setVarError(err instanceof Error ? err.message : 'Failed to generate variations'); }
    finally { setVarLoading(false); }
  };

  const renderVariations = () => (
    <div id="variations" style={{ marginTop: '2.5rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '0.75rem', padding: '1.5rem' }}>
      <h2 style={{ color: '#d97706', marginBottom: '0.25rem', fontSize: '1.1rem' }}>🔄 Viral Variations</h2>
      <p style={{ color: '#637381', fontSize: '0.8125rem', marginBottom: '1rem' }}>
        Generate 3 viral hook variations from any script — different opening styles to A/B test. Each becomes a separate video you can generate and publish.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <input
          type="text"
          value={varSourceId}
          onChange={e => setVarSourceId(e.target.value)}
          placeholder="Paste Script ID (from Scripts page)"
          disabled={varLoading}
          style={{ flex: '1 1 260px', background: '#f4f6f8', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.6rem 0.85rem', fontSize: '0.875rem' }}
        />
        <button
          onClick={() => generateVariations(varSourceId)}
          disabled={varLoading || !varSourceId.trim()}
          style={{ background: 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: varLoading ? 'not-allowed' : 'pointer', opacity: varLoading || !varSourceId.trim() ? 0.7 : 1, whiteSpace: 'nowrap' }}>
          {varLoading ? '⏳ Generating…' : '🔄 Make 3 Variations'}
        </button>
      </div>
      {varError && <div className="error-message">{varError}</div>}
      {varResults.length > 0 && (
        <div>
          <p style={{ color: '#637381', fontSize: '0.8rem', marginBottom: '0.75rem' }}>✅ 3 variations ready — click a script to use it, or generate a video directly:</p>
          <div className="scripts-list">
            {varResults.map((s, i) => (
              <div key={s.id} className="script-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h3 style={{ color: '#d97706', margin: 0, fontSize: '0.9375rem' }}>Variation {i + 1}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button onClick={() => copyId(s.id)}
                      style={{ background: copiedId === s.id ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)', border: `1px solid ${copiedId === s.id ? 'rgba(16,185,129,0.4)' : 'rgba(148,163,184,0.25)'}`, color: copiedId === s.id ? '#34d399' : '#94a3b8', borderRadius: '0.375rem', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                      {copiedId === s.id ? '✓' : '📋 Copy ID'}
                    </button>
                    <button
                      onClick={() => { setVideoScriptId(s.id); loadScript(s.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      style={{ background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)', color: '#fff', border: 'none', borderRadius: '0.375rem', padding: '0.25rem 0.75rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                      🎬 Generate Video
                    </button>
                  </div>
                </div>
                <p style={{ color: '#637381', fontSize: '0.8rem', margin: '0.4rem 0 0.25rem', fontFamily: 'monospace' }}>{s.id.slice(0, 16)}…</p>
                <p style={{ color: '#d97706', fontSize: '0.875rem', fontWeight: 600, margin: '0.3rem 0 0.15rem' }}>Hook: {s.hook}</p>
                <p style={{ color: '#637381', fontSize: '0.8125rem', margin: 0, whiteSpace: 'pre-wrap' }}>{s.body?.slice(0, 120)}…</p>
              </div>
            ))}
          </div>
        </div>
      )}
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
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/parrot`, {
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
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/generate?${params}`, {
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
      <p className="subtitle">Find inspiration — parrot a proven video, browse trending, or research keywords</p>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => setSourceTab('parrot')}
          style={{ padding: '0.55rem 1.5rem', borderRadius: '999px', border: `2px solid #a78bfa`,
            background: sourceTab === 'parrot' ? '#a78bfa' : 'transparent',
            color: sourceTab === 'parrot' ? '#fff' : '#a78bfa',
            fontWeight: 700, cursor: 'pointer', fontSize: '0.9375rem' }}>
          🦜 Parrot a Video
        </button>
        <button onClick={() => setSourceTab('trending')}
          style={{ padding: '0.55rem 1.5rem', borderRadius: '999px', border: `2px solid #ef4444`,
            background: sourceTab === 'trending' ? '#ef4444' : 'transparent',
            color: sourceTab === 'trending' ? '#fff' : '#ef4444',
            fontWeight: 700, cursor: 'pointer', fontSize: '0.9375rem' }}>
          🔥 Trending Now
        </button>
        <button onClick={() => setSourceTab('keywords' as any)}
          style={{ padding: '0.55rem 1.5rem', borderRadius: '999px', border: `2px solid #10b981`,
            background: sourceTab === ('keywords' as any) ? '#10b981' : 'transparent',
            color: sourceTab === ('keywords' as any) ? '#fff' : '#10b981',
            fontWeight: 700, cursor: 'pointer', fontSize: '0.9375rem' }}>
          🔍 Keywords
        </button>
      </div>
      {sourceTab === 'parrot' ? renderParrot() : sourceTab === ('keywords' as any) ? renderKeywords() : renderTrending()}
    </div>
  );

  const renderParrot = () => (
    <div className="videos-page">
      <h1>🦜 Parrot a Video</h1>
      <p className="subtitle">Find a YouTube video you love → AI reverse-engineers its structure → creates a Blueprint in your niche</p>
      <WorkflowSteps steps={[
        { n: 1, label: 'Paste a YouTube URL', detail: 'Any video that\'s performing well in your niche' },
        { n: 2, label: 'Analyse It', detail: 'AI reverse-engineers the structure, hooks and shot list' },
        { n: 3, label: 'Generate Your Script', detail: 'One click creates a script in your niche from the blueprint' },
        { n: 4, label: 'Go to Videos', detail: 'Paste the Script ID to generate your Veo 3 video' },
      ]} />

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
              <p style={{ color: '#1c2b33', fontWeight: 600 }}>{source_video.title || '(title via AI)'}</p>
              <p style={{ color: '#637381', fontSize: '0.875rem', margin: '0.25rem 0' }}>by {source_video.channel || 'unknown'} · {source_video.views} views · {source_video.likes} likes</p>
              {source_video.url && <a href={source_video.url} target="_blank" rel="noopener noreferrer" className="video-download-link" style={{ marginTop: '0.75rem', display: 'inline-block' }}>▶ Open on YouTube</a>}
            </div>

            {/* Analysis */}
            {sa && (
              <div className="video-status-card" style={{ borderColor: '#f59e0b', marginTop: '1rem' }}>
                <h3 style={{ color: '#d97706', marginBottom: '1rem' }}>🔍 Why It Works</h3>
                <div className="blueprint-section"><strong style={{ color: '#d97706' }}>Hook style:</strong> <span style={{ color: '#637381' }}>{sa.hook_style}</span></div>
                <div className="blueprint-section"><strong style={{ color: '#d97706' }}>Structure:</strong> <span style={{ color: '#637381' }}>{sa.structure}</span></div>
                <div className="blueprint-section"><strong style={{ color: '#d97706' }}>Tone:</strong> <span style={{ color: '#637381' }}>{sa.tone}</span></div>
                <div className="blueprint-section"><strong style={{ color: '#d97706' }}>Why it works:</strong> <span style={{ color: '#637381' }}>{sa.why_it_works}</span></div>
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
                <span style={{ color: '#637381', fontSize: '0.8rem', fontFamily: 'monospace' }}>ID: {parrotResult.id.slice(0,8)}…</span>
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
                      ...(blueprint.thumbnail_ideas?.map(t => `• ${typeof t === 'string' ? t : `${t.headline ?? ''}${t.visual ? ` — ${t.visual}` : ''}${t.style ? ` (${t.style})` : ''}`}`) ?? []),
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
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/trending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: trendNiche, count: 8 }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      setTrendResult(await res.json());
    } catch (err) { setTrendError(err instanceof Error ? err.message : 'Trending fetch failed'); }
    finally { setTrendLoading(false); }
  };

  const platformColor = (p: string) => ({
    youtube: '#ef4444', tiktok: '#69c9d0', instagram: '#e1306c',
    facebook: '#1877f2', twitter: '#1da1f2', linkedin: '#0077b5',
  }[p] ?? '#a78bfa');
  const platformIcon  = (p: string) => ({
    youtube: '▶', tiktok: '🎵', instagram: '📸',
    facebook: '👥', twitter: '𝕏', linkedin: '💼',
  }[p] ?? '🌐');

  const [trendingScriptLoading, setTrendingScriptLoading] = useState<number | null>(null);

  const generateScriptFromTrending = async (item: TrendingItem, itemNiche: string) => {
    setTrendingScriptLoading(item.rank);
    try {
      const topic = item.use_for_niche || item.title;
      const params = new URLSearchParams({ topic, niche: itemNiche });
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/generate?${params}`, {
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
    if (!items.length) return <p style={{ color: '#637381' }}>No data available.</p>;
    return (
      <div className="scripts-list">
        {items.map((item) => (
          <div key={item.rank} className="script-card" style={{ borderLeft: `4px solid ${platformColor(platform)}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span style={{ background: platformColor(platform), color: '#fff', borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>#{item.rank}</span>
              <span style={{ color: '#637381', fontSize: '0.8125rem', flexShrink: 0 }}>{item.views}</span>
            </div>
            <h3 style={{ color: '#1c2b33', margin: '0.6rem 0 0.25rem', lineHeight: 1.4 }}>{item.title}</h3>
            {item.creator && <p style={{ color: '#637381', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>by {item.creator}</p>}
            <p style={{ color: '#637381', fontSize: '0.875rem', marginBottom: '0.5rem' }}><strong style={{ color: '#d97706' }}>Why trending:</strong> {item.why_trending}</p>
            <p style={{ color: '#10b981', fontSize: '0.875rem', marginBottom: '0.5rem' }}><strong>Your angle:</strong> {item.use_for_niche}</p>
            {item.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                {item.tags.map((t, i) => <span key={i} style={{ background: 'rgba(148,163,184,0.1)', color: '#637381', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>#{t}</span>)}
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
      <WorkflowSteps steps={[
        { n: 1, label: 'Pick your niche', detail: 'Choose the topic area you create content for' },
        { n: 2, label: 'Fetch Trending Now', detail: 'Pull live trending videos from YouTube, TikTok & Instagram' },
        { n: 3, label: 'Auto-Script All Trends', detail: 'AI generates a script for every trending topic in one click' },
        { n: 4, label: 'Generate & Post All Videos', detail: 'Veo 3 creates each video then posts to all your social platforms' },
      ]} />

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
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="generate-button" onClick={fetchTrending} disabled={trendLoading} style={{ flex: '1 1 200px', margin: 0 }}>
            {trendLoading ? '🔍 Fetching trends…' : '🔥 Fetch Trending Now'}
          </button>
          <button
            onClick={runAutoQueue}
            disabled={autoQueueLoading || trendLoading}
            style={{ flex: '1 1 200px', background: autoQueueLoading ? 'rgba(245,158,11,0.25)' : 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.75rem 1.25rem', fontWeight: 800, fontSize: '0.9375rem', cursor: autoQueueLoading ? 'not-allowed' : 'pointer', opacity: autoQueueLoading ? 0.7 : 1 }}>
            {autoQueueLoading ? '⏳ Generating scripts…' : '⚡ Auto-Script All Trends'}
          </button>
        </div>

        {autoQueueError && <div className="error-message" style={{ marginTop: '0.75rem' }}>{autoQueueError}</div>}
        {autoQueueResult && (
          <div style={{ marginTop: '1rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
            <p style={{ color: '#d97706', fontWeight: 700, margin: '0 0 0.5rem' }}>
              ✅ {autoQueueResult.count} scripts generated and saved!
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {autoQueueResult.scripts.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.375rem', padding: '0.4rem 0.75rem' }}>
                  <span style={{ color: '#1c2b33', fontSize: '0.8125rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.topic}</span>
                  <button onClick={() => copyId(s.id)}
                    style={{ background: copiedId === s.id ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)', border: `1px solid ${copiedId === s.id ? 'rgba(16,185,129,0.4)' : 'rgba(148,163,184,0.25)'}`, color: copiedId === s.id ? '#34d399' : '#94a3b8', borderRadius: '0.375rem', padding: '0.2rem 0.55rem', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>
                    {copiedId === s.id ? '✓ Copied' : '📋 Copy ID'}
                  </button>
                </div>
              ))}
            </div>
            {/* Generate & Post All button */}
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(245,158,11,0.2)' }}>
              <button
                onClick={runGenerateAndPublishAll}
                disabled={bulkGenLoading || autoQueueLoading}
                style={{ width: '100%', background: bulkGenLoading ? 'rgba(59,130,246,0.25)' : bulkGenDone ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.85rem 1.25rem', fontWeight: 800, fontSize: '1rem', cursor: bulkGenLoading ? 'not-allowed' : 'pointer', opacity: bulkGenLoading ? 0.8 : 1 }}>
                {bulkGenLoading
                  ? `⏳ Processing ${bulkGenProgress.done}/${bulkGenProgress.total}…`
                  : bulkGenDone
                  ? '✅ All Videos Posted!'
                  : '🚀 Generate & Post All Videos'}
              </button>
              <p style={{ color: '#637381', fontSize: '0.75rem', marginTop: '0.4rem', marginBottom: 0, textAlign: 'center' }}>
                Generates a Veo 3 video for each script above, then posts to YouTube, TikTok, Instagram &amp; Facebook
              </p>
            </div>

            {/* Live progress log */}
            {(bulkGenLoading || bulkGenProgress.log.length > 0) && (
              <div style={{ marginTop: '0.75rem', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '0.5rem', padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem', maxHeight: '220px', overflowY: 'auto' }}>
                {bulkGenProgress.current && (
                  <div style={{ color: '#3b82f6', fontWeight: 700, marginBottom: '0.4rem' }}>▶ {bulkGenProgress.current}</div>
                )}
                {bulkGenProgress.log.map((line, i) => (
                  <div key={i} style={{ color: line.startsWith('  ❌') ? '#dc2626' : line.startsWith('  ⚠️') ? '#d97706' : line.startsWith('  ✅') ? '#059669' : line.startsWith('🎉') ? '#059669' : '#374151', paddingLeft: line.startsWith('  ') ? '1rem' : 0 }}>{line}</div>
                ))}
                {bulkGenLoading && <div style={{ color: '#94a3b8', marginTop: '0.25rem' }}>▌</div>}
              </div>
            )}
            {bulkGenError && <div className="error-message" style={{ marginTop: '0.5rem' }}>{bulkGenError}</div>}

            <p style={{ color: '#637381', fontSize: '0.8rem', marginTop: '0.75rem', marginBottom: 0 }}>
              Or go to <button className="inline-link" onClick={() => setCurrentPage('videos')}>🎬 Videos</button> to generate individual videos from any script ID above.
            </p>
          </div>
        )}
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
  const [diagResult, setDiagResult]     = useState<null | { summary: { total: number; passed: number; failed: number; warned: number }; checks: Array<{ name: string; status: 'pass'|'fail'|'warn'; detail: string; hint: string }>; checked_at?: string }>(null);
  const [diagError,  setDiagError]      = useState('');
  const [restartBackendState, setRestartBackendState] = useState<'idle'|'loading'|'ok'|'error'>('idle');
  const [restartFrontendState, setRestartFrontendState] = useState<'idle'|'loading'|'ok'|'error'>('idle');
  const [restartMsg, setRestartMsg] = useState('');

  const runDiagnostics = async () => {
    setDiagLoading(true); setDiagResult(null); setDiagError('');
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/health/checks`);
      if (!res.ok) throw new Error(`Backend returned ${res.status} — is the backend running?`);
      setDiagResult(await res.json());
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : 'Could not reach backend. Check that it is running.');
    }
    finally { setDiagLoading(false); }
  };

  const restartService = async (service: 'backend' | 'frontend') => {
    const set = service === 'backend' ? setRestartBackendState : setRestartFrontendState;
    set('loading'); setRestartMsg('');
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/health/restart/${service}`, { method: 'POST' });
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
      <p className="subtitle">Checks all services in parallel — backend, APIs, FFmpeg, Buffer, and more</p>

      <div className="generator-form">
        <button className="generate-button" onClick={runDiagnostics} disabled={diagLoading}>
          {diagLoading ? '🔍 Running checks…' : '🔧 Run All Checks'}
        </button>
        {diagError && (
          <div className="error-message" style={{ marginTop: '0.75rem' }}>
            ❌ {diagError}
          </div>
        )}
        {diagResult?.checked_at && !diagLoading && (
          <p style={{ color: '#637381', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
            Last checked: {new Date(diagResult.checked_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* ── Restart controls ── */}
      <div style={{ background: '#f4f6f8', border: '1px solid #e3e8ef', borderRadius: '1rem', padding: '1.5rem', margin: '1.5rem 0' }}>
        <h2 style={{ color: '#1c2b33', marginBottom: '0.4rem', fontSize: '1.25rem' }}>🔄 Restart Services</h2>
        <p style={{ color: '#637381', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
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
        <p style={{ marginTop: '0.75rem', color: '#637381', fontSize: '0.8125rem' }}>
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
                <div style={{ fontSize: '0.75rem', color: '#637381' }}>{b.label}</div>
              </div>
            ))}
          </div>

          {/* Check list */}
          <div className="scripts-list">
            {diagResult.checks.map((c, i) => (
              <div key={i} className="script-card" style={{ borderLeft: `4px solid ${diagColor(c.status)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#1c2b33', fontSize: '1rem' }}>{diagIcon(c.status)} {c.name}</span>
                  <span style={{ background: diagColor(c.status), color: '#fff', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>{c.status.toUpperCase()}</span>
                </div>
                <p style={{ color: '#637381', fontSize: '0.875rem', margin: '0.5rem 0 0' }}>{c.detail}</p>
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
                    {c.name === 'Buffer (social posting)' && (
                      <a href="https://buffer.com/app/account/apps" target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: '0.4rem', color: '#60a5fa', fontSize: '0.8125rem', textDecoration: 'underline' }}>
                        👉 Get Buffer access token →
                      </a>
                    )}
                    {c.name === 'FFmpeg' && (
                      <a href="https://ffmpeg.org/download.html" target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: '0.4rem', color: '#60a5fa', fontSize: '0.8125rem', textDecoration: 'underline' }}>
                        👉 Download FFmpeg →
                      </a>
                    )}
                    {c.name === 'OpenAI API Key' && (
                      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: '0.4rem', color: '#60a5fa', fontSize: '0.8125rem', textDecoration: 'underline' }}>
                        👉 Get OpenAI API key →
                      </a>
                    )}
                    {c.name === 'Google Veo 3 (AI video)' && (
                      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: '0.4rem', color: '#60a5fa', fontSize: '0.8125rem', textDecoration: 'underline' }}>
                        👉 Get Google AI Studio key →
                      </a>
                    )}
                    {c.name === 'YouTube OAuth (upload)' && (
                      <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: '0.4rem', color: '#60a5fa', fontSize: '0.8125rem', textDecoration: 'underline' }}>
                        👉 Google Cloud Console →
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

  // ── URL import (Davinci.ai / HeyGen / CapCut paste-link) ─────────────────
  const [importUrl,        setImportUrl]        = useState('');
  const [importUrlLoading, setImportUrlLoading] = useState(false);
  const [importUrlError,   setImportUrlError]   = useState('');
  const [importUrlSuccess, setImportUrlSuccess] = useState('');

  const submitImportUrl = async () => {
    const url = importUrl.trim();
    if (!url) { setImportUrlError('Paste a direct MP4 URL first'); return; }
    setImportUrlLoading(true); setImportUrlError(''); setImportUrlSuccess('');
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/videos/import-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title: uploadTitle.trim() || undefined }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const video: VideoRecord = await res.json();
      setImportUrlSuccess(`✅ Imported! Video ID: ${video.id} — find it in My Videos below.`);
      setImportUrl('');
      setUploadTitle('');
      setActiveVideo(video);
      setAllVideos(prev => [video, ...prev.filter(v => v.id !== video.id)]);
    } catch (err) {
      setImportUrlError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportUrlLoading(false);
    }
  };

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
        const token = localStorage.getItem('auth_token');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
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
      const res = await apiFetch(`${API_BASE}/api/v1/videos/${scheduleVideoId.trim()}/schedule`, {
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
        <h2 style={{ color: '#1c2b33', marginBottom: '1rem' }}>📅 Schedule a Video</h2>
        <div className="form-group">
          <label>Video ID (must be status: ready)</label>
          <input type="text" value={scheduleVideoId} onChange={e => setScheduleVideoId(e.target.value)}
            placeholder="Paste video ID from above" disabled={schedLoading} />
        </div>
        <div className="form-group">
          <label>Date</label>
          <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]} disabled={schedLoading}
            style={{ background: '#f4f6f8', border: '1px solid #e3e8ef', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.75rem', width: '100%', fontSize: '1rem' }} />
        </div>
        <div className="form-group">
          <label>Time (UTC)</label>
          <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)}
            disabled={schedLoading}
            style={{ background: '#f4f6f8', border: '1px solid #e3e8ef', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.75rem', width: '100%', fontSize: '1rem' }} />
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


  // ── Optimize state ────────────────────────────────────────────────────────
  const [optLoading, setOptLoading]       = useState(false);
  const [optError, setOptError]           = useState('');
  const [optResult, setOptResult]         = useState<OptimizeResult | null>(null);
  const [optCopied, setOptCopied]         = useState('');

  const runOptimize = async (scriptTopic: string, scriptNiche: string, hook?: string, body?: string, cta?: string) => {
    setOptLoading(true); setOptError(''); setOptResult(null);
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/optimize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: scriptTopic, niche: scriptNiche, hook, body, cta }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      setOptResult(await res.json());
    } catch (err) { setOptError(err instanceof Error ? err.message : 'Optimize failed'); }
    finally { setOptLoading(false); }
  };

  // ── Keywords state ────────────────────────────────────────────────────────
  const [kwTopic, setKwTopic]             = useState('');
  const [kwNiche, setKwNiche]             = useState('AI tools');
  const [kwLoading, setKwLoading]         = useState(false);
  const [kwError, setKwError]             = useState('');
  const [kwResult, setKwResult]           = useState<KeywordResult | null>(null);

  const runKeywords = async () => {
    if (!kwTopic.trim()) { setKwError('Enter a topic first'); return; }
    setKwLoading(true); setKwError(''); setKwResult(null);
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/keywords`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: kwTopic.trim(), niche: kwNiche, count: 10 }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      setKwResult(await res.json());
    } catch (err) { setKwError(err instanceof Error ? err.message : 'Keyword research failed'); }
    finally { setKwLoading(false); }
  };

  // ── Channel Audit state ───────────────────────────────────────────────────
  const [auditChannel, setAuditChannel]   = useState('');
  const [auditNiche, setAuditNiche]       = useState('AI tools');
  const [auditLoading, setAuditLoading]   = useState(false);
  const [auditError, setAuditError]       = useState('');
  const [auditResult, setAuditResult]     = useState<ChannelAuditResult | null>(null);

  const runAudit = async () => {
    if (!auditChannel.trim()) { setAuditError('Enter a channel ID, handle or URL'); return; }
    setAuditLoading(true); setAuditError(''); setAuditResult(null);
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/analytics/channel-audit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: auditChannel.trim(), niche: auditNiche }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      setAuditResult(await res.json());
    } catch (err) { setAuditError(err instanceof Error ? err.message : 'Audit failed'); }
    finally { setAuditLoading(false); }
  };

  // ── Analytics page ────────────────────────────────────────────────────────
  const fetchAnalytics = async (metric: 'views'|'likes'|'comments'|'shares' = analyticsTopMetric) => {
    setAnalyticsLoading(true); setAnalyticsError('');
    try {
      const [summaryRes, topRes, dashRes] = await Promise.all([
        apiFetch(`${API_BASE}/api/v1/analytics/summary`),
        apiFetch(`${API_BASE}/api/v1/analytics/top-posts?limit=10&metric=${metric}`),
        apiFetch(`${API_BASE}/api/v1/dashboard/metrics`),
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
      const res = await apiFetch(`${API_BASE}/api/v1/analytics/sync`, { method: 'POST' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const d = await res.json();
      setAnalyticsSyncMsg(`✅ Synced ${d.total_records} records at ${new Date(d.synced_at).toLocaleTimeString()}`);
      await fetchAnalytics();
    } catch (err) { setAnalyticsSyncMsg(`❌ ${err instanceof Error ? err.message : 'Sync failed'}`); }
    finally { setAnalyticsSyncing(false); }
  };

  const fmt = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(1)}K` : String(n);

  // ── Orders Management functions ───────────────────────────────────────────
  const fetchOrders = async (filter = ordersFilter, page = ordersPage) => {
    setOrdersLoading(true); setOrdersError('');
    try {
      const status = filter !== 'all' ? `&status=${filter}` : '';
      const skip   = (page - 1) * 20;
      const res    = await apiFetch(`${API_BASE}/api/v1/orders/?skip=${skip}&limit=20${status}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const d = await res.json();
      setOrdersList(d.items ?? []);
      setOrdersTotal(d.total ?? 0);
    } catch (err) { setOrdersError(err instanceof Error ? err.message : 'Failed to load orders'); }
    finally { setOrdersLoading(false); }
  };

  const retryOrder = async (orderId: string) => {
    setOrderRetrying(orderId); setOrderRetryMsg('');
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/orders/${orderId}/retry`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      setOrderRetryMsg('✅ Order re-queued — pipeline restarting…');
      await fetchOrders();
      if (selectedOrder?.id === orderId) {
        const updated = await apiFetch(`${API_BASE}/api/v1/orders/${orderId}`);
        if (updated.ok) setSelectedOrder(await updated.json());
      }
    } catch (err) { setOrderRetryMsg(`❌ ${err instanceof Error ? err.message : 'Retry failed'}`); }
    finally { setOrderRetrying(null); }
  };

  const ORDER_STEPS: Array<{ key: string; label: string; icon: string }> = [
    { key: 'received',   label: 'Webhook Received',   icon: '📥' },
    { key: 'queued',     label: 'Order Queued',        icon: '⏳' },
    { key: 'generating', label: 'Video Generating',    icon: '🎬' },
    { key: 'storing',    label: 'Uploading to Cloud',  icon: '☁️'  },
    { key: 'delivering', label: 'Sending Email',       icon: '📧' },
    { key: 'delivered',  label: 'Delivered',           icon: '✅' },
  ];

  const orderStatusColor = (s: string) =>
    s === 'delivered'  ? '#10b981' :
    s === 'failed'     ? '#ef4444' :
    s === 'delivering' ? '#3b82f6' :
    s === 'storing'    ? '#8b5cf6' :
    s === 'generating' ? '#f59e0b' :
    s === 'queued'     ? '#06b6d4' : '#94a3b8';

  const orderStepIndex = (status: string) =>
    ORDER_STEPS.findIndex(s => s.key === status);

  const renderOrders = () => {
    const FILTERS = ['all', 'received', 'queued', 'generating', 'storing', 'delivering', 'delivered', 'failed'];
    const totalPages = Math.ceil(ordersTotal / 20) || 1;

    // Stats from current list
    const counts: Record<string, number> = {};
    ordersList.forEach(o => { counts[o.status] = (counts[o.status] ?? 0) + 1; });

    return (
      <div className="videos-page">
        <h1>🛍️ Orders — Personalised Video Pipeline</h1>
        <p className="subtitle">
          Every Gumroad purchase triggers the AI pipeline below. Track each order from webhook to delivery.
        </p>

        {/* ── Pipeline architecture diagram ── */}
        <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid #b7e4cc', borderRadius: '0.875rem', padding: '1.5rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
          <div style={{ color: '#2a9d5c', fontWeight: 700, fontSize: '0.8125rem', letterSpacing: '0.08em', marginBottom: '1rem', textTransform: 'uppercase' }}>
            Pipeline Architecture
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', flexWrap: 'nowrap', minWidth: 'max-content' }}>
            {[
              { icon: '🛒', label: 'Landing Page', sublabel: 'Buy Now → Gumroad', color: '#3b82f6' },
              { icon: '💳', label: 'Gumroad Payment', sublabel: 'Checkout', color: '#8b5cf6' },
              { icon: '📥', label: 'Order Webhook', sublabel: 'Receives ping-back', color: '#06b6d4' },
              { icon: '🤖', label: 'AI Prompt Builder', sublabel: 'Name, age, features', color: '#f59e0b' },
              { icon: '🎬', label: 'Video Engine', sublabel: 'Runway / Kling / Veo', color: '#ef4444' },
              { icon: '☁️',  label: 'Cloud Storage', sublabel: 'S3 / Azure Blob', color: '#10b981' },
              { icon: '📧', label: 'Email Delivery', sublabel: 'SendGrid / Mailgun', color: '#2a9d5c' },
            ].map((step, i, arr) => (
              <React.Fragment key={step.label}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', minWidth: '90px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: `${step.color}22`, border: `2px solid ${step.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                    {step.icon}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1c2b33', textAlign: 'center', lineHeight: 1.2 }}>{step.label}</div>
                  <div style={{ fontSize: '0.65rem', color: '#637381', textAlign: 'center', lineHeight: 1.2 }}>{step.sublabel}</div>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ color: '#334155', fontSize: '1.25rem', padding: '0 0.25rem', flexShrink: 0, alignSelf: 'flex-start', marginTop: '0.85rem' }}>→</div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Orders', value: ordersTotal, color: '#3b82f6' },
            { label: 'Delivered', value: ordersList.filter(o=>o.status==='delivered').length, color: '#10b981' },
            { label: 'In Progress', value: ordersList.filter(o=>['queued','generating','storing','delivering'].includes(o.status)).length, color: '#f59e0b' },
            { label: 'Failed', value: ordersList.filter(o=>o.status==='failed').length, color: '#ef4444' },
          ].map(s => (
            <div key={s.label} style={{ flex: '1 1 120px', background: `${s.color}12`, border: `1px solid ${s.color}35`, borderRadius: '0.625rem', padding: '0.75rem 1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#637381', marginTop: '0.2rem' }}>{s.label}</div>
            </div>
          ))}
          <div style={{ flex: '1 1 120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              onClick={() => fetchOrders(ordersFilter, ordersPage)}
              disabled={ordersLoading}
              style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.65rem 1.25rem', fontWeight: 700, cursor: ordersLoading ? 'not-allowed' : 'pointer', opacity: ordersLoading ? 0.7 : 1, fontSize: '0.875rem' }}>
              {ordersLoading ? '⟳ Loading…' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {orderRetryMsg && (
          <div style={{ background: orderRetryMsg.startsWith('✅') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${orderRetryMsg.startsWith('✅') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem', color: orderRetryMsg.startsWith('✅') ? '#34d399' : '#fca5a5', fontWeight: 600, fontSize: '0.875rem' }}>
            {orderRetryMsg}
          </div>
        )}

        {/* ── Filter tabs ── */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {FILTERS.map(f => (
            <button key={f}
              onClick={() => { setOrdersFilter(f); setOrdersPage(1); fetchOrders(f, 1); }}
              style={{ padding: '0.35rem 0.85rem', borderRadius: '999px', border: `2px solid ${ordersFilter === f ? orderStatusColor(f) : 'rgba(148,163,184,0.25)'}`, background: ordersFilter === f ? `${orderStatusColor(f)}22` : 'transparent', color: ordersFilter === f ? orderStatusColor(f) : '#94a3b8', fontWeight: ordersFilter === f ? 700 : 400, fontSize: '0.8125rem', cursor: 'pointer', textTransform: 'capitalize' }}>
              {f === 'all' ? `All (${ordersTotal})` : f}
            </button>
          ))}
        </div>

        {ordersError && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#fca5a5', marginBottom: '1rem', fontSize: '0.875rem' }}>
            ⚠️ {ordersError}
          </div>
        )}

        {ordersLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#637381' }}>Loading orders…</div>
        ) : ordersList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#637381' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛍️</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#637381', marginBottom: '0.5rem' }}>No orders yet</div>
            <div style={{ fontSize: '0.875rem', color: '#637381' }}>
              Connect your Gumroad webhook to{' '}
              <code style={{ background: '#f4f6f8', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8125rem' }}>
                /api/v1/orders/webhook/gumroad
              </code>
              {' '}to start receiving orders.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: selectedOrder ? '1fr 380px' : '1fr', gap: '1rem', alignItems: 'start' }}>

            {/* Order list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {ordersList.map(order => {
                const stepIdx  = orderStepIndex(order.status);
                const isActive = selectedOrder?.id === order.id;

                return (
                  <div key={order.id}
                    onClick={() => setSelectedOrder(isActive ? null : order)}
                    style={{ background: isActive ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isActive ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`, borderLeft: `4px solid ${orderStatusColor(order.status)}`, borderRadius: '0.75rem', padding: '1rem 1.25rem', cursor: 'pointer', transition: 'border-color 0.15s' }}>

                    {/* Header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#1c2b33', fontSize: '0.9375rem' }}>
                          {order.child_profile?.child_name
                            ? `✨ ${order.child_profile.child_name}'s Video`
                            : order.product_name ?? 'Personalised Video'}
                        </div>
                        <div style={{ color: '#637381', fontSize: '0.8125rem', marginTop: '0.2rem' }}>
                          {order.customer_email}
                          {order.customer_name ? ` · ${order.customer_name}` : ''}
                          {order.price_cents != null ? ` · $${Number(order.price_cents).toFixed(2)}` : ''}
                        </div>
                      </div>
                      <span style={{ background: `${orderStatusColor(order.status)}22`, color: orderStatusColor(order.status), border: `1px solid ${orderStatusColor(order.status)}55`, borderRadius: '999px', padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                        {order.status}
                      </span>
                    </div>

                    {/* Pipeline stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginTop: '0.85rem', overflowX: 'auto' }}>
                      {ORDER_STEPS.map((step, i) => {
                        const done    = order.status === 'delivered' || (order.status !== 'failed' && i < stepIdx);
                        const current = i === stepIdx && order.status !== 'failed';
                        const failed  = order.status === 'failed' && i === stepIdx;
                        const clr     = done ? '#10b981' : current ? '#f59e0b' : failed ? '#ef4444' : '#334155';
                        return (
                          <React.Fragment key={step.key}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', minWidth: '52px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${clr}22`, border: `2px solid ${clr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                                {done ? '✓' : failed ? '✕' : step.icon}
                              </div>
                              <div style={{ fontSize: '0.6rem', color: done ? '#34d399' : current ? '#fbbf24' : failed ? '#fca5a5' : '#475569', textAlign: 'center', lineHeight: 1.2, maxWidth: '52px' }}>{step.label}</div>
                            </div>
                            {i < ORDER_STEPS.length - 1 && (
                              <div style={{ flex: 1, height: '2px', background: done ? '#10b981' : '#1e293b', minWidth: '12px', alignSelf: 'flex-start', marginTop: '13px' }} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {order.status === 'failed' && order.error_message && (
                      <div style={{ marginTop: '0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid #fecaca', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: '#fca5a5' }}>
                        ⚠️ {order.error_message}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#637381' }}>
                        {new Date(order.created_at).toLocaleString()}
                      </div>
                      {['failed', 'received'].includes(order.status) && (
                        <button
                          onClick={e => { e.stopPropagation(); retryOrder(order.id); }}
                          disabled={orderRetrying === order.id}
                          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#d97706', borderRadius: '0.375rem', padding: '0.3rem 0.85rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                          {orderRetrying === order.id ? '⟳ Retrying…' : '↺ Retry'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                  <button disabled={ordersPage <= 1} onClick={() => { const p = ordersPage - 1; setOrdersPage(p); fetchOrders(ordersFilter, p); }}
                    style={{ background: '#f4f6f8', border: '1px solid #e3e8ef', color: '#637381', borderRadius: '0.375rem', padding: '0.4rem 0.85rem', cursor: ordersPage <= 1 ? 'not-allowed' : 'pointer' }}>← Prev</button>
                  <span style={{ color: '#637381', alignSelf: 'center', fontSize: '0.875rem' }}>Page {ordersPage} / {totalPages}</span>
                  <button disabled={ordersPage >= totalPages} onClick={() => { const p = ordersPage + 1; setOrdersPage(p); fetchOrders(ordersFilter, p); }}
                    style={{ background: '#f4f6f8', border: '1px solid #e3e8ef', color: '#637381', borderRadius: '0.375rem', padding: '0.4rem 0.85rem', cursor: ordersPage >= totalPages ? 'not-allowed' : 'pointer' }}>Next →</button>
                </div>
              )}
            </div>

            {/* Order detail panel */}
            {selectedOrder && (
              <div style={{ background: '#f4f6f8', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '0.875rem', padding: '1.25rem', position: 'sticky', top: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, color: '#1c2b33', fontSize: '1rem' }}>Order Details</div>
                  <button onClick={() => setSelectedOrder(null)}
                    style={{ background: 'none', border: 'none', color: '#637381', cursor: 'pointer', fontSize: '1.125rem' }}>✕</button>
                </div>

                {/* Child profile */}
                {selectedOrder.child_profile && (
                  <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '0.625rem', padding: '0.875rem', marginBottom: '1rem' }}>
                    <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>👶 Child Profile</div>
                    {[
                      ['Name',       selectedOrder.child_profile.child_name],
                      ['Age',        selectedOrder.child_profile.age],
                      ['Hair',       selectedOrder.child_profile.hair_colour],
                      ['Eyes',       selectedOrder.child_profile.eye_colour],
                      ['Extra',      selectedOrder.child_profile.features],
                    ].map(([k, v]) => v ? (
                      <div key={k as string} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.3rem', fontSize: '0.8125rem' }}>
                        <span style={{ color: '#637381', minWidth: '48px' }}>{k}:</span>
                        <span style={{ color: '#1c2b33' }}>{v}</span>
                      </div>
                    ) : null)}
                  </div>
                )}

                {/* Pipeline artefacts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {[
                    { label: 'Sale ID',      value: selectedOrder.gumroad_sale_id,                            icon: '🏷️' },
                    { label: 'Product',      value: selectedOrder.product_name,                               icon: '📦' },
                    { label: 'Price',        value: selectedOrder.price_cents != null ? `$${Number(selectedOrder.price_cents).toFixed(2)}` : null, icon: '💵' },
                    { label: 'Customer',     value: selectedOrder.customer_name,                              icon: '👤' },
                    { label: 'Email',        value: selectedOrder.customer_email,                             icon: '✉️' },
                    { label: 'Video URL',    value: selectedOrder.video_storage_url,                          icon: '🎬' },
                    { label: 'Email Msg ID', value: selectedOrder.email_message_id,                           icon: '📧' },
                  ].map(row => row.value ? (
                    <div key={row.label} style={{ fontSize: '0.8125rem' }}>
                      <div style={{ color: '#637381', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.icon} {row.label}</div>
                      {row.label === 'Video URL' ? (
                        <a href={row.value} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#60a5fa', wordBreak: 'break-all', display: 'block', marginTop: '0.1rem' }}>
                          {row.value.length > 60 ? row.value.slice(0, 57) + '…' : row.value}
                        </a>
                      ) : (
                        <div style={{ color: '#1c2b33', marginTop: '0.1rem', wordBreak: 'break-all' }}>{row.value}</div>
                      )}
                    </div>
                  ) : null)}
                </div>

                {/* Prompt */}
                {selectedOrder.generated_prompt && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ color: '#637381', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>🤖 Generated Prompt</div>
                    <div style={{ background: '#f4f6f8', border: '1px solid #e3e8ef', borderRadius: '0.375rem', padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: '#637381', maxHeight: '120px', overflowY: 'auto', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {selectedOrder.generated_prompt}
                    </div>
                  </div>
                )}

                {/* Error */}
                {selectedOrder.error_message && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8125rem', color: '#fca5a5' }}>
                    ⚠️ <strong>Error:</strong> {selectedOrder.error_message}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['failed', 'received'].includes(selectedOrder.status) && (
                    <button onClick={() => retryOrder(selectedOrder.id)} disabled={orderRetrying === selectedOrder.id}
                      style={{ flex: 1, background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.65rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                      {orderRetrying === selectedOrder.id ? '⟳ Retrying…' : '↺ Retry Pipeline'}
                    </button>
                  )}
                  {selectedOrder.video_storage_url && (
                    <a href={selectedOrder.video_storage_url} target="_blank" rel="noopener noreferrer"
                      style={{ flex: 1, background: 'rgba(16,185,129,0.12)', border: '1px solid #b7e4cc', color: '#2a9d5c', borderRadius: '0.5rem', padding: '0.65rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>
                      ▶ Watch Video
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderKeywords = () => (
    <div className="videos-page">
      <h1>🔍 Keyword Research</h1>
      <p className="subtitle">Find the best YouTube search terms — search volume, competition, and opportunity scores</p>
      <div className="generator-form">
        <div className="form-group">
          <label>Topic or seed keyword *</label>
          <input type="text" value={kwTopic} onChange={e => setKwTopic(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !kwLoading) runKeywords(); }}
            placeholder="e.g. Azure data engineering, AI tools for beginners" disabled={kwLoading} />
        </div>
        <div className="form-group">
          <label>Your Niche</label>
          <select value={kwNiche} onChange={e => setKwNiche(e.target.value)} disabled={kwLoading}>
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
        {kwError && <div className="error-message">{kwError}</div>}
        <button className="generate-button" onClick={runKeywords} disabled={kwLoading}>
          {kwLoading ? '🔍 Researching…' : '🔍 Research Keywords'}
        </button>
      </div>

      {kwResult && (
        <div>
          {/* Recommended primary */}
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid #b7e4cc', borderRadius: '0.75rem', padding: '1rem 1.25rem', margin: '1.5rem 0 1rem' }}>
            <p style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>⭐ Best Keyword to Target</p>
            <p style={{ color: '#2a9d5c', fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>{kwResult.recommended_primary}</p>
          </div>

          {/* Keyword table */}
          <div className="scripts-list">
            {kwResult.keywords.map((kw, i) => {
              const oppColor = kw.opportunity_score >= 8 ? '#10b981' : kw.opportunity_score >= 6 ? '#f59e0b' : '#ef4444';
              const volBg = kw.search_volume === 'High' ? 'rgba(16,185,129,0.15)' : kw.search_volume === 'Medium' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
              const volColor = kw.search_volume === 'High' ? '#34d399' : kw.search_volume === 'Medium' ? '#fbbf24' : '#fca5a5';
              const compBg = kw.competition === 'Low' ? 'rgba(16,185,129,0.15)' : kw.competition === 'Medium' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
              const compColor = kw.competition === 'Low' ? '#34d399' : kw.competition === 'Medium' ? '#fbbf24' : '#fca5a5';
              return (
                <div key={i} className="script-card" style={{ borderLeft: `4px solid ${oppColor}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ color: '#1c2b33', margin: 0, fontSize: '1rem' }}>{kw.keyword}</h3>
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, alignItems: 'center' }}>
                      <span style={{ background: volBg, color: volColor, borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.73rem', fontWeight: 700 }}>Vol: {kw.search_volume}</span>
                      <span style={{ background: compBg, color: compColor, borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.73rem', fontWeight: 700 }}>Comp: {kw.competition}</span>
                      <span style={{ background: `rgba(${oppColor.slice(1).match(/.{2}/g)!.map(h=>parseInt(h,16)).join(',')},0.2)`, color: oppColor, borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.73rem', fontWeight: 700 }}>Score: {kw.opportunity_score}</span>
                    </div>
                  </div>
                  <p style={{ color: '#637381', fontSize: '0.8rem', margin: '0.3rem 0 0.5rem' }}>{kw.intent} · {kw.why}</p>
                  {kw.result_count !== undefined && <p style={{ color: '#637381', fontSize: '0.78rem', marginBottom: '0.4rem' }}>📊 {kw.result_count.toLocaleString()} results on YouTube</p>}
                  <p style={{ color: '#60a5fa', fontSize: '0.8125rem', marginBottom: '0.6rem' }}>💡 Suggested title: <em>{kw.suggested_title}</em></p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => { setTopic(kw.suggested_title); setNiche(kwNiche); setCurrentPage('scripts'); }}
                      style={{ background: 'linear-gradient(135deg,#a78bfa 0%,#7c3aed 100%)', color: '#fff', border: 'none', borderRadius: '0.4rem', padding: '0.4rem 0.85rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                      ✍️ Write Script
                    </button>
                    <button onClick={() => { setTopic(kw.suggested_title); setNiche(kwNiche); setCurrentPage('blueprint'); }}
                      style={{ background: 'linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)', color: '#fff', border: 'none', borderRadius: '0.4rem', padding: '0.4rem 0.85rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                      📋 Blueprint
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Long-tail */}
          {kwResult.long_tail?.length > 0 && (
            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginTop: '1rem' }}>
              <p style={{ color: '#60a5fa', fontWeight: 700, marginBottom: '0.5rem' }}>🔗 Long-tail Variants</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {kwResult.long_tail.map((t, i) => <span key={i} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6', borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.8125rem', cursor: 'pointer' }} onClick={() => { setKwTopic(t); }}>{t}</span>)}
              </div>
            </div>
          )}

          {/* Niche tips */}
          {kwResult.niche_tips?.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>💡 SEO Tips for {kwNiche}</p>
              <ul style={{ paddingLeft: '1rem', margin: 0 }}>{kwResult.niche_tips.map((t, i) => <li key={i} style={{ color: '#637381', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>{t}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── Performance Monitor helpers ───────────────────────────────────────────
  const loadMonitorData = async (days = monitorDays) => {
    setMonitorLoading(true); setMonitorError('');
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/analytics/performance-monitor?days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMonitorData(await res.json());
    } catch (e) { setMonitorError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setMonitorLoading(false); }
  };

  const syncAndReload = async () => {
    setMonitorSyncing(true); setMonitorSyncMsg('');
    try {
      const r = await apiFetch(`${API_BASE}/api/v1/analytics/sync`, { method: 'POST' });
      if (!r.ok) throw new Error(`Sync failed: HTTP ${r.status}`);
      const d = await r.json();
      const total = d.total_records ?? 0;
      setMonitorSyncMsg(`✅ Synced ${total} records`);
      await loadMonitorData(monitorDays);
    } catch (e) { setMonitorSyncMsg(e instanceof Error ? `❌ ${e.message}` : '❌ Sync failed'); }
    finally { setMonitorSyncing(false); }
  };

  const runImprove = async () => {
    setImproveLoading(true); setImproveError(''); setImproveData(null);
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/analytics/improve-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold_views: improveThreshold, limit: 10 }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      setImproveData(await res.json());
    } catch (e) { setImproveError(e instanceof Error ? e.message : 'Failed'); }
    finally { setImproveLoading(false); }
  };

  const loadConnStatus = async () => {
    setConnLoading(true);
    try {
      const r = await apiFetch(`${API_BASE}/api/v1/analytics/platform-status`);
      if (r.ok) setConnStatus(await r.json());
    } catch { /* ignore */ }
    finally { setConnLoading(false); }
  };

  const platIcon  = (p: string) => ({ youtube: '▶', instagram: '📸', tiktok: '🎵', facebook: '👥', twitter: '𝕏', linkedin: '💼' } as Record<string,string>)[p] ?? '🌐';
  const platColor = (p: string) => ({ youtube: '#ef4444', instagram: '#e1306c', tiktok: '#69c9d0', facebook: '#1877f2', twitter: '#1da1f2', linkedin: '#0077b5' } as Record<string,string>)[p] ?? '#94a3b8';

  const renderMonitor = () => {
    const s = monitorData;
    const TAB_STYLE = (active: boolean) => ({
      padding: '0.5rem 1.1rem', borderRadius: '0.4rem', border: 'none', cursor: 'pointer', fontWeight: 700,
      fontSize: '0.82rem', background: active ? '#3b82f6' : 'rgba(255,255,255,0.05)',
      color: active ? '#fff' : '#94a3b8', transition: 'background 0.15s',
    });
    const CARD = (children: React.ReactNode, accent = '#3b82f6') => (
      <div style={{ background: `${accent}0d`, border: `1px solid ${accent}35`, borderRadius: '0.75rem', padding: '1rem' }}>
        {children}
      </div>
    );
    const BIG_NUM = (val: React.ReactNode, label: string, color: string) => (
      <div style={{ background: `${color}12`, border: `1px solid ${color}40`, borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 900, color }}>{val}</div>
        <div style={{ color: '#637381', fontSize: '0.78rem', marginTop: '0.2rem' }}>{label}</div>
      </div>
    );

    return (
      <div className="videos-page">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>📡 Performance Monitor</h1>
            <p className="subtitle" style={{ margin: '0.25rem 0 0' }}>
              Live video metrics · Revenue · AI improvement coach · Affiliate income
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Period selector */}
            {([7,14,30,90] as const).map(d => (
              <button key={d} onClick={() => { setMonitorDays(d); loadMonitorData(d); }}
                style={{ padding: '0.35rem 0.8rem', borderRadius: '999px', border: `1px solid ${monitorDays===d?'#3b82f6':'rgba(148,163,184,0.25)'}`, background: monitorDays===d?'rgba(59,130,246,0.2)':'transparent', color: monitorDays===d?'#60a5fa':'#94a3b8', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700 }}>
                {d}d
              </button>
            ))}
            <button onClick={syncAndReload} disabled={monitorSyncing}
              style={{ padding: '0.45rem 1rem', borderRadius: '0.4rem', border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: '#2a9d5c', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 700 }}>
              {monitorSyncing ? '⏳ Syncing…' : '☁️ Sync'}
            </button>
            <button onClick={() => loadMonitorData(monitorDays)} disabled={monitorLoading}
              style={{ padding: '0.45rem 1rem', borderRadius: '0.4rem', border: '1px solid rgba(59,130,246,0.35)', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 700 }}>
              {monitorLoading ? '⏳' : '🔄 Refresh'}
            </button>
          </div>
        </div>
        {monitorSyncMsg && <p style={{ color: monitorSyncMsg.startsWith('✅') ? '#34d399' : '#f87171', fontSize: '0.82rem', margin: '0.25rem 0 0.75rem' }}>{monitorSyncMsg}</p>}
        {monitorError   && <div className="error-message" style={{ marginBottom: '1rem' }}>{monitorError}</div>}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!s && !monitorLoading && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#637381' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📡</div>
            <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>No data loaded yet.</p>
            <button onClick={() => loadMonitorData(monitorDays)}
              style={{ padding: '0.7rem 1.5rem', borderRadius: '0.5rem', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
              Load Dashboard
            </button>
          </div>
        )}
        {monitorLoading && !s && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#637381' }}>⏳ Loading…</div>
        )}

        {s && (
          <>
            {/* ── KPI row ─────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '0.65rem', marginBottom: '1.25rem' }}>
              {BIG_NUM(`$${s.revenue.total.toFixed(2)}`,   `Revenue (${s.period_days}d)`,   '#f59e0b')}
              {BIG_NUM(fmt(s.social.total_views),          'Total Views',                   '#10b981')}
              {BIG_NUM(fmt(s.social.total_likes),          'Total Likes',                   '#f472b6')}
              {BIG_NUM(`${s.social.avg_engagement_rate}%`, 'Engagement',                    '#a78bfa')}
              {BIG_NUM(s.social.total_posts,               'Posts Tracked',                 '#3b82f6')}
              {BIG_NUM(s.revenue.conversions,              `Sales (${s.period_days}d)`,     '#06b6d4')}
              {BIG_NUM(s.pipeline.posts_published,         'Published Posts',               '#34d399')}
              {BIG_NUM(
                s.low_performer_count > 0
                  ? <span style={{ color: '#d97706' }}>{s.low_performer_count} ⚠</span>
                  : <span style={{ color: '#2a9d5c' }}>0 ✓</span>,
                'Low Performers', s.low_performer_count > 0 ? '#fbbf24' : '#34d399'
              )}
            </div>

            {/* ── Tabs ────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {([
                ['overview',   '📊 Overview'],
                ['platforms',  '🌐 By Platform'],
                ['topvids',    '🏆 Top Videos'],
                ['affiliate',  '💸 Affiliate Income'],
                ['ai-coach',   `🤖 AI Coach${s.low_performer_count > 0 ? ` (${s.low_performer_count})` : ''}`],
                ['connections', `🔌 Connections${connStatus && !connStatus.all_connected ? ` (${connStatus.connected_count}/${connStatus.total})` : ''}`],
              ] as [typeof monitorTab, string][]).map(([key, label]) => (
                <button key={key} onClick={() => { setMonitorTab(key as typeof monitorTab); if (key === 'connections') loadConnStatus(); }} style={TAB_STYLE(monitorTab === key)}>{label}</button>
              ))}
            </div>

            {/* ════════ TAB: OVERVIEW ══════════════════════════════════ */}
            {monitorTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Revenue card */}
                {CARD(
                  <>
                    <h3 style={{ color: '#f59e0b', margin: '0 0 0.75rem', fontSize: '0.95rem' }}>💰 Revenue</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '0.6rem' }}>
                      {[
                        ['Total Revenue', `$${s.revenue.total.toFixed(2)}`, '#f59e0b'],
                        ['Conversions',   s.revenue.conversions,            '#10b981'],
                        ['Avg Order',     `$${s.revenue.avg_order.toFixed(2)}`, '#06b6d4'],
                      ].map(([lbl, val, col]) => (
                        <div key={lbl as string} style={{ textAlign: 'center', background: `${col as string}12`, borderRadius: '0.5rem', padding: '0.6rem' }}>
                          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: col as string }}>{val as string | number}</div>
                          <div style={{ color: '#637381', fontSize: '0.76rem' }}>{lbl as string}</div>
                        </div>
                      ))}
                    </div>
                  </>,
                  '#f59e0b'
                )}
                {/* Pipeline card */}
                {CARD(
                  <>
                    <h3 style={{ color: '#a78bfa', margin: '0 0 0.75rem', fontSize: '0.95rem' }}>🎬 Video Pipeline</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {Object.entries(s.pipeline.videos_by_status).map(([status, count]) => {
                        const c = ({ generating:'#f59e0b', ready:'#10b981', posted:'#3b82f6', failed:'#ef4444' } as Record<string,string>)[status] ?? '#94a3b8';
                        return (
                          <div key={status} style={{ background: `${c}18`, border: `1px solid ${c}45`, borderRadius: '0.5rem', padding: '0.4rem 0.85rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: c }}>{count}</div>
                            <div style={{ color: '#637381', fontSize: '0.73rem', textTransform: 'capitalize' }}>{status}</div>
                          </div>
                        );
                      })}
                      <div style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)', borderRadius: '0.5rem', padding: '0.4rem 0.85rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2a9d5c' }}>{s.pipeline.posts_published}</div>
                        <div style={{ color: '#637381', fontSize: '0.73rem' }}>Published</div>
                      </div>
                    </div>
                  </>,
                  '#a78bfa'
                )}
                {/* Social totals */}
                {CARD(
                  <>
                    <h3 style={{ color: '#10b981', margin: '0 0 0.75rem', fontSize: '0.95rem' }}>📈 Social Totals</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: '0.5rem' }}>
                      {[
                        ['👁 Views',    fmt(s.social.total_views),    '#10b981'],
                        ['❤️ Likes',    fmt(s.social.total_likes),    '#f472b6'],
                        ['💬 Comments', fmt(s.social.total_comments), '#a78bfa'],
                        ['🔁 Shares',   fmt(s.social.total_shares),   '#06b6d4'],
                        ['🖱 Clicks',   fmt(s.social.total_clicks),   '#3b82f6'],
                        ['📊 Eng %',    `${s.social.avg_engagement_rate}%`, '#f59e0b'],
                      ].map(([l, v, c]) => (
                        <div key={l as string} style={{ textAlign: 'center', background: '#f4f6f8', borderRadius: '0.4rem', padding: '0.45rem' }}>
                          <div style={{ color: c as string, fontWeight: 800, fontSize: '0.95rem' }}>{v as string}</div>
                          <div style={{ color: '#637381', fontSize: '0.72rem' }}>{l as string}</div>
                        </div>
                      ))}
                    </div>
                  </>,
                  '#10b981'
                )}
                {s.last_synced && <p style={{ color: '#637381', fontSize: '0.76rem', margin: 0 }}>Last synced: {new Date(s.last_synced).toLocaleString()}</p>}
              </div>
            )}

            {/* ════════ TAB: BY PLATFORM ═══════════════════════════════ */}
            {monitorTab === 'platforms' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {s.social.by_platform.length === 0
                  ? <p style={{ color: '#637381' }}>No platform data — sync from social platforms first.</p>
                  : s.social.by_platform.map(p => (
                    <div key={p.platform} className="script-card" style={{ borderLeft: `4px solid ${platColor(p.platform)}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3 style={{ color: '#1c2b33', margin: 0, fontSize: '1rem' }}>{platIcon(p.platform)} {p.platform.charAt(0).toUpperCase()+p.platform.slice(1)}</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ background: `${platColor(p.platform)}22`, color: platColor(p.platform), borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: 700 }}>{p.posts} posts</span>
                          <span style={{ background: p.engagement_rate >= 3 ? 'rgba(16,185,129,0.15)' : p.engagement_rate >= 1 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)', color: p.engagement_rate >= 3 ? '#34d399' : p.engagement_rate >= 1 ? '#fbbf24' : '#f87171', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 700 }}>
                            {p.engagement_rate}% eng
                          </span>
                        </div>
                      </div>
                      {/* Bar chart — views as proportion of max */}
                      {(() => {
                        const maxV = Math.max(...s.social.by_platform.map(x => x.views), 1);
                        const pct = Math.round((p.views / maxV) * 100);
                        return (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#637381', marginBottom: '0.25rem' }}>
                              <span>Views</span><span style={{ color: '#1c2b33', fontWeight: 700 }}>{fmt(p.views)}</span>
                            </div>
                            <div style={{ background: '#f4f6f8', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                              <div style={{ background: platColor(p.platform), width: `${pct}%`, height: '100%', borderRadius: '999px', transition: 'width 0.4s' }} />
                            </div>
                          </div>
                        );
                      })()}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.4rem' }}>
                        {[['❤️', fmt(p.likes),'Likes'],['💬',fmt(p.comments),'Comments'],['🔁',fmt(p.shares),'Shares']].map(([ic,v,lb]) => (
                          <div key={lb} style={{ textAlign: 'center', background: '#f4f6f8', borderRadius: '0.4rem', padding: '0.35rem' }}>
                            <div style={{ color: '#1c2b33', fontSize: '0.85rem', fontWeight: 700 }}>{ic} {v}</div>
                            <div style={{ color: '#637381', fontSize: '0.7rem' }}>{lb}</div>
                          </div>
                        ))}
                        <div style={{ textAlign: 'center', background: p.engagement_rate >= 3 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)', borderRadius: '0.4rem', padding: '0.35rem' }}>
                          <div style={{ color: p.engagement_rate >= 3 ? '#34d399' : '#f87171', fontSize: '0.85rem', fontWeight: 700 }}>{p.engagement_rate}%</div>
                          <div style={{ color: '#637381', fontSize: '0.7rem' }}>Eng Rate</div>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {/* ════════ TAB: TOP VIDEOS ════════════════════════════════ */}
            {monitorTab === 'topvids' && (
              <div>
                {s.top_posts.length === 0
                  ? <p style={{ color: '#637381' }}>No posts tracked yet. Sync from platforms.</p>
                  : s.top_posts.map((post, i) => (
                    <div key={post.id} className="script-card" style={{ borderLeft: `4px solid ${platColor(post.platform)}`, marginBottom: '0.65rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ background: platColor(post.platform), color: '#fff', borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>#{i+1}</span>
                          <span style={{ background: `${platColor(post.platform)}22`, color: platColor(post.platform), borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 600 }}>{platIcon(post.platform)} {post.platform}</span>
                        </div>
                        {post.posted_at && <span style={{ color: '#637381', fontSize: '0.72rem' }}>{new Date(post.posted_at).toLocaleDateString()}</span>}
                      </div>
                      <p style={{ color: '#1c2b33', fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.4rem', lineHeight: 1.4 }}>{post.title || '(untitled)'}</p>
                      {/* Mini bar for views */}
                      {(() => {
                        const maxV = Math.max(...s.top_posts.map(x => x.views), 1);
                        const pct = Math.round((post.views / maxV) * 100);
                        return (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <div style={{ background: '#f4f6f8', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                              <div style={{ background: `linear-gradient(90deg,${platColor(post.platform)},${platColor(post.platform)}88)`, width: `${pct}%`, height: '100%', borderRadius: '999px' }} />
                            </div>
                          </div>
                        );
                      })()}
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
                        <span style={{ color: '#10b981' }}>👁 {fmt(post.views)}</span>
                        <span style={{ color: '#f472b6' }}>❤️ {fmt(post.likes)}</span>
                        <span style={{ color: '#a78bfa' }}>💬 {fmt(post.comments)}</span>
                        <span style={{ color: '#06b6d4' }}>🔁 {fmt(post.shares)}</span>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {/* ════════ TAB: AFFILIATE INCOME ══════════════════════════ */}
            {monitorTab === 'affiliate' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '0.25rem' }}>
                  <h3 style={{ color: '#d97706', margin: '0 0 0.3rem', fontSize: '0.95rem' }}>💸 How to Earn Affiliate Revenue</h3>
                  <p style={{ color: '#637381', fontSize: '0.83rem', margin: 0, lineHeight: 1.6 }}>
                    Add your affiliate links to every video description, pinned comment, and link-in-bio.
                    Create dedicated "Best AI Tools" or "I Use This Every Day" videos — these convert at 3–8%.
                    Track which platform drives the most clicks in the By Platform tab.
                  </p>
                </div>
                {s.affiliates.map((af, i) => (
                  <div key={i} className="script-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div>
                        <span style={{ color: '#1c2b33', fontWeight: 700, fontSize: '0.95rem' }}>{af.name}</span>
                        <span style={{ marginLeft: '0.5rem', background: 'rgba(148,163,184,0.12)', color: '#637381', borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.72rem' }}>{af.category}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 700 }}>{af.commission}</span>
                        <span style={{ background: 'rgba(16,185,129,0.12)', color: '#2a9d5c', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 700 }}>{af.est_monthly}/mo</span>
                      </div>
                    </div>
                    <p style={{ color: '#637381', fontSize: '0.82rem', margin: '0 0 0.6rem', lineHeight: 1.5 }}>{af.why}</p>
                    <a href={af.link} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-block', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', borderRadius: '0.4rem', padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}>
                      Get Affiliate Link →
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* ════════ TAB: AI COACH ══════════════════════════════════ */}
            {monitorTab === 'ai-coach' && (
              <div>
                <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                  <h3 style={{ color: '#60a5fa', margin: '0 0 0.5rem', fontSize: '0.95rem' }}>🤖 AI Improvement Coach</h3>
                  <p style={{ color: '#637381', fontSize: '0.83rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                    Finds your low-performing videos and GPT-4 gives you 3 specific tactics to fix each one.
                    Set the views threshold below — any post under that number gets analysed.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ color: '#637381', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      Threshold (views):
                      <input type="number" value={improveThreshold} min={50} max={100000} step={50}
                        onChange={e => setImproveThreshold(Number(e.target.value))}
                        style={{ width: '90px', background: '#f4f6f8', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '0.4rem', color: '#1c2b33', padding: '0.35rem 0.6rem', fontSize: '0.83rem' }} />
                    </label>
                    <button onClick={runImprove} disabled={improveLoading}
                      style={{ padding: '0.5rem 1.1rem', borderRadius: '0.4rem', border: 'none', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: improveLoading ? 0.7 : 1 }}>
                      {improveLoading ? '🤖 Analysing…' : '🤖 Get AI Tips'}
                    </button>
                  </div>
                  {s.low_performer_count > 0 && !improveData && !improveLoading && (
                    <p style={{ color: '#d97706', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>
                      ⚠ {s.low_performer_count} posts are below the auto-calculated threshold — click Get AI Tips.
                    </p>
                  )}
                </div>

                {improveError && <div className="error-message" style={{ marginBottom: '0.75rem' }}>{improveError}</div>}

                {improveData && (
                  <>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                      {[
                        [`${improveData.low_performer_count} low-performing`, '#fbbf24'],
                        [`avg ${fmt(Math.round(improveData.avg_views))} views`, '#94a3b8'],
                        [`< ${fmt(improveData.threshold_views)} views threshold`, '#64748b'],
                      ].map(([v, c]) => (
                        <span key={v} style={{ background: `${c}18`, color: c as string, borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.78rem', fontWeight: 600 }}>{v}</span>
                      ))}
                    </div>

                    {/* General tips */}
                    {improveData.general_tips.length > 0 && (
                      <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid #b7e4cc', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                        <h4 style={{ color: '#2a9d5c', margin: '0 0 0.6rem', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✅ Channel-Wide Improvements</h4>
                        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                          {improveData.general_tips.map((tip, i) => (
                            <li key={i} style={{ color: '#a7f3d0', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '0.2rem' }}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Per-post suggestions */}
                    {improveData.suggestions.length > 0 && (
                      <>
                        <h4 style={{ color: '#1c2b33', margin: '0 0 0.75rem', fontSize: '0.9rem' }}>🔧 Per-Post Action Plans</h4>
                        {improveData.suggestions.map((sug, i) => (
                          <div key={i} className="script-card" style={{ borderLeft: `4px solid ${platColor(sug.platform)}`, marginBottom: '0.65rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ background: `${platColor(sug.platform)}22`, color: platColor(sug.platform), borderRadius: '999px', padding: '0.15rem 0.55rem', fontSize: '0.73rem', fontWeight: 700 }}>{platIcon(sug.platform)} {sug.platform}</span>
                              <span style={{ color: '#1c2b33', fontWeight: 600, fontSize: '0.875rem' }}>{sug.title || '(untitled)'}</span>
                            </div>
                            {/* Tactics list */}
                            {sug.tactics.map((t, j) => (
                              <div key={j} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.3rem 0', borderBottom: j < sug.tactics.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                <span style={{ color: '#3b82f6', fontWeight: 700, flexShrink: 0, fontSize: '0.8rem' }}>{j+1}.</span>
                                <span style={{ color: '#637381', fontSize: '0.83rem', lineHeight: 1.5 }}>{t}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </>
                    )}

                    {improveData.low_performer_count === 0 && (
                      <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid #b7e4cc', borderRadius: '0.6rem', padding: '1rem', textAlign: 'center', color: '#2a9d5c', fontWeight: 600 }}>
                        ✅ No posts are below the threshold — your content is performing well!
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ════════ TAB: CONNECTIONS ═══════════════════════════════ */}
            {monitorTab === 'connections' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Header */}
                <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.28)', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
                  <h3 style={{ color: '#818cf8', margin: '0 0 0.35rem', fontSize: '0.95rem' }}>🔌 Platform Connections</h3>
                  <p style={{ color: '#637381', fontSize: '0.83rem', margin: 0, lineHeight: 1.55 }}>
                    Shows which platforms are wired up and pulling live metrics into the dashboard.
                    Green = data flowing. Red = credentials missing.
                  </p>
                </div>

                {connLoading && !connStatus && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#637381' }}>⏳ Checking connections…</div>
                )}

                {connStatus && (
                  <>
                    {/* Summary badge */}
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        background: connStatus.all_connected ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: connStatus.all_connected ? '#34d399' : '#fbbf24',
                        border: `1px solid ${connStatus.all_connected ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`,
                        borderRadius: '999px', padding: '0.3rem 0.9rem', fontWeight: 700, fontSize: '0.83rem'
                      }}>
                        {connStatus.connected_count}/{connStatus.total} platforms connected
                      </span>
                      <button onClick={loadConnStatus} disabled={connLoading}
                        style={{ padding: '0.3rem 0.75rem', borderRadius: '0.35rem', border: '1px solid rgba(148,163,184,0.25)', background: 'transparent', color: '#637381', fontSize: '0.78rem', cursor: 'pointer' }}>
                        {connLoading ? '…' : '🔄 Recheck'}
                      </button>
                    </div>

                    {/* One card per platform */}
                    {connStatus.platforms.map(p => {
                      const ok = p.connected;
                      const accent = ok ? '#10b981' : '#ef4444';
                      const platC  = platColor(p.platform);
                      return (
                        <div key={p.platform} style={{ background: `${accent}08`, border: `1px solid ${accent}35`, borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
                          {/* Row 1: name + status */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1.2rem' }}>{platIcon(p.platform)}</span>
                              <span style={{ color: '#1c2b33', fontWeight: 700, fontSize: '0.95rem' }}>{p.label}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                              <span style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}50`, borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 700 }}>
                                {ok ? '✅ Connected' : '❌ Not connected'}
                              </span>
                              {ok && (
                                <span style={{ background: p.auto_refresh ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.12)', color: p.auto_refresh ? '#34d399' : '#fbbf24', border: `1px solid ${p.auto_refresh ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.75rem', fontWeight: 600 }}>
                                  {p.auto_refresh ? '🔄 Auto-refresh' : '⚠ Manual refresh'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Notes */}
                          <p style={{ color: '#637381', fontSize: '0.8rem', margin: '0 0 0.6rem', lineHeight: 1.5 }}>{p.notes}</p>

                          {/* Missing vars list */}
                          {!ok && p.missing.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                              <p style={{ color: '#fca5a5', fontSize: '0.78rem', fontWeight: 700, margin: '0 0 0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Missing env vars:</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                {p.missing.map(v => (
                                  <code key={v} style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid #fecaca', borderRadius: '0.3rem', padding: '0.15rem 0.5rem', fontSize: '0.78rem' }}>{v}</code>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* TikTok-specific setup steps */}
                          {p.platform === 'tiktok' && !ok && (
                            <div style={{ background: 'rgba(105,201,208,0.07)', border: '1px solid rgba(105,201,208,0.2)', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
                              <p style={{ color: '#69c9d0', fontWeight: 700, fontSize: '0.8rem', margin: '0 0 0.4rem', textTransform: 'uppercase' }}>TikTok Setup (5 minutes)</p>
                              <ol style={{ margin: 0, paddingLeft: '1.1rem' }}>
                                {[
                                  'Go to developers.tiktok.com → My Apps → Create App',
                                  'Add products: "Content Posting API" and "Login Kit"',
                                  'Set scopes: user.info.basic + video.list',
                                  'Copy "App Key" → TIKTOK_CLIENT_KEY in .env',
                                  'Copy "App Secret" → TIKTOK_CLIENT_SECRET in .env',
                                  'Run OAuth flow once to get access + refresh tokens (see docs below)',
                                  'Paste tokens into TIKTOK_ACCESS_TOKEN + TIKTOK_REFRESH_TOKEN',
                                ].map((step, i) => (
                                  <li key={i} style={{ color: '#a7f3d0', fontSize: '0.8rem', lineHeight: 1.7 }}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {/* Setup link + optional channel shortcut */}
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <a href={p.setup_url} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'inline-block', background: `${platC}22`, color: platC, border: `1px solid ${platC}44`, borderRadius: '0.4rem', padding: '0.35rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}>
                              {ok ? '⚙ Manage →' : '🔗 Setup Guide →'}
                            </a>
                            {p.platform === 'youtube' && (
                              <a href="https://www.youtube.com/@TxNightcoder" target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-block', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.4rem', padding: '0.35rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}>
                                ▶ @TxNightcoder →
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {!connStatus && !connLoading && (
                  <button onClick={loadConnStatus}
                    style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', fontSize: '0.875rem' }}>
                    Check Connections
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderAnalytics = () => (
    <div className="videos-page">
      <h1>📊 Analytics Dashboard</h1>
      <p className="subtitle">Performance across all connected social platforms</p>

      {/* ── Connected Accounts panel ─────────────────────────────────── */}
      <div style={{ background: '#f4f6f8', border: '1px solid #e3e8ef', borderRadius: '0.875rem', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ color: '#1c2b33', fontSize: '1rem', margin: 0 }}>🔌 Connected Accounts</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="generate-button" style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
              onClick={() => fetchAnalytics()} disabled={analyticsLoading}>
              {analyticsLoading ? '⏳' : '🔄 Refresh'}
            </button>
            <button className="publish-button" style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
              onClick={syncAnalytics} disabled={analyticsSyncing}>
              {analyticsSyncing ? '⏳ Syncing…' : '☁️ Sync All'}
            </button>
          </div>
        </div>
        {analyticsSyncMsg && <p style={{ color: analyticsSyncMsg.startsWith('✅') ? '#34d399' : '#f87171', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{analyticsSyncMsg}</p>}

        {/* Platform connection cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.65rem' }}>
          {[
            {
              id: 'tiktok', label: 'TikTok', icon: '🎵', color: '#69c9d0',
              envKey: 'TIKTOK_ACCESS_TOKEN',
              setupUrl: 'https://developers.tiktok.com/apps',
              setupLabel: 'TikTok Developer Portal',
              hint: 'Needs TIKTOK_ACCESS_TOKEN + 3 other vars in GitHub Secrets',
            },
            {
              id: 'instagram', label: 'Instagram', icon: '📸', color: '#e1306c',
              envKey: 'BUFFER_INSTAGRAM_PROFILE_ID',
              setupUrl: 'https://publish.buffer.com/settings/channels',
              setupLabel: 'Connect via Buffer',
              hint: 'Connect Instagram in Buffer, then set BUFFER_INSTAGRAM_PROFILE_ID',
            },
            {
              id: 'facebook', label: 'Facebook', icon: '👥', color: '#1877f2',
              envKey: 'BUFFER_FACEBOOK_PROFILE_ID',
              setupUrl: 'https://publish.buffer.com/settings/channels',
              setupLabel: 'Connect via Buffer',
              hint: 'Connect Facebook Page in Buffer, then set BUFFER_FACEBOOK_PROFILE_ID',
            },
            {
              id: 'youtube', label: 'YouTube', icon: '▶', color: '#ef4444',
              envKey: 'BUFFER_YOUTUBE_PROFILE_ID',
              setupUrl: 'https://publish.buffer.com/settings/channels',
              setupLabel: 'Connect via Buffer',
              channelUrl: 'https://www.youtube.com/@TxNightcoder',
              hint: 'Connect YouTube in Buffer, then set BUFFER_YOUTUBE_PROFILE_ID',
            },
            {
              id: 'twitter', label: 'X / Twitter', icon: '𝕏', color: '#1da1f2',
              envKey: 'BUFFER_TWITTER_PROFILE_ID',
              setupUrl: 'https://publish.buffer.com/settings/channels',
              setupLabel: 'Connect via Buffer',
              hint: 'Connect X/Twitter in Buffer, then set BUFFER_TWITTER_PROFILE_ID',
            },
            {
              id: 'linkedin', label: 'LinkedIn', icon: '💼', color: '#0077b5',
              envKey: 'BUFFER_LINKEDIN_PROFILE_ID',
              setupUrl: 'https://publish.buffer.com/settings/channels',
              setupLabel: 'Connect via Buffer',
              hint: 'Connect LinkedIn in Buffer, then set BUFFER_LINKEDIN_PROFILE_ID',
            },
            {
              id: 'gumroad', label: 'Gumroad', icon: '🛒', color: '#f59e0b',
              envKey: null,
              setupUrl: 'https://app.gumroad.com/settings/advanced',
              setupLabel: 'Gumroad Webhook Settings',
              hint: 'Set your backend webhook URL in Gumroad → Settings → Advanced → Webhooks',
            },
          ].map(acct => {
            // We can't read server env from the browser, so show as "needs setup"
            // until the user syncs data — once data exists for this platform it shows as connected
            const hasData = analyticsSummary?.by_platform?.some(p => p.platform === acct.id);
            const isGumroad = acct.id === 'gumroad';
            const connected = isGumroad
              ? !!(analyticsSummary)   // if analytics loaded, assume gumroad webhook may be set
              : hasData;
            return (
              <div key={acct.id} style={{
                background: connected ? `${acct.color}10` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${connected ? acct.color + '45' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '0.65rem', padding: '0.85rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>{acct.icon}</span>
                    <span style={{ color: '#1c2b33', fontWeight: 700, fontSize: '0.875rem' }}>{acct.label}</span>
                  </div>
                  <span style={{
                    background: connected ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)',
                    color: connected ? '#34d399' : '#64748b',
                    border: `1px solid ${connected ? 'rgba(16,185,129,0.3)' : 'rgba(148,163,184,0.2)'}`,
                    borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: 700,
                  }}>
                    {connected ? '● Active' : '○ Setup'}
                  </span>
                </div>
                {connected
                  ? <p style={{ color: '#2a9d5c', fontSize: '0.75rem', margin: '0 0 0.5rem', lineHeight: 1.4 }}>
                      {isGumroad ? 'Webhook endpoint ready' : `Data syncing ✓`}
                    </p>
                  : <p style={{ color: '#637381', fontSize: '0.75rem', margin: '0 0 0.5rem', lineHeight: 1.4 }}>{acct.hint}</p>
                }
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <a href={acct.setupUrl} target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-block', fontSize: '0.72rem', fontWeight: 700,
                    color: acct.color, textDecoration: 'none',
                    background: `${acct.color}15`, border: `1px solid ${acct.color}35`,
                    borderRadius: '0.3rem', padding: '0.2rem 0.55rem',
                  }}>
                    {connected ? '⚙ Manage' : '🔗 Set up'} →
                  </a>
                  {(acct as any).channelUrl && (
                    <a href={(acct as any).channelUrl} target="_blank" rel="noopener noreferrer" style={{
                      display: 'inline-block', fontSize: '0.72rem', fontWeight: 700,
                      color: acct.color, textDecoration: 'none',
                      background: `${acct.color}15`, border: `1px solid ${acct.color}35`,
                      borderRadius: '0.3rem', padding: '0.2rem 0.55rem',
                    }}>
                      ▶ Visit Channel →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {analyticsSummary?.last_synced && (
          <p style={{ color: '#637381', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            Last synced: {new Date(analyticsSummary.last_synced).toLocaleString()}
          </p>
        )}
      </div>

      {analyticsError && <div className="error-message">{analyticsError}</div>}

      {!analyticsSummary && !dashboardMetrics && !analyticsLoading && (
        <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center', color: '#637381' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>No analytics data yet.</p>
          <p style={{ fontSize: '0.875rem' }}>Click <strong>Sync from Platforms</strong> to pull live stats, or <strong>Refresh</strong> to load any stored records.</p>
        </div>
      )}

      {/* Pipeline overview — from dashboard/metrics */}
      {dashboardMetrics && (
        <>
          <h2 style={{ color: '#1c2b33', marginBottom: '1rem' }}>📋 Pipeline Overview</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Scripts', value: dashboardMetrics.overview.total_scripts, color: '#a78bfa' },
              { label: 'Videos', value: dashboardMetrics.overview.total_videos, color: '#3b82f6' },
              { label: 'Posts', value: dashboardMetrics.overview.total_posts, color: '#10b981' },
              { label: 'Revenue 30d', value: `$${dashboardMetrics.overview.revenue_30d.toFixed(2)}`, color: '#f59e0b' },
            ].map(c => (
              <div key={c.label} style={{ background: `${c.color}12`, border: `1px solid ${c.color}40`, borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: c.color }}>{c.value}</div>
                <div style={{ color: '#637381', fontSize: '0.8125rem', marginTop: '0.25rem' }}>{c.label}</div>
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
          <h2 style={{ color: '#1c2b33', marginBottom: '1rem' }}>📈 Social Performance</h2>
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
                <div style={{ color: '#637381', fontSize: '0.8125rem', marginTop: '0.25rem' }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Per-platform breakdown */}
          {analyticsSummary.by_platform.length > 0 && (
            <>
              <h2 style={{ color: '#1c2b33', marginBottom: '1rem' }}>🌐 By Platform</h2>
              <div className="scripts-list" style={{ marginBottom: '1.5rem' }}>
                {analyticsSummary.by_platform.map(p => (
                  <div key={p.platform} className="script-card" style={{ borderLeft: `4px solid ${platformColor(p.platform)}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ color: '#1c2b33', fontSize: '1rem' }}>{platformIcon(p.platform)} {p.platform.charAt(0).toUpperCase() + p.platform.slice(1)}</h3>
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
                          <div style={{ color: '#1c2b33', fontWeight: 700, fontSize: '0.9rem' }}>{val}</div>
                          <div style={{ color: '#637381', fontSize: '0.75rem' }}>{label}</div>
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
            <h2 style={{ color: '#1c2b33' }}>🏆 Top Posts</h2>
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
            ? <p style={{ color: '#637381', fontSize: '0.875rem' }}>No posts synced yet — hit Sync from Platforms to pull data.</p>
            : (
              <div className="scripts-list">
                {analyticsTopPosts.map((post, i) => (
                  <div key={post.id} className="script-card" style={{ borderLeft: `4px solid ${platformColor(post.platform)}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <span style={{ background: platformColor(post.platform), color: '#fff', borderRadius: '999px', padding: '0.15rem 0.55rem', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>#{i+1}</span>
                      <span style={{ background: `${platformColor(post.platform)}22`, color: platformColor(post.platform), borderRadius: '999px', padding: '0.15rem 0.55rem', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>{platformIcon(post.platform)} {post.platform}</span>
                    </div>
                    <p style={{ color: '#1c2b33', margin: '0.6rem 0 0.5rem', fontWeight: 600, lineHeight: 1.4 }}>{post.title || '(untitled)'}</p>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
                      <span style={{ color: '#10b981' }}>👁 {fmt(post.views)}</span>
                      <span style={{ color: '#f59e0b' }}>❤️ {fmt(post.likes)}</span>
                      <span style={{ color: '#a78bfa' }}>💬 {fmt(post.comments)}</span>
                      <span style={{ color: '#06b6d4' }}>🔁 {fmt(post.shares)}</span>
                    </div>
                    {post.posted_at && <p style={{ color: '#637381', fontSize: '0.75rem', marginTop: '0.4rem' }}>Posted {new Date(post.posted_at).toLocaleDateString()}</p>}
                  </div>
                ))}
              </div>
            )
          }
        </>
      )}

      {/* ── Channel Audit ── */}
      <div style={{ marginTop: '2.5rem', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '0.75rem', padding: '1.5rem' }}>
        <h2 style={{ color: '#a78bfa', marginBottom: '0.25rem', fontSize: '1.1rem' }}>🎓 Channel Audit</h2>
        <p style={{ color: '#637381', fontSize: '0.8125rem', marginBottom: '1rem' }}>AI analyses your YouTube channel and scores it across 6 dimensions with actionable recommendations.</p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <input type="text" value={auditChannel} onChange={e => setAuditChannel(e.target.value)}
            placeholder="Channel ID (UC...), @handle, or YouTube URL"
            disabled={auditLoading}
            style={{ flex: '1 1 260px', background: '#f4f6f8', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.6rem 0.85rem', fontSize: '0.875rem' }} />
          <select value={auditNiche} onChange={e => setAuditNiche(e.target.value)} disabled={auditLoading}
            style={{ flex: '0 0 auto', background: '#f4f6f8', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.6rem 0.85rem', fontSize: '0.875rem' }}>
            <option value="AI tools">AI Tools</option><option value="technology">Technology</option>
            <option value="education">Education</option><option value="finance">Finance</option>
            <option value="health">Health</option><option value="gaming">Gaming</option>
            <option value="kids">Kids & Family</option><option value="beauty">Beauty</option>
            <option value="food">Food</option><option value="travel">Travel</option>
          </select>
          <button onClick={runAudit} disabled={auditLoading}
            style={{ background: 'linear-gradient(135deg,#a78bfa 0%,#7c3aed 100%)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: auditLoading ? 'not-allowed' : 'pointer', opacity: auditLoading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            {auditLoading ? '🔍 Analysing…' : '🔍 Audit Channel'}
          </button>
        </div>
        {auditError && <div className="error-message">{auditError}</div>}

        {auditResult && (() => {
          const gradeColor = auditResult.overall_score >= 8 ? '#10b981' : auditResult.overall_score >= 6 ? '#f59e0b' : '#ef4444';
          const scoreKeys = Object.entries(auditResult.scores ?? {});
          return (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{auditResult.grade}</div>
                  <div style={{ color: '#637381', fontSize: '0.8rem' }}>Overall Grade</div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#1c2b33', fontSize: '0.9375rem', margin: '0 0 0.5rem', fontWeight: 600 }}>{auditResult.channel?.title}</p>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    {[['👥', auditResult.channel?.subscribers?.toLocaleString(), 'Subscribers'],['👁', auditResult.channel?.total_views?.toLocaleString(), 'Total Views'],['🎬', auditResult.channel?.video_count?.toLocaleString(), 'Videos'],['📊', auditResult.channel?.avg_views?.toLocaleString(), 'Avg Views']].map(([icon, val, lbl]) => (
                      <div key={lbl as string}><div style={{ color: '#1c2b33', fontWeight: 700, fontSize: '0.9rem' }}>{icon} {val}</div><div style={{ color: '#637381', fontSize: '0.73rem' }}>{lbl as string}</div></div>
                    ))}
                  </div>
                </div>
              </div>
              <p style={{ color: '#637381', fontSize: '0.875rem', marginBottom: '1.25rem' }}>{auditResult.summary}</p>
              {scoreKeys.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  {scoreKeys.map(([key, val]) => {
                    const sc = val as AuditScore; const c = sc.score >= 8 ? '#10b981' : sc.score >= 6 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={key} style={{ background: '#f4f6f8', border: `1px solid ${c}44`, borderRadius: '0.5rem', padding: '0.6rem 0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <span style={{ color: '#637381', fontSize: '0.8rem', textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
                          <span style={{ color: c, fontWeight: 700, fontSize: '0.875rem' }}>{sc.score}/10</span>
                        </div>
                        <div style={{ background: '#f4f6f8', borderRadius: '999px', height: '4px', overflow: 'hidden' }}>
                          <div style={{ background: c, width: `${sc.score * 10}%`, height: '100%', borderRadius: '999px' }} />
                        </div>
                        <p style={{ color: '#637381', fontSize: '0.73rem', margin: '0.25rem 0 0' }}>{sc.detail}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              {auditResult.strengths?.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ color: '#2a9d5c', fontWeight: 700, fontSize: '0.8125rem', textTransform: 'uppercase', marginBottom: '0.4rem' }}>✅ Strengths</p>
                  <ul style={{ paddingLeft: '1rem', margin: 0 }}>{auditResult.strengths.map((s, i) => <li key={i} style={{ color: '#a7f3d0', fontSize: '0.8125rem', marginBottom: '0.2rem' }}>{s}</li>)}</ul>
                </div>
              )}
              {auditResult.improvements?.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ color: '#d97706', fontWeight: 700, fontSize: '0.8125rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>🔧 Action Plan</p>
                  {auditResult.improvements.map((imp, i) => {
                    const pc = imp.priority === 'High' ? '#ef4444' : imp.priority === 'Medium' ? '#f59e0b' : '#94a3b8';
                    return (
                      <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ background: `${pc}22`, color: pc, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0, alignSelf: 'flex-start', marginTop: '0.1rem' }}>{imp.priority}</span>
                        <div><p style={{ color: '#1c2b33', fontSize: '0.8125rem', margin: '0 0 0.15rem', fontWeight: 600 }}>{imp.action}</p><p style={{ color: '#637381', fontSize: '0.78rem', margin: 0 }}>{imp.impact}</p></div>
                      </div>
                    );
                  })}
                </div>
              )}
              {auditResult.next_5_videos?.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.8125rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>🎬 Recommended Next Videos</p>
                  {auditResult.next_5_videos.map((v, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
                      <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>#{i+1}</span>
                      <div style={{ flex: 1 }}><p style={{ color: '#1c2b33', fontSize: '0.8125rem', margin: '0 0 0.1rem', fontWeight: 600 }}>{v.title}</p><p style={{ color: '#637381', fontSize: '0.75rem', margin: 0 }}>Keyword: <span style={{ color: '#3b82f6' }}>{v.keyword}</span> · {v.why}</p></div>
                      <button onClick={() => { setTopic(v.title); setNiche(auditNiche); setCurrentPage('scripts'); }}
                        style={{ background: 'linear-gradient(135deg,#a78bfa 0%,#7c3aed 100%)', color: '#fff', border: 'none', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0 }}>
                        ✍️ Write Script
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {auditResult.monetization_readiness?.recommendation && (
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '0.5rem', padding: '0.75rem 1rem' }}>
                  <p style={{ color: '#d97706', fontWeight: 700, marginBottom: '0.35rem', fontSize: '0.875rem' }}>💰 Monetization — {auditResult.monetization_readiness.estimated_monthly_revenue}/mo estimate {auditResult.monetization_readiness.adsense_eligible ? '· ✅ AdSense eligible' : '· ⚠️ Not yet eligible'}</p>
                  <p style={{ color: '#637381', fontSize: '0.8125rem', margin: 0 }}>{auditResult.monetization_readiness.recommendation}</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );


  // ── Gumroad Studio page ───────────────────────────────────────────────────
  const [gmTab,           setGmTab]           = useState<'ideas'|'products'|'analytics'>('ideas');
  const [gmNiche,         setGmNiche]         = useState('AI tools');
  const [gmIdeas,         setGmIdeas]         = useState<any[]>([]);
  const [gmIdeasLoading,  setGmIdeasLoading]  = useState(false);
  const [gmIdeasError,    setGmIdeasError]    = useState('');
  const [gmExpanded,      setGmExpanded]      = useState<number|null>(null);
  const [gmProducts,      setGmProducts]      = useState<any[]>([]);
  const [gmProdLoading,   setGmProdLoading]   = useState(false);
  const [gmProdError,     setGmProdError]     = useState('');
  const [gmNewName,       setGmNewName]       = useState('');
  const [gmNewPrice,      setGmNewPrice]      = useState('');
  const [gmNewDesc,       setGmNewDesc]       = useState('');
  const [gmNewGumId,      setGmNewGumId]      = useState('');
  const [gmSaving,        setGmSaving]        = useState(false);
  const [gmSaveMsg,       setGmSaveMsg]       = useState('');
  const [gmOrders,        setGmOrders]        = useState<any[]>([]);
  const [gmOrdersLoading, setGmOrdersLoading] = useState(false);
  const [gmRevenue,       setGmRevenue]       = useState(0);

  const fetchGmProducts = async () => {
    setGmProdLoading(true); setGmProdError('');
    try {
      const r = await apiFetch(`${API_BASE}/api/v1/products/?limit=50`);
      if (!r.ok) throw new Error('Failed to load products');
      const d = await r.json(); setGmProducts(d.items ?? []);
    } catch (e) { setGmProdError(e instanceof Error ? e.message : 'Error'); }
    finally { setGmProdLoading(false); }
  };

  const fetchGmOrders = async () => {
    setGmOrdersLoading(true);
    try {
      const r = await apiFetch(`${API_BASE}/api/v1/orders/?limit=100`);
      if (r.ok) {
        const d = await r.json();
        const items = d.items ?? [];
        setGmOrders(items);
        setGmRevenue(items.reduce((s: number, o: any) => s + (o.price_cents ?? 0) / 100, 0));
      }
    } catch { /* ignore */ }
    finally { setGmOrdersLoading(false); }
  };

  const saveGmProduct = async () => {
    if (!gmNewName.trim() || !gmNewPrice.trim()) { setGmSaveMsg('Name and price are required'); return; }
    setGmSaving(true); setGmSaveMsg('');
    try {
      const r = await apiFetch(`${API_BASE}/api/v1/products/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: gmNewName.trim(), price: parseFloat(gmNewPrice), description: gmNewDesc.trim() || undefined, stan_store_product_id: gmNewGumId.trim() || undefined }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail ?? 'Save failed'); }
      setGmSaveMsg('✅ Product saved!');
      setGmNewName(''); setGmNewPrice(''); setGmNewDesc(''); setGmNewGumId('');
      fetchGmProducts();
    } catch (e) { setGmSaveMsg(`❌ ${e instanceof Error ? e.message : 'Error'}`); }
    finally { setGmSaving(false); }
  };

  const fetchPdfIdeas = async () => {
    setGmIdeasLoading(true); setGmIdeasError(''); setGmIdeas([]);
    try {
      const trendingTopics = autoQueueResult?.scripts?.map((s: any) => s.topic) ?? [];
      const r = await apiFetch(`${API_BASE}/api/v1/scripts/pdf-product-ideas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: gmNiche, trending_topics: trendingTopics }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail ?? 'Failed'); }
      const d = await r.json(); setGmIdeas(d.ideas ?? []);
    } catch (e) { setGmIdeasError(e instanceof Error ? e.message : 'Error'); }
    finally { setGmIdeasLoading(false); }
  };

  const renderGumroad = () => {
    const TAB = (id: typeof gmTab, label: string) => (
      <button onClick={() => { setGmTab(id); if (id === 'products') fetchGmProducts(); if (id === 'analytics') { fetchGmProducts(); fetchGmOrders(); } }}
        style={{ padding: '0.5rem 1.25rem', borderRadius: '999px', border: `2px solid #8b5cf6`, background: gmTab === id ? '#8b5cf6' : 'transparent', color: gmTab === id ? '#fff' : '#8b5cf6', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
        {label}
      </button>
    );
    const statusColor = (s: string) => ({ delivered: '#10b981', failed: '#ef4444', generating: '#f59e0b', queued: '#3b82f6' }[s] ?? '#94a3b8');

    return (
      <div className="videos-page">
        <h1>🛒 Gumroad Studio</h1>
        <p className="subtitle">Find trending PDF ideas, manage your products, and track orders & revenue</p>
        <WorkflowSteps steps={[
          { n: 1, label: 'Find trending PDF ideas', detail: 'AI picks hot topics your audience will buy based on what\'s trending' },
          { n: 2, label: 'Create your product', detail: 'Add it to Gumroad and paste the product ID here to track sales' },
          { n: 3, label: 'Promote with a video', detail: 'Use the promo hook to make a video — Generate & Post from Trending' },
          { n: 4, label: 'Track orders & revenue', detail: 'Gumroad pings this app on every sale — see revenue in Analytics tab' },
        ]} />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {TAB('ideas', '💡 Trending PDF Ideas')}
          {TAB('products', '📦 My Products')}
          {TAB('analytics', '📈 Orders & Revenue')}
        </div>

        {/* ── IDEAS TAB ─────────────────────────────────────────────────── */}
        {gmTab === 'ideas' && (
          <div>
            <div className="generator-form" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label>Your Niche</label>
                <select value={gmNiche} onChange={e => setGmNiche(e.target.value)}>
                  <option value="AI tools">💰 AI Tools / Online Business</option>
                  <option value="technology">💻 Technology</option>
                  <option value="education">📚 Education</option>
                  <option value="health">💪 Health & Fitness</option>
                  <option value="side hustles">💸 Side Hustles</option>
                  <option value="finance">📈 Finance / Investing</option>
                  <option value="kids">🧒 Kids & Family</option>
                  <option value="productivity">⚡ Productivity</option>
                  <option value="marketing">📣 Marketing</option>
                </select>
              </div>
              <button className="generate-button" onClick={fetchPdfIdeas} disabled={gmIdeasLoading}>
                {gmIdeasLoading ? '⏳ Finding trending ideas…' : '🔍 Find Trending PDF Ideas to Sell'}
              </button>
              {autoQueueResult?.scripts?.length ? (
                <p style={{ color: '#2a9d5c', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>✅ Using {autoQueueResult.scripts.length} trending topics from your last Auto-Script run to personalise ideas</p>
              ) : (
                <p style={{ color: '#57606a', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>Tip: Run Auto-Script on the Trending page first to anchor ideas to what's actually getting views right now</p>
              )}
              {gmIdeasError && <div className="error-message" style={{ marginTop: '0.75rem' }}>{gmIdeasError}</div>}
            </div>

            {gmIdeas.map((idea, i) => (
              <div key={i} style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: '0.875rem', marginBottom: '1rem', overflow: 'hidden' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', gap: '1rem', flexWrap: 'wrap', cursor: 'pointer' }}
                  onClick={() => setGmExpanded(gmExpanded === i ? null : i)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ background: '#8b5cf6', color: '#fff', borderRadius: '999px', padding: '0.2rem 0.75rem', fontWeight: 700, fontSize: '0.78rem' }}>${idea.price}</span>
                      <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#1f2328' }}>{idea.title}</span>
                    </div>
                    <p style={{ color: '#57606a', fontSize: '0.8125rem', margin: '0.25rem 0 0' }}>{idea.tagline}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '0.375rem', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>🔥 {idea.trending_angle?.split(' ').slice(0,5).join(' ')}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{gmExpanded === i ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {gmExpanded === i && (
                  <div style={{ borderTop: '1px solid #e5e7eb', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '1rem' }}>
                      {/* Chapters */}
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.8rem', color: '#3b82d4', textTransform: 'uppercase', marginBottom: '0.4rem' }}>📄 PDF Chapters</p>
                        {(idea.chapters ?? []).map((ch: string, ci: number) => (
                          <div key={ci} style={{ display: 'flex', gap: '0.5rem', padding: '0.3rem 0', borderBottom: '1px solid #f0f0f0' }}>
                            <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.78rem', flexShrink: 0 }}>{ci+1}.</span>
                            <span style={{ color: '#374151', fontSize: '0.8125rem' }}>{ch}</span>
                          </div>
                        ))}
                      </div>
                      {/* Right column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.75rem' }}>
                          <p style={{ fontWeight: 700, fontSize: '0.78rem', color: '#57606a', textTransform: 'uppercase', margin: '0 0 0.35rem' }}>👥 Target Audience</p>
                          <p style={{ color: '#1f2328', fontSize: '0.8125rem', margin: 0 }}>{idea.target_audience}</p>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.75rem' }}>
                          <p style={{ fontWeight: 700, fontSize: '0.78rem', color: '#57606a', textTransform: 'uppercase', margin: '0 0 0.35rem' }}>🛒 Gumroad Description</p>
                          <p style={{ color: '#1f2328', fontSize: '0.8125rem', margin: 0, lineHeight: 1.5 }}>{idea.gumroad_description}</p>
                          <button onClick={() => navigator.clipboard.writeText(idea.gumroad_description)}
                            style={{ marginTop: '0.5rem', background: 'none', border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.25rem 0.65rem', fontSize: '0.75rem', cursor: 'pointer', color: '#57606a' }}>📋 Copy</button>
                        </div>
                        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '0.5rem', padding: '0.75rem' }}>
                          <p style={{ fontWeight: 700, fontSize: '0.78rem', color: '#d97706', textTransform: 'uppercase', margin: '0 0 0.35rem' }}>🎬 Video Promo Hook</p>
                          <p style={{ color: '#1f2328', fontSize: '0.8125rem', margin: 0, fontStyle: 'italic' }}>"{idea.promo_hook}"</p>
                          <button onClick={() => { setTopic(idea.promo_hook); setNiche(gmNiche); setCurrentPage('scripts'); }}
                            style={{ marginTop: '0.5rem', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none', borderRadius: '0.375rem', padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                            ✍️ Write Script for This →
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Pre-fill product form */}
                    <button onClick={() => { setGmNewName(idea.title); setGmNewPrice(String(idea.price)); setGmNewDesc(idea.gumroad_description); setGmTab('products'); }}
                      style={{ alignSelf: 'flex-start', background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                      📦 Add This to My Products →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── PRODUCTS TAB ──────────────────────────────────────────────── */}
        {gmTab === 'products' && (
          <div>
            {/* Add product form */}
            <div className="generator-form" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#1f2328' }}>➕ Add New Product</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Product Name *</label>
                  <input value={gmNewName} onChange={e => setGmNewName(e.target.value)} placeholder="e.g. AI Tools Beginner Guide" style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.9rem' }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Price (USD) *</label>
                  <input type="number" value={gmNewPrice} onChange={e => setGmNewPrice(e.target.value)} placeholder="27" min="1" style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.9rem' }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Gumroad Product ID <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
                  <input value={gmNewGumId} onChange={e => setGmNewGumId(e.target.value)} placeholder="from Gumroad dashboard" style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.9rem' }} />
                </div>
              </div>
              <div className="form-group" style={{ margin: '0.75rem 0 0' }}>
                <label>Description</label>
                <textarea value={gmNewDesc} onChange={e => setGmNewDesc(e.target.value)} rows={3} placeholder="What's in this PDF? Who is it for?" style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.9rem', resize: 'vertical' }} />
              </div>
              <button className="generate-button" onClick={saveGmProduct} disabled={gmSaving} style={{ marginTop: '0.75rem' }}>
                {gmSaving ? '⏳ Saving…' : '💾 Save Product'}
              </button>
              {gmSaveMsg && <p style={{ color: gmSaveMsg.startsWith('✅') ? '#059669' : '#dc2626', fontSize: '0.875rem', marginTop: '0.5rem' }}>{gmSaveMsg}</p>}
            </div>

            {/* Products list */}
            {gmProdLoading ? <p style={{ color: '#94a3b8' }}>Loading…</p> : gmProdError ? <p style={{ color: '#dc2626' }}>{gmProdError}</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {gmProducts.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>No products yet — add one above or generate ideas on the PDF Ideas tab</p>}
                {gmProducts.map((p: any) => (
                  <div key={p.id} style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, color: '#1f2328' }}>{p.name}</span>
                        <span style={{ background: p.active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: p.active ? '#059669' : '#dc2626', border: `1px solid ${p.active ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}>{p.active ? 'Active' : 'Inactive'}</span>
                      </div>
                      {p.description && <p style={{ color: '#57606a', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{p.description}</p>}
                      {p.stan_store_product_id && <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0.2rem 0 0' }}>Gumroad ID: {p.stan_store_product_id}</p>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#059669' }}>${Number(p.price).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS TAB ─────────────────────────────────────────────── */}
        {gmTab === 'analytics' && (
          <div>
            {/* Revenue summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Total Revenue', value: `$${gmRevenue.toFixed(2)}`, color: '#059669' },
                { label: 'Total Orders', value: gmOrders.length, color: '#3b82d4' },
                { label: 'Delivered', value: gmOrders.filter((o:any) => o.status === 'delivered').length, color: '#10b981' },
                { label: 'Failed', value: gmOrders.filter((o:any) => o.status === 'failed').length, color: '#ef4444' },
                { label: 'Avg Order Value', value: gmOrders.length ? `$${(gmRevenue / gmOrders.length).toFixed(2)}` : '—', color: '#8b5cf6' },
              ].map(c => (
                <div key={c.label} style={{ background: `${c.color}10`, border: `1px solid ${c.color}30`, borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: c.color }}>{c.value}</div>
                  <div style={{ color: '#57606a', fontSize: '0.78rem', marginTop: '0.2rem' }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Webhook setup reminder */}
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
              <p style={{ fontWeight: 700, color: '#d97706', margin: '0 0 0.35rem' }}>⚙️ Connect Gumroad Webhook to receive live orders</p>
              <p style={{ color: '#57606a', fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>In Gumroad: Settings → Advanced → Webhooks → Add this URL:</p>
              <code style={{ background: 'rgba(0,0,0,0.06)', padding: '0.35rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8rem', display: 'block', wordBreak: 'break-all', color: '#1f2328' }}>
                https://ai-content-backend.victoriousmeadow-edd1d4e3.eastus.azurecontainerapps.io/api/v1/orders/webhook/gumroad
              </code>
            </div>

            {/* Orders table */}
            {gmOrdersLoading ? <p style={{ color: '#94a3b8' }}>Loading orders…</p> : (
              <div>
                <h2 style={{ fontSize: '1rem', color: '#1f2328', marginBottom: '0.75rem' }}>Recent Orders ({gmOrders.length})</h2>
                {gmOrders.length === 0 ? (
                  <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>No orders yet — connect the Gumroad webhook above to start receiving orders automatically</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {gmOrders.slice(0, 50).map((o: any) => (
                      <div key={o.id} style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#1f2328', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customer_name || o.customer_email}</div>
                          <div style={{ color: '#57606a', fontSize: '0.78rem', marginTop: '0.15rem' }}>{o.product_name ?? 'Unknown product'} · {new Date(o.created_at).toLocaleDateString()}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                          <span style={{ fontWeight: 800, color: '#059669' }}>${((o.price_cents ?? 0) / 100).toFixed(2)}</span>
                          <span style={{ background: `${statusColor(o.status)}18`, color: statusColor(o.status), border: `1px solid ${statusColor(o.status)}40`, borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}>{o.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── X & Email Funnel page ─────────────────────────────────────────────────
  const [fnTab,          setFnTab]          = useState<'leads'|'x'|'email'|'schedule'>('leads');
  const [fnNiche,        setFnNiche]        = useState('AI tools');
  const [fnLeads,        setFnLeads]        = useState<any[]>([]);
  const [fnLeadsLoading, setFnLeadsLoading] = useState(false);
  const [fnLeadsError,   setFnLeadsError]   = useState('');
  const [fnLeadExpanded, setFnLeadExpanded] = useState<number|null>(null);
  const [fnXTopic,       setFnXTopic]       = useState('');
  const [fnXStyle,       setFnXStyle]       = useState('educational');
  const [fnXTweets,      setFnXTweets]      = useState<string[]>([]);
  const [fnXLoading,     setFnXLoading]     = useState(false);
  const [fnXError,       setFnXError]       = useState('');
  const [fnXCopied,      setFnXCopied]      = useState<number|null>(null);
  const [fnMagnet,       setFnMagnet]       = useState('');
  const [fnProduct,      setFnProduct]      = useState('');
  const [fnProductPrice, setFnProductPrice] = useState('$29');
  const [fnEmails,       setFnEmails]       = useState<any[]>([]);
  const [fnEmailLoading, setFnEmailLoading] = useState(false);
  const [fnEmailError,   setFnEmailError]   = useState('');
  const [fnEmailExp,     setFnEmailExp]     = useState<number|null>(null);
  const [fnEmailCopied,  setFnEmailCopied]  = useState<number|null>(null);

  const fetchLeadMagnets = async () => {
    setFnLeadsLoading(true); setFnLeadsError(''); setFnLeads([]);
    try {
      const trendingTopics = autoQueueResult?.scripts?.map((s: any) => s.topic) ?? [];
      const r = await apiFetch(`${API_BASE}/api/v1/scripts/lead-magnet-ideas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: fnNiche, trending_topics: trendingTopics }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail ?? 'Failed'); }
      const d = await r.json(); setFnLeads(d.ideas ?? []);
    } catch (e) { setFnLeadsError(e instanceof Error ? e.message : 'Error'); }
    finally { setFnLeadsLoading(false); }
  };

  const generateXThread = async () => {
    if (!fnXTopic.trim()) { setFnXError('Enter a topic first'); return; }
    setFnXLoading(true); setFnXError(''); setFnXTweets([]);
    try {
      const r = await apiFetch(`${API_BASE}/api/v1/scripts/x-thread`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: fnXTopic.trim(), niche: fnNiche, style: fnXStyle }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail ?? 'Failed'); }
      const d = await r.json(); setFnXTweets(d.tweets ?? []);
    } catch (e) { setFnXError(e instanceof Error ? e.message : 'Error'); }
    finally { setFnXLoading(false); }
  };

  const generateEmailSeq = async () => {
    if (!fnMagnet.trim() || !fnProduct.trim()) { setFnEmailError('Fill in lead magnet and product name'); return; }
    setFnEmailLoading(true); setFnEmailError(''); setFnEmails([]);
    try {
      const r = await apiFetch(`${API_BASE}/api/v1/scripts/email-sequence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: fnNiche, lead_magnet: fnMagnet.trim(), product_name: fnProduct.trim(), product_price: fnProductPrice }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail ?? 'Failed'); }
      const d = await r.json(); setFnEmails(d.emails ?? []);
    } catch (e) { setFnEmailError(e instanceof Error ? e.message : 'Error'); }
    finally { setFnEmailLoading(false); }
  };

  const copyTweet = (i: number, text: string) => {
    navigator.clipboard.writeText(text); setFnXCopied(i); setTimeout(() => setFnXCopied(null), 2000);
  };

  const copyEmail = (i: number, email: any) => {
    navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}\n\nCTA: ${email.cta}`);
    setFnEmailCopied(i); setTimeout(() => setFnEmailCopied(null), 2000);
  };

  const renderFunnel = () => {
    const TAB = (id: typeof fnTab, label: string) => (
      <button onClick={() => setFnTab(id)}
        style={{ padding: '0.5rem 1.25rem', borderRadius: '999px', border: '2px solid #1da1f2', background: fnTab === id ? '#1da1f2' : 'transparent', color: fnTab === id ? '#fff' : '#1da1f2', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
        {label}
      </button>
    );

    const WEEKLY_SCHEDULE = [
      { day: 'Mon', type: 'SQL / Tech Tip', hook: 'Share a quick tip from your niche' },
      { day: 'Tue', type: 'Azure / Cloud Tip', hook: 'Something people can use today' },
      { day: 'Wed', type: 'AI Agent Insight', hook: 'A diagram, workflow, or architecture' },
      { day: 'Thu', type: 'Career Advice', hook: 'Something relatable about your journey' },
      { day: 'Fri', type: 'Architecture Breakdown', hook: 'Show how something complex works simply' },
      { day: 'Sat', type: 'Project Lesson', hook: 'What you learned from a real project' },
      { day: 'Sun', type: '🎯 Lead Magnet Promo', hook: 'Drive followers to your free resource + email signup' },
    ];

    return (
      <div className="videos-page">
        <h1>📧 X & Email Funnel</h1>
        <p className="subtitle">Build followers on X, convert them to email subscribers, then sell your Gumroad products on autopilot</p>

        <WorkflowSteps steps={[
          { n: 1, label: 'Create a lead magnet', detail: 'A free PDF, checklist or template people give their email for' },
          { n: 2, label: 'Post X threads daily', detail: 'Value-packed threads drive followers to your lead magnet link' },
          { n: 3, label: 'Subscriber joins email list', detail: 'Beehiiv or ConvertKit delivers the free guide automatically' },
          { n: 4, label: '5-email sequence runs', detail: 'Automated emails nurture subscribers and pitch your Gumroad product on Day 12' },
        ]} />

        {/* Funnel diagram */}
        <div style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: '0.875rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 700, color: '#1f2328', margin: '0 0 0.75rem', fontSize: '0.9rem' }}>📊 Your Funnel at a Glance</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
            {[
              { icon: '𝕏', label: 'X Thread', color: '#1da1f2' },
              { icon: '→', label: '', color: '#94a3b8' },
              { icon: '🎁', label: 'Free Lead Magnet', color: '#8b5cf6' },
              { icon: '→', label: '', color: '#94a3b8' },
              { icon: '📬', label: 'Email Signup', color: '#059669' },
              { icon: '→', label: '', color: '#94a3b8' },
              { icon: '✉️', label: '5-Email Sequence', color: '#f59e0b' },
              { icon: '→', label: '', color: '#94a3b8' },
              { icon: '🛒', label: 'Gumroad Sale', color: '#ef4444' },
            ].map((s, i) => s.label ? (
              <span key={i} style={{ background: `${s.color}15`, border: `1px solid ${s.color}40`, borderRadius: '999px', padding: '0.3rem 0.85rem', fontWeight: 700, color: s.color, whiteSpace: 'nowrap' }}>{s.icon} {s.label}</span>
            ) : <span key={i} style={{ color: s.color, fontWeight: 700, fontSize: '1rem' }}>{s.icon}</span>)}
          </div>
          <p style={{ color: '#57606a', fontSize: '0.78rem', margin: '0.75rem 0 0' }}>
            At 5 new subscribers/day → ~1,800/year. The email list is the business asset — followers bring attention, subscribers become customers.
          </p>
        </div>

        {/* Niche selector */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1f2328', flexShrink: 0 }}>Your Niche:</label>
          <select value={fnNiche} onChange={e => setFnNiche(e.target.value)}
            style={{ padding: '0.5rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.875rem' }}>
            <option value="AI tools">💰 AI Tools / Online Business</option>
            <option value="data engineering">🗄️ Data Engineering / SQL</option>
            <option value="Azure / cloud">☁️ Azure / Cloud Architecture</option>
            <option value="ServiceNow">⚙️ ServiceNow</option>
            <option value="technology">💻 Technology</option>
            <option value="education">📚 Education</option>
            <option value="side hustles">💸 Side Hustles</option>
            <option value="finance">📈 Finance / Investing</option>
            <option value="productivity">⚡ Productivity</option>
            <option value="marketing">📣 Marketing</option>
          </select>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {TAB('leads', '🎁 Lead Magnets')}
          {TAB('x', '𝕏 X Threads')}
          {TAB('email', '✉️ Email Sequence')}
          {TAB('schedule', '📅 Weekly Schedule')}
        </div>

        {/* ── LEAD MAGNETS TAB ─────────────────────────────────────────── */}
        {fnTab === 'leads' && (
          <div>
            <div className="generator-form" style={{ marginBottom: '1.5rem' }}>
              <button className="generate-button" onClick={fetchLeadMagnets} disabled={fnLeadsLoading}>
                {fnLeadsLoading ? '⏳ Generating ideas…' : '🎁 Generate Lead Magnet Ideas'}
              </button>
              {autoQueueResult?.scripts?.length ? (
                <p style={{ color: '#2a9d5c', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>✅ Using {autoQueueResult.scripts.length} trending topics to personalise ideas</p>
              ) : (
                <p style={{ color: '#57606a', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>Tip: Run Auto-Script on the Trending page first to anchor ideas to what's getting views</p>
              )}
              {fnLeadsError && <div className="error-message" style={{ marginTop: '0.75rem' }}>{fnLeadsError}</div>}
            </div>

            <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
              <p style={{ fontWeight: 700, color: '#7c3aed', margin: '0 0 0.5rem', fontSize: '0.875rem' }}>💡 Example Lead Magnets for Your Background</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {['Azure SQL Health Check Checklist', 'Data Engineer Interview Kit', 'AI Agent Architecture Templates', 'SQL Performance Playbook', '30 Enterprise AI Agent Use Cases', 'ServiceNow + Azure AI Blueprint'].map(m => (
                  <button key={m} onClick={() => setFnMagnet(m)}
                    style={{ background: '#fff', border: '1px solid #d0d7de', borderRadius: '999px', padding: '0.3rem 0.75rem', fontSize: '0.78rem', cursor: 'pointer', color: '#374151', fontWeight: 600 }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {fnLeads.map((idea, i) => (
              <div key={i} style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: '0.875rem', marginBottom: '0.875rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', cursor: 'pointer', flexWrap: 'wrap', gap: '0.5rem' }}
                  onClick={() => setFnLeadExpanded(fnLeadExpanded === i ? null : i)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ background: '#8b5cf6', color: '#fff', borderRadius: '0.375rem', padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}>{idea.format}</span>
                      <span style={{ fontWeight: 800, color: '#1f2328', fontSize: '0.9375rem' }}>{idea.title}</span>
                    </div>
                    <p style={{ color: '#57606a', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>{idea.why_it_works}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ background: 'rgba(5,150,105,0.1)', color: '#059669', border: '1px solid rgba(5,150,105,0.3)', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}>{idea.expected_conversion}</span>
                    <span style={{ color: '#94a3b8' }}>{fnLeadExpanded === i ? '▲' : '▼'}</span>
                  </div>
                </div>
                {fnLeadExpanded === i && (
                  <div style={{ borderTop: '1px solid #e5e7eb', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.75rem' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.78rem', color: '#57606a', textTransform: 'uppercase', margin: '0 0 0.35rem' }}>🏠 Landing Page Headline</p>
                      <p style={{ color: '#1f2328', fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{idea.landing_page_headline}</p>
                    </div>
                    <div style={{ background: 'rgba(29,161,242,0.06)', border: '1px solid rgba(29,161,242,0.25)', borderRadius: '0.5rem', padding: '0.75rem' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.78rem', color: '#1da1f2', textTransform: 'uppercase', margin: '0 0 0.35rem' }}>𝕏 X Post Hook</p>
                      <p style={{ color: '#1f2328', fontSize: '0.875rem', margin: 0, fontStyle: 'italic' }}>{idea.hook}</p>
                      <button onClick={() => navigator.clipboard.writeText(idea.hook)}
                        style={{ marginTop: '0.5rem', background: 'none', border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.25rem 0.65rem', fontSize: '0.75rem', cursor: 'pointer', color: '#57606a' }}>📋 Copy</button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button onClick={() => { setFnMagnet(idea.title); setFnTab('email'); }}
                        style={{ background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.55rem 1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                        ✉️ Build Email Sequence for This →
                      </button>
                      <button onClick={() => { setFnXTopic(idea.title); setFnTab('x'); }}
                        style={{ background: 'linear-gradient(135deg,#1da1f2,#0d8fd9)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.55rem 1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                        𝕏 Write X Thread for This →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── X THREADS TAB ────────────────────────────────────────────── */}
        {fnTab === 'x' && (
          <div>
            <div className="generator-form" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label>Thread Topic *</label>
                <input value={fnXTopic} onChange={e => setFnXTopic(e.target.value)}
                  placeholder="e.g. 5 Azure SQL mistakes that cost companies thousands"
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.9rem' }} />
              </div>
              <div className="form-group">
                <label>Thread Style</label>
                <select value={fnXStyle} onChange={e => setFnXStyle(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.9rem' }}>
                  <option value="educational">📚 Educational — step-by-step tips</option>
                  <option value="story">📖 Story — personal experience/journey</option>
                  <option value="tip-list">⚡ Tip List — quick wins numbered list</option>
                  <option value="controversial">🔥 Controversial — challenge a common belief</option>
                </select>
              </div>
              <button className="generate-button" onClick={generateXThread} disabled={fnXLoading}>
                {fnXLoading ? '⏳ Writing thread…' : '𝕏 Generate X Thread'}
              </button>
              {fnXError && <div className="error-message" style={{ marginTop: '0.75rem' }}>{fnXError}</div>}
            </div>

            {fnXTweets.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <p style={{ fontWeight: 700, color: '#1f2328', margin: 0 }}>𝕏 Your Thread ({fnXTweets.length} tweets)</p>
                  <button onClick={() => navigator.clipboard.writeText(fnXTweets.join('\n\n'))}
                    style={{ background: '#1da1f2', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                    📋 Copy Full Thread
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {fnXTweets.map((tweet, i) => (
                    <div key={i} style={{ background: i === 0 ? 'rgba(29,161,242,0.06)' : '#f7f8fa', border: `1px solid ${i === 0 ? 'rgba(29,161,242,0.3)' : '#e5e7eb'}`, borderRadius: '0.75rem', padding: '0.875rem 1.25rem', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <p style={{ color: '#1f2328', fontSize: '0.875rem', margin: 0, lineHeight: 1.6, flex: 1, whiteSpace: 'pre-wrap' }}>{tweet}</p>
                        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ color: tweet.length > 280 ? '#ef4444' : '#94a3b8', fontSize: '0.72rem', fontWeight: 700 }}>{tweet.length}/280</span>
                          <button onClick={() => copyTweet(i, tweet)}
                            style={{ background: fnXCopied === i ? '#1da1f2' : 'none', color: fnXCopied === i ? '#fff' : '#94a3b8', border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.2rem 0.55rem', fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {fnXCopied === i ? '✓' : '📋'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '1rem', background: 'rgba(29,161,242,0.06)', border: '1px solid rgba(29,161,242,0.2)', borderRadius: '0.75rem', padding: '0.875rem 1.25rem' }}>
                  <p style={{ fontWeight: 700, color: '#1da1f2', margin: '0 0 0.35rem', fontSize: '0.875rem' }}>⚡ Schedule with Buffer</p>
                  <p style={{ color: '#57606a', fontSize: '0.8rem', margin: 0 }}>Copy each tweet above and schedule via <a href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer" style={{ color: '#1da1f2' }}>Buffer →</a> or <a href="https://typefully.com" target="_blank" rel="noopener noreferrer" style={{ color: '#1da1f2' }}>Typefully →</a> for the best engagement time (Tue–Thu, 9–11am)</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EMAIL SEQUENCE TAB ───────────────────────────────────────── */}
        {fnTab === 'email' && (
          <div>
            <div className="generator-form" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label>Lead Magnet Name *</label>
                <input value={fnMagnet} onChange={e => setFnMagnet(e.target.value)}
                  placeholder="e.g. 30 Enterprise AI Agent Use Cases"
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.9rem' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Gumroad Product to Pitch *</label>
                  <input value={fnProduct} onChange={e => setFnProduct(e.target.value)}
                    placeholder="e.g. ServiceNow + Azure AI Blueprint"
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.9rem' }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Product Price</label>
                  <input value={fnProductPrice} onChange={e => setFnProductPrice(e.target.value)}
                    placeholder="$29"
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.9rem' }} />
                </div>
              </div>
              <button className="generate-button" onClick={generateEmailSeq} disabled={fnEmailLoading} style={{ marginTop: '0.75rem' }}>
                {fnEmailLoading ? '⏳ Writing sequence…' : '✉️ Generate 5-Email Sequence'}
              </button>
              {fnEmailError && <div className="error-message" style={{ marginTop: '0.75rem' }}>{fnEmailError}</div>}
            </div>

            {fnEmails.length > 0 && (
              <div>
                <p style={{ fontWeight: 700, color: '#1f2328', margin: '0 0 0.75rem' }}>✉️ Your 5-Email Welcome Sequence</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {fnEmails.map((email, i) => (
                    <div key={i} style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: '0.875rem', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', cursor: 'pointer', flexWrap: 'wrap', gap: '0.5rem' }}
                        onClick={() => setFnEmailExp(fnEmailExp === i ? null : i)}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
                          <span style={{ background: i === 4 ? '#ef4444' : '#059669', color: '#fff', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>Day {email.day}</span>
                          <div>
                            <p style={{ fontWeight: 700, color: '#1f2328', margin: 0, fontSize: '0.875rem' }}>{email.subject}</p>
                            <p style={{ color: '#57606a', fontSize: '0.78rem', margin: '0.1rem 0 0' }}>{email.preview}</p>
                          </div>
                        </div>
                        <span style={{ color: '#94a3b8' }}>{fnEmailExp === i ? '▲' : '▼'}</span>
                      </div>
                      {fnEmailExp === i && (
                        <div style={{ borderTop: '1px solid #e5e7eb', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.875rem', whiteSpace: 'pre-wrap', fontSize: '0.875rem', color: '#1f2328', lineHeight: 1.65 }}>{email.body}</div>
                          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '0.5rem', padding: '0.65rem 1rem' }}>
                            <span style={{ fontWeight: 700, color: '#d97706', fontSize: '0.78rem' }}>CTA: </span>
                            <span style={{ color: '#1f2328', fontSize: '0.875rem' }}>{email.cta}</span>
                          </div>
                          <button onClick={() => copyEmail(i, email)}
                            style={{ alignSelf: 'flex-start', background: fnEmailCopied === i ? '#059669' : 'none', color: fnEmailCopied === i ? '#fff' : '#57606a', border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.35rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                            {fnEmailCopied === i ? '✅ Copied!' : '📋 Copy Email'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '1rem', background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: '0.75rem', padding: '0.875rem 1.25rem' }}>
                  <p style={{ fontWeight: 700, color: '#059669', margin: '0 0 0.35rem' }}>📬 Add to Beehiiv or ConvertKit</p>
                  <p style={{ color: '#57606a', fontSize: '0.8rem', margin: 0 }}>
                    Copy each email above into your email platform's automation flow. Set up a 5-email sequence triggered when someone subscribes.{' '}
                    <a href="https://www.beehiiv.com" target="_blank" rel="noopener noreferrer" style={{ color: '#059669' }}>Beehiiv →</a>{' '}
                    <a href="https://convertkit.com" target="_blank" rel="noopener noreferrer" style={{ color: '#059669' }}>ConvertKit →</a>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── WEEKLY SCHEDULE TAB ──────────────────────────────────────── */}
        {fnTab === 'schedule' && (
          <div>
            <div style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: '0.875rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <p style={{ fontWeight: 700, color: '#1f2328', margin: '0 0 0.75rem' }}>📅 Recommended Weekly X Schedule</p>
              <p style={{ color: '#57606a', fontSize: '0.8125rem', margin: '0 0 1rem' }}>Spend one hour on Sunday — batch-create a week of content using the X Threads tab, then schedule all 7 in Buffer or Typefully.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {WEEKLY_SCHEDULE.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', padding: '0.75rem 1rem', background: d.day === 'Sun' ? 'rgba(139,92,246,0.06)' : '#fff', border: `1px solid ${d.day === 'Sun' ? 'rgba(139,92,246,0.25)' : '#e5e7eb'}`, borderRadius: '0.5rem' }}>
                    <span style={{ fontWeight: 800, color: d.day === 'Sun' ? '#8b5cf6' : '#3b82d4', minWidth: '36px', fontSize: '0.875rem' }}>{d.day}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, color: '#1f2328', margin: 0, fontSize: '0.875rem' }}>{d.type}</p>
                      <p style={{ color: '#57606a', fontSize: '0.78rem', margin: '0.15rem 0 0' }}>{d.hook}</p>
                    </div>
                    <button onClick={() => { setFnXTopic(d.type); setFnTab('x'); }}
                      style={{ background: 'linear-gradient(135deg,#1da1f2,#0d8fd9)', color: '#fff', border: 'none', borderRadius: '0.375rem', padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      ✍️ Write Thread
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
              {[
                { name: 'Buffer', desc: 'Schedule across X, Instagram, Facebook, LinkedIn — already connected', url: 'https://publish.buffer.com', color: '#1da1f2' },
                { name: 'Typefully', desc: 'Best for X threads — shows thread preview, analytics, optimal timing', url: 'https://typefully.com', color: '#1f2328' },
                { name: 'Beehiiv', desc: 'Newsletter + email automation + built-in referral program', url: 'https://www.beehiiv.com', color: '#059669' },
                { name: 'ConvertKit', desc: 'Email sequences + landing pages + subscriber tagging', url: 'https://convertkit.com', color: '#f59e0b' },
              ].map(t => (
                <a key={t.name} href={t.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', textDecoration: 'none' }}>
                  <p style={{ fontWeight: 800, color: t.color, margin: '0 0 0.35rem', fontSize: '0.9375rem' }}>{t.name} →</p>
                  <p style={{ color: '#57606a', fontSize: '0.8rem', margin: 0 }}>{t.desc}</p>
                </a>
              ))}
            </div>

            <div style={{ marginTop: '1.5rem', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '0.875rem', padding: '1.25rem' }}>
              <p style={{ fontWeight: 700, color: '#7c3aed', margin: '0 0 0.75rem' }}>🔄 Repurpose Everything — 1 idea, 4 pieces of content</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {[
                  ['✍️', 'Write a post about a ServiceNow AI Agent or Azure architecture'],
                  ['𝕏', 'Turn it into an X thread (use the X Threads tab above)'],
                  ['📬', 'Expand it into a Beehiiv newsletter issue'],
                  ['🛒', 'Bundle it into a future Gumroad PDF guide'],
                ].map(([icon, text], i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: i < 3 ? '1px solid rgba(139,92,246,0.1)' : 'none' }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icon}</span>
                    <span style={{ color: '#374151', fontSize: '0.875rem' }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Monetize page ─────────────────────────────────────────────────────────
  const renderMonetize = () => (
    <div className="videos-page">
      <h1>💰 Monetization Hub</h1>
      <p className="subtitle">Ways to make money with this platform — from day one</p>

      {/* Affiliate banner */}
      <div style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(59,130,246,0.15))', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#a78bfa', marginBottom: '0.5rem' }}>🎙️ Earn with ElevenLabs Affiliate</h2>
        <p style={{ color: '#637381', marginBottom: '1rem' }}>Share ElevenLabs with other creators and earn commission on every signup. It powers the voiceovers in every video you publish.</p>
        <a href="https://elevenlabs.io/affiliate" target="_blank" rel="noopener noreferrer"
          className="publish-button" style={{ display: 'inline-block', textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontSize: '1rem', textAlign: 'center' }}>
          🔗 ElevenLabs Affiliate Link →
        </a>
        <p style={{ color: '#637381', fontSize: '0.8125rem', marginTop: '0.75rem' }}>elevenlabs.io/affiliate</p>
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
            <h3 style={{ color: '#1c2b33', fontSize: '1.1rem' }}>{stream.icon} {stream.title}</h3>
            <span style={{ background: `${stream.color}22`, color: stream.color, borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.8125rem', fontWeight: 700 }}>{stream.est}</span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {stream.steps.map((s, j) => (
              <li key={j} style={{ color: '#637381', fontSize: '0.875rem', padding: '0.25rem 0 0.25rem 1.25rem', position: 'relative', lineHeight: 1.5 }}>
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

      <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #b7e4cc', borderRadius: '0.75rem', padding: '1.25rem', marginTop: '1rem' }}>
        <h3 style={{ color: '#10b981', marginBottom: '0.5rem' }}>📊 Realistic Income Timeline</h3>
        {[
          { month: 'Month 1–2', income: '$0–50', action: 'Setup, post daily, build audience. Focus on affiliate links.' },
          { month: 'Month 3–4', income: '$50–300', action: 'First affiliate commissions + YouTube unlocks. Scale to 5 videos/day.' },
          { month: 'Month 5–6', income: '$300–1,000', action: 'Brand deals start. Sell first digital product. TikTok fund active.' },
          { month: 'Month 7–12', income: '$1,000–5,000', action: 'Sponsorships + course income + YouTube ads. Fully automated.' },
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0', borderBottom: i < 3 ? '1px solid rgba(148,163,184,0.1)' : 'none', flexWrap: 'wrap' }}>
            <span style={{ color: '#10b981', fontWeight: 700, minWidth: '110px', fontSize: '0.875rem' }}>{row.month}</span>
            <span style={{ color: '#2a9d5c', fontWeight: 700, minWidth: '90px', fontSize: '0.875rem' }}>{row.income}</span>
            <span style={{ color: '#637381', fontSize: '0.875rem', flex: 1 }}>{row.action}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const getTopicIdeas = async () => {
    setLoadingIdeas(true);
    setTopPerfDataAvailable(false);
    setTopPerfNote('');
    setError('');
    
    try {
      const response = await apiFetch(`${API_BASE}/api/v1/scripts/topic-ideas`, {
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
    setTopPerfNote('');
  };

  const getTopPerformerIdeas = async () => {
    setTopPerfLoading(true);
    setTopPerfDataAvailable(false);
    setTopPerfNote('');
    setError('');
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/generate-from-top-performers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, count: 10 }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const data = await res.json();
      setTopicIdeas(data.ideas ?? []);
      setTopPerfDataAvailable(data.data_available ?? false);
      setTopPerfNote(data.note ?? '');
      setShowIdeas(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load top performer ideas');
    } finally {
      setTopPerfLoading(false);
    }
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
      
      const response = await apiFetch(`${API_BASE}/api/v1/scripts/generate?${params}`, {
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
      const response = await apiFetch(`${API_BASE}/api/v1/scripts/blueprint`, {
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

  // ── AI Visuals / DALL·E 3 state ──────────────────────────────────────────
  const [oaTopic, setOaTopic]           = useState('');
  const [oaNiche, setOaNiche]           = useState('AI tools');
  const [oaPrompt, setOaPrompt]         = useState('');
  const [oaAvatarDesc, setOaAvatarDesc] = useState('professional AI content creator, clean neutral background, confident pose');
  const [oaAspect, setOaAspect]         = useState('16:9');
  const [oaStyle, setOaStyle]           = useState('youtube_thumbnail');
  const [oaTab, setOaTab]               = useState<'thumbnail' | 'social_pack' | 'image' | 'avatar'>('thumbnail');
  const [oaLoading, setOaLoading]       = useState(false);
  const [oaError, setOaError]           = useState('');
  const [oaImages, setOaImages]         = useState<AIImage[]>([]);
  const [oaPack, setOaPack]             = useState<{youtube_thumbnail:AIImage|null;shorts_tiktok_thumbnail:AIImage|null;instagram_square:AIImage|null;topic:string;niche:string;provider:string}|null>(null);
  const [oaProvider, setOaProvider]     = useState('');

  const runOaThumbnail = async () => {
    if (!oaTopic.trim()) { setOaError('Enter a video topic first'); return; }
    setOaLoading(true); setOaError(''); setOaImages([]);
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/openart/thumbnail`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: oaTopic.trim(), niche: oaNiche, style: oaStyle, aspect_ratio: oaAspect }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const data = await res.json();
      setOaImages(data.images ?? []);
      setOaProvider(data.provider ?? '');
    } catch (err) { setOaError(err instanceof Error ? err.message : 'Generation failed'); }
    finally { setOaLoading(false); }
  };

  const runOaSocialPack = async () => {
    if (!oaTopic.trim()) { setOaError('Enter a video topic first'); return; }
    setOaLoading(true); setOaError(''); setOaPack(null);
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/openart/social-pack`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: oaTopic.trim(), niche: oaNiche }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const data = await res.json();
      setOaPack(data);
      setOaProvider(data.provider ?? '');
    } catch (err) { setOaError(err instanceof Error ? err.message : 'Generation failed'); }
    finally { setOaLoading(false); }
  };

  const runOaImage = async () => {
    if (!oaPrompt.trim()) { setOaError('Enter a prompt first'); return; }
    setOaLoading(true); setOaError(''); setOaImages([]);
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/openart/image`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: oaPrompt.trim(), style_preset: oaStyle || null, aspect_ratio: oaAspect, n: 2 }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const data = await res.json();
      setOaImages(data.images ?? []);
      setOaProvider(data.provider ?? '');
    } catch (err) { setOaError(err instanceof Error ? err.message : 'Generation failed'); }
    finally { setOaLoading(false); }
  };

  const runOaAvatar = async () => {
    setOaLoading(true); setOaError(''); setOaImages([]);
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/openart/avatar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: oaAvatarDesc }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const data = await res.json();
      setOaImages(data.images ?? []);
      setOaProvider(data.provider ?? '');
    } catch (err) { setOaError(err instanceof Error ? err.message : 'Generation failed'); }
    finally { setOaLoading(false); }
  };

  const renderAIImageGrid = (images: AIImage[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
      {images.map((img, i) => (
        <div key={i} style={{ background: '#f4f6f8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', overflow: 'hidden' }}>
          <img src={img.url} alt={`AI image ${i+1}`} style={{ width: '100%', display: 'block', maxHeight: '320px', objectFit: 'cover' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div style={{ padding: '0.75rem' }}>
            <p style={{ color: '#637381', fontSize: '0.73rem', margin: '0 0 0.5rem', lineHeight: 1.4 }}>{img.revised_prompt?.slice(0, 100)}…</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <a href={img.url} target="_blank" rel="noopener noreferrer" download
                className="video-download-link" style={{ flex: 1, textAlign: 'center', fontSize: '0.8125rem', padding: '0.35rem 0.5rem' }}>
                ⬇️ Download
              </a>
              <button onClick={() => navigator.clipboard.writeText(img.url)}
                style={{ flex: 1, background: 'rgba(148,163,184,0.1)', border: '1px solid #e3e8ef', color: '#637381', borderRadius: '0.375rem', padding: '0.35rem 0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                📋 Copy URL
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const nicheOptions = [
    ["AI tools","💰 AI Tools / Online Business"],["technology","💰 Technology"],
    ["education","💰 Education"],["finance","💰 Finance / Investing"],
    ["health","💰 Health & Fitness"],["side hustles","💰 Side Hustles"],
    ["gaming","🎮 Gaming"],["beauty","💄 Beauty & Fashion"],
    ["food","🍕 Food & Cooking"],["travel","✈️ Travel"],
    ["motivation","🔥 Motivation & Self-Help"],["kids","🧒 Kids & Family"],
  ];

  const renderVisuals = () => (
    <div className="videos-page">
      <h1>🎨 AI Visuals — Thumbnails & Images</h1>
      <p className="subtitle">
        Generate eye-catching thumbnails, social media packs, and consistent AI avatars — powered by DALL·E 3 HD.{' '}
        {oaProvider && <span style={{ color: '#2a9d5c', fontWeight: 600 }}>Active: {oaProvider}</span>}
      </p>

      {/* Info banner */}
      <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#a78bfa', fontWeight: 700, margin: '0 0 0.35rem', fontSize: '0.9375rem' }}>🎨 DALL·E 3 HD Image Generation</p>
          <p style={{ color: '#637381', fontSize: '0.8125rem', margin: 0, lineHeight: 1.5 }}>
            Uses your existing <strong style={{ color: '#1c2b33' }}>OPENAI_API_KEY</strong> — no extra key needed.
            Cost: ~$0.04–0.08 per image. Generates 1792×1024 (16:9), 1024×1792 (9:16), or 1024×1024 (1:1).
          </p>
        </div>
        <a href="https://platform.openai.com/docs/guides/images" target="_blank" rel="noopener noreferrer"
          className="video-download-link" style={{ whiteSpace: 'nowrap', fontSize: '0.875rem', padding: '0.45rem 1rem', alignSelf: 'center' }}>
          DALL·E 3 Docs →
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {([
          ['thumbnail',   '🖼️ YouTube Thumbnail'],
          ['social_pack', '📦 Social Pack (3-in-1)'],
          ['image',       '✨ Custom Image'],
          ['avatar',      '🤖 AI Avatar'],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => { setOaTab(t); setOaError(''); setOaImages([]); setOaPack(null); }}
            style={{ padding: '0.55rem 1.25rem', borderRadius: '999px',
              border: `2px solid #a78bfa`,
              background: oaTab === t ? '#a78bfa' : 'transparent',
              color: oaTab === t ? '#fff' : '#a78bfa',
              fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="generator-form">
        {/* Shared: topic + niche */}
        {(oaTab === 'thumbnail' || oaTab === 'social_pack') && (
          <>
            <div className="form-group">
              <label>Video Topic *</label>
              <input type="text" value={oaTopic} onChange={e => setOaTopic(e.target.value)}
                placeholder="e.g. 5 AI Tools to Make Money Online in 2025" disabled={oaLoading} />
            </div>
            <div className="form-group">
              <label>Niche</label>
              <select value={oaNiche} onChange={e => setOaNiche(e.target.value)} disabled={oaLoading}>
                {nicheOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </>
        )}

        {/* Thumbnail extras */}
        {oaTab === 'thumbnail' && (
          <>
            <div className="form-group">
              <label>Style</label>
              <select value={oaStyle} onChange={e => setOaStyle(e.target.value)} disabled={oaLoading}>
                <option value="youtube_thumbnail">🎬 YouTube Thumbnail (16:9)</option>
                <option value="youtube_shorts_thumbnail">📱 YouTube Shorts (9:16)</option>
                <option value="motivational">🔥 Motivational</option>
                <option value="tech_diagram">🔧 Tech Diagram</option>
              </select>
            </div>
            <div className="form-group">
              <label>Aspect Ratio</label>
              <select value={oaAspect} onChange={e => setOaAspect(e.target.value)} disabled={oaLoading}>
                <option value="16:9">16:9 — YouTube landscape</option>
                <option value="9:16">9:16 — Shorts / TikTok</option>
                <option value="1:1">1:1 — Instagram square</option>
              </select>
            </div>
            {oaError && <div className="error-message">{oaError}</div>}
            <button className="generate-button" onClick={runOaThumbnail} disabled={oaLoading}>
              {oaLoading ? '🎨 Generating…' : '🖼️ Generate 2 Thumbnail Options'}
            </button>
          </>
        )}

        {/* Social pack */}
        {oaTab === 'social_pack' && (
          <>
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid #b7e4cc', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
              <p style={{ color: '#2a9d5c', fontSize: '0.875rem', margin: 0, fontWeight: 600 }}>
                📦 Generates 3 images in parallel:
              </p>
              <p style={{ color: '#637381', fontSize: '0.8125rem', margin: '0.25rem 0 0' }}>
                YouTube thumbnail (16:9) · Shorts/TikTok (9:16) · Instagram square (1:1)
              </p>
            </div>
            {oaError && <div className="error-message">{oaError}</div>}
            <button className="generate-button" onClick={runOaSocialPack} disabled={oaLoading}>
              {oaLoading ? '🎨 Generating 3 images…' : '📦 Generate Full Social Pack'}
            </button>
          </>
        )}

        {/* Custom image */}
        {oaTab === 'image' && (
          <>
            <div className="form-group">
              <label>Image Prompt *</label>
              <textarea value={oaPrompt} onChange={e => setOaPrompt(e.target.value)}
                rows={3} disabled={oaLoading}
                placeholder="e.g. A futuristic data center with glowing blue servers, cinematic lighting, 8K quality"
                style={{ width: '100%', background: '#f4f6f8', border: '1px solid #e3e8ef', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.6rem 0.75rem', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
            <div className="form-group">
              <label>Style Preset (optional)</label>
              <select value={oaStyle} onChange={e => setOaStyle(e.target.value)} disabled={oaLoading}>
                <option value="">None</option>
                <option value="youtube_thumbnail">🎬 YouTube Thumbnail</option>
                <option value="social_square">📱 Social Media Square</option>
                <option value="ai_avatar">🤖 AI Avatar</option>
                <option value="tech_diagram">🔧 Tech Diagram</option>
                <option value="motivational">🔥 Motivational</option>
              </select>
            </div>
            <div className="form-group">
              <label>Aspect Ratio</label>
              <select value={oaAspect} onChange={e => setOaAspect(e.target.value)} disabled={oaLoading}>
                <option value="16:9">16:9 — Widescreen</option>
                <option value="9:16">9:16 — Portrait / Shorts</option>
                <option value="1:1">1:1 — Square</option>
              </select>
            </div>
            {oaError && <div className="error-message">{oaError}</div>}
            <button className="generate-button" onClick={runOaImage} disabled={oaLoading}>
              {oaLoading ? '✨ Generating…' : '✨ Generate 2 Images'}
            </button>
          </>
        )}

        {/* Avatar */}
        {oaTab === 'avatar' && (
          <>
            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
              <p style={{ color: '#60a5fa', fontSize: '0.875rem', margin: 0, fontWeight: 600 }}>🤖 Consistent AI Presenter Avatar</p>
              <p style={{ color: '#637381', fontSize: '0.8125rem', margin: '0.25rem 0 0' }}>
                Creates a reusable AI character to use across all your thumbnails and social media.
                Describe the look you want — the AI keeps it consistent across generations.
              </p>
            </div>
            <div className="form-group">
              <label>Avatar Description</label>
              <textarea value={oaAvatarDesc} onChange={e => setOaAvatarDesc(e.target.value)}
                rows={2} disabled={oaLoading}
                style={{ width: '100%', background: '#f4f6f8', border: '1px solid #e3e8ef', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.6rem 0.75rem', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
            {oaError && <div className="error-message">{oaError}</div>}
            <button className="generate-button" onClick={runOaAvatar} disabled={oaLoading}>
              {oaLoading ? '🤖 Generating…' : '🤖 Generate 2 Avatar Options'}
            </button>
          </>
        )}
      </div>

      {/* Results */}
      {oaImages.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.5rem 0 0.5rem' }}>
            <h2 style={{ margin: 0, color: '#1c2b33' }}>✅ Generated Images</h2>
            {oaProvider && <span style={{ background: 'rgba(52,211,153,0.15)', color: '#2a9d5c', borderRadius: '999px', padding: '0.2rem 0.7rem', fontSize: '0.78rem', fontWeight: 700 }}>{oaProvider}</span>}
          </div>
          <p style={{ color: '#637381', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
            Right-click any image to save, or use the Download button.
          </p>
          {renderAIImageGrid(oaImages)}
        </div>
      )}

      {/* Social pack results */}
      {oaPack && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 style={{ color: '#1c2b33', marginBottom: '0.25rem' }}>✅ Social Media Pack — {oaPack.topic}</h2>
          <p style={{ color: '#637381', fontSize: '0.8125rem', marginBottom: '1rem' }}>3 images ready for all platforms</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {[
              { label: '🎬 YouTube Thumbnail (16:9)', img: oaPack.youtube_thumbnail, bg: '#ef4444' },
              { label: '📱 Shorts / TikTok (9:16)',  img: oaPack.shorts_tiktok_thumbnail, bg: '#a78bfa' },
              { label: '📸 Instagram Square (1:1)',  img: oaPack.instagram_square, bg: '#f59e0b' },
            ].map(({ label, img, bg }) => img && (
              <div key={label} style={{ background: '#f4f6f8', border: `1px solid ${bg}40`, borderRadius: '0.75rem', overflow: 'hidden' }}>
                <div style={{ background: `${bg}22`, padding: '0.5rem 0.75rem' }}>
                  <span style={{ color: bg, fontWeight: 700, fontSize: '0.8rem' }}>{label}</span>
                </div>
                <img src={img.url} alt={label} style={{ width: '100%', display: 'block', maxHeight: '200px', objectFit: 'cover' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div style={{ padding: '0.6rem', display: 'flex', gap: '0.4rem' }}>
                  <a href={img.url} target="_blank" rel="noopener noreferrer" download
                    className="video-download-link" style={{ flex: 1, textAlign: 'center', fontSize: '0.78rem', padding: '0.3rem 0.4rem' }}>
                    ⬇️ Download
                  </a>
                  <button onClick={() => navigator.clipboard.writeText(img.url)}
                    style={{ flex: 1, background: 'rgba(148,163,184,0.1)', border: '1px solid #e3e8ef', color: '#637381', borderRadius: '0.375rem', padding: '0.3rem 0.4rem', fontSize: '0.78rem', cursor: 'pointer' }}>
                    📋 URL
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div style={{ marginTop: '2.5rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '0.75rem', padding: '1.25rem' }}>
        <h3 style={{ color: '#d97706', margin: '0 0 0.75rem', fontSize: '1rem' }}>💡 Monetization Tips</h3>
        <ul style={{ paddingLeft: '1.25rem', margin: 0, lineHeight: 1.7 }}>
          <li style={{ color: '#637381', fontSize: '0.875rem' }}>A/B test 2 thumbnails — upload both and YouTube shows the winner automatically (Studio → Tests)</li>
          <li style={{ color: '#637381', fontSize: '0.875rem' }}>Use the Social Pack to publish the same video across YouTube, TikTok, and Instagram in one click</li>
          <li style={{ color: '#637381', fontSize: '0.875rem' }}>Create a consistent AI avatar to build brand recognition without showing your face</li>
          <li style={{ color: '#637381', fontSize: '0.875rem' }}>Sell image packs to small businesses — 10 social media images for $97 is a common price point</li>
          <li style={{ color: '#637381', fontSize: '0.875rem' }}>DALL·E 3 costs ~$0.04–0.08/image — 25 thumbnails costs about $1. Very cheap at scale.</li>
        </ul>
      </div>
    </div>
  );

  // ── Growth Advisor page ───────────────────────────────────────────────────
  const renderAdvisor = () => {
    const catMeta: Record<string, { label: string; color: string; bg: string; icon: string }> = {
      grow_followers: { label: 'Grow Followers', color: '#3b82f6', bg: '#eff6ff', icon: '📈' },
      fix_issues:     { label: 'Fix Issues',     color: '#ef4444', bg: '#fff0f0', icon: '🔧' },
      sell_products:  { label: 'Sell Products',  color: '#f59e0b', bg: '#fffbeb', icon: '💰' },
      content_ideas:  { label: 'Content Ideas',  color: '#10b981', bg: '#f0fdf4', icon: '💡' },
    };
    const priBadge: Record<string, { label: string; color: string }> = {
      high:   { label: 'High',   color: '#ef4444' },
      medium: { label: 'Medium', color: '#f59e0b' },
      low:    { label: 'Low',    color: '#6b7280' },
    };
    const categories = ['all', 'grow_followers', 'fix_issues', 'sell_products', 'content_ideas'];
    const tasks = advisorData?.tasks ?? [];
    const filtered = advisorFilter === 'all' ? tasks : tasks.filter(t => t.category === advisorFilter);
    const doneCount = tasks.filter(t => advisorDone.has(t.id)).length;
    const score = advisorData?.score ?? 0;
    const scoreColor = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';

    return (
      <div>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1c2b33', margin: '0 0 0.25rem' }}>🧭 Growth Advisor</h1>
            <p style={{ color: '#637381', fontSize: '0.875rem', margin: 0 }}>
              AI-powered action plan — what to do next to grow followers, fix issues, and sell more
            </p>
          </div>
          <button
            onClick={fetchAdvisor}
            disabled={advisorLoading}
            style={{ background: advisorLoading ? '#e5e7eb' : '#1c2b33', color: advisorLoading ? '#9ca3af' : '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.65rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: advisorLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
          >
            {advisorLoading ? '⟳ Analysing…' : advisorData ? '↺ Refresh AI Advice' : '✦ Get My Action Plan'}
          </button>
        </div>

        {/* Error */}
        {advisorError && (
          <div style={{ background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: '0.75rem', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>
            ⚠️ {advisorError}
          </div>
        )}

        {/* Empty state */}
        {!advisorData && !advisorLoading && !advisorError && (
          <div style={{ background: '#f7f8fa', border: '2px dashed #e5e7eb', borderRadius: '1rem', padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧭</div>
            <h2 style={{ color: '#1c2b33', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Your personalized action plan</h2>
            <p style={{ color: '#637381', fontSize: '0.875rem', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
              Click "Get My Action Plan" and the AI will analyze your channel stats and give you exactly what to do next — prioritized by impact.
            </p>
            <button
              onClick={fetchAdvisor}
              style={{ background: '#1c2b33', color: '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.75rem 2rem', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }}
            >
              ✦ Get My Action Plan
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {advisorLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ background: '#f7f8fa', borderRadius: '0.75rem', padding: '1.25rem', height: '80px', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
            <p style={{ color: '#637381', fontSize: '0.8125rem', textAlign: 'center' }}>AI is analyzing your channel… this takes about 10 seconds</p>
          </div>
        )}

        {/* Results */}
        {advisorData && !advisorLoading && (
          <>
            {/* Score + Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1rem', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.25rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}</div>
                <div style={{ fontSize: '0.72rem', color: '#637381', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>Channel Score</div>
                <div style={{ width: '100%', height: '6px', background: '#e5e7eb', borderRadius: '999px', marginTop: '0.5rem', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${score}%`, background: scoreColor, borderRadius: '999px', transition: 'width 0.5s ease' }} />
                </div>
              </div>
              <div>
                <p style={{ color: '#1c2b33', fontSize: '0.9375rem', margin: '0 0 0.5rem', lineHeight: 1.5 }}>{advisorData.summary}</p>
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', display: 'inline-block' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#92400e' }}>🎯 This week: </span>
                  <span style={{ fontSize: '0.8125rem', color: '#78350f' }}>{advisorData.weekly_focus}</span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {tasks.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', background: '#f7f8fa', borderRadius: '0.6rem', padding: '0.6rem 1rem' }}>
                <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(doneCount / tasks.length * 100)}%`, background: '#10b981', borderRadius: '999px', transition: 'width 0.3s ease' }} />
                </div>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#637381', whiteSpace: 'nowrap' }}>{doneCount}/{tasks.length} done</span>
                {doneCount > 0 && (
                  <button onClick={() => { setAdvisorDone(new Set()); localStorage.removeItem('advisor_done'); }}
                    style={{ fontSize: '0.75rem', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>reset</button>
                )}
              </div>
            )}

            {/* Quick wins */}
            {advisorData.quick_wins && advisorData.quick_wins.length > 0 && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem' }}>
                <h3 style={{ color: '#065f46', fontSize: '0.875rem', fontWeight: 800, margin: '0 0 0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚡ Quick Wins — Do These Right Now</h3>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {advisorData.quick_wins.map((w, i) => (
                    <li key={i} style={{ color: '#065f46', fontSize: '0.875rem', lineHeight: 1.5 }}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Category filter tabs */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {categories.map(cat => {
                const isActive = advisorFilter === cat;
                const meta = cat === 'all' ? null : catMeta[cat];
                const count = cat === 'all' ? tasks.length : tasks.filter(t => t.category === cat).length;
                return (
                  <button key={cat} onClick={() => setAdvisorFilter(cat)}
                    style={{ background: isActive ? (meta?.bg ?? '#1c2b33') : '#f7f8fa', color: isActive ? (meta?.color ?? '#fff') : '#637381', border: `1px solid ${isActive ? (meta?.color ?? '#1c2b33') + '60' : '#e5e7eb'}`, borderRadius: '999px', padding: '0.35rem 0.9rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {meta ? `${meta.icon} ${meta.label}` : 'All'} ({count})
                  </button>
                );
              })}
            </div>

            {/* Task cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {filtered.map(task => {
                const done = advisorDone.has(task.id);
                const meta = catMeta[task.category] ?? catMeta.content_ideas;
                const pri  = priBadge[task.priority] ?? priBadge.medium;
                return (
                  <div key={task.id}
                    style={{ background: done ? '#f7f8fa' : '#fff', border: `1px solid ${done ? '#e5e7eb' : meta.color + '30'}`, borderRadius: '0.75rem', padding: '1rem', display: 'grid', gridTemplateColumns: '1.5rem 1fr auto', gap: '0.75rem', alignItems: 'flex-start', opacity: done ? 0.55 : 1, transition: 'opacity 0.2s' }}>
                    {/* Checkbox */}
                    <button onClick={() => toggleAdvisorDone(task.id)}
                      style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${done ? '#10b981' : meta.color}`, background: done ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: '0.1rem' }}>
                      {done && <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 900 }}>✓</span>}
                    </button>
                    {/* Content */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: meta.color, background: meta.bg, borderRadius: '999px', padding: '0.15rem 0.6rem', border: `1px solid ${meta.color}30` }}>
                          {meta.icon} {meta.label}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: pri.color, border: `1px solid ${pri.color}30`, borderRadius: '999px', padding: '0.15rem 0.5rem' }}>
                          {pri.label} priority
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1c2b33', marginBottom: '0.3rem', textDecoration: done ? 'line-through' : 'none' }}>
                        {task.title}
                      </div>
                      <p style={{ color: '#637381', fontSize: '0.8125rem', margin: '0 0 0.4rem', lineHeight: 1.5 }}>{task.detail}</p>
                      {task.impact && (
                        <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>📊 {task.impact}</span>
                      )}
                    </div>
                    {/* Go button */}
                    {task.page && !done && (
                      <button
                        onClick={() => {
                          setCurrentPage(task.page as any);
                          if (task.page === 'monitor') loadMonitorData(monitorDays);
                          if (task.page === 'analytics') fetchAnalytics();
                          if (task.page === 'orders') fetchOrders('all', 1);
                        }}
                        style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}40`, borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'center' }}>
                        Go →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderHome = () => {
    const metrics = dashboardMetrics;
    const summary = analyticsSummary;
    const totalViews   = summary?.totals?.total_views   ?? 0;
    const totalLikes   = summary?.totals?.total_likes   ?? 0;
    const totalPosts   = summary?.totals?.total_posts   ?? 0;
    const revenue30d   = metrics?.overview?.revenue_30d ?? 0;
    const totalVideos  = metrics?.overview?.total_videos ?? 0;
    const totalScripts = metrics?.overview?.total_scripts ?? 0;

    return (
      <div>
        {/* ── Header ── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1c2b33', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋
          </h1>
          <p style={{ color: '#637381', fontSize: '0.875rem' }}>
            KidVid Creator &nbsp;·&nbsp; Kids short-form video channel &nbsp;·&nbsp;
            <a href="https://www.youtube.com/@TxNightcoder" target="_blank" rel="noopener noreferrer" style={{ color: '#f87171', textDecoration: 'none', fontWeight: 600 }}>▶ @TxNightcoder</a>
          </p>
        </div>

        {/* ── Auto-Generate Daily Video Banner ── */}
        <div className="autogen-banner">
          <div className="autogen-banner-text">
            <h3>🤖 Auto-Generate Today's Video</h3>
            <p>AI picks a trending kids topic → writes script → generates video → ready to publish to YouTube, TikTok & Instagram</p>
          </div>
          <button className="autogen-btn" disabled={loading || videoLoading}
            onClick={async () => {
              setLoading(true);
              setCurrentPage('scripts');
              setNiche('kids');
              await getTopicIdeas();
              setLoading(false);
            }}>
            {loading ? '⟳ Generating…' : '▶ Generate Today\'s Video'}
          </button>
        </div>

        {/* ── Stats grid ── */}
        <div className="stat-grid">
          {[
            { label: 'Revenue (30d)',    value: `$${revenue30d.toFixed(0)}`,                   color: 'green'  },
            { label: 'Total Views',      value: totalViews >= 1000 ? `${(totalViews/1000).toFixed(1)}K` : String(totalViews), color: 'blue'   },
            { label: 'Total Likes',      value: totalLikes >= 1000 ? `${(totalLikes/1000).toFixed(1)}K` : String(totalLikes), color: 'purple' },
            { label: 'Posts Published',  value: String(totalPosts),                             color: 'teal'   },
            { label: 'Videos Made',      value: String(totalVideos),                            color: 'amber'  },
            { label: 'Scripts Written',  value: String(totalScripts),                           color: 'blue'   },
          ].map(s => (
            <div key={s.label} className={`stat-card ${s.color}`}>
              <div className="stat-value">{s.value || '—'}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Platform social stats ── */}
        {summary?.by_platform && summary.by_platform.length > 0 && (
          <div className="section-card">
            <h2>Social Platforms</h2>
            <div className="platform-grid">
              {summary.by_platform.map(p => (
                <div key={p.platform} className="platform-card">
                  <div className="platform-card-head">
                    <div className="platform-name">
                      <span>{p.platform === 'youtube' ? '▶' : p.platform === 'tiktok' ? '🎵' : p.platform === 'instagram' ? '📸' : '👥'}</span>
                      <span style={{ textTransform: 'capitalize' }}>{p.platform}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#637381' }}>{p.posts} posts</span>
                  </div>
                  <div className="platform-stat">{p.total_views >= 1000 ? `${(p.total_views/1000).toFixed(1)}K` : p.total_views}</div>
                  <div className="platform-stat-label">views</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Daily workflow quick-actions ── */}
        <div className="section-card">
          <h2>Daily Workflow — Kids Video Channel</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {[
              { icon: '🔥', label: 'Find Trending Topic',    desc: 'See what kids are watching today',            page: 'trending'    as const, color: '#f59e0b' },
              { icon: '📝', label: 'Write AI Script',        desc: 'Auto-generate kids video script',             page: 'scripts'     as const, color: '#6366f1' },
              { icon: '🎬', label: 'Generate Video',         desc: videoProvider?.provider === 'veo' ? 'Veo 3 AI video ✨' : 'AI video from script', page: 'videos' as const, color: '#10b981' },
              { icon: '📊', label: 'Check Performance',      desc: 'Views, likes, revenue across platforms',      page: 'monitor'     as const, color: '#3b82f6' },
              { icon: '🛍️', label: 'View Orders',            desc: 'Gumroad personalised video orders',           page: 'orders'      as const, color: '#8b5cf6' },
              { icon: '💰', label: 'Grow Revenue',           desc: 'Affiliate links, ad revenue tips',            page: 'monetize'    as const, color: '#ef4444' },
            ].map(item => (
              <button key={item.label}
                onClick={() => {
                  setCurrentPage(item.page);
                  if (item.page === 'monitor') loadMonitorData(monitorDays);
                  if (item.page === 'orders')  fetchOrders('all', 1);
                }}
                style={{ background: `${item.color}0d`, border: `1px solid ${item.color}30`, borderRadius: '0.75rem', padding: '1rem', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${item.color}70`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = `${item.color}30`)}
              >
                <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>{item.icon}</div>
                <div style={{ color: '#1c2b33', fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.2rem' }}>{item.label}</div>
                <div style={{ color: '#637381', fontSize: '0.78rem' }}>{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Connected platforms status ── */}
        <div className="section-card">
          <h2>Connected Accounts</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { label: 'YouTube',   color: '#ef4444', url: 'https://www.youtube.com/@TxNightcoder',  connected: true  },
              { label: 'TikTok',    color: '#69c9d0', url: 'https://www.tiktok.com/',                connected: false },
              { label: 'Instagram', color: '#e1306c', url: 'https://www.instagram.com/txnightcoder', connected: false },
              { label: 'Gumroad',   color: '#f59e0b', url: 'https://app.gumroad.com/',               connected: true  },
              { label: 'Google AI', color: '#34a853', url: 'https://aistudio.google.com/',           connected: true  },
              { label: 'GoDaddy',   color: '#3b82f6', url: 'https://site-xnltxqiro.godaddysites.com', connected: true },
            ].map(acct => (
              <a key={acct.label} href={acct.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: acct.connected ? `${acct.color}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${acct.connected ? acct.color + '40' : 'rgba(255,255,255,0.08)'}`, borderRadius: '999px', padding: '0.35rem 0.85rem', fontSize: '0.8125rem', fontWeight: 600, color: acct.connected ? acct.color : '#475569', textDecoration: 'none' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: acct.connected ? acct.color : '#334155', display: 'inline-block', flexShrink: 0 }} />
                {acct.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  };

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
          <small style={{ color: '#637381', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
            💰 = High revenue potential niches
          </small>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="idea-button"
            onClick={getTopicIdeas}
            disabled={loadingIdeas || loading || topPerfLoading}
            type="button"
            style={{ flex: '1 1 200px' }}
          >
            {loadingIdeas ? '🤔 Getting Ideas...' : '💡 Get AI Topic Ideas'}
          </button>
          <button
            className="idea-button"
            onClick={getTopPerformerIdeas}
            disabled={topPerfLoading || loadingIdeas || loading}
            type="button"
            title="Generate ideas based on your best-performing videos"
            style={{ flex: '1 1 200px', background: 'rgba(16,185,129,0.12)', borderColor: '#10b981', color: '#2a9d5c' }}
          >
            {topPerfLoading ? '📊 Analysing...' : '🏆 Ideas from Top Performers'}
          </button>
        </div>

        {showIdeas && topicIdeas.length > 0 && (
          <div className="topic-ideas">
            <h3>{topPerfDataAvailable ? '🏆 Topics Based on Your Best Performers' : '💡 Recommended Topics for ' + niche}</h3>
            {topPerfDataAvailable && topPerfNote && (
              <p className="ideas-subtitle" style={{ color: '#2a9d5c' }}>✅ {topPerfNote}</p>
            )}
            {!topPerfDataAvailable && topPerfNote && (
              <p className="ideas-subtitle" style={{ color: '#f59e0b' }}>⚠️ {topPerfNote}</p>
            )}
            {!topPerfNote && <p className="ideas-subtitle">Click any topic to use it:</p>}
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

          {/* ── SEO Optimizer panel ── */}
          <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid #b7e4cc', borderRadius: '0.75rem', padding: '1.25rem', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <h3 style={{ color: '#2a9d5c', margin: 0 }}>🎯 YouTube SEO Optimizer</h3>
              <button onClick={() => runOptimize(generatedScript.topic, generatedScript.script_metadata?.niche ?? niche, generatedScript.hook, generatedScript.body, generatedScript.cta)}
                disabled={optLoading}
                style={{ background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: optLoading ? 'not-allowed' : 'pointer', opacity: optLoading ? 0.7 : 1 }}>
                {optLoading ? '⏳ Generating…' : '✨ Generate Titles, Description & Tags'}
              </button>
            </div>
            <p style={{ color: '#637381', fontSize: '0.8125rem', margin: '0 0 0.75rem' }}>
              Get 10 click-optimised title options, a full SEO description, and 20 keyword tags ready to paste into YouTube Studio.
            </p>
            {optError && <div className="error-message">{optError}</div>}
            {optResult && (() => {
              const cp = optResult.content_pack;
              return (
                <div>
                  {/* Recommended title */}
                  <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #b7e4cc', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                    <p style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>⭐ Recommended Title</p>
                    <p style={{ color: '#1c2b33', fontWeight: 700, fontSize: '1rem', margin: 0 }}>{cp.recommended_title}</p>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ color: '#637381', fontSize: '0.8rem' }}>👥 {cp.target_audience}</span>
                      <span style={{ color: '#637381', fontSize: '0.8rem' }}>🕐 {cp.best_posting_time}</span>
                      <span style={{ color: '#637381', fontSize: '0.8rem' }}>💰 {cp.estimated_cpm}</span>
                    </div>
                  </div>
                  {/* All title options */}
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>📝 All Title Options (ranked by CTR)</p>
                    {optResult.titles.map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ background: `rgba(16,185,129,${0.15 + (10-i)*0.015})`, color: '#2a9d5c', borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{t.ctr_score.toFixed(1)}</span>
                        <span style={{ color: '#1c2b33', fontSize: '0.875rem', flex: 1 }}>{t.title}</span>
                        <span style={{ color: '#637381', fontSize: '0.75rem', flexShrink: 0 }}>{t.style}</span>
                        <button onClick={() => { navigator.clipboard.writeText(t.title); setOptCopied(t.title); setTimeout(() => setOptCopied(''), 2000); }}
                          style={{ background: optCopied === t.title ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.1)', border: '1px solid #e3e8ef', color: optCopied === t.title ? '#34d399' : '#94a3b8', borderRadius: '0.3rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>
                          {optCopied === t.title ? '✓' : '📋'}
                        </button>
                      </div>
                    ))}
                  </div>
                  {/* Description */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <p style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>📄 YouTube Description</p>
                      <button onClick={() => { navigator.clipboard.writeText(optResult.description); setOptCopied('desc'); setTimeout(() => setOptCopied(''), 2000); }}
                        style={{ background: optCopied === 'desc' ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.1)', border: '1px solid #e3e8ef', color: optCopied === 'desc' ? '#34d399' : '#94a3b8', borderRadius: '0.3rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                        {optCopied === 'desc' ? '✓ Copied' : '📋 Copy'}
                      </button>
                    </div>
                    <pre style={{ color: '#637381', fontSize: '0.8rem', background: '#f0f2f5', borderRadius: '0.5rem', padding: '0.75rem', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto', margin: 0 }}>{optResult.description}</pre>
                  </div>
                  {/* Tags */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <p style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>🏷️ Tags ({optResult.tags.length})</p>
                      <button onClick={() => { navigator.clipboard.writeText(optResult.tags.join(', ')); setOptCopied('tags'); setTimeout(() => setOptCopied(''), 2000); }}
                        style={{ background: optCopied === 'tags' ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.1)', border: '1px solid #e3e8ef', color: optCopied === 'tags' ? '#34d399' : '#94a3b8', borderRadius: '0.3rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                        {optCopied === 'tags' ? '✓ Copied' : '📋 Copy All'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {optResult.tags.map((t, i) => <span key={i} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #b7e4cc', color: '#2a9d5c', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.78rem' }}>#{t}</span>)}
                    </div>
                  </div>
                  {cp.seo_tips?.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <p style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>💡 SEO Tips</p>
                      <ul style={{ paddingLeft: '1rem', margin: 0 }}>{cp.seo_tips.map((t, i) => <li key={i} style={{ color: '#637381', fontSize: '0.8125rem', marginBottom: '0.2rem' }}>{t}</li>)}</ul>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {scripts.length > 0 && (
        <div className="scripts-history">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Recent Scripts ({scripts.length})</h2>
            <button
              onClick={() => {
                const header = ['id','topic','hook','body','cta','created_at'];
                const rows = scripts.map(s => [
                  s.id,
                  `"${(s.topic||'').replace(/"/g,'""')}"`,
                  `"${(s.hook||'').replace(/"/g,'""')}"`,
                  `"${(s.body||'').replace(/"/g,'""')}"`,
                  `"${(s.cta||'').replace(/"/g,'""')}"`,
                  s.created_at,
                ]);
                const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `scripts-${new Date().toISOString().slice(0,10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#2a9d5c', borderRadius: '0.5rem', padding: '0.4rem 0.9rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
              ⬇️ Download All as CSV
            </button>
          </div>
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
                      style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid #b7e4cc', color: '#2a9d5c', borderRadius: '0.375rem', padding: '0.25rem 0.65rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
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
              color: '#1c2b33',
              fontSize: '0.9375rem',
              fontFamily: 'inherit',
              lineHeight: '1.6',
              resize: 'vertical'
            }}
          />
          <small style={{ color: '#637381', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
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
          <p style={{ marginTop: '1rem' }}><strong>Automated Creation (Active — Veo 3):</strong></p>
          <ul>
            <li>Set <code>GOOGLE_API_KEY</code> from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{color:'#60a5fa'}}>aistudio.google.com/apikey</a></li>
            <li>Veo 3 generates the full video — AI clips, voiceover, and captions automatically</li>
            <li>No ElevenLabs or Pexels needed</li>
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
              color: '#1c2b33',
              transition: 'all 0.2s'
            }}
          >
            <strong>📚 API Documentation</strong>
            <p style={{ fontSize: '0.875rem', color: '#637381', marginTop: '0.5rem' }}>
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
              color: '#1c2b33',
              transition: 'all 0.2s'
            }}
          >
            <strong>🎨 Canva</strong>
            <p style={{ fontSize: '0.875rem', color: '#637381', marginTop: '0.5rem' }}>
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
              color: '#1c2b33',
              transition: 'all 0.2s'
            }}
          >
            <strong>📺 YouTube Studio</strong>
            <p style={{ fontSize: '0.875rem', color: '#637381', marginTop: '0.5rem' }}>
              Upload and manage your videos
            </p>
          </a>
        </div>
      </div>

      <div className="help-section" style={{ marginTop: '2rem', background: '#f4f6f8', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '0.75rem', padding: '1.5rem' }}>
        <h2 style={{ color: '#1c2b33', marginBottom: '0.25rem' }}>💻 PowerShell Command Reference</h2>
        <p style={{ color: '#637381', fontSize: '0.875rem', marginBottom: '1.25rem' }}>Commonly used commands for managing this platform. Run from <code>C:\Users\JohnKirshy\Desktop\ai-content-monetization</code></p>

        {[
          {
            category: '🚀 Deploy & Keys',
            color: '#3b82f6',
            commands: [
              { cmd: 'cd "C:\\Users\\JohnKirshy\\Desktop\\ai-content-monetization"', desc: 'Navigate to the project folder — always do this first before running any command' },
              { cmd: '$env:OPENAI_API_KEY = "sk-..."; $env:GOOGLE_API_KEY = "AQ...."; $env:ELEVENLABS_API_KEY = "sk_..."; .\\SET_AZURE_ENV_VARS.ps1', desc: 'Set all API keys in current shell then push to Azure in one shot' },
              { cmd: '.\\SET_AZURE_ENV_VARS.ps1', desc: 'Push all API keys already set in shell to Azure and restart the container' },
              { cmd: 'git add -A; git commit -m "msg"; git push origin main', desc: 'Save all changes to GitHub — triggers auto-deploy to Azure (~3-5 min)' },
              { cmd: 'git commit --allow-empty -m "Trigger deployment"; git push origin main', desc: 'Force a redeploy to Azure without any code changes' },
            ]
          },
          {
            category: '🔍 Diagnostics',
            color: '#a78bfa',
            commands: [
              { cmd: 'Invoke-RestMethod -Uri "https://ai-content-backend.victoriousmeadow-edd1d4e3.eastus.azurecontainerapps.io/api/v1/health/video-provider"', desc: 'Check which video provider is active (Veo 3 or local)' },
              { cmd: 'Invoke-RestMethod -Uri "https://ai-content-backend.victoriousmeadow-edd1d4e3.eastus.azurecontainerapps.io/api/v1/health/checks" | ConvertTo-Json -Depth 10', desc: 'Run all system health checks and see pass/fail for every service' },
              { cmd: 'az containerapp logs show --name ai-content-backend --resource-group ai-video-pipeline --tail 50', desc: 'View live backend error logs from Azure' },
              { cmd: 'az containerapp revision list --name ai-content-backend --resource-group ai-video-pipeline -o table', desc: 'Check which version is currently deployed' },
            ]
          },
          {
            category: '🗄️ Database',
            color: '#10b981',
            commands: [
              { cmd: 'az containerapp exec --name ai-content-backend --resource-group ai-video-pipeline --command "alembic upgrade head"', desc: 'Run database migrations on the live Azure database — do this after schema changes' },
            ]
          },
          {
            category: '🔑 Test API Keys',
            color: '#f59e0b',
            commands: [
              { cmd: 'Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models?key=$env:GOOGLE_API_KEY" | ConvertTo-Json -Depth 3', desc: 'Verify Google AI Studio / Veo 3 key works and list available models' },
              { cmd: '$h=@{"Authorization"="Bearer $env:OPENAI_API_KEY";"Content-Type"="application/json"}; $b=\'{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}],"max_tokens":5}\'; Invoke-RestMethod -Uri "https://api.openai.com/v1/chat/completions" -Method Post -Headers $h -Body $b', desc: 'Verify OpenAI API key works — should return a chat completion response' },
              { cmd: '$h=@{"xi-api-key"="sk_..."}; Invoke-RestMethod -Uri "https://api.elevenlabs.io/v1/user" -Headers $h', desc: 'Check ElevenLabs account status and remaining credits' },
            ]
          },
          {
            category: '☁️ Azure',
            color: '#0ea5e9',
            commands: [
              { cmd: 'az containerapp show --name ai-content-frontend --resource-group ai-video-pipeline --query "properties.configuration.ingress.fqdn" -o tsv', desc: 'Get the live frontend URL' },
              { cmd: 'az containerapp show --name ai-content-backend --resource-group ai-video-pipeline --query "properties.configuration.ingress.fqdn" -o tsv', desc: 'Get the live backend API URL' },
              { cmd: 'az containerapp auth update --name ai-content-frontend --resource-group ai-video-pipeline --enabled false', desc: 'Disable Easy Auth if locked out of the frontend' },
              { cmd: 'az containerapp auth update --name ai-content-backend --resource-group ai-video-pipeline --enabled false', desc: 'Disable Easy Auth if locked out of the backend' },
              { cmd: 'az account show --query "{tenantId:tenantId}" -o tsv', desc: 'Get your Azure tenant ID' },
              { cmd: 'Start-Process "https://github.com/txnightcoder-prog/ai-content-monetization/actions"', desc: 'Open GitHub Actions to watch deployment progress' },
              { cmd: 'Start-Process "https://ai-content-frontend.victoriousmeadow-edd1d4e3.eastus.azurecontainerapps.io"', desc: 'Open the live frontend app in browser' },
            ]
          },
          {
            category: '🧪 Test Video Generation',
            color: '#f472b6',
            commands: [
              { cmd: '$h=@{"Content-Type"="application/json"}; $b=\'{"topic":"how to save money","style":"educational","duration":30}\'; Invoke-RestMethod -Uri "https://ai-content-backend.victoriousmeadow-edd1d4e3.eastus.azurecontainerapps.io/api/v1/videos/generate" -Method Post -Headers $h -Body $b | ConvertTo-Json -Depth 10', desc: 'Trigger a test video generation directly via API' },
            ]
          },
        ].map(group => (
          <div key={group.category} style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ color: group.color, fontSize: '0.9rem', marginBottom: '0.6rem', fontWeight: 700 }}>{group.category}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {group.commands.map((c, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.5rem', padding: '0.65rem 0.85rem' }}>
                  <code style={{ color: '#7dd3fc', fontSize: '0.78rem', display: 'block', marginBottom: '0.25rem', wordBreak: 'break-all' }}>{c.cmd}</code>
                  <span style={{ color: '#637381', fontSize: '0.8rem' }}>{c.desc}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
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
          <li>Use ElevenLabs + Pexels for voiceover + stock footage automation (5+ videos/week)</li>
          <li>🎬 <strong>Upgrade to Veo 3</strong> (Google AI Studio) for fully AI-generated video clips — no stock footage needed. Set <code>GOOGLE_API_KEY</code> in Azure.</li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#637381', marginBottom: '1rem' }}>
          For detailed documentation, see <code>WORKFLOW_GUIDE.md</code> in the project folder
        </p>
        <button className="cta-button" onClick={() => setCurrentPage('home')}>
          ← Back to Home
        </button>
      </div>
    </div>
  );

  // ── ElevenLabs Voice Studio state ────────────────────────────────────────
  const EL_VOICES = [
    { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel',  desc: 'Neutral female · calm, clear',      tags: ['narration','neutral'] },
    { id: '29vD33N1CtxCmqQRPOHJ', label: 'Drew',    desc: 'Deep male · authoritative',          tags: ['narration','male'] },
    { id: '2EiwWnXFnvU5JabPnv8n', label: 'Clyde',   desc: 'Warm male · conversational',         tags: ['casual','male'] },
    { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella',   desc: 'Soft female · soothing',             tags: ['calm','female'] },
    { id: 'AZnzlk1XvdvUeBnXmlld', label: 'Domi',    desc: 'Energetic female · engaging',        tags: ['upbeat','female'] },
    { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni',  desc: 'Conversational male · friendly',     tags: ['casual','male'] },
    { id: 'GBv7mTt0atIp3Br8iCZE', label: 'Thomas',  desc: 'Calm male · professional',           tags: ['calm','male'] },
    { id: 'IKne3meq5aSn9XLyUdCD', label: 'Charlie', desc: 'Australian male · bright',           tags: ['upbeat','male'] },
    { id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Emily',   desc: 'Calm female · gentle',               tags: ['calm','female'] },
    { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh',    desc: 'Deep male · dramatic',               tags: ['narration','male'] },
    { id: 'ThT5KcBeYPX3keUQqHPh', label: 'Dorothy', desc: 'British female · refined',           tags: ['narration','female'] },
    { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam',    desc: 'Deep male · serious',                tags: ['narration','male'] },
  ];

  const [voiceText,       setVoiceText]       = useState('');
  const [voiceId,         setVoiceId2]        = useState('21m00Tcm4TlvDq8ikWAM');
  const [voiceStability,  setVoiceStability]  = useState(0.50);
  const [voiceSimilarity, setVoiceSimilarity] = useState(0.75);
  const [voiceStyle,      setVoiceStyle]      = useState(0.00);
  const [voiceLoading,    setVoiceLoading]    = useState(false);
  const [voiceError,      setVoiceError]      = useState('');
  const [voiceAudioUrl,   setVoiceAudioUrl]   = useState<string | null>(null);
  const [voiceAudioBlob,  setVoiceAudioBlob]  = useState<Blob | null>(null);
  const [voiceCharCount,  setVoiceCharCount]  = useState(0);
  const [voiceHistory,    setVoiceHistory]    = useState<{text:string;voice:string;url:string;ts:string}[]>([]);
  const [voiceTab,        setVoiceTab]        = useState<'studio'|'history'|'tips'>('studio');

  const generateVoice = async () => {
    if (!voiceText.trim()) return;
    setVoiceLoading(true); setVoiceError(''); setVoiceAudioUrl(null); setVoiceAudioBlob(null);
    try {
      const r = await apiFetch(`${API_BASE}/api/v1/videos/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: voiceText,
          voice_id: voiceId,
          stability: voiceStability,
          similarity_boost: voiceSimilarity,
          style: voiceStyle,
        }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail ?? 'ElevenLabs failed'); }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setVoiceAudioUrl(url);
      setVoiceAudioBlob(blob);
      const vLabel = EL_VOICES.find(v => v.id === voiceId)?.label ?? voiceId;
      setVoiceHistory(prev => [
        { text: voiceText.slice(0, 80) + (voiceText.length > 80 ? '…' : ''), voice: vLabel, url, ts: new Date().toLocaleTimeString() },
        ...prev.slice(0, 9),
      ]);
    } catch (err) { setVoiceError(err instanceof Error ? err.message : 'Failed'); }
    finally { setVoiceLoading(false); }
  };

  const downloadVoice = () => {
    if (!voiceAudioBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(voiceAudioBlob);
    a.download = `voiceover-${Date.now()}.mp3`;
    a.click();
  };

  const renderVoice = () => {
    const selectedVoice = EL_VOICES.find(v => v.id === voiceId) ?? EL_VOICES[0];
    const charLimit = 5000;
    const charsUsed = voiceText.length;
    const charPct = Math.min(100, Math.round(charsUsed / charLimit * 100));

    // Preset scripts
    const PRESETS = [
      { label: '30-sec intro',   text: 'Hey, welcome back! Today I want to share something that completely changed how I think about this topic. Stick around because by the end of this video you\'ll never look at it the same way again.' },
      { label: 'CTA outro',      text: 'If you found this helpful, do me a favor and hit that subscribe button right now. I drop new videos every week and I would hate for you to miss the next one. See you in the next video!' },
      { label: 'Product promo',  text: 'I\'ve been using this for the past three months and honestly it has saved me hours every single week. If you want to try it yourself, I left a link in the description. You can thank me later.' },
      { label: 'Granny opening', text: 'Now honey, let me tell you something. I\'ve been around long enough to know that the most important things in life are never the ones we rush. So pull up a chair and let Granny tell you something good.' },
      { label: 'Story hook',     text: 'Three years ago I was completely broke, burnt out, and about to quit. What happened next changed everything — and I wish someone had told me this sooner.' },
      { label: 'News-style',     text: 'Breaking down everything you need to know about today\'s biggest story in under sixty seconds. Here\'s what happened, why it matters, and what comes next.' },
    ];

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1c2b33', margin: '0 0 0.25rem' }}>🎙️ ElevenLabs Voice Studio</h1>
            <p style={{ color: '#637381', fontSize: '0.875rem', margin: 0 }}>
              Convert any text to a professional voiceover · 12 voices · Download as MP3 · Use in your videos
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, color: '#15803d' }}>
              ✅ API key active
            </span>
            <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer"
              style={{ background: '#1c2b33', color: '#fff', borderRadius: '0.5rem', padding: '0.4rem 0.85rem', fontSize: '0.8125rem', fontWeight: 700, textDecoration: 'none' }}>
              elevenlabs.io →
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-bar" style={{ marginBottom: '1.5rem' }}>
          {([
            { id: 'studio'  as const, label: '🎙️ Voice Studio' },
            { id: 'history' as const, label: `📼 History${voiceHistory.length ? ` (${voiceHistory.length})` : ''}` },
            { id: 'tips'    as const, label: '💡 Voice Tips' },
          ]).map(t => (
            <button key={t.id} className={`tab-btn ${voiceTab === t.id ? 'active' : ''}`} onClick={() => setVoiceTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* ── STUDIO TAB ── */}
        {voiceTab === 'studio' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: '1.25rem' }}>

            {/* Left — text + controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="section-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h2 style={{ margin: 0 }}>Script / Text</h2>
                  <span style={{ fontSize: '0.78rem', color: charPct > 90 ? '#ef4444' : '#637381', fontWeight: 600 }}>
                    {charsUsed.toLocaleString()} / {charLimit.toLocaleString()} chars
                  </span>
                </div>
                <textarea
                  value={voiceText}
                  onChange={e => { setVoiceText(e.target.value); setVoiceCharCount(e.target.value.length); }}
                  rows={8}
                  placeholder="Paste your script, narration, or any text here…&#10;&#10;Tip: write naturally — ElevenLabs reads punctuation as pauses."
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9rem', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', background: '#fafafa', lineHeight: 1.7 }}
                />
                {/* Char bar */}
                <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '999px', marginTop: '0.4rem', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${charPct}%`, background: charPct > 90 ? '#ef4444' : '#10b981', borderRadius: '999px', transition: 'width 0.2s' }} />
                </div>

                {/* Preset scripts */}
                <div style={{ marginTop: '0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#637381', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Quick Presets</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {PRESETS.map(p => (
                      <button key={p.label} onClick={() => setVoiceText(p.text)}
                        style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: '999px', padding: '0.25rem 0.7rem', fontSize: '0.75rem', cursor: 'pointer', color: '#1c2b33', fontWeight: 500 }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Error */}
              {voiceError && (
                <div style={{ background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.875rem' }}>
                  ⚠️ {voiceError}
                </div>
              )}

              {/* Generate button */}
              <button onClick={generateVoice} disabled={voiceLoading || !voiceText.trim()}
                style={{ background: voiceLoading ? '#e5e7eb' : '#1c2b33', color: voiceLoading ? '#9ca3af' : '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.9rem', fontWeight: 800, fontSize: '1rem', cursor: voiceLoading ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
                {voiceLoading ? '⏳ Generating voiceover…' : '🎙️ Generate Voiceover'}
              </button>

              {/* Audio player */}
              {voiceAudioUrl && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#15803d', marginBottom: '0.6rem' }}>✅ Ready — {selectedVoice.label} voice</div>
                  <audio src={voiceAudioUrl} controls style={{ width: '100%', marginBottom: '0.6rem' }} />
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={downloadVoice}
                      style={{ background: '#15803d', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                      ⬇️ Download MP3
                    </button>
                    <button onClick={() => { setVoiceAudioUrl(null); setVoiceText(''); }}
                      style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', color: '#637381' }}>
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right — voice picker + settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Voice selector */}
              <div className="section-card">
                <h2 style={{ marginBottom: '0.75rem' }}>Choose Voice</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '340px', overflowY: 'auto' }}>
                  {EL_VOICES.map(v => (
                    <button key={v.id} onClick={() => setVoiceId2(v.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: voiceId === v.id ? '#eff6ff' : '#f7f8fa', border: `1px solid ${voiceId === v.id ? '#3b82f6' : '#e5e7eb'}`, borderRadius: '0.5rem', padding: '0.6rem 0.75rem', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: voiceId === v.id ? '#3b82f6' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', flexShrink: 0, color: voiceId === v.id ? '#fff' : '#637381', fontWeight: 800 }}>
                        {v.label[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1c2b33' }}>{v.label}</div>
                        <div style={{ fontSize: '0.75rem', color: '#637381' }}>{v.desc}</div>
                      </div>
                      {voiceId === v.id && <span style={{ color: '#3b82f6', fontSize: '0.9rem', fontWeight: 900 }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Settings sliders */}
              <div className="section-card">
                <h2 style={{ marginBottom: '0.85rem' }}>Voice Settings</h2>
                {[
                  { label: 'Stability', val: voiceStability, set: setVoiceStability, lo: 'Variable', hi: 'Stable', tip: 'Higher = more consistent. Lower = more expressive.' },
                  { label: 'Clarity / Similarity', val: voiceSimilarity, set: setVoiceSimilarity, lo: 'Different', hi: 'Similar', tip: 'How closely it matches the original voice.' },
                  { label: 'Style Exaggeration', val: voiceStyle, set: setVoiceStyle, lo: 'Natural', hi: 'Exaggerated', tip: '0 = natural. Raise for more dramatic delivery.' },
                ].map(s => (
                  <div key={s.label} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1c2b33' }}>{s.label}</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#3b82f6' }}>{(s.val * 100).toFixed(0)}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={s.val}
                      onChange={e => s.set(parseFloat(e.target.value))}
                      style={{ width: '100%', accentColor: '#3b82f6' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#9ca3af' }}>
                      <span>{s.lo}</span><span>{s.hi}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.15rem 0 0' }}>{s.tip}</p>
                  </div>
                ))}

                {/* Model selector */}
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1c2b33', marginBottom: '0.4rem' }}>Model</div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {[
                      { id: 'eleven_multilingual_v2', label: 'Multilingual v2', desc: 'Best quality' },
                      { id: 'eleven_turbo_v2_5',      label: 'Turbo v2.5',      desc: 'Fastest' },
                      { id: 'eleven_flash_v2_5',      label: 'Flash v2.5',      desc: 'Lowest latency' },
                    ].map(m => (
                      <button key={m.id} style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: '0.4rem', padding: '0.35rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', color: '#637381' }}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {voiceTab === 'history' && (
          <div className="section-card">
            <h2>Recent Generations</h2>
            {voiceHistory.length === 0 ? (
              <p style={{ color: '#637381', fontSize: '0.875rem' }}>No voiceovers generated yet this session.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {voiceHistory.map((h, i) => (
                  <div key={i} style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1c2b33' }}>{h.voice}</span>
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{h.ts}</span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: '#637381', margin: '0 0 0.6rem', fontStyle: 'italic' }}>"{h.text}"</p>
                    <audio src={h.url} controls style={{ width: '100%', height: '32px' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TIPS TAB ── */}
        {voiceTab === 'tips' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1.25rem' }}>
            {[
              {
                title: '✍️ Write for the ear',
                tips: [
                  'Use short sentences — they sound more natural',
                  'Add commas and periods where you want pauses',
                  'Use "..." for a longer dramatic pause',
                  'Avoid bullet points or lists — they sound robotic',
                  'Write how you talk, not how you type',
                ],
                color: '#3b82f6',
              },
              {
                title: '🎚️ Best settings by use case',
                tips: [
                  'Narration/documentary: Stability 70%, Clarity 75%',
                  'Casual social video: Stability 40%, Style 20%',
                  'Granny Spills character: Stability 80%, Style 0%',
                  'Energetic promo: Stability 30%, Clarity 80%',
                  'News-style: Stability 90%, Clarity 80%',
                ],
                color: '#10b981',
              },
              {
                title: '⏱️ Longer videos',
                tips: [
                  'Split scripts into sections — generate each separately',
                  '5,000 chars ≈ 5-6 minutes of audio at normal pace',
                  'Stitch MP3s together in CapCut or Audacity (free)',
                  'Import each MP3 into HeyGen for lip-sync video',
                  'Use one voice consistently across all segments',
                ],
                color: '#8b5cf6',
              },
              {
                title: '📲 Workflow: Voice → Video',
                tips: [
                  '1. Generate script here in Voice Studio',
                  '2. Download MP3',
                  '3. Upload to HeyGen or CapCut',
                  '4. Add Granny / influencer image for lip-sync',
                  '5. Import finished video back via Videos → Import URL',
                ],
                color: '#f59e0b',
              },
            ].map(card => (
              <div key={card.title} className="section-card">
                <h2 style={{ color: card.color, marginBottom: '0.75rem' }}>{card.title}</h2>
                <ul style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {card.tips.map((t, i) => (
                    <li key={i} style={{ color: '#1c2b33', fontSize: '0.875rem', lineHeight: 1.5 }}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Granny Spills Studio state ───────────────────────────────────────────
  const [grannyTab,         setGrannyTab]         = useState<'bible' | 'scripts' | 'subscription' | 'calendar' | 'video'>('bible');
  const [grannyTopic,       setGrannyTopic]       = useState('');
  const [grannyType,        setGrannyType]        = useState('life_lesson');
  const [grannyDuration,    setGrannyDuration]    = useState('30_seconds');
  const [grannyScript,      setGrannyScript]      = useState<{script:string;elevenlabs_prompt:string;thumbnail_idea:string;hook_caption:string} | null>(null);
  const [grannyLoading,     setGrannyLoading]     = useState(false);
  const [grannyError,       setGrannyError]       = useState('');
  const [grannyCopied,      setGrannyCopied]      = useState('');

  const generateGrannyScript = async () => {
    if (!grannyTopic.trim()) return;
    setGrannyLoading(true); setGrannyError(''); setGrannyScript(null);
    try {
      const r = await apiFetch(`${API_BASE}/api/v1/scripts/granny-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: grannyTopic, script_type: grannyType, duration: grannyDuration }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail ?? 'Failed'); }
      setGrannyScript(await r.json());
    } catch (err) { setGrannyError(err instanceof Error ? err.message : 'Failed'); }
    finally { setGrannyLoading(false); }
  };

  const grannyCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setGrannyCopied(key);
    setTimeout(() => setGrannyCopied(''), 2000);
  };

  const renderGranny = () => {
    const GRANNY_TOPICS = [
      'Being kind costs nothing', 'Calling someone you love', 'Slow down and breathe',
      'Forgiveness is for you, not them', 'The value of a good night\'s sleep',
      'Why comparison steals your joy', 'Saying thank you and meaning it',
      'Making time for what matters', 'Writing letters instead of texts',
      'The best things in life take time',
    ];
    const TYPE_LABELS: Record<string, string> = {
      life_lesson: '🌿 Life Lesson',
      morning_reminder: '☀️ Morning Reminder',
      weekly_wisdom: '📬 Weekly Wisdom',
      newsletter_welcome: '💌 Newsletter Welcome',
      subscription_pitch: '🎁 Subscribe Invite',
    };
    const DUR_LABELS: Record<string, string> = {
      '30_seconds': '30 sec',
      '60_seconds': '60 sec',
      '2_minutes':  '2 min',
    };

    return (
      <div>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', flexShrink: 0 }}>👵🏻</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1c2b33', margin: '0 0 0.25rem' }}>Granny Spills Studio</h1>
            <p style={{ color: '#637381', fontSize: '0.875rem', margin: '0 0 0.5rem' }}>
              Warm Southern grandmother character · Life lessons · Subscription newsletter business
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {['ElevenLabs Voice', 'Weekly Newsletter', 'Subscription Model', 'Short-form Video'].map(tag => (
                <span key={tag} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, color: '#92400e' }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Quote banner */}
        <div style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1px solid #fde68a', borderRadius: '1rem', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontStyle: 'italic', color: '#78350f', fontSize: '1rem', lineHeight: 1.7 }}>
          "Now honey, life goes by faster than you think... Don't wait until tomorrow to tell somebody you love them today. Trust me on that one."
          <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#d97706', fontStyle: 'normal' }}>— Granny Spills</div>
        </div>

        {/* Tabs */}
        <div className="tab-bar" style={{ marginBottom: '1.5rem' }}>
          {([
            { id: 'bible' as const,        label: '📖 Voice Bible' },
            { id: 'scripts' as const,      label: '✍️ Script Generator' },
            { id: 'subscription' as const, label: '💌 Subscription Model' },
            { id: 'calendar' as const,     label: '📅 Content Calendar' },
            { id: 'video' as const,        label: '🎬 Video Setup' },
          ]).map(t => (
            <button key={t.id} className={`tab-btn ${grannyTab === t.id ? 'active' : ''}`} onClick={() => setGrannyTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* ── VOICE BIBLE TAB ── */}
        {grannyTab === 'bible' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: '1.25rem' }}>
            {/* Voice Formula */}
            <div className="section-card">
              <h2 style={{ color: '#d97706' }}>🎙️ The Granny Voice Formula</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {[
                  ['Warm Southern grandma', '#10b981'],
                  ['Calm and reassuring', '#3b82f6'],
                  ['Speaks slowly, never rushes', '#8b5cf6'],
                  ['Gentle humor', '#f59e0b'],
                  ['Encouraging, not preachy', '#10b981'],
                ].map(([trait, color]) => (
                  <div key={trait} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color as string, flexShrink: 0 }} />
                    <span style={{ color: '#1c2b33', fontSize: '0.875rem' }}>{trait}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fffbeb', borderRadius: '0.6rem', padding: '0.85rem', fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.7, fontStyle: 'italic' }}>
                "Now honey, let me tell you something."<br/>
                "I've been around long enough to know that being kind is never a mistake."<br/>
                "Put the phone down for a minute and call somebody you love."
              </div>
            </div>

            {/* Signature Phrases */}
            <div className="section-card">
              <h2 style={{ color: '#d97706' }}>💬 Signature Phrases</h2>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#637381', marginBottom: '0.4rem' }}>Opening Lines</div>
                {['Now honey...', 'Pull up a chair.', 'Let Granny tell you something.'].map(p => (
                  <div key={p} style={{ background: '#f0fdf4', borderRadius: '0.4rem', padding: '0.4rem 0.7rem', marginBottom: '0.3rem', fontSize: '0.875rem', color: '#065f46', fontStyle: 'italic' }}>"{p}"</div>
                ))}
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#637381', marginBottom: '0.4rem' }}>During Advice</div>
                {['The hard way taught me that lesson.', "I've seen this before.", 'Life has a funny way of teaching us.'].map(p => (
                  <div key={p} style={{ background: '#eff6ff', borderRadius: '0.4rem', padding: '0.4rem 0.7rem', marginBottom: '0.3rem', fontSize: '0.875rem', color: '#1e40af', fontStyle: 'italic' }}>"{p}"</div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#637381', marginBottom: '0.4rem' }}>Sign-offs</div>
                {["That's enough wisdom for today.", 'Love somebody well.', "I'll see you on the porch tomorrow."].map(p => (
                  <div key={p} style={{ background: '#fff0f9', borderRadius: '0.4rem', padding: '0.4rem 0.7rem', marginBottom: '0.3rem', fontSize: '0.875rem', color: '#9d174d', fontStyle: 'italic' }}>"{p}"</div>
                ))}
              </div>
            </div>

            {/* Never Says / Always Says */}
            <div className="section-card">
              <h2 style={{ color: '#d97706' }}>📜 Voice Bible Rules</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#ef4444', marginBottom: '0.5rem' }}>❌ Granny Never Says</div>
                  {['Crush it', 'Hustle harder', 'Scale your business', 'Leverage opportunities', 'Content strategy', 'Monetize', 'Personal brand'].map(w => (
                    <div key={w} style={{ fontSize: '0.8125rem', color: '#dc2626', padding: '0.2rem 0', borderBottom: '1px solid #fee2e2' }}>{w}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#10b981', marginBottom: '0.5rem' }}>✅ Granny Always Says</div>
                  {['Honey', 'Sweetheart', 'Bless your heart', 'Let me tell you', 'I\'ve seen this before', 'Trust me on that', 'Love somebody well'].map(w => (
                    <div key={w} style={{ fontSize: '0.8125rem', color: '#065f46', padding: '0.2rem 0', borderBottom: '1px solid #bbf7d0' }}>{w}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Speaking Style + ElevenLabs */}
            <div className="section-card">
              <h2 style={{ color: '#d97706' }}>🎚️ ElevenLabs Voice Settings</h2>
              <div style={{ background: '#1e293b', borderRadius: '0.6rem', padding: '1rem', fontFamily: 'monospace', fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.8, marginBottom: '1rem' }}>
                <span style={{ color: '#f59e0b' }}>Age:</span> 70-80<br/>
                <span style={{ color: '#f59e0b' }}>Gender:</span> Female<br/>
                <span style={{ color: '#f59e0b' }}>Tone:</span> Warm<br/>
                <span style={{ color: '#f59e0b' }}>Accent:</span> Southern American (Light)<br/>
                <span style={{ color: '#f59e0b' }}>Stability:</span> High<br/>
                <span style={{ color: '#f59e0b' }}>Style:</span> Storytelling
              </div>
              <div style={{ marginBottom: '0.5rem', fontSize: '0.78rem', fontWeight: 700, color: '#637381', textTransform: 'uppercase' }}>Voice Generation Prompt</div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.6rem', padding: '0.85rem', fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.7, fontStyle: 'italic', marginBottom: '0.75rem' }}>
                You are Granny Spills, a kind-hearted grandmother sharing life lessons on a front porch. Speak slowly and warmly. Pause naturally. Smile while speaking. Never sound like a salesman. Always sound encouraging and loving.
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer"
                  style={{ background: '#1c2b33', color: '#fff', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 700, textDecoration: 'none' }}>
                  🔗 Open ElevenLabs →
                </a>
                <a href="https://play.ht" target="_blank" rel="noopener noreferrer"
                  style={{ background: '#6366f1', color: '#fff', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 700, textDecoration: 'none' }}>
                  🔗 Try Play.ht →
                </a>
              </div>
            </div>

            {/* Sample 30-sec script */}
            <div className="section-card" style={{ gridColumn: '1 / -1' }}>
              <h2 style={{ color: '#d97706' }}>📋 Sample 30-Second Script</h2>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '1.25rem', fontStyle: 'italic', color: '#78350f', lineHeight: 2, fontSize: '1rem', marginBottom: '0.75rem' }}>
                "Now honey, let me tell you something."<br/><br/>
                "I've lived long enough to learn that most arguments aren't worth winning."<br/><br/>
                "You can be right... or you can have peace."<br/><br/>
                "And most days, peace is a whole lot better."<br/><br/>
                "Call somebody you love today."<br/><br/>
                "I'll see you on the porch tomorrow."
              </div>
              <button onClick={() => grannyCopy(`"Now honey, let me tell you something."\n\n"I've lived long enough to learn that most arguments aren't worth winning."\n\n"You can be right... or you can have peace."\n\n"And most days, peace is a whole lot better."\n\n"Call somebody you love today."\n\n"I'll see you on the porch tomorrow."`, 'sample')}
                style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                {grannyCopied === 'sample' ? '✓ Copied!' : '📋 Copy Script'}
              </button>
            </div>
          </div>
        )}

        {/* ── SCRIPT GENERATOR TAB ── */}
        {grannyTab === 'scripts' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="section-card">
                <h2>Generate a Granny Script</h2>
                <div className="form-group">
                  <label>Topic / Lesson *</label>
                  <input value={grannyTopic} onChange={e => setGrannyTopic(e.target.value)}
                    placeholder="e.g. Being kind costs nothing" />
                </div>
                {/* Quick topic chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                  {GRANNY_TOPICS.map(t => (
                    <button key={t} onClick={() => setGrannyTopic(t)}
                      style={{ background: grannyTopic === t ? '#fef3c7' : '#f7f8fa', border: `1px solid ${grannyTopic === t ? '#fde68a' : '#e5e7eb'}`, borderRadius: '999px', padding: '0.25rem 0.7rem', fontSize: '0.75rem', cursor: 'pointer', color: '#1c2b33' }}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="form-group">
                  <label>Script Type</label>
                  <select value={grannyType} onChange={e => setGrannyType(e.target.value)}>
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Length</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {Object.entries(DUR_LABELS).map(([v, l]) => (
                      <button key={v} onClick={() => setGrannyDuration(v)}
                        style={{ flex: 1, background: grannyDuration === v ? '#fef3c7' : '#f7f8fa', border: `1px solid ${grannyDuration === v ? '#f59e0b' : '#e5e7eb'}`, borderRadius: '0.5rem', padding: '0.5rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', color: '#1c2b33' }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {grannyError && <div style={{ background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: '0.5rem', padding: '0.6rem 0.85rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '0.75rem' }}>⚠️ {grannyError}</div>}
                <button onClick={generateGrannyScript} disabled={grannyLoading || !grannyTopic.trim()}
                  style={{ width: '100%', background: grannyLoading ? '#e5e7eb' : '#d97706', color: grannyLoading ? '#9ca3af' : '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.8rem', fontWeight: 800, fontSize: '1rem', cursor: grannyLoading ? 'not-allowed' : 'pointer' }}>
                  {grannyLoading ? '✍️ Writing Granny\'s script…' : '👵🏻 Generate Script'}
                </button>
              </div>

              {/* Result card */}
              {grannyScript && (
                <div className="section-card" style={{ gridColumn: 'span 1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h2 style={{ margin: 0 }}>Generated Script</h2>
                    <button onClick={() => grannyCopy(grannyScript.script, 'script')}
                      style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.85rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                      {grannyCopied === 'script' ? '✓ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '1.25rem', fontStyle: 'italic', color: '#78350f', lineHeight: 2, fontSize: '0.9375rem', marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
                    {grannyScript.script}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                      { label: '🎙️ ElevenLabs Voice Prompt', value: grannyScript.elevenlabs_prompt, key: 'el', bg: '#eff6ff', color: '#1e40af' },
                      { label: '🖼️ Thumbnail Idea',          value: grannyScript.thumbnail_idea,   key: 'th', bg: '#f0fdf4', color: '#065f46' },
                      { label: '📲 Hook Caption (social)',   value: grannyScript.hook_caption,     key: 'hk', bg: '#fff0f9', color: '#9d174d' },
                    ].map(({ label, value, key, bg, color }) => (
                      <div key={key} style={{ background: bg, borderRadius: '0.6rem', padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color, marginBottom: '0.3rem' }}>{label}</div>
                        <div style={{ fontSize: '0.875rem', color: '#1c2b33', lineHeight: 1.6 }}>{value}</div>
                        <button onClick={() => grannyCopy(value, key)}
                          style={{ marginTop: '0.4rem', background: 'none', border: `1px solid ${color}40`, borderRadius: '0.4rem', padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, color, cursor: 'pointer' }}>
                          {grannyCopied === key ? '✓ Copied!' : 'Copy'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SUBSCRIPTION MODEL TAB ── */}
        {grannyTab === 'subscription' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Business overview */}
            <div className="section-card" style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1px solid #fde68a' }}>
              <h2 style={{ color: '#92400e' }}>💰 The Granny Spills Business Model</h2>
              <p style={{ color: '#78350f', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.7 }}>
                The voice is the product. People don't follow Granny for information — they follow her for <strong>how she makes them feel</strong>.
                That emotional connection converts to newsletter subscribers, book buyers, and community members.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '1rem' }}>
                {[
                  { tier: 'Free',             price: '$0/mo',    desc: 'Daily 30-sec videos on TikTok, Instagram, YouTube Shorts',            icon: '🎥', color: '#6b7280' },
                  { tier: 'Newsletter',        price: '$0/mo',    desc: 'Weekly wisdom email — Granny\'s letter to the porch. Grows email list.', icon: '📬', color: '#3b82f6' },
                  { tier: 'Granny\'s Circle',  price: '$9/mo',    desc: 'Weekly longer audio/video + downloadable wisdom cards',               icon: '☕', color: '#10b981' },
                  { tier: 'Front Porch VIP',   price: '$27/mo',   desc: 'Monthly live Q&A, exclusive letters, printable recipe/life cards',    icon: '🌿', color: '#8b5cf6' },
                  { tier: 'Granny\'s Books',   price: '$9-19',    desc: '"Porch Wisdom" PDF/print books sold on Gumroad',                     icon: '📖', color: '#f59e0b' },
                  { tier: 'Brand Deals',       price: '$500+',    desc: 'Home goods, tea brands, greeting cards at 100K+ followers',          icon: '🤝', color: '#ef4444' },
                ].map(item => (
                  <div key={item.tier} style={{ background: '#fff', border: `1px solid ${item.color}30`, borderRadius: '0.75rem', padding: '1rem' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{item.icon}</div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1c2b33', marginBottom: '0.2rem' }}>{item.tier}</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: item.color, marginBottom: '0.4rem' }}>{item.price}</div>
                    <div style={{ color: '#637381', fontSize: '0.8rem', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Email/newsletter setup */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1.25rem' }}>
              <div className="section-card">
                <h2 style={{ color: '#3b82f6' }}>📬 Newsletter Strategy</h2>
                <p style={{ color: '#637381', fontSize: '0.875rem', marginBottom: '1rem', lineHeight: 1.6 }}>
                  The newsletter is the backbone. Every video ends with: <em>"Subscribe to Granny's weekly letter at [link]."</em> You own this list forever.
                </p>
                {[
                  { step: '1', title: 'Set up Beehiiv (free)', detail: 'Granny sends every Sunday morning — "Granny\'s Porch Letter"', link: 'https://beehiiv.com', linkLabel: 'beehiiv.com →' },
                  { step: '2', title: 'Welcome sequence (3 emails)', detail: 'Day 1: Welcome. Day 3: Best piece of advice. Day 7: Invite to Granny\'s Circle ($9/mo)', link: null, linkLabel: '' },
                  { step: '3', title: 'Weekly send — every Sunday', detail: '300-word wisdom letter. 1 life lesson. 1 quote. 1 call to action (buy book or upgrade).', link: null, linkLabel: '' },
                  { step: '4', title: 'Convert to paid', detail: 'At 500 subscribers → launch $9/mo Granny\'s Circle. At 2K → $27/mo Front Porch VIP.', link: null, linkLabel: '' },
                ].map(item => (
                  <div key={item.step} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.85rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900, flexShrink: 0 }}>{item.step}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1c2b33', marginBottom: '0.2rem' }}>{item.title}</div>
                      <div style={{ color: '#637381', fontSize: '0.8125rem', lineHeight: 1.5 }}>{item.detail}</div>
                      {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontSize: '0.78rem', fontWeight: 700 }}>{item.linkLabel}</a>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="section-card">
                <h2 style={{ color: '#8b5cf6' }}>📚 Gumroad Book Products</h2>
                <p style={{ color: '#637381', fontSize: '0.875rem', marginBottom: '1rem' }}>These write themselves — just compile Granny's wisdom into themed PDFs.</p>
                {[
                  { title: '"Porch Wisdom: 52 Weekly Letters"', price: '$12', desc: '52 short wisdom pieces — one for every Sunday of the year' },
                  { title: '"What Granny Knows About Love"',     price: '$9',  desc: '30 short lessons on relationships, kindness, and family' },
                  { title: '"Letters I Wish I\'d Gotten"',       price: '$15', desc: 'Longer personal letters for life moments: grief, new baby, divorce' },
                  { title: '"The Slow Life Guide"',              price: '$19', desc: 'Granny\'s guide to slowing down, being present, and finding peace' },
                ].map(book => (
                  <div key={book.title} style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '0.6rem', padding: '0.75rem', marginBottom: '0.6rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1c2b33' }}>{book.title}</div>
                    <div style={{ fontWeight: 800, color: '#8b5cf6', fontSize: '0.9rem' }}>{book.price}</div>
                    <div style={{ color: '#637381', fontSize: '0.8rem', marginTop: '0.2rem' }}>{book.desc}</div>
                  </div>
                ))}
                <button onClick={() => { setCurrentPage('gumroad'); }}
                  style={{ width: '100%', marginTop: '0.5rem', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.6rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                  Create in Gumroad Studio →
                </button>
              </div>

              {/* Revenue timeline */}
              <div className="section-card" style={{ gridColumn: '1 / -1' }}>
                <h2 style={{ color: '#10b981' }}>📈 Realistic Revenue Timeline</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: '#f0fdf4' }}>
                        {['Period', 'Followers', 'Email Subs', 'Revenue', 'Focus'].map(h => (
                          <th key={h} style={{ padding: '0.65rem 0.85rem', textAlign: 'left', color: '#065f46', fontWeight: 800, borderBottom: '2px solid #bbf7d0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Month 1-2',  '0 → 500',    '0 → 100',     '$0',          'Post daily 30-sec videos. Build voice consistency.'],
                        ['Month 3-4',  '500 → 2K',   '100 → 400',   '$50-200',     'Launch newsletter. Publish first Gumroad book ($9).'],
                        ['Month 5-6',  '2K → 10K',   '400 → 1.2K',  '$200-800',    'Launch $9/mo Granny\'s Circle. Second book.'],
                        ['Month 7-9',  '10K → 30K',  '1.2K → 4K',   '$1K-3K',      'Add $27/mo VIP tier. HeyGen lip-sync videos.'],
                        ['Month 10-12','30K → 75K',  '4K → 10K',    '$3K-8K',      'Brand deals. Course. Physical book pitch.'],
                      ].map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          {row.map((cell, j) => (
                            <td key={j} style={{ padding: '0.65rem 0.85rem', color: j === 3 ? '#10b981' : '#1c2b33', fontWeight: j === 3 ? 800 : 400 }}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CONTENT CALENDAR TAB ── */}
        {grannyTab === 'calendar' && (
          <div>
            <div className="section-card" style={{ marginBottom: '1.25rem' }}>
              <h2>📅 Granny's Weekly Posting Schedule</h2>
              <p style={{ color: '#637381', fontSize: '0.875rem', marginBottom: '1.25rem' }}>Consistency is everything. Granny posts the same time every day — readers should expect her like clockwork.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '0.75rem' }}>
                {[
                  { day: 'Monday',    type: '☀️ Morning Reminder',  platform: 'TikTok + Reels',    tip: '"Start the week right, honey."' },
                  { day: 'Tuesday',   type: '🌿 Life Lesson',        platform: 'YouTube Shorts',    tip: 'Longer 60-sec wisdom piece' },
                  { day: 'Wednesday', type: '💬 Signature Quote',    platform: 'Instagram Post',    tip: 'Quote card — simple design' },
                  { day: 'Thursday',  type: '📖 Story Time',         platform: 'TikTok + Reels',    tip: 'Personal story with lesson' },
                  { day: 'Friday',    type: '❤️ Encouragement',      platform: 'All platforms',      tip: '"You\'ve done good this week."' },
                  { day: 'Saturday',  type: '🎁 Subscribe Invite',   platform: 'TikTok + YouTube',  tip: 'Soft pitch for newsletter' },
                  { day: 'Sunday',    type: '📬 Newsletter Send',     platform: 'Email (Beehiiv)',    tip: 'Granny\'s weekly letter goes out' },
                ].map(item => (
                  <div key={item.day} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '0.85rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.875rem', color: '#92400e', marginBottom: '0.2rem' }}>{item.day}</div>
                    <div style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}>{item.type}</div>
                    <div style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 700, marginBottom: '0.4rem' }}>{item.platform}</div>
                    <div style={{ fontSize: '0.78rem', color: '#78350f', fontStyle: 'italic' }}>{item.tip}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="section-card">
              <h2>🌱 30-Day Quick-Start Topics</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '0.4rem' }}>
                {[
                  'Why kindness is never a mistake', 'Put the phone down', 'Call somebody you love',
                  'Most arguments aren\'t worth winning', 'Say sorry first', 'Sleep is wisdom',
                  'A good meal fixes almost anything', 'Slow down and notice things', 'Write a thank-you note',
                  'Don\'t compare your life', 'Be someone\'s reason to smile', 'Fix what you can, let go of the rest',
                  'Tell people you love them now', 'Forgiveness is peace, not approval', 'Plant something and watch it grow',
                  'Cook for someone who needs it', 'Read something every day', 'Make your bed every morning',
                  'Visit someone who is lonely', 'Keep a few good friends', 'Pray or be grateful daily',
                  'Don\'t rush the good parts', 'A walk cures most things', 'Bake for your neighbors',
                  'Write down what you\'re thankful for', 'Rest is not lazy', 'Talk to elderly people — they know',
                  'Save something for a rainy day', 'Mean what you say', 'Leave things better than you found them',
                ].map((topic, i) => (
                  <button key={i} onClick={() => { setGrannyTopic(topic); setGrannyTab('scripts'); }}
                    style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: '0.5rem', padding: '0.5rem 0.65rem', fontSize: '0.8rem', cursor: 'pointer', color: '#78350f', textAlign: 'left', fontWeight: 500 }}>
                    {i+1}. {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── VIDEO SETUP TAB ── */}
        {grannyTab === 'video' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1.25rem' }}>
            <div className="section-card">
              <h2 style={{ color: '#d97706' }}>🖼️ Granny Visual Style</h2>
              <p style={{ color: '#637381', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Warm, inviting, and timeless. Viewers should feel like they stepped onto a front porch.
              </p>
              {[
                { label: 'Setting',    val: 'Front porch, rocking chair, soft afternoon light' },
                { label: 'Colors',     val: 'Warm amber, cream, sage green, faded wood tones' },
                { label: 'Clothing',   val: 'Floral housedress or soft cardigan, reading glasses' },
                { label: 'Props',      val: 'Cup of tea, open book, garden flowers, handkerchief' },
                { label: 'Camera',     val: 'Close-up or medium shot. Never fast cuts. Slow and steady.' },
                { label: 'Captions',   val: 'Simple serif font, warm color, large and readable' },
              ].map(item => (
                <div key={item.label} style={{ borderBottom: '1px solid #fde68a', padding: '0.5rem 0', display: 'flex', gap: '0.75rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#d97706', minWidth: '70px' }}>{item.label}</span>
                  <span style={{ color: '#78350f', fontSize: '0.8rem', lineHeight: 1.5 }}>{item.val}</span>
                </div>
              ))}
            </div>

            <div className="section-card">
              <h2 style={{ color: '#8b5cf6' }}>🤖 HeyGen Lip-Sync Setup</h2>
              <p style={{ color: '#637381', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Once you have consistent Granny images, combine with ElevenLabs audio using HeyGen for talking videos.
              </p>
              <div style={{ background: '#1e293b', borderRadius: '0.6rem', padding: '1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 2, marginBottom: '1rem' }}>
                <span style={{ color: '#a78bfa' }}>Step 1:</span> Generate Granny image (consistent look)<br/>
                <span style={{ color: '#a78bfa' }}>Step 2:</span> Generate audio via ElevenLabs<br/>
                <span style={{ color: '#a78bfa' }}>Step 3:</span> Upload both to HeyGen<br/>
                <span style={{ color: '#a78bfa' }}>Step 4:</span> Generate lip-sync video (2-3 min)<br/>
                <span style={{ color: '#a78bfa' }}>Step 5:</span> Add captions + post
              </div>
              <a href="https://heygen.com" target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-block', background: '#8b5cf6', color: '#fff', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.8125rem', textDecoration: 'none' }}>
                🔗 Open HeyGen →
              </a>
            </div>

            <div className="section-card">
              <h2 style={{ color: '#10b981' }}>✍️ AI Image Prompt — Granny</h2>
              <div style={{ background: '#1e293b', borderRadius: '0.6rem', padding: '1rem', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.8, fontFamily: 'monospace', marginBottom: '0.75rem' }}>
                Photorealistic elderly Southern grandmother, age 72, silver-white hair in a soft bun, warm smile with kind eyes, wearing a floral housedress and pearl earrings, sitting on a wooden front porch rocking chair, holding a cup of tea, afternoon golden hour light, lush green garden background, warm amber tones, cozy and inviting atmosphere, 4K, hyperrealistic
              </div>
              <button onClick={() => grannyCopy('Photorealistic elderly Southern grandmother, age 72, silver-white hair in a soft bun, warm smile with kind eyes, wearing a floral housedress and pearl earrings, sitting on a wooden front porch rocking chair, holding a cup of tea, afternoon golden hour light, lush green garden background, warm amber tones, cozy and inviting atmosphere, 4K, hyperrealistic', 'img')}
                style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                {grannyCopied === 'img' ? '✓ Copied!' : '📋 Copy Prompt'}
              </button>
              <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a href="https://www.midjourney.com" target="_blank" rel="noopener noreferrer"
                  style={{ background: '#1c2b33', color: '#fff', borderRadius: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}>Midjourney →</a>
                <a href="https://creator.nightcafe.studio" target="_blank" rel="noopener noreferrer"
                  style={{ background: '#4c1d95', color: '#fff', borderRadius: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}>NightCafe →</a>
              </div>
            </div>

            {/* Quick-start button */}
            <div className="section-card" style={{ gridColumn: '1 / -1', background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1px solid #fde68a' }}>
              <h2 style={{ color: '#92400e' }}>🚀 Quick Start — Generate Your First Granny Script</h2>
              <p style={{ color: '#78350f', fontSize: '0.875rem', marginBottom: '1rem' }}>You have everything you need. Start with one 30-second video and post it today.</p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={() => { setGrannyTopic('Being kind costs nothing'); setGrannyTab('scripts'); }}
                  style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.65rem 1.25rem', fontWeight: 700, cursor: 'pointer' }}>
                  👵🏻 Write First Script →
                </button>
                <button onClick={() => setGrannyTab('subscription')}
                  style={{ background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.65rem 1.25rem', fontWeight: 700, cursor: 'pointer' }}>
                  💰 See Business Model →
                </button>
                <button onClick={() => setCurrentPage('funnel')}
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.65rem 1.25rem', fontWeight: 700, cursor: 'pointer' }}>
                  📧 Set Up Email Funnel →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Sidebar navigation definition ──────────────────────────────────────────

  // -- AI Influencer Studio state --
  const [infTab,          setInfTab]          = useState<'profile' | 'calendar' | 'scripts' | 'images' | 'business'>('profile');
  const [infName,         setInfName]         = useState('Chloe Hart');
  const [infAge,          setInfAge]          = useState('23');
  const [infHair,         setInfHair]         = useState('Blonde waves');
  const [infEyes,         setInfEyes]         = useState('Blue-green');
  const [infNiche,        setInfNiche]        = useState('Education & AI Tools');
  const [infPersonality,  setInfPersonality]  = useState('Smart but relatable, optimistic, slightly playful');
  const [infTagline,      setInfTagline]      = useState('Making learning smarter, simpler, and more fun.');
  const [infPlatforms,    setInfPlatforms]    = useState<string[]>(['tiktok', 'instagram', 'youtube']);
  const [infCalendar,     setInfCalendar]     = useState<{day:number;platform:string;type:string;topic:string;hook:string}[]>([]);
  const [infCalLoading,   setInfCalLoading]   = useState(false);
  const [infScriptResult, setInfScriptResult] = useState('');
  const [infScriptLoading,setInfScriptLoading]= useState(false);
  const [infScriptType,   setInfScriptType]   = useState('tiktok_reel');
  const [infImgPrompts,   setInfImgPrompts]   = useState<string[]>([]);
  const [infImgLoading,   setInfImgLoading]   = useState(false);
  const [infCopied,       setInfCopied]       = useState('');
  const [infLook,         setInfLook]         = useState('');
  const [infLookLoading,  setInfLookLoading]  = useState(false);

  const infCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setInfCopied(key);
    setTimeout(() => setInfCopied(''), 2000);
  };

  const generateCalendar = async () => {
    setInfCalLoading(true);
    try {
      const prompt = `Create a 30-day social media content calendar for an AI education influencer named ${infName}, age ${infAge}, ${infHair} hair. Niche: ${infNiche}. Tagline: "${infTagline}". Platforms: ${infPlatforms.join(', ')}. Return a JSON array of 30 objects: {day, platform, type (Reel|Short|Post|Story|LinkedIn), topic, hook (opening line max 15 words)}. Return ONLY the JSON array.`;
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: prompt }) });
      const data = await res.json();
      const raw = (data.answer || data.response || '').trim();
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) setInfCalendar(JSON.parse(match[0]));
    } catch { setInfCalendar([]); }
    setInfCalLoading(false);
  };

  const generateInfluencerScript = async () => {
    setInfScriptLoading(true); setInfScriptResult('');
    try {
      const typeLabel: Record<string,string> = { tiktok_reel: 'viral TikTok/Reels (60 sec)', youtube_short: 'YouTube Short (60 sec)', youtube_long: 'YouTube video (8 min)', linkedin_post: 'LinkedIn post', instagram_caption: 'Instagram carousel caption' };
      const prompt = `Write a ${typeLabel[infScriptType] || infScriptType} for ${infName}, an AI education influencer, age ${infAge}. Niche: ${infNiche}. Personality: ${infPersonality}. Tagline: "${infTagline}". Include hook, main content, and CTA. Format clearly with sections.`;
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: prompt }) });
      const data = await res.json();
      setInfScriptResult(data.answer || data.response || 'No response from AI');
    } catch { setInfScriptResult('Error generating script.'); }
    setInfScriptLoading(false);
  };

  const generateImagePrompts = async () => {
    setInfImgLoading(true); setInfImgPrompts([]);
    try {
      const prompt = `Generate 8 detailed photorealistic AI image prompts for ${infName}, age ${infAge}, ${infHair} hair, ${infEyes} eyes. Niche: ${infNiche}. Each prompt: specific scene, outfit, pose, lighting, mood. Vary locations: home office, coffee shop, campus, outdoors, gym, library, studio, rooftop. Style: photorealistic, bright clean Instagram aesthetic. Return ONLY a JSON array of 8 strings.`;
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: prompt }) });
      const data = await res.json();
      const raw = (data.answer || data.response || '').trim();
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) setInfImgPrompts(JSON.parse(match[0]));
    } catch { setInfImgPrompts([]); }
    setInfImgLoading(false);
  };

  const generateLookPrompt = async () => {
    setInfLookLoading(true); setInfLook('');
    try {
      const prompt = `You are Roxy AI. Create a detailed AI character sheet for a social media influencer named ${infName}, age ${infAge}, ${infHair} hair, ${infEyes} eyes. Niche: ${infNiche}. Include: full physical description for AI image generation, wardrobe style guide, color palette, background/setting guide, facial expression guide, lighting style, and a LoRA training prompt for visual consistency. Make it detailed enough to maintain 100% visual consistency across hundreds of AI-generated images.`;
      const res = await apiFetch(`${API_BASE}/api/v1/scripts/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: prompt }) });
      const data = await res.json();
      setInfLook(data.answer || data.response || '');
    } catch { setInfLook('Error generating character sheet.'); }
    setInfLookLoading(false);
  };

  const INF_PLATFORMS = ['tiktok','instagram','youtube','linkedin','twitter'];
  const infPlatIcon = (p: string) => ({'tiktok':'TT','instagram':'IG','youtube':'YT','linkedin':'LI','twitter':'X'} as Record<string,string>)[p] ?? '?';

  const renderInfluencer = () => (
    <div className="videos-page">
      <div className="page-header">
        <div>
          <h1>AI Education Influencer Studio</h1>
          <p className="page-subtitle">Design, brand, and launch your AI-powered education influencer. Roxy AI-style character sheet, 30-day calendar, viral scripts, image prompts, and full business model.</p>
        </div>
      </div>

      <div className="section-card" style={{ background: 'linear-gradient(135deg,#e8f7ef,#f0f9ff)', border: '1px solid #b7e4cc', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#2a9d5c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0, color: '#fff', fontWeight: 800 }}>AI</div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1c2b33' }}>{infName || 'Your Influencer'}</div>
            <div style={{ color: '#637381', fontSize: '0.875rem', margin: '0.2rem 0' }}>Age {infAge} · {infHair} · {infEyes}</div>
            <div style={{ color: '#2a9d5c', fontSize: '0.875rem', fontWeight: 600, fontStyle: 'italic' }}>"{infTagline}"</div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {infPlatforms.map(p => <span key={p} style={{ background: '#fff', border: '1px solid #e3e8ef', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, color: '#1c2b33' }}>{infPlatIcon(p)} {p}</span>)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#637381' }}>Niche</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1c2b33' }}>{infNiche}</div>
          </div>
        </div>
      </div>

      <div className="tab-bar">
        {([
          { id: 'profile' as const,  label: 'Profile' },
          { id: 'calendar' as const, label: '30-Day Calendar' },
          { id: 'scripts' as const,  label: 'Viral Scripts' },
          { id: 'images' as const,   label: 'Image Prompts' },
          { id: 'business' as const, label: 'Business Model' },
        ]).map(t => (
          <button key={t.id} className={`tab-btn ${infTab === t.id ? 'active' : ''}`} onClick={() => setInfTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {infTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1.25rem' }}>
          <div className="section-card">
            <h2>Character Design</h2>
            <div className="form-group"><label>Name</label><input value={infName} onChange={e => setInfName(e.target.value)} placeholder="Chloe Hart" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group"><label>Age</label><input value={infAge} onChange={e => setInfAge(e.target.value)} placeholder="23" /></div>
              <div className="form-group"><label>Hair</label><input value={infHair} onChange={e => setInfHair(e.target.value)} placeholder="Blonde waves" /></div>
            </div>
            <div className="form-group"><label>Eye Colour</label><input value={infEyes} onChange={e => setInfEyes(e.target.value)} placeholder="Blue-green" /></div>
            <div className="form-group"><label>Tagline</label><input value={infTagline} onChange={e => setInfTagline(e.target.value)} placeholder="Making learning smarter, simpler, and more fun." /></div>
          </div>

          <div className="section-card">
            <h2>Brand Identity</h2>
            <div className="form-group"><label>Niche</label>
              <select value={infNiche} onChange={e => setInfNiche(e.target.value)}>
                <option>Education & AI Tools</option>
                <option>STEM & Science</option>
                <option>Language Learning</option>
                <option>History & Culture</option>
                <option>Productivity & Study Skills</option>
                <option>Career & Professional Growth</option>
                <option>Math & Coding</option>
                <option>Health & Wellness Education</option>
              </select>
            </div>
            <div className="form-group"><label>Personality</label>
              <textarea rows={3} value={infPersonality} onChange={e => setInfPersonality(e.target.value)} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group"><label>Platforms</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {INF_PLATFORMS.map(p => (
                  <button key={p} onClick={() => setInfPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                    style={{ background: infPlatforms.includes(p) ? '#2a9d5c' : '#f4f6f8', color: infPlatforms.includes(p) ? '#fff' : '#637381', border: `1px solid ${infPlatforms.includes(p) ? '#2a9d5c' : '#e3e8ef'}`, borderRadius: '999px', padding: '0.3rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    {infPlatIcon(p)} {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="section-card" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>Roxy AI-Style Character Sheet</h2>
                <p style={{ color: '#637381', fontSize: '0.8125rem', margin: '0.25rem 0 0' }}>Full visual consistency guide — physical description, wardrobe, lighting style, and LoRA training prompt so every AI image of {infName} looks identical.</p>
              </div>
              <button className="btn-primary" onClick={generateLookPrompt} disabled={infLookLoading}>{infLookLoading ? 'Generating...' : 'Generate Character Sheet'}</button>
            </div>
            {infLook && (
              <div>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', color: '#1c2b33', lineHeight: 1.7, fontFamily: 'inherit', background: '#f4f6f8', borderRadius: '0.5rem', padding: '1rem', margin: 0 }}>{infLook}</pre>
                <button className="btn-secondary" style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.4rem 0.85rem' }} onClick={() => infCopy(infLook, 'look')}>{infCopied === 'look' ? 'Copied!' : 'Copy Character Sheet'}</button>
              </div>
            )}
          </div>

          <div className="section-card" style={{ gridColumn: '1 / -1' }}>
            <h2>Ready-to-Use Bio & First Post</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#637381', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Instagram Bio</div>
                <div style={{ background: '#f4f6f8', borderRadius: '0.5rem', padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#1c2b33', lineHeight: 1.7 }}>
                  Learning smarter with AI<br/>
                  {infNiche}<br/>
                  Helping you grow every day<br/>
                  Free AI resources below<br/>
                  <span style={{ color: '#2a9d5c', fontWeight: 600 }}>"{infTagline}"</span>
                </div>
                <button className="btn-secondary" style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.4rem 0.85rem' }} onClick={() => infCopy(`Learning smarter with AI\n${infNiche}\nHelping you grow every day\nFree AI resources below\n"${infTagline}"`, 'bio')}>{infCopied === 'bio' ? 'Copied!' : 'Copy Bio'}</button>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#637381', textTransform: 'uppercase', marginBottom: '0.5rem' }}>First Post Caption</div>
                <div style={{ background: '#f4f6f8', borderRadius: '0.5rem', padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#1c2b33', lineHeight: 1.7 }}>
                  Hi, I am {infName}!<br/>
                  I help students and professionals learn faster and work smarter with AI. Follow for practical tips, productivity strategies, and career advice that actually works.<br/>
                  <span style={{ color: '#2a9d5c' }}>#{(infNiche||'education').replace(/[^a-zA-Z]/g,'')} #AI #LearnWithMe</span>
                </div>
                <button className="btn-secondary" style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.4rem 0.85rem' }} onClick={() => infCopy(`Hi, I am ${infName}!\nI help students and professionals learn faster and work smarter with AI.\n#${(infNiche||'education').replace(/[^a-zA-Z]/g,'')} #AI #LearnWithMe`, 'post')}>{infCopied === 'post' ? 'Copied!' : 'Copy Post'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {infTab === 'calendar' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <p style={{ color: '#637381', fontSize: '0.875rem', flex: 1, margin: 0 }}>AI generates a full 30-day posting schedule tailored to {infName}.</p>
            <button className="btn-primary" onClick={generateCalendar} disabled={infCalLoading}>{infCalLoading ? 'Generating...' : 'Generate 30-Day Calendar'}</button>
          </div>
          {infCalendar.length === 0 && !infCalLoading && <div className="info-block">Click Generate to create a full month of content ideas for {infName}.</div>}
          {infCalLoading && <div className="info-block">Building your 30-day calendar...</div>}
          {infCalendar.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: '#1c2b33', fontSize: '0.875rem' }}>{infCalendar.length} posts planned</div>
                <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }} onClick={() => infCopy(infCalendar.map(d => `Day ${d.day} | ${d.platform} | ${d.type}\n${d.topic}\nHook: ${d.hook}`).join('\n\n'), 'calendar')}>{infCopied === 'calendar' ? 'Copied!' : 'Copy All'}</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '0.65rem' }}>
                {infCalendar.map((day, i) => {
                  const platColors: Record<string,string> = { tiktok: '#69c9d0', instagram: '#e1306c', youtube: '#ef4444', linkedin: '#0077b5', twitter: '#1da1f2' };
                  const col = platColors[day.platform] ?? '#2a9d5c';
                  return (
                    <div key={i} style={{ background: '#fff', border: '1px solid #e3e8ef', borderLeft: `3px solid ${col}`, borderRadius: '0.5rem', padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: col, textTransform: 'uppercase' }}>Day {day.day}</span>
                        <span style={{ fontSize: '0.72rem', background: '#f4f6f8', borderRadius: '999px', padding: '0.1rem 0.5rem', color: '#637381', fontWeight: 600 }}>{day.type}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1c2b33', marginBottom: '0.3rem' }}>{day.topic}</div>
                      <div style={{ fontSize: '0.8rem', color: '#637381', fontStyle: 'italic' }}>"{day.hook}"</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {infTab === 'scripts' && (
        <div>
          <div className="section-card">
            <h2>Script Generator</h2>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: '1 1 200px', margin: 0 }}><label>Script Type</label>
                <select value={infScriptType} onChange={e => setInfScriptType(e.target.value)}>
                  <option value="tiktok_reel">TikTok / Instagram Reel (60 sec)</option>
                  <option value="youtube_short">YouTube Short (60 sec)</option>
                  <option value="youtube_long">YouTube Video (8 min)</option>
                  <option value="linkedin_post">LinkedIn Post</option>
                  <option value="instagram_caption">Instagram Carousel Caption</option>
                </select>
              </div>
              <button className="btn-primary" style={{ marginBottom: '1rem' }} onClick={generateInfluencerScript} disabled={infScriptLoading}>{infScriptLoading ? 'Writing...' : 'Generate Script'}</button>
            </div>
          </div>
          {infScriptResult && (
            <div className="section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ margin: 0 }}>Generated Script</h2>
                <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }} onClick={() => infCopy(infScriptResult, 'script')}>{infCopied === 'script' ? 'Copied!' : 'Copy'}</button>
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', color: '#1c2b33', lineHeight: 1.7, fontFamily: 'inherit', margin: 0 }}>{infScriptResult}</pre>
            </div>
          )}
          <div className="section-card">
            <h2>Proven Formats for {infName}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '0.75rem' }}>
              {[
                { platform: 'TikTok',   title: '1 AI Tool Every Student Should Know', desc: 'Quick explainer + demo. High save rate.' },
                { platform: 'Reels',    title: '30-Second Study Hack',                 desc: 'Fast tips. Shareable to stories.' },
                { platform: 'YouTube',  title: 'Study With Me (1hr)',                  desc: 'Passive watch time. High retention.' },
                { platform: 'TikTok',   title: 'AI vs Human Challenge',                desc: 'Engagement bait. Comments fire.' },
                { platform: 'YouTube',  title: 'I Used AI for My Entire Week',         desc: 'Vlog format. Great watch time.' },
                { platform: 'LinkedIn', title: '5 Skills AI Will Not Replace',         desc: 'Thought leadership. Gets reshared.' },
                { platform: 'Reels',    title: 'POV: Studying with AI',                desc: 'Relatable POV. High saves.' },
                { platform: 'Shorts',   title: 'Career Mistake I Wish I Avoided',      desc: 'Story format. Very high CTR.' },
              ].map((idea, i) => (
                <div key={i} style={{ background: '#f4f6f8', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#637381', marginBottom: '0.3rem', textTransform: 'uppercase' }}>{idea.platform}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1c2b33', marginBottom: '0.25rem' }}>{idea.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#637381' }}>{idea.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {infTab === 'images' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <p style={{ color: '#637381', fontSize: '0.875rem', flex: 1, margin: 0 }}>Generate 8 photorealistic AI image prompts for {infName} across different scenes. Paste into Midjourney, DALL-E 3, or AI Visuals.</p>
            <button className="btn-primary" onClick={generateImagePrompts} disabled={infImgLoading}>{infImgLoading ? 'Generating...' : 'Generate Image Prompts'}</button>
          </div>
          {infImgLoading && <div className="info-block">Crafting prompts for {infName}...</div>}
          {infImgPrompts.length === 0 && !infImgLoading && <div className="info-block">Click Generate to get 8 scene-specific prompts for any AI image generator.</div>}
          {infImgPrompts.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: '#1c2b33' }}>{infImgPrompts.length} prompts ready</div>
                <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }} onClick={() => infCopy(infImgPrompts.map((p,i2) => `Scene ${i2+1}:\n${p}`).join('\n\n'), 'imgprompts')}>{infCopied === 'imgprompts' ? 'Copied!' : 'Copy All'}</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {infImgPrompts.map((prompt, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e3e8ef', borderRadius: '0.5rem', padding: '0.9rem 1.1rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2a9d5c', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Scene {i + 1}</div>
                      <div style={{ fontSize: '0.875rem', color: '#1c2b33', lineHeight: 1.6 }}>{prompt}</div>
                    </div>
                    <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem', flexShrink: 0 }} onClick={() => infCopy(prompt, `img${i}`)}>{infCopied === `img${i}` ? 'OK' : 'Copy'}</button>
                  </div>
                ))}
              </div>
              <div className="info-block" style={{ marginTop: '1rem' }}>Tip: Use these prompts in AI Visuals (sidebar) or paste into Midjourney / DALL-E 3 for photorealistic results.</div>
            </div>
          )}
        </div>
      )}

      {infTab === 'business' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '1.25rem' }}>
          {[
            { tag: 'Sub', title: 'Educational Subscriptions', color: '#2a9d5c', items: ['$9/mo - Premium study guides', '$29/mo - Weekly live AI sessions', '$99/mo - 1-on-1 AI tutoring', 'Full course library bundle'], est: '$500-5K/mo at 50-500 subscribers' },
            { tag: 'Crs', title: 'Course Sales', color: '#3b82f6', items: ['Master AI Tools in 30 Days - $97', 'Study Smarter Not Harder - $47', 'Get Your Dream Job with AI - $127', 'School licensing - $500+/yr'], est: '$1K-10K/launch' },
            { tag: 'Spo', title: 'Sponsored Content', color: '#8b5cf6', items: ['Ed-tech integrations (Notion, Coursera)', 'AI app sponsors (Grammarly, ChatGPT)', 'Study tool brands (Anki, Quizlet)', 'University partnerships'], est: '$500-5K/post at 50K+ followers' },
            { tag: 'Tut', title: 'Premium Tutoring', color: '#f59e0b', items: ['AI-assisted homework help', 'Exam prep intensives', 'Subject-specific deep-dives', 'Study group memberships'], est: '$50-200/hr' },
            { tag: 'Ads', title: 'Platform Monetization', color: '#ef4444', items: ['YouTube AdSense ($3-15 CPM)', 'TikTok Creator Fund + Series', 'Instagram Subscriptions', 'LinkedIn newsletters'], est: '$200-2K/mo at 100K views' },
            { tag: 'B2B', title: 'B2B & Institutional', color: '#06b6d4', items: ['School district licensing', 'Corporate L&D partnerships', 'University guest lectures', 'EdTech white-labeling'], est: '$2K-20K/contract' },
          ].map((stream, i) => (
            <div key={i} className="section-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, background: stream.color, color: '#fff', borderRadius: '0.375rem', padding: '0.2rem 0.5rem' }}>{stream.tag}</span>
                <h2 style={{ margin: 0, color: stream.color }}>{stream.title}</h2>
              </div>
              <ul style={{ paddingLeft: '1.1rem', margin: '0 0 0.75rem' }}>
                {stream.items.map((item, j) => <li key={j} style={{ color: '#1c2b33', fontSize: '0.875rem', padding: '0.2rem 0' }}>{item}</li>)}
              </ul>
              <div style={{ background: '#e8f7ef', borderRadius: '0.375rem', padding: '0.45rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: '#1a6640' }}>Est: {stream.est}</div>
            </div>
          ))}
          <div className="section-card" style={{ gridColumn: '1 / -1' }}>
            <h2>Revenue Roadmap for {infName}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: '0.75rem' }}>
              {[
                { period: 'Month 1-2',   income: '$0-50',    goal: 'Brand & Build',  action: 'Set up profiles, post daily, build first 1K followers. TikTok + Reels focus.' },
                { period: 'Month 3-4',   income: '$50-500',  goal: 'First Income',   action: 'First affiliate commissions. Free lead magnet. Start email list.' },
                { period: 'Month 5-6',   income: '$500-2K',  goal: 'Course Launch',  action: 'Launch first paid course. First sponsors. YouTube gains traction.' },
                { period: 'Month 7-9',   income: '$2K-5K',   goal: 'Scale',          action: 'Subscription community. School partnerships. Batch-produce with AI.' },
                { period: 'Month 10-12', income: '$5K-15K',  goal: 'Full Business',  action: 'B2B licensing. Multiple revenue streams. Fully automated content.' },
              ].map((phase, i) => (
                <div key={i} style={{ background: '#f4f6f8', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#637381', textTransform: 'uppercase' }}>{phase.period}</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#2a9d5c', margin: '0.15rem 0' }}>{phase.income}/mo</div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1c2b33', marginBottom: '0.3rem' }}>{phase.goal}</div>
                  <div style={{ fontSize: '0.8rem', color: '#637381', lineHeight: 1.5 }}>{phase.action}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const NAV_SECTIONS = [
    {
      label: 'Dashboard',
      items: [
        { id: 'home',        icon: '🏠', label: 'Dashboard',        badge: null },
        { id: 'advisor',     icon: '🧭', label: 'Growth Advisor',   badge: 'AI' },
        { id: 'monitor',     icon: '📡', label: 'Performance',      badge: null },
        { id: 'analytics',   icon: '📊', label: 'Analytics',        badge: null },
        { id: 'orders',      icon: '🛍️', label: 'Orders',           badge: null },
        { id: 'gumroad',     icon: '🛒', label: 'Gumroad Studio',   badge: null },
        { id: 'funnel',      icon: '📧', label: 'X & Email Funnel', badge: 'New' },
        { id: 'monetize',    icon: '💰', label: 'Monetize',         badge: null },
      ],
    },
    {
      label: 'Create',
      items: [
        { id: 'voice',       icon: '🎙️', label: 'Voice Studio',     badge: 'EL' },
        { id: 'scripts',     icon: '📝', label: 'Scripts',          badge: null },
        { id: 'blueprint',   icon: '🗺️', label: 'Blueprint',        badge: null },
        { id: 'videos',      icon: '🎬', label: 'Video Generator',  badge: videoProvider?.provider === 'veo' ? 'Veo3' : null },
        { id: 'visuals',     icon: '🎨', label: 'AI Visuals',       badge: null },
        { id: 'influencer',  icon: 'AI', label: 'AI Influencer',    badge: 'New' },
        { id: 'granny',      icon: '👵🏻', label: 'Granny Spills',    badge: 'New' },
      ],
    },
    {
      label: 'Research',
      items: [
        { id: 'source',      icon: '🔍', label: 'Source',           badge: null },
        { id: 'parrot',      icon: '🦜', label: 'Parrot',           badge: null },
        { id: 'trending',    icon: '🔥', label: 'Trending',         badge: null },
      ],
    },
    {
      label: 'Settings',
      items: [
        { id: 'diagnostics', icon: '🔧', label: 'Diagnostics',      badge: null },
        { id: 'help',        icon: '📖', label: 'Help & Guide',     badge: null },
      ],
    },
  ] as const;

  // ── What's Next helper ───────────────────────────────────────────────────────
  const NEXT_PAGE: Record<string, { page: string; label: string; hint: string }> = {
    home:        { page: 'advisor',   label: 'Get Action Plan →',      hint: 'AI advisor tells you exactly what to do next' },
    advisor:     { page: 'scripts',   label: 'Write a Script →',       hint: 'Generate an AI script for your next video' },
    scripts:     { page: 'blueprint', label: 'Build Blueprint →',      hint: 'Turn your script into a full video blueprint' },
    blueprint:   { page: 'videos',    label: 'Generate Video →',       hint: 'Create the AI video from your blueprint' },
    videos:      { page: 'monitor',   label: 'Check Performance →',    hint: 'See how your published videos are performing' },
    monitor:     { page: 'analytics', label: 'View Analytics →',       hint: 'Deep dive into platform analytics' },
    analytics:   { page: 'orders',    label: 'View Orders →',          hint: 'See Gumroad orders and pipeline status' },
    orders:      { page: 'monetize',  label: 'Monetize →',             hint: 'Set up affiliate links and revenue streams' },
    monetize:    { page: 'home',      label: '← Back to Dashboard',    hint: 'Return to your revenue dashboard' },
    source:      { page: 'parrot',    label: 'Parrot a Video →',       hint: 'Clone the structure of a viral video' },
    parrot:      { page: 'trending',  label: 'See Trending →',         hint: 'Find what is trending right now' },
    trending:    { page: 'scripts',   label: 'Write Script →',         hint: 'Turn a trending topic into a script' },
    voice:       { page: 'videos',    label: 'Generate Video →',       hint: 'Use your voiceover in a full video' },
    visuals:     { page: 'videos',    label: 'Generate Video →',       hint: 'Use your visuals in a full video' },
    influencer:  { page: 'granny',    label: 'Granny Spills →', hint: 'Build the Granny Spills subscription character' },
    granny:      { page: 'visuals',   label: 'AI Visuals →',    hint: 'Generate Granny images for video thumbnails' },
    diagnostics: { page: 'help',      label: 'Read Guide →',           hint: 'Full workflow guide and tips' },
    help:        { page: 'home',      label: '← Dashboard',            hint: 'Return to your dashboard' },
  };

  const WhatsNext = ({ page }: { page: string }) => {
    const next = NEXT_PAGE[page];
    if (!next) return null;
    return (
      <div className="whats-next-bar">
        <span className="whats-next-label">What's Next</span>
        <span className="whats-next-text">{next.hint}</span>
        <button className="whats-next-btn" onClick={() => {
          setCurrentPage(next.page as any);
          if (next.page === 'monitor') loadMonitorData(monitorDays);
          if (next.page === 'analytics') fetchAnalytics();
          if (next.page === 'orders') fetchOrders('all', 1);
        }}>
          {next.label}
        </button>
      </div>
    );
  };

  // ── User Management page (admin only) ─────────────────────────────────────
  const [usersList, setUsersList]           = React.useState<any[]>([]);
  const [usersLoading, setUsersLoading]     = React.useState(false);
  const [usersError, setUsersError]         = React.useState('');
  const [newEmail, setNewEmail]             = React.useState('');
  const [newPassword, setNewPassword]       = React.useState('');
  const [newRole, setNewRole]               = React.useState<'admin'|'viewer'>('viewer');
  const [addingUser, setAddingUser]         = React.useState(false);
  const [addUserError, setAddUserError]     = React.useState('');
  const [addUserSuccess, setAddUserSuccess] = React.useState('');

  const loadUsers = async () => {
    setUsersLoading(true); setUsersError('');
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/auth/users`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      setUsersList(await res.json());
    } catch (err) { setUsersError(err instanceof Error ? err.message : 'Failed to load users'); }
    finally { setUsersLoading(false); }
  };

  const addUser = async () => {
    if (!newEmail.trim() || !newPassword.trim()) return;
    setAddingUser(true); setAddUserError(''); setAddUserSuccess('');
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), password: newPassword, role: newRole }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      setAddUserSuccess(`User ${newEmail.trim()} added!`);
      setNewEmail(''); setNewPassword(''); setNewRole('viewer');
      await loadUsers();
    } catch (err) { setAddUserError(err instanceof Error ? err.message : 'Failed to add user'); }
    finally { setAddingUser(false); }
  };

  const deleteUser = async (id: string, email: string) => {
    if (!window.confirm(`Delete ${email}?`)) return;
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/auth/users/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      await loadUsers();
    } catch (err) { setUsersError(err instanceof Error ? err.message : 'Delete failed'); }
  };

  const renderUsers = () => {
    if (usersLoading && usersList.length === 0) {
      return <div style={{ padding: '2rem', color: '#57606a' }}>Loading users…</div>;
    }
    return (
      <div style={{ padding: '2rem', maxWidth: '720px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1f2328', marginBottom: '0.25rem' }}>👥 User Management</h1>
        <p style={{ color: '#57606a', marginBottom: '1.75rem' }}>Admin-only. Add or remove dashboard users.</p>

        {/* Add user form */}
        <div style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1f2328', margin: 0 }}>Add new user</h3>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" disabled={addingUser}
              style={{ flex: '2 1 200px', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.875rem', background: '#fff' }} />
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Password" disabled={addingUser}
              style={{ flex: '1 1 160px', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.875rem', background: '#fff' }} />
            <select value={newRole} onChange={e => setNewRole(e.target.value as 'admin'|'viewer')} disabled={addingUser}
              style={{ flex: '0 0 auto', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', border: '1px solid #d0d7de', fontSize: '0.875rem', background: '#fff', color: '#1f2328' }}>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
            <button onClick={addUser} disabled={addingUser || !newEmail.trim() || !newPassword.trim()}
              style={{ padding: '0.6rem 1.1rem', background: '#2a9d5c', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', opacity: addingUser ? 0.6 : 1 }}>
              {addingUser ? 'Adding…' : '+ Add User'}
            </button>
          </div>
          {addUserError   && <div style={{ color: '#dc2626', fontSize: '0.8rem' }}>{addUserError}</div>}
          {addUserSuccess && <div style={{ color: '#2a9d5c', fontSize: '0.8rem' }}>{addUserSuccess}</div>}
        </div>

        {/* Users table */}
        {usersError && <div style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.875rem' }}>{usersError}</div>}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f7f8fa', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontWeight: 700, color: '#57606a' }}>Email</th>
                <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontWeight: 700, color: '#57606a' }}>Role</th>
                <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontWeight: 700, color: '#57606a' }}>Status</th>
                <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontWeight: 700, color: '#57606a' }}>Added</th>
                <th style={{ padding: '0.65rem 1rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {usersList.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: '#8c959f' }}>No users yet</td></tr>
              ) : usersList.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < usersList.length - 1 ? '1px solid #e5e7eb' : 'none', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ padding: '0.7rem 1rem', color: '#1f2328', fontWeight: u.role === 'admin' ? 700 : 400 }}>{u.email}</td>
                  <td style={{ padding: '0.7rem 1rem' }}>
                    <span style={{ background: u.role === 'admin' ? 'rgba(42,157,92,0.12)' : 'rgba(59,130,246,0.1)', color: u.role === 'admin' ? '#2a9d5c' : '#3b82f6', borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '0.7rem 1rem' }}>
                    <span style={{ color: u.is_active ? '#2a9d5c' : '#ef4444', fontSize: '0.8rem' }}>{u.is_active ? 'Active' : 'Disabled'}</span>
                  </td>
                  <td style={{ padding: '0.7rem 1rem', color: '#8c959f', fontSize: '0.8rem' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>
                    <button onClick={() => deleteUser(u.id, u.email)}
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '0.375rem', padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={loadUsers} style={{ marginTop: '1rem', background: 'none', border: '1px solid #d0d7de', borderRadius: '0.5rem', padding: '0.45rem 0.9rem', color: '#57606a', fontSize: '0.8rem', cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>
    );
  };

  if (!authToken) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="app">
      {/* ── Top navbar ── */}
      <nav className="navbar">

        {/* ── Centre banner image — swap src for any image URL ── */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', height: '44px' }}>
          <a href="https://www.youtube.com/@TxNightcoder" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
            <img
              src="https://yt3.googleusercontent.com/ytc/AIdro_lsGJ3j5kf0PcTGBsgFKNEHMpMfJBgFgQ-qxG4R1Q=s88-c-k-c0x00ffffff-no-rj"
              alt="@TxNightcoder"
              style={{ height: '36px', width: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e3e8ef' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1c2b33' }}>@TxNightcoder</span>
          </a>
        </div>

        {/* nav right — live status pill + user controls */}
        <div className="nav-right">
          <div className="nav-pill">
            <span className="dot" />
            Live on Azure
          </div>
          <button onClick={() => { setCurrentPage('users' as any); loadUsers(); }}
            style={{ background: 'rgba(42,157,92,0.12)', color: '#2a9d5c', border: '1px solid #b7e4cc', borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            👥 Users
          </button>
          <button onClick={handleLogout}
            style={{ background: 'rgba(100,116,139,0.10)', color: '#57606a', border: '1px solid #d0d7de', borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Sign out
          </button>
        </div>
      </nav>

      {/* ── AI Ask bar ── */}
      <div className="ask-bar">
        <div className="ask-bar-inner">
          <span className="ask-bar-label">🤖 Ask AI</span>
          <input
            type="text"
            value={askQuestion}
            onChange={e => setAskQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !askLoading) submitAsk(); }}
            placeholder="Ask anything — content strategy, monetization, how to grow faster…"
            disabled={askLoading}
          />
          <button className="ask-bar-btn" onClick={() => submitAsk()} disabled={askLoading || !askQuestion.trim()}>
            {askLoading ? '…' : 'Ask'}
          </button>
          <div className="ask-bar-suggestions">
            {['Make money?', 'Daily video plan', 'Parrot feature?'].map(q => (
              <button key={q} className="ask-bar-suggestion" onClick={() => { setAskQuestion(q); submitAsk(q); }}>{q}</button>
            ))}
          </div>
        </div>
        {(askAnswer || askError) && askOpen && (
          <div className="ask-answer">
            <button onClick={() => setAskOpen(false)}
              style={{ position: 'absolute', top: '0.5rem', right: '0.75rem', background: 'none', border: 'none', color: '#637381', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
            {askError
              ? <p style={{ color: '#fca5a5', fontSize: '0.8125rem', margin: 0 }}>⚠️ {askError}</p>
              : <p style={{ color: '#1c2b33', fontSize: '0.8125rem', margin: 0, whiteSpace: 'pre-wrap', paddingRight: '1.5rem' }}>{askAnswer}</p>
            }
          </div>
        )}
      </div>

      {/* ── Body: sidebar + content ── */}
      <div className="app-body">
        {/* Left sidebar */}
        <nav className="sidebar">
          {NAV_SECTIONS.map(section => (
            <React.Fragment key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map(item => (
                <button
                  key={item.id}
                  className={`sidebar-btn ${currentPage === item.id ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentPage(item.id as any);
                    if (item.id === 'monitor')   loadMonitorData(monitorDays);
                    if (item.id === 'analytics') fetchAnalytics();
                    if (item.id === 'orders')    fetchOrders('all', 1);
                  }}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  {item.label}
                  {item.badge && <span className="sidebar-badge">{item.badge}</span>}
                </button>
              ))}
            </React.Fragment>
          ))}
        </nav>

        {/* Main content */}
        <main className="main-content">
          {(currentPage as string) === 'users' ? renderUsers() :
           currentPage === 'home'        ? renderHome() :
           currentPage === 'source'      ? renderSource() :
           currentPage === 'scripts'     ? renderScripts() :
           currentPage === 'blueprint'   ? renderBlueprint() :
           currentPage === 'videos'      ? renderVideos() :
           currentPage === 'parrot'      ? renderParrot() :
           currentPage === 'trending'    ? renderTrending() :
           currentPage === 'diagnostics' ? renderDiagnostics() :
           currentPage === 'monitor'     ? renderMonitor() :
           currentPage === 'analytics'   ? renderAnalytics() :
           currentPage === 'orders'      ? renderOrders() :
           currentPage === 'gumroad'     ? renderGumroad() :
           currentPage === 'funnel'      ? renderFunnel() :
           currentPage === 'advisor'     ? renderAdvisor() :
           currentPage === 'monetize'    ? renderMonetize() :
           currentPage === 'visuals'     ? renderVisuals() :
           currentPage === 'influencer'  ? renderInfluencer() :
           currentPage === 'granny'      ? renderGranny() :
           currentPage === 'voice'       ? renderVoice() :
           renderHelp()}
          {/* What's Next bar on every page */}
          <WhatsNext page={currentPage} />
        </main>
      </div>

      <footer className="footer">
        KidVid Creator &nbsp;·&nbsp; Made with IBM Bob &nbsp;·&nbsp; <a href="https://www.youtube.com/@TxNightcoder" target="_blank" rel="noopener noreferrer" style={{ color: '#ef4444', textDecoration: 'none' }}>▶ @TxNightcoder</a>
      </footer>
    </div>
  );
}

export default App;


// ── CreatifyPanel — self-contained Creatify AI Avatar Video creator ──────────

interface CreatifyAvatar { id: string; avatar_name?: string; name?: string; gender?: string; preview_image_url?: string; preview_video_url?: string; }
interface CreatifyVoice  { id: string; name: string; language?: string; gender?: string; preview_audio_url?: string; }

interface CreatifyPanelProps {
  apiBase: string;
  onVideoCreated: (video: VideoRecord) => void;
  onNavigateScripts: () => void;
}

function CreatifyPanel({ apiBase, onVideoCreated, onNavigateScripts }: CreatifyPanelProps) {
  const [open, setOpen]               = React.useState(false);
  const [tab, setTab]                 = React.useState<'script' | 'url'>('script');
  // ── Script → Avatar Video ─────────────────────────────────────────────────
  const [scriptId, setScriptId]       = React.useState('');
  const [avatarId, setAvatarId]       = React.useState('');
  const [voiceId, setVoiceId]         = React.useState('');
  const [aspect, setAspect]           = React.useState('9:16');
  const [captionStyle, setCaptionStyle] = React.useState('normal');
  // ── URL → Video Ad ────────────────────────────────────────────────────────
  const [adUrl, setAdUrl]             = React.useState('');
  const [visualStyle, setVisualStyle] = React.useState('dynamic');
  const [scriptStyle, setScriptStyle] = React.useState('engaging');
  const [adAspect, setAdAspect]       = React.useState('9:16');
  const [adAvatarId, setAdAvatarId]   = React.useState('');
  // ── Shared ────────────────────────────────────────────────────────────────
  const [avatars, setAvatars]         = React.useState<CreatifyAvatar[]>([]);
  const [voices, setVoices]           = React.useState<CreatifyVoice[]>([]);
  const [refLoading, setRefLoading]   = React.useState(false);
  const [refError, setRefError]       = React.useState('');
  const [loading, setLoading]         = React.useState(false);
  const [error, setError]             = React.useState('');
  const [success, setSuccess]         = React.useState('');
  const [configured, setConfigured]   = React.useState<boolean | null>(null);

  // Check if Creatify is configured by attempting to load avatars
  const checkAndLoad = async () => {
    if (avatars.length > 0) { setOpen(true); return; }
    setRefLoading(true); setRefError(''); setOpen(true);
    try {
      const [aRes, vRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/videos/creatify/avatars`),
        fetch(`${apiBase}/api/v1/videos/creatify/voices`),
      ]);
      if (aRes.status === 503) {
        const e = await aRes.json();
        setRefError(e.detail ?? 'Creatify not configured');
        setConfigured(false);
        return;
      }
      if (aRes.ok) { setAvatars((await aRes.json()).avatars ?? []); setConfigured(true); }
      if (vRes.ok) { setVoices((await vRes.json()).voices ?? []); }
    } catch { setRefError('Could not reach backend'); }
    finally { setRefLoading(false); }
  };

  // Submit: Script → Avatar Video
  const submit = async () => {
    if (!scriptId.trim()) { setError('Paste a Script ID first'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`${apiBase}/api/v1/videos/creatify/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script_id:     scriptId.trim(),
          avatar_id:     avatarId   || undefined,
          voice_id:      voiceId    || undefined,
          aspect_ratio:  aspect,
          caption_style: captionStyle,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const video: VideoRecord = await res.json();
      setSuccess(`✅ Creatify avatar video started! ID: ${video.id.slice(0,8)}… — ready in ~2 min`);
      onVideoCreated(video);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creatify create failed');
    } finally {
      setLoading(false);
    }
  };

  // Submit: URL → Video Ad
  const submitUrl = async () => {
    if (!adUrl.trim()) { setError('Enter a URL first'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`${apiBase}/api/v1/videos/creatify/link-to-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:          adUrl.trim(),
          aspect_ratio: adAspect,
          visual_style: visualStyle,
          script_style: scriptStyle,
          avatar_id:    adAvatarId || undefined,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? res.statusText); }
      const video: VideoRecord = await res.json();
      setSuccess(`✅ Link-to-Video started! ID: ${video.id.slice(0,8)}… — Creatify is building your ad (~2–4 min)`);
      onVideoCreated(video);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Link-to-video failed');
    } finally {
      setLoading(false);
    }
  };

  const avatarName = (a: CreatifyAvatar) => a.avatar_name || a.name || a.id.slice(0, 12);
  const voiceName  = (v: CreatifyVoice)  => `${v.name}${v.language ? ` (${v.language})` : ''}${v.gender ? ` · ${v.gender}` : ''}`;

  return (
    <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.28)', borderRadius: '0.875rem', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ color: '#2a9d5c', margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🎭 Creatify AI Avatar Video
            <span style={{ background: 'rgba(16,185,129,0.18)', border: '1px solid #b7e4cc', color: '#6ee7b7', borderRadius: '999px', padding: '0.15rem 0.55rem', fontSize: '0.7rem', fontWeight: 700 }}>CONNECTED</span>
          </h3>
          <p style={{ color: '#637381', fontSize: '0.8125rem', margin: '0.2rem 0 0' }}>
            Create a talking AI avatar video from any script — using your Creatify subscription
          </p>
        </div>
        <button
          onClick={checkAndLoad}
          style={{ background: 'linear-gradient(135deg,#34d399,#059669)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {open ? '▲ Collapse' : '🎭 Create with Creatify'}
        </button>
      </div>

      {success && <div style={{ marginTop: '0.75rem', background: 'rgba(16,185,129,0.12)', border: '1px solid #b7e4cc', borderRadius: '0.5rem', padding: '0.6rem 0.85rem', color: '#6ee7b7', fontSize: '0.875rem' }}>{success}</div>}

      {open && (
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => { setTab('script'); setError(''); }}
              style={{ flex: 1, padding: '0.55rem 0', borderRadius: '0.5rem', border: `2px solid ${tab === 'script' ? '#34d399' : 'rgba(148,163,184,0.2)'}`, background: tab === 'script' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)', color: tab === 'script' ? '#34d399' : '#64748b', fontWeight: tab === 'script' ? 700 : 400, cursor: 'pointer', fontSize: '0.875rem' }}>
              🎭 Script → Avatar Video
            </button>
            <button onClick={() => { setTab('url'); setError(''); }}
              style={{ flex: 1, padding: '0.55rem 0', borderRadius: '0.5rem', border: `2px solid ${tab === 'url' ? '#34d399' : 'rgba(148,163,184,0.2)'}`, background: tab === 'url' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)', color: tab === 'url' ? '#34d399' : '#64748b', fontWeight: tab === 'url' ? 700 : 400, cursor: 'pointer', fontSize: '0.875rem' }}>
              🔗 URL → Video Ad
            </button>
          </div>

          {refLoading && <p style={{ color: '#637381', fontSize: '0.875rem' }}>⏳ Loading avatars and voices…</p>}

          {refError && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: '0.5rem', padding: '0.75rem 1rem' }}>
              <p style={{ color: '#fca5a5', fontSize: '0.875rem', margin: 0 }}>⚠️ {refError}</p>
              {configured === false && (
                <div style={{ marginTop: '0.5rem' }}>
                  <p style={{ color: '#637381', fontSize: '0.8125rem', margin: 0 }}>
                    To connect Creatify: add <code style={{ background: '#f4f6f8', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>CREATIFY_API_ID</code> and{' '}
                    <code style={{ background: '#f4f6f8', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>CREATIFY_API_KEY</code> to your <code>.env</code> file.
                  </p>
                  <a href="https://app.creatify.ai" target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-block', marginTop: '0.4rem', color: '#2a9d5c', fontSize: '0.8125rem', textDecoration: 'underline' }}>
                    👉 Get API keys at app.creatify.ai → Settings → API →
                  </a>
                </div>
              )}
            </div>
          )}

          {configured !== false && !refLoading && (
            <>
              {/* ── URL → Video Ad tab ── */}
              {tab === 'url' && (
                <>
                  <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid #b7e4cc', borderRadius: '0.5rem', padding: '0.75rem 1rem' }}>
                    <p style={{ color: '#6ee7b7', fontSize: '0.8125rem', margin: 0 }}>
                      Paste any URL — product page, landing page, App Store listing, or website. Creatify automatically reads it, writes an ad script, and creates a video with an AI avatar.
                    </p>
                  </div>
                  <div>
                    <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>Product / Page URL *</label>
                    <input type="url" value={adUrl} onChange={e => setAdUrl(e.target.value)} disabled={loading}
                      placeholder="https://yoursite.com/product or App Store URL"
                      style={{ width: '100%', background: '#f4f6f8', border: '1px solid #b7e4cc', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.6rem 0.85rem', fontSize: '0.875rem' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 160px' }}>
                      <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>Visual Style</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {['dynamic','minimalist','cinematic','social'].map(s => (
                          <button key={s} onClick={() => setVisualStyle(s)}
                            style={{ padding: '0.35rem 0.6rem', borderRadius: '0.375rem', border: `1px solid ${visualStyle === s ? '#34d399' : 'rgba(148,163,184,0.2)'}`, background: visualStyle === s ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.03)', color: visualStyle === s ? '#34d399' : '#94a3b8', fontWeight: visualStyle === s ? 700 : 400, cursor: 'pointer', fontSize: '0.78rem' }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ flex: '1 1 160px' }}>
                      <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>Script Style</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {['engaging','informative','storytelling','direct'].map(s => (
                          <button key={s} onClick={() => setScriptStyle(s)}
                            style={{ padding: '0.35rem 0.6rem', borderRadius: '0.375rem', border: `1px solid ${scriptStyle === s ? '#34d399' : 'rgba(148,163,184,0.2)'}`, background: scriptStyle === s ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.03)', color: scriptStyle === s ? '#34d399' : '#94a3b8', fontWeight: scriptStyle === s ? 700 : 400, cursor: 'pointer', fontSize: '0.78rem' }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>Aspect Ratio</label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {['9:16', '16:9', '1:1'].map(r => (
                        <button key={r} onClick={() => setAdAspect(r)}
                          style={{ flex: 1, background: adAspect === r ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${adAspect === r ? '#34d399' : 'rgba(148,163,184,0.2)'}`, color: adAspect === r ? '#34d399' : '#94a3b8', borderRadius: '0.375rem', padding: '0.45rem 0', cursor: 'pointer', fontWeight: adAspect === r ? 700 : 400, fontSize: '0.8rem' }}>
                          {r === '9:16' ? '📱 9:16' : r === '16:9' ? '🖥 16:9' : '⬜ 1:1'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: '0.5rem', padding: '0.6rem 0.85rem', color: '#fca5a5', fontSize: '0.875rem' }}>{error}</div>}
                  <button onClick={submitUrl} disabled={loading || !adUrl.trim()}
                    style={{ background: loading || !adUrl.trim() ? 'rgba(16,185,129,0.25)' : 'linear-gradient(135deg,#34d399,#059669)', color: '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.85rem 1.5rem', fontWeight: 800, fontSize: '1rem', cursor: loading || !adUrl.trim() ? 'not-allowed' : 'pointer', opacity: loading || !adUrl.trim() ? 0.7 : 1 }}>
                    {loading ? '⏳ Creating ad…' : '🔗 Generate Video Ad from URL'}
                  </button>
                  <p style={{ color: '#637381', fontSize: '0.78rem', margin: 0 }}>⏱ Creatify scrapes the page, writes the script, and renders — typically 2–4 minutes.</p>
                </>
              )}

              {/* ── Script → Avatar Video tab ── */}
              {tab === 'script' && <>
              {/* Script ID */}
              <div>
                <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>
                  Script ID *
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={scriptId}
                    onChange={e => setScriptId(e.target.value)}
                    placeholder="e.g. cadb45d7-623f-4364-91e5-f3b017a1892c"
                    disabled={loading}
                    style={{ flex: '1 1 260px', background: '#f4f6f8', border: '1px solid #b7e4cc', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.6rem 0.85rem', fontSize: '0.875rem' }}
                  />
                  <button onClick={onNavigateScripts}
                    style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #b7e4cc', color: '#2a9d5c', borderRadius: '0.5rem', padding: '0.6rem 0.85rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ✍️ Go to Scripts
                  </button>
                </div>
              </div>

              {/* Avatar picker */}
              <div>
                <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>
                  AI Avatar {avatars.length > 0 && `(${avatars.length} available)`}
                </label>
                {avatars.length > 0 ? (
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <div
                      onClick={() => setAvatarId('')}
                      style={{ border: `2px solid ${!avatarId ? '#34d399' : 'rgba(148,163,184,0.2)'}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', cursor: 'pointer', background: !avatarId ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)', color: !avatarId ? '#34d399' : '#94a3b8', fontSize: '0.8rem', fontWeight: !avatarId ? 700 : 400 }}>
                      🤖 Auto-select
                    </div>
                    {avatars.slice(0, 12).map(a => (
                      <div key={a.id}
                        onClick={() => setAvatarId(a.id)}
                        style={{ border: `2px solid ${avatarId === a.id ? '#34d399' : 'rgba(148,163,184,0.2)'}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', cursor: 'pointer', background: avatarId === a.id ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', minWidth: '80px', maxWidth: '100px' }}>
                        {a.preview_image_url
                          ? <img src={a.preview_image_url} alt={avatarName(a)} style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: avatarId === a.id ? '2px solid #34d399' : '2px solid transparent' }} />
                          : <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🧑</div>
                        }
                        <span style={{ color: avatarId === a.id ? '#34d399' : '#94a3b8', fontSize: '0.7rem', fontWeight: avatarId === a.id ? 700 : 400, textAlign: 'center', wordBreak: 'break-word' }}>{avatarName(a)}</span>
                        {a.gender && <span style={{ color: '#637381', fontSize: '0.65rem' }}>{a.gender}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#637381', fontSize: '0.8125rem' }}>Avatar list not loaded — first active avatar will be used automatically.</p>
                )}
              </div>

              {/* Voice picker */}
              <div>
                <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>
                  Voice {voices.length > 0 && `(${voices.length} available)`}
                </label>
                <select
                  value={voiceId}
                  onChange={e => setVoiceId(e.target.value)}
                  disabled={loading}
                  style={{ width: '100%', background: '#f4f6f8', border: '1px solid #b7e4cc', borderRadius: '0.5rem', color: '#1c2b33', padding: '0.6rem 0.85rem', fontSize: '0.875rem' }}>
                  <option value="">Default avatar voice</option>
                  {voices.map(v => (
                    <option key={v.id} value={v.id}>{voiceName(v)}</option>
                  ))}
                </select>
              </div>

              {/* Aspect ratio + Caption style */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 160px' }}>
                  <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>Aspect Ratio</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {['9:16', '16:9', '1:1'].map(r => (
                      <button key={r} onClick={() => setAspect(r)}
                        style={{ flex: 1, background: aspect === r ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${aspect === r ? '#34d399' : 'rgba(148,163,184,0.2)'}`, color: aspect === r ? '#34d399' : '#94a3b8', borderRadius: '0.375rem', padding: '0.45rem 0', cursor: 'pointer', fontWeight: aspect === r ? 700 : 400, fontSize: '0.8rem' }}>
                        {r === '9:16' ? '📱 9:16' : r === '16:9' ? '🖥 16:9' : '⬜ 1:1'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label style={{ color: '#637381', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>Caption Style</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {[['normal', 'Normal'], ['highlight', 'Highlight'], ['none', 'None']].map(([id, label]) => (
                      <button key={id} onClick={() => setCaptionStyle(id)}
                        style={{ flex: 1, background: captionStyle === id ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${captionStyle === id ? '#34d399' : 'rgba(148,163,184,0.2)'}`, color: captionStyle === id ? '#34d399' : '#94a3b8', borderRadius: '0.375rem', padding: '0.45rem 0', cursor: 'pointer', fontWeight: captionStyle === id ? 700 : 400, fontSize: '0.78rem' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: '0.5rem', padding: '0.6rem 0.85rem', color: '#fca5a5', fontSize: '0.875rem' }}>{error}</div>}

              {/* Submit */}
              <button
                onClick={submit}
                disabled={loading || !scriptId.trim()}
                style={{ background: loading || !scriptId.trim() ? 'rgba(16,185,129,0.25)' : 'linear-gradient(135deg,#34d399,#059669)', color: '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.85rem 1.5rem', fontWeight: 800, fontSize: '1rem', cursor: loading || !scriptId.trim() ? 'not-allowed' : 'pointer', opacity: loading || !scriptId.trim() ? 0.7 : 1 }}>
                {loading ? '⏳ Submitting to Creatify…' : '🎭 Generate AI Avatar Video'}
              </button>
              <p style={{ color: '#637381', fontSize: '0.78rem', margin: 0 }}>
                ⏱ Typical generation time: 1–3 minutes. The video will appear in My Videos below when ready.
              </p>
              </>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Made with Bob

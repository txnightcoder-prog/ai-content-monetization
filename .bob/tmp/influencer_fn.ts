
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
      const res = await fetch(`${API_BASE}/api/v1/scripts/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: prompt }) });
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
      const res = await fetch(`${API_BASE}/api/v1/scripts/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: prompt }) });
      const data = await res.json();
      setInfScriptResult(data.answer || data.response || 'No response from AI');
    } catch { setInfScriptResult('Error generating script.'); }
    setInfScriptLoading(false);
  };

  const generateImagePrompts = async () => {
    setInfImgLoading(true); setInfImgPrompts([]);
    try {
      const prompt = `Generate 8 detailed photorealistic AI image prompts for ${infName}, age ${infAge}, ${infHair} hair, ${infEyes} eyes. Niche: ${infNiche}. Each prompt: specific scene, outfit, pose, lighting, mood. Vary locations: home office, coffee shop, campus, outdoors, gym, library, studio, rooftop. Style: photorealistic, bright clean Instagram aesthetic. Return ONLY a JSON array of 8 strings.`;
      const res = await fetch(`${API_BASE}/api/v1/scripts/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: prompt }) });
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
      const res = await fetch(`${API_BASE}/api/v1/scripts/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: prompt }) });
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


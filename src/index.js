import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

const BASE_URL = 'https://anidb.app';
const PROXY_PREFIX = 'https://streamrelay.sapis.workers.dev/proxy?url=';
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

// Enable CORS
app.use('*', cors());

// Clean API Documentation Landing Page (GET /)
app.get('/', (c) => {
  return c.html(HTML_DOCS);
});

// API Health Check
app.get('/api/health', (c) => {
  return c.json({
    status: 'online',
    platform: 'Cloudflare Workers',
    service: 'AniDB Video Scraper API',
    target: BASE_URL,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/search?q=solo+leveling
 */
app.get('/api/search', async (c) => {
  const query = c.req.query('q') || c.req.query('query') || c.req.query('keyword');
  if (!query) {
    return c.json({ success: false, error: 'Missing query parameter "q". Example: /api/search?q=solo+leveling' }, 400);
  }

  try {
    const searchUrl = `${BASE_URL}/browse?q=${encodeURIComponent(query.trim())}`;
    const res = await fetch(searchUrl, { headers: BROWSER_HEADERS });
    if (!res.ok) {
      return c.json({ success: false, error: `Failed to fetch search page (Status: ${res.status})` }, res.status);
    }
    const html = await res.text();
    const results = [];
    const seenSlugs = new Set();

    const linkRegex = /<a[^>]*href=["'](?:https:\/\/anidb\.app)?\/anime\/([^"']+)["'][^>]*title=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const hrefSlug = match[1].replace(/^\/anime\//, '').replace(/\/$/, '');
      const rawTitle = match[2];
      const innerHtml = match[3];

      if (!hrefSlug || seenSlugs.has(hrefSlug)) continue;
      seenSlugs.add(hrefSlug);

      const imgMatch = innerHtml.match(/src=["']([^"']+)["']/i);
      let image = imgMatch ? imgMatch[1] : '';
      if (image.startsWith('//')) image = `https:${image}`;

      const badgeMatches = [...innerHtml.matchAll(/<span[^>]*>([^<]+)<\/span>/gi)].map(m => m[1].trim()).filter(Boolean);
      const typeVal = badgeMatches[0] || 'TV';
      const ratingVal = badgeMatches[1] || '';

      results.push({
        id: hrefSlug,
        title: rawTitle,
        image: image || 'https://cdn.xlsbox.com/poster/small/default.jpg',
        type: typeVal,
        rating: ratingVal,
        url: `${BASE_URL}/anime/${hrefSlug}`
      });
    }

    return c.json({
      success: true,
      query: query,
      total: results.length,
      data: results
    });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /api/anime/:id
 */
app.get('/api/anime/:id', async (c) => {
  const animeId = c.req.param('id');
  if (!animeId) {
    return c.json({ success: false, error: 'Anime ID or slug is required' }, 400);
  }

  try {
    const animeUrl = `${BASE_URL}/anime/${encodeURIComponent(animeId)}`;
    const res = await fetch(animeUrl, { headers: BROWSER_HEADERS });
    if (!res.ok) {
      return c.json({ success: false, error: `Failed to fetch anime (Status: ${res.status})` }, res.status);
    }

    const html = await res.text();

    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim() : animeId.replace(/-/g, ' ');

    const descMatch = html.match(/<p[^>]*class=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    const watchMatch = html.match(/watchPage\((\d+)/);
    const numId = watchMatch ? watchMatch[1] : null;

    let episodes = [];
    if (numId) {
      const epRes = await fetch(`${BASE_URL}/api/frontend/anime/${numId}/episodes`, { headers: BROWSER_HEADERS });
      if (epRes.ok) {
        const epData = await epRes.json();
        if (epData && Array.isArray(epData.episodes)) {
          episodes = epData.episodes.map(ep => ({
            id: ep.id,
            number: ep.number,
            title: `Episode ${ep.number}`,
            filler: ep.filler || false,
            url: `${BASE_URL}/api/frontend/episode/${ep.id}/languages`
          }));
        }
      }
    }

    return c.json({
      success: true,
      data: {
        id: animeId,
        numericalId: numId,
        title: title,
        description: description,
        totalEpisodes: episodes.length,
        episodes: episodes
      }
    });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /api/watch/:episodeId
 */
app.get('/api/watch/:episodeId', async (c) => {
  const epId = c.req.param('episodeId');
  if (!epId) {
    return c.json({ success: false, error: 'Episode ID is required' }, 400);
  }

  try {
    const langRes = await fetch(`${BASE_URL}/api/frontend/episode/${encodeURIComponent(epId)}/languages`, { headers: BROWSER_HEADERS });
    if (!langRes.ok) {
      return c.json({ success: false, error: `Failed to fetch episode languages (Status: ${langRes.status})` }, langRes.status);
    }

    const langData = await langRes.json();
    const languages = langData.languages || [];

    const sources = [];
    const embeds = [];

    for (const lang of languages) {
      const embedUrl = lang.embed_url;
      embeds.push({
        language: lang.name || lang.code,
        code: lang.code,
        embedUrl: embedUrl
      });

      try {
        const embedRes = await fetch(embedUrl, { headers: BROWSER_HEADERS });
        if (embedRes.ok) {
          const embedHtml = await embedRes.text();
          const m3u8Match = embedHtml.match(/sources:\s*\[{\s*file:\s*['"]([^'"]+)['"]/);
          if (m3u8Match && m3u8Match[1]) {
            const rawUrl = m3u8Match[1];
            const proxiedUrl = `${PROXY_PREFIX}${encodeURIComponent(rawUrl)}`;
            sources.push({
              url: proxiedUrl,
              rawUrl: rawUrl,
              quality: 'Master HLS (.m3u8)',
              type: 'hls',
              language: lang.name || lang.code
            });
          }
        }
      } catch (e) {
        // Continue if single embed fails
      }
    }

    return c.json({
      success: true,
      data: {
        episodeId: epId,
        headers: {
          'User-Agent': BROWSER_HEADERS['User-Agent'],
          'Referer': `${BASE_URL}/`
        },
        sources: sources,
        embeds: embeds
      }
    });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Fallback Route for non-API requests
app.get('*', (c) => {
  return c.html(HTML_DOCS);
});

// Clean API Documentation Landing Page Template
const HTML_DOCS = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AniDB Scraper API - Documentation</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f17;
      --bg-card: #131b29;
      --bg-code: #090d14;
      --border: rgba(255, 255, 255, 0.08);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --cyan: #06b6d4;
      --green: #10b981;
      --text: #f3f4f6;
      --muted: #9ca3af;
      --font-sans: 'Inter', system-ui, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: var(--bg); color: var(--text); font-family: var(--font-sans); line-height: 1.6; padding-bottom: 60px; }
    .container { max-width: 1040px; margin: 0 auto; padding: 0 1.5rem; }
    
    /* Header Navigation */
    header { border-bottom: 1px solid var(--border); background: rgba(11, 15, 23, 0.85); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 100; height: 65px; display: flex; align-items: center; }
    .nav { display: flex; justify-content: space-between; align-items: center; width: 100%; }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.25rem; color: #fff; text-decoration: none; }
    .badge { background: linear-gradient(135deg, var(--primary), var(--cyan)); font-size: 0.7rem; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; font-weight: 800; }
    .github-link { color: var(--muted); text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.2s; }
    .github-link:hover { color: #fff; }

    /* Hero Section */
    .hero { padding: 48px 0 32px; text-align: center; border-bottom: 1px solid var(--border); }
    .status-tag { display: inline-flex; align-items: center; gap: 8px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); color: var(--green); padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; margin-bottom: 16px; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); box-shadow: 0 0 8px var(--green); }
    .hero h1 { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 12px; background: linear-gradient(135deg, #ffffff, #a5b4fc, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero p { color: var(--muted); font-size: 1.05rem; max-width: 600px; margin: 0 auto 24px; }
    
    .base-url-box { background: var(--bg-card); border: 1px solid var(--border); display: inline-flex; align-items: center; gap: 12px; padding: 10px 18px; border-radius: 10px; font-family: var(--font-mono); font-size: 0.9rem; color: var(--cyan); }
    .base-url-label { color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; font-family: var(--font-sans); }

    /* Main Docs Content */
    .docs-section { margin-top: 40px; }
    .section-title { font-size: 1.35rem; font-weight: 700; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }

    /* Endpoint Card */
    .endpoint-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 28px; overflow: hidden; }
    .endpoint-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.02); }
    .method-get { background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.4); padding: 4px 10px; border-radius: 6px; font-family: var(--font-mono); font-size: 0.8rem; font-weight: 700; }
    .endpoint-path { font-family: var(--font-mono); font-size: 1rem; font-weight: 600; color: #fff; }
    .endpoint-desc { color: var(--muted); font-size: 0.9rem; padding: 16px 20px 0; }

    .endpoint-body { padding: 20px; }
    
    /* Table */
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 0.85rem; }
    th { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); color: var(--muted); font-weight: 600; }
    td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .param-name { font-family: var(--font-mono); color: var(--cyan); }
    .param-type { font-family: var(--font-mono); color: #f472b6; font-size: 0.8rem; }

    /* Code Snippet & Output */
    .code-block { background: var(--bg-code); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; font-family: var(--font-mono); font-size: 0.82rem; color: #e2e8f0; overflow-x: auto; margin-top: 12px; white-space: pre-wrap; }
    .json-output { color: #38bdf8; max-height: 250px; overflow-y: auto; }

    .try-btn { background: var(--primary); color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    .try-btn:hover { opacity: 0.9; }

    footer { text-align: center; margin-top: 60px; color: var(--muted); font-size: 0.85rem; border-top: 1px solid var(--border); padding-top: 24px; }
  </style>
</head>
<body>

  <header>
    <div class="container nav">
      <a href="/" class="brand">
        AniDB API <span class="badge">v1.0</span>
      </a>
      <a href="https://github.com/Varomine/Anidb-api" target="_blank" class="github-link">GitHub Repository &rarr;</a>
    </div>
  </header>

  <section class="hero">
    <div class="container">
      <div class="status-tag"><span class="dot"></span> Service Operational</div>
      <h1>AniDB Scraper API Documentation</h1>
      <p>High-performance RESTful Video Scraper API and Stream Extractor for <code>anidb.app</code></p>
      
      <div class="base-url-box">
        <span class="base-url-label">Base URL:</span>
        <span id="base-url-text">https://anidb-scraper-api.sapis.workers.dev</span>
      </div>
    </div>
  </section>

  <main class="container docs-section">
    <h2 class="section-title">API Endpoints</h2>

    <!-- Endpoint 1: Search -->
    <div class="endpoint-card">
      <div class="endpoint-header">
        <span class="method-get">GET</span>
        <span class="endpoint-path">/api/search</span>
      </div>
      <p class="endpoint-desc">Search anime titles live on <code>anidb.app/browse?q=...</code></p>
      
      <div class="endpoint-body">
        <h4 style="font-size: 0.85rem; color: var(--muted); margin-bottom: 6px;">Query Parameters</h4>
        <table>
          <thead>
            <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td class="param-name">q</td><td class="param-type">string</td><td>Yes</td><td>Search query or keyword (e.g. <code>solo leveling</code>, <code>demon slayer</code>)</td></tr>
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;">
          <h4 style="font-size: 0.85rem; color: var(--muted);">Example Request</h4>
          <button class="try-btn" onclick="testEndpoint('/api/search?q=solo%20leveling', 'json-search')">Execute Request</button>
        </div>
        <div class="code-block">curl "https://anidb-scraper-api.sapis.workers.dev/api/search?q=solo%20leveling"</div>

        <h4 style="font-size: 0.85rem; color: var(--muted); margin-top: 16px;">Response Output</h4>
        <pre class="code-block json-output" id="json-search">{
  "success": true,
  "query": "solo leveling",
  "total": 3,
  "data": [
    {
      "id": "solo-leveling-4883",
      "title": "Solo Leveling",
      "image": "https://cdn.xlsbox.com/poster/small/1782735600/4883.jpg",
      "type": "TV",
      "url": "https://anidb.app/anime/solo-leveling-4883"
    }
  ]
}</pre>
      </div>
    </div>

    <!-- Endpoint 2: Anime Info -->
    <div class="endpoint-card">
      <div class="endpoint-header">
        <span class="method-get">GET</span>
        <span class="endpoint-path">/api/anime/:id</span>
      </div>
      <p class="endpoint-desc">Fetch anime details, description, and full episode list from <code>anidb.app</code></p>
      
      <div class="endpoint-body">
        <h4 style="font-size: 0.85rem; color: var(--muted); margin-bottom: 6px;">Path Parameters</h4>
        <table>
          <thead>
            <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td class="param-name">id</td><td class="param-type">string</td><td>Yes</td><td>Anime slug ID (e.g. <code>solo-leveling-4883</code> or <code>mob-psycho-100-3422</code>)</td></tr>
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;">
          <h4 style="font-size: 0.85rem; color: var(--muted);">Example Request</h4>
          <button class="try-btn" onclick="testEndpoint('/api/anime/solo-leveling-4883', 'json-anime')">Execute Request</button>
        </div>
        <div class="code-block">curl "https://anidb-scraper-api.sapis.workers.dev/api/anime/solo-leveling-4883"</div>

        <h4 style="font-size: 0.85rem; color: var(--muted); margin-top: 16px;">Response Output</h4>
        <pre class="code-block json-output" id="json-anime">{
  "success": true,
  "data": {
    "id": "solo-leveling-4883",
    "numericalId": "4883",
    "title": "Solo Leveling",
    "description": "Shigeo Kageyama is an ordinary boy...",
    "totalEpisodes": 12,
    "episodes": [
      { "id": 72835, "number": 1, "title": "Episode 1", "filler": false }
    ]
  }
}</pre>
      </div>
    </div>

    <!-- Endpoint 3: Watch Stream Extractor -->
    <div class="endpoint-card">
      <div class="endpoint-header">
        <span class="method-get">GET</span>
        <span class="endpoint-path">/api/watch/:episodeId</span>
      </div>
      <p class="endpoint-desc">Extract direct master HLS (<code>.m3u8</code>) stream URLs and embed links for an episode.</p>
      
      <div class="endpoint-body">
        <h4 style="font-size: 0.85rem; color: var(--muted); margin-bottom: 6px;">Path Parameters</h4>
        <table>
          <thead>
            <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td class="param-name">episodeId</td><td class="param-type">string / integer</td><td>Yes</td><td>Episode ID (e.g. <code>72835</code>)</td></tr>
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;">
          <h4 style="font-size: 0.85rem; color: var(--muted);">Example Request</h4>
          <button class="try-btn" onclick="testEndpoint('/api/watch/72835', 'json-watch')">Execute Request</button>
        </div>
        <div class="code-block">curl "https://anidb-scraper-api.sapis.workers.dev/api/watch/72835"</div>

        <h4 style="font-size: 0.85rem; color: var(--muted); margin-top: 16px;">Response Output</h4>
        <pre class="code-block json-output" id="json-watch">{
  "success": true,
  "data": {
    "episodeId": "72835",
    "sources": [
      {
        "url": "https://streamrelay.sapis.workers.dev/proxy?url=https%3A%2F%2Fhls.anidb.app%2Fstream%2FiaBAq_QRDU7I5o1pr85shXbqpiad6OslTSfx_rMkQV2_hyrPLONAKbORS_dmVqR0%2Fmaster.m3u8",
        "rawUrl": "https://hls.anidb.app/stream/iaBAq_QRDU7I5o1pr85shXbqpiad6OslTSfx_rMkQV2_hyrPLONAKbORS_dmVqR0/master.m3u8",
        "quality": "Master HLS (.m3u8)",
        "type": "hls",
        "language": "English"
      }
    ],
    "embeds": [
      { "language": "English", "embedUrl": "https://anidb.app/embed/JGEHCbWnk_yDojAFqtFUDJIKBXpJtYCWLyw0UdpZJgeRih7SvNeAz42UFKMfpF90" }
    ]
  }
}</pre>
      </div>
    </div>

    <!-- Endpoint 4: Health -->
    <div class="endpoint-card">
      <div class="endpoint-header">
        <span class="method-get">GET</span>
        <span class="endpoint-path">/api/health</span>
      </div>
      <p class="endpoint-desc">Check API server status and platform operational status.</p>
    </div>

  </main>

  <footer>
    <div class="container">
      <p>AniDB Scraper API &bull; Deployed on Cloudflare Workers &bull; <a href="https://github.com/Varomine/Anidb-api" target="_blank" style="color: var(--cyan);">GitHub: Varomine/Anidb-api</a></p>
    </div>
  </footer>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('base-url-text').innerText = window.location.origin;
    });

    async function testEndpoint(path, outputId) {
      const el = document.getElementById(outputId);
      el.innerText = '// Executing API request...';
      try {
        const res = await fetch(path);
        const data = await res.json();
        el.innerText = JSON.stringify(data, null, 2);
      } catch(e) {
        el.innerText = JSON.stringify({ success: false, error: e.message }, null, 2);
      }
    }
  </script>
</body>
</html>`;

export default app;

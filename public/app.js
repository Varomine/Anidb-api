let activeTab = 'search';
let hlsInstance = null;

// Initialize Dashboard on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  // Execute default initial search
  handleSearch();
});

function switchTab(tabName) {
  activeTab = tabName;
  
  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');

  // Form elements
  document.getElementById('search-form').style.display = tabName === 'search' ? 'flex' : 'none';
  document.getElementById('anime-form').style.display = tabName === 'anime' ? 'flex' : 'none';
  document.getElementById('watch-form').style.display = tabName === 'watch' ? 'flex' : 'none';
}

// Handle Search API Call
async function handleSearch() {
  const query = document.getElementById('search-input').value.trim() || 'solo leveling';
  const url = `/api/search?q=${encodeURIComponent(query)}`;
  
  updateUrlDisplay(`GET ${url}`);
  showJsonLoading();

  try {
    const res = await fetch(url);
    const data = await res.json();
    renderJson(data);

    if (data.success && data.data) {
      renderSearchGrid(data.data);
    }
  } catch (err) {
    renderJson({ success: false, error: err.message });
  }
}

// Render Search Results Cards
function renderSearchGrid(items) {
  const grid = document.getElementById('anime-results-grid');
  grid.innerHTML = '';

  if (items.length === 0) {
    grid.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">No anime found. Try another search term.</div>';
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'anime-card-item';
    card.onclick = () => selectAnime(item.id);

    card.innerHTML = `
      <img src="${item.image}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/180x240/111827/ffffff?text=AniDB'">
      <div class="anime-card-info">
        <div class="anime-card-title" title="${item.title}">${item.title}</div>
        <div class="anime-card-meta">${item.type} ${item.year ? '• ' + item.year : ''}</div>
      </div>
    `;

    grid.appendChild(card);
  });
}

// Handle Get Anime Details
async function selectAnime(animeId) {
  switchTab('anime');
  document.getElementById('anime-input').value = animeId;
  await handleGetAnime();
}

async function handleGetAnime() {
  const animeId = document.getElementById('anime-input').value.trim() || 'solo-leveling';
  const url = `/api/anime/${encodeURIComponent(animeId)}`;

  updateUrlDisplay(`GET ${url}`);
  showJsonLoading();

  try {
    const res = await fetch(url);
    const data = await res.json();
    renderJson(data);

    if (data.success && data.data) {
      renderEpisodesList(data.data.episodes);
    }
  } catch (err) {
    renderJson({ success: false, error: err.message });
  }
}

// Render Episodes Grid
function renderEpisodesList(episodes) {
  const container = document.getElementById('episodes-container');
  const section = document.getElementById('episodes-section');

  container.innerHTML = '';
  if (!episodes || episodes.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  episodes.forEach(ep => {
    const btn = document.createElement('button');
    btn.className = 'ep-btn';
    btn.innerText = `Ep ${ep.number}`;
    btn.title = ep.title;
    btn.onclick = () => selectEpisode(ep.id);
    container.appendChild(btn);
  });
}

// Handle Stream Extraction & Video Player Setup
async function selectEpisode(episodeId) {
  switchTab('watch');
  document.getElementById('watch-input').value = episodeId;
  await handleGetStream();
}

async function handleGetStream() {
  const epId = document.getElementById('watch-input').value.trim() || 'solo-leveling-episode-1';
  const url = `/api/watch/${encodeURIComponent(epId)}`;

  updateUrlDisplay(`GET ${url}`);
  showJsonLoading();

  try {
    const res = await fetch(url);
    const data = await res.json();
    renderJson(data);

    if (data.success && data.data && data.data.sources.length > 0) {
      const firstSource = data.data.sources[0];
      playVideoStream(firstSource.url, firstSource.quality || 'Auto');
    }
  } catch (err) {
    renderJson({ success: false, error: err.message });
  }
}

// Initialize Video Player with HLS.js or native HTML5
function playVideoStream(streamUrl, label) {
  const video = document.getElementById('video-player');
  const labelEl = document.getElementById('current-stream-label');

  labelEl.innerText = `Active Stream: ${label}`;

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  if (streamUrl.includes('.m3u8')) {
    if (Hls.isSupported()) {
      hlsInstance = new Hls();
      hlsInstance.loadSource(streamUrl);
      hlsInstance.attachMedia(video);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.play().catch(() => {});
    }
  } else {
    video.src = streamUrl;
    video.play().catch(() => {});
  }
}

// Display JSON Helper
function renderJson(data) {
  document.getElementById('json-output').innerText = JSON.stringify(data, null, 2);
}

function showJsonLoading() {
  document.getElementById('json-output').innerText = '// Fetching data from API...';
}

function updateUrlDisplay(text) {
  document.getElementById('request-url').innerText = text;
}

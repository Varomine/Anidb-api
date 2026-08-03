const express = require('express');
const cors = require('cors');
const path = require('path');
const scraper = require('./lib/scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'AniDB Video Scraper API',
    target: scraper.BASE_URL,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/search?q=solo+leveling
 * Search anime titles
 */
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q || req.query.query;
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Missing query parameter "q". Example: /api/search?q=solo+leveling'
      });
    }

    const results = await scraper.searchAnime(query);
    res.json({
      success: true,
      query: query,
      total: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to perform search'
    });
  }
});

/**
 * GET /api/anime/:id
 * Get anime details and episode list
 */
app.get('/api/anime/:id', async (req, res) => {
  try {
    const animeId = req.params.id;
    const details = await scraper.getAnimeDetails(animeId);
    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch anime details'
    });
  }
});

/**
 * GET /api/watch/:episodeId
 * Get streaming video sources for an episode
 */
app.get('/api/watch/:episodeId', async (req, res) => {
  try {
    const episodeId = req.params.episodeId;
    const streams = await scraper.getEpisodeStreams(episodeId);
    res.json({
      success: true,
      data: streams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch episode streams'
    });
  }
});

// Fallback route for SPA dashboard
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 AniDB Video Scraper API running on port ${PORT}`);
  console.log(`📡 Dashboard UI: http://localhost:${PORT}`);
  console.log(`🔍 Search API:   http://localhost:${PORT}/api/search?q=demon`);
  console.log(`=======================================================`);
});

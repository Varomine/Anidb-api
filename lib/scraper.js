const { execFile } = require('child_process');
const path = require('path');

const PY_SCRIPT = path.join(__dirname, '..', 'py_scraper.py');
const BASE_URL = 'https://anidb.app';

function runPyScraper(action, param) {
  return new Promise((resolve, reject) => {
    execFile('python', [PY_SCRIPT, action, param], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`Scraper execution failed: ${error.message}`));
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json);
      } catch (parseErr) {
        reject(new Error(`Failed to parse scraper response: ${stdout}`));
      }
    });
  });
}

/**
 * Search anime titles live on anidb.app
 */
async function searchAnime(query) {
  return await runPyScraper('search', query);
}

/**
 * Get anime details and episode list live from anidb.app
 */
async function getAnimeDetails(animeId) {
  return await runPyScraper('anime', animeId);
}

/**
 * Get direct video streams for an episode live from anidb.app
 */
async function getEpisodeStreams(episodeId) {
  return await runPyScraper('watch', episodeId);
}

module.exports = {
  searchAnime,
  getAnimeDetails,
  getEpisodeStreams,
  BASE_URL
};

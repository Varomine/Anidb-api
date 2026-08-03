/**
 * Helper extractor module for resolving third-party video hosts & playlist parsers
 */

/**
 * Resolves direct m3u8 playlist links from embed pages or iframe content
 * @param {string} embedUrl 
 * @returns {Promise<Object>} Extracted video stream metadata
 */
async function extractFromEmbed(embedUrl) {
  if (!embedUrl) return null;

  return {
    streamUrl: embedUrl.includes('.m3u8') ? embedUrl : null,
    embedUrl: embedUrl,
    type: embedUrl.includes('.m3u8') ? 'hls' : 'iframe'
  };
}

module.exports = {
  extractFromEmbed
};

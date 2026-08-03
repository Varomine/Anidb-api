# 🚀 AniDB Video Scraper API & Stream Extractor
** NOTE : If the proxy isn't working find one yourself, If my proxy getting rate limit host one yourself [streamrelay](https://github.com/Varomine/streamrelay)**
High-performance, edge-ready RESTful Video Scraper API and Stream Extractor for `https://anidb.app/`. Built for global edge deployment on **Cloudflare Workers** and **Node.js**.

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Hono](https://img.shields.io/badge/Hono-E36002?style=for-the-badge&logo=hono&logoColor=white)](https://hono.dev/)
[![GitHub](https://img.shields.io/badge/GitHub-Varomine/Anidb--api-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Varomine/Anidb-api)

---

## ✨ Key Features

- ⚡ **Cloudflare Workers Native**: Built using [Hono](https://hono.dev/) for instant global deployment with zero server maintenance.
- 🎬 **StreamRelay Proxy Integration**: Automatically prefixes master `.m3u8` video URLs with `https://streamrelay.sapis.workers.dev/proxy?url={m3u8}` to bypass CORS restrictions.
- 🔍 **Live Search (`q=`)**: Real-time catalog search matching `https://anidb.app/browse?q=...`.
- 📖 **Anime & Episode Details**: Retrieve titles, posters, overview descriptions, and full episode lists.
- 🛡️ **Full CORS Enabled**: Accessible from any web frontend, mobile application, or video player.
- 📄 **Built-in Documentation Landing Page**: Clean developer documentation served directly at `GET /`.

---

## 📡 API Reference & Endpoints

### 1. Search Anime Catalog
```http
GET /api/search?q={query}
```

#### Query Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `q` | `string` | **Yes** | Search keyword (e.g. `solo leveling`, `demon slayer`) |

#### Example Request:
```bash
curl "https://anidb-scraper-api.sapis.workers.dev/api/search?q=solo%20leveling"
```

#### Example Response:
```json
{
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
    },
    {
      "id": "solo-leveling-season-2-arise-from-the-shadow-4884",
      "title": "Solo Leveling Season 2: Arise from the Shadow",
      "image": "https://cdn.xlsbox.com/poster/small/1782735600/4884.jpg",
      "type": "TV",
      "url": "https://anidb.app/anime/solo-leveling-season-2-arise-from-the-shadow-4884"
    },
    {
      "id": "solo-leveling-how-to-get-stronger-4885",
      "title": "Solo Leveling: How to Get Stronger",
      "image": "https://cdn.xlsbox.com/poster/small/1782735600/4885.jpg",
      "type": "Special",
      "url": "https://anidb.app/anime/solo-leveling-how-to-get-stronger-4885"
    }
  ]
}
```

---

### 2. Anime Details & Episodes List
```http
GET /api/anime/:id
```

#### Path Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | **Yes** | Anime slug ID (e.g. `solo-leveling-4883` or `mob-psycho-100-3422`) |

#### Example Request:
```bash
curl "https://anidb-scraper-api.sapis.workers.dev/api/anime/solo-leveling-4883"
```

---

### 3. Extract Episode Video Streams
```http
GET /api/watch/:episodeId
```

#### Path Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `episodeId` | `integer / string` | **Yes** | Episode ID (e.g. `72835`) |

#### Example Request:
```bash
curl "https://anidb-scraper-api.sapis.workers.dev/api/watch/72835"
```

#### Example Response:
```json
{
  "success": true,
  "data": {
    "episodeId": "72835",
    "headers": {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
      "Referer": "https://anidb.app/"
    },
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
      {
        "language": "English",
        "embedUrl": "https://anidb.app/embed/JGEHCbWnk_yDojAFqtFUDJIKBXpJtYCWLyw0UdpZJgeRih7SvNeAz42UFKMfpF90"
      }
    ]
  }
}
```

---

### 4. Health Check
```http
GET /api/health
```

---

## ⚡ Deployment Instructions

### Cloudflare Workers Deployment

```bash
# 1. Install dependencies
npm install

# 2. Login to Cloudflare (one-time)
npx wrangler login

# 3. Deploy to Cloudflare Workers
npm run deploy
```


## 📄 License
MIT License

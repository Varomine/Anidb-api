import sys
import urllib.request
import urllib.parse
import re
import json
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
}

PROXY_PREFIX = "https://streamrelay.sapis.workers.dev/proxy?url="

def get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode('utf-8')

def search(query):
    url = f"https://anidb.app/browse?q={urllib.parse.quote(query)}"
    html = get(url)
    soup = BeautifulSoup(html, 'html.parser')
    results = []
    seen = set()

    for a in soup.find_all('a', class_=lambda c: c and 'anime-card' in c):
        href = a.get('href', '')
        if '/anime/' in href:
            slug = href.replace('https://anidb.app', '').replace('/anime/', '').strip('/')
            if not slug or slug in seen:
                continue
            seen.add(slug)

            title = a.get('title', '').strip()
            img = a.find('img')
            image = img['src'] if img and 'src' in img.attrs else (img.get('data-src') if img else '')
            if image.startswith('//'):
                image = f"https:{image}"

            # Extract type and rating badges if present
            badges = [span.text.strip() for span in a.find_all('span') if span.text.strip()]
            type_val = badges[0] if badges else 'TV'
            rating_val = badges[1] if len(badges) > 1 else ''

            results.append({
                'id': slug,
                'title': title or slug.replace('-', ' '),
                'image': image or 'https://cdn.xlsbox.com/poster/small/default.jpg',
                'type': type_val,
                'rating': rating_val,
                'url': f"https://anidb.app/anime/{slug}"
            })
    return results

def get_anime(slug):
    url = slug if slug.startswith('http') else f"https://anidb.app/anime/{slug}"
    html = get(url)
    soup = BeautifulSoup(html, 'html.parser')

    title_el = soup.find('h1')
    title = title_el.text.strip() if title_el else slug.replace('-', ' ')
    
    match = re.search(r'watchPage\((\d+)', html)
    num_id = match.group(1) if match else None

    episodes = []
    if num_id:
        ep_json = get(f"https://anidb.app/api/frontend/anime/{num_id}/episodes")
        ep_data = json.loads(ep_json)
        for ep in ep_data.get('episodes', []):
            episodes.append({
                'id': ep['id'],
                'number': ep['number'],
                'title': f"Episode {ep['number']}",
                'filler': ep.get('filler', False)
            })

    return {
        'id': slug,
        'numericalId': num_id,
        'title': title,
        'totalEpisodes': len(episodes),
        'episodes': episodes
    }

def get_streams(episode_id):
    lang_json = get(f"https://anidb.app/api/frontend/episode/{episode_id}/languages")
    lang_data = json.loads(lang_json)
    
    sources = []
    embeds = []

    for lang in lang_data.get('languages', []):
        embed_url = lang['embed_url']
        embeds.append({
            'language': lang.get('name', lang.get('code')),
            'embedUrl': embed_url
        })
        try:
            embed_html = get(embed_url)
            m3u8_match = re.search(r'sources:\s*\[{\s*file:\s*[\'"]([^\'"]+)[\'"]', embed_html)
            if m3u8_match:
                raw_url = m3u8_match.group(1)
                proxied_url = f"{PROXY_PREFIX}{urllib.parse.quote(raw_url, safe='')}"
                sources.append({
                    'url': proxied_url,
                    'rawUrl': raw_url,
                    'quality': 'Master HLS (.m3u8)',
                    'type': 'hls',
                    'language': lang.get('name', lang.get('code'))
                })
        except Exception:
            pass

    return {
        'episodeId': episode_id,
        'headers': {
            'User-Agent': HEADERS['User-Agent'],
            'Referer': 'https://anidb.app/'
        },
        'sources': sources,
        'embeds': embeds
    }

if __name__ == '__main__':
    action = sys.argv[1] if len(sys.argv) > 1 else ''
    param = sys.argv[2] if len(sys.argv) > 2 else ''

    if action == 'search':
        print(json.dumps(search(param)))
    elif action == 'anime':
        print(json.dumps(get_anime(param)))
    elif action == 'watch':
        print(json.dumps(get_streams(param)))
    else:
        print(json.dumps({'error': 'Invalid action'}))

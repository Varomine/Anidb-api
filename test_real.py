import urllib.request
import re
import json
from bs4 import BeautifulSoup

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
    return urllib.request.urlopen(req).read().decode('utf-8')

print('--- 1. SEARCHING FOR DEMON SLAYER ---')
html = get('https://anidb.app/browse?keyword=demon+slayer')
soup = BeautifulSoup(html, 'html.parser')
cards = []

for a in soup.find_all('a', href=True):
    if '/anime/' in a['href']:
        img = a.find('img')
        cards.append({
            'title': a.text.strip().split('\n')[0],
            'url': a['href'],
            'image': img['src'] if img and 'src' in img.attrs else (img.get('data-src') if img else '')
        })

print(f"Found: {len(cards)} results")
if cards:
    anime_url = cards[0]['url']
    print(f"--- 2. GETTING ANIME DETAILS --- {anime_url}")
    anime_html = get(anime_url)
    soup_anime = BeautifulSoup(anime_html, 'html.parser')
    
    # Extract numerical anime ID
    match = re.search(r'watchPage\((\d+)', anime_html)
    num_id = match.group(1) if match else None
    print(f"Numerical Anime ID: {num_id}")

    if num_id:
        ep_json_raw = get(f'https://anidb.app/api/frontend/anime/{num_id}/episodes')
        ep_data = json.loads(ep_json_raw)
        episodes = ep_data.get('episodes', [])
        print(f"Total Episodes found: {len(episodes)}")
        
        if episodes:
            ep1 = episodes[0]
            print(f"--- 3. EXTRACTING STREAMS FOR EPISODE 1 (ID: {ep1['id']}) ---")
            lang_raw = get(f'https://anidb.app/api/frontend/episode/{ep1["id"]}/languages')
            lang_data = json.loads(lang_raw)
            print(f"Languages available: {json.dumps(lang_data)}")
            
            for lang in lang_data.get('languages', []):
                embed_url = lang['embed_url']
                embed_html = get(embed_url)
                m3u8_match = re.search(r'sources:\s*\[{\s*file:\s*[\'"]([^\'"]+)[\'"]', embed_html)
                if m3u8_match:
                    print(f"DIRECT M3U8 STREAM ({lang['name']}): {m3u8_match.group(1)}")

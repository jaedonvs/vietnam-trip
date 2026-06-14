#!/usr/bin/env python3
"""Fetch representative city photos from Wikimedia (REST summary lead image).
Saves raw files to img/<id>.src ; resizing/convert handled by sips afterwards.
"""
import urllib.request, json, os, ssl

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "img")
os.makedirs(OUT, exist_ok=True)
ctx = ssl.create_default_context()
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"

# id -> wikipedia article title
TARGETS = {
    "hanoi":  "Hanoi",
    "halong": "Hạ Long Bay",
    "hoian":  "Hội An",
    "danang": "Da Nang",
    "hcmc":   "Ho Chi Minh City",
}

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
        return r.read()

def summary_image(title):
    # MediaWiki action API: original page image
    u = ("https://en.wikipedia.org/w/api.php?action=query&prop=pageimages"
         "&piprop=original&format=json&titles=" + urllib.parse.quote(title))
    data = json.loads(get(u))
    pages = data.get("query", {}).get("pages", {})
    for _, p in pages.items():
        src = (p.get("original") or {}).get("source")
        if src:
            return src
    return None

for cid, title in TARGETS.items():
    try:
        img = summary_image(title)
        if not img:
            print("NO IMAGE for", cid); continue
        ext = os.path.splitext(img.split("?")[0])[1].lower() or ".jpg"
        path = os.path.join(OUT, cid + ".src" + ext)
        req = urllib.request.Request(img, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, context=ctx, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
        print("OK", cid, "->", os.path.basename(path), os.path.getsize(path), "bytes |", img.split("/")[-1][:60])
    except Exception as e:
        print("FAIL", cid, type(e).__name__, e)

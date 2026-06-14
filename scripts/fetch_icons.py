#!/usr/bin/env python3
"""Fetch a cohesive Lucide (MIT) icon set and emit icons.js with inner SVG markup.
Usage in app: ICONS[name] -> inner markup, wrapped by icon() helper.
"""
import urllib.request, ssl, re, os, json, time

VER = "0.469.0"
BASE = f"https://unpkg.com/lucide-static@{VER}/icons/"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"
ctx = ssl.create_default_context()
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# logical name -> lucide icon file
ICONS = {
    "overview": "compass",
    "map": "map",
    "days": "calendar-days",
    "places": "map-pin",
    "pack": "luggage",
    "guide": "book-open",
    "coffee": "coffee",
    "food": "utensils",
    "shopping": "shopping-bag",
    "sights": "camera",
    "nightlife": "beer",
    "stay": "bed-double",
    "directions": "navigation",
    "search": "search",
    "showmap": "map",
    "phone": "phone",
    "copy": "copy",
    "check": "check",
    "circlecheck": "circle-check",
    "sun": "sun",
    "moon": "moon",
    "plane": "plane",
    "locate": "locate-fixed",
    "chevron": "chevron-right",
    "sparkle": "sparkles",
    "wallet": "wallet",
    "alert": "triangle-alert",
    "languages": "languages",
    "calendar": "calendar",
    "arrowright": "arrow-right",
    "clock": "clock",
}

def fetch(name):
    req = urllib.request.Request(BASE + name + ".svg", headers={"User-Agent": UA})
    return urllib.request.urlopen(req, context=ctx, timeout=30).read().decode("utf-8")

def inner(svg):
    m = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S)
    return re.sub(r"\s+", " ", (m.group(1) if m else "")).strip()

out = {}
for logical, fname in ICONS.items():
    for attempt in range(3):
        try:
            out[logical] = inner(fetch(fname))
            print("ok", logical, "<-", fname)
            break
        except Exception as e:
            print("retry", logical, e); time.sleep(2)
    else:
        print("FAIL", logical)

with open(os.path.join(OUT, "icons.js"), "w") as f:
    f.write("/* Lucide icons (MIT) — inner SVG markup, wrapped by icon() in app.js */\n")
    f.write("const ICON_PATHS = " + json.dumps(out, ensure_ascii=False, indent=0) + ";\n")
print("wrote icons.js with", len(out), "icons")

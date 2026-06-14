#!/usr/bin/env python3
"""Generate PWA icons with no external deps.
Draws the N->S Vietnam route motif (5 city dots on a dashed line) on paper bg.
Outputs icon-192.png, icon-512.png, apple-touch-icon.png, favicon-32.png.
"""
import zlib, struct, math, os

PAPER   = (242, 238, 223)
INK_SOFT= (92, 83, 69)
PINK    = (212, 101, 95)
BLUSH   = (232, 201, 182)
SAGE    = (183, 199, 168)
LEMON   = (224, 184, 80)
LILAC   = (196, 119, 90)

# normalized route points (kept inside central 80% maskable safe zone)
POINTS = [
    (0.36, 0.17, PINK),
    (0.63, 0.35, BLUSH),
    (0.38, 0.54, SAGE),
    (0.65, 0.72, LEMON),
    (0.43, 0.87, LILAC),
]

def blend(dst, src, a):
    return tuple(int(dst[i] * (1 - a) + src[i] * a) for i in range(3))

def draw(size):
    S = size
    buf = bytearray(S * S * 4)
    # fill background
    for i in range(S * S):
        buf[i*4:i*4+4] = bytes((*PAPER, 255))

    def px(x, y, color, a=1.0):
        if 0 <= x < S and 0 <= y < S:
            o = (y * S + x) * 4
            cur = (buf[o], buf[o+1], buf[o+2])
            r, g, b = blend(cur, color, a)
            buf[o], buf[o+1], buf[o+2], buf[o+3] = r, g, b, 255

    pts = [(x*S, y*S, c) for (x, y, c) in POINTS]

    # dashed connecting line in ink-soft
    line_w = max(2.0, S * 0.018)
    for k in range(len(pts) - 1):
        x0, y0, _ = pts[k]
        x1, y1, _ = pts[k+1]
        dx, dy = x1 - x0, y1 - y0
        dist = math.hypot(dx, dy)
        steps = int(dist)
        for s in range(steps):
            t = s / dist
            # dash pattern
            if int(s / max(6, S*0.02)) % 2 == 1:
                continue
            cx = x0 + dx * t
            cy = y0 + dy * t
            r = int(line_w) + 1
            for oy in range(-r, r + 1):
                for ox in range(-r, r + 1):
                    d = math.hypot(ox, oy)
                    a = max(0.0, min(1.0, (line_w - d) / 1.5))
                    if a > 0:
                        px(int(cx)+ox, int(cy)+oy, INK_SOFT, a * 0.55)

    # city dots with soft white ring
    rad = S * 0.062
    for (cx, cy, color) in pts:
        R = int(rad + 2)
        for oy in range(-R, R + 1):
            for ox in range(-R, R + 1):
                d = math.hypot(ox, oy)
                if d <= rad + 1.5:
                    # white-ish halo edge
                    if d > rad - 1:
                        a = max(0.0, min(1.0, (rad + 1.5 - d)))
                        px(int(cx)+ox, int(cy)+oy, (255, 252, 244), a)
                    else:
                        a = max(0.0, min(1.0, (rad - d) / 1.5))
                        px(int(cx)+ox, int(cy)+oy, color, a if a < 1 else 1.0)
    return bytes(buf)

def draw_banner(w, h):
    """Wide OG share image: horizontal route of 5 city dots on paper."""
    buf = bytearray(w * h * 4)
    for i in range(w * h):
        buf[i*4:i*4+4] = bytes((*PAPER, 255))

    def px(x, y, color, a=1.0):
        if 0 <= x < w and 0 <= y < h:
            o = (y * w + x) * 4
            cur = (buf[o], buf[o+1], buf[o+2])
            r, g, b = blend(cur, color, a)
            buf[o], buf[o+1], buf[o+2], buf[o+3] = r, g, b, 255

    cols = [PINK, BLUSH, SAGE, LEMON, LILAC]
    n = len(cols)
    cy = int(h * 0.60)
    xs = [int(w * (0.16 + 0.68 * k / (n - 1))) for k in range(n)]
    line_w = h * 0.012
    # dashed line
    for k in range(n - 1):
        x0, x1 = xs[k], xs[k+1]
        for s in range(x1 - x0):
            if int(s / max(8, w*0.012)) % 2 == 1:
                continue
            cx = x0 + s
            r = int(line_w) + 1
            for oy in range(-r, r + 1):
                a = max(0.0, min(1.0, (line_w - abs(oy)) / 1.5))
                if a > 0:
                    px(cx, cy + oy, INK_SOFT, a * 0.5)
    # dots
    rad = h * 0.05
    for (cx, color) in zip(xs, cols):
        R = int(rad + 2)
        for oy in range(-R, R + 1):
            for ox in range(-R, R + 1):
                d = math.hypot(ox, oy)
                if d <= rad + 1.5:
                    if d > rad - 1:
                        px(cx+ox, cy+oy, (255, 252, 244), max(0.0, min(1.0, rad + 1.5 - d)))
                    else:
                        a = max(0.0, min(1.0, (rad - d) / 1.5))
                        px(cx+ox, cy+oy, color, a if a < 1 else 1.0)
    return bytes(buf)

def encode_png(width, height, rgba):
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw.extend(rgba[y*stride:(y+1)*stride])
    comp = zlib.compress(bytes(raw), 9)
    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data +
                struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', comp) + chunk(b'IEND', b'')

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for size, name in [(512, "icon-512.png"), (192, "icon-192.png"),
                   (180, "apple-touch-icon.png"), (32, "favicon-32.png")]:
    data = encode_png(size, size, draw(size))
    with open(os.path.join(OUT, name), "wb") as f:
        f.write(data)
    print("wrote", name, size, "x", size, len(data), "bytes")

# wide OG share image
og = encode_png(1200, 630, draw_banner(1200, 630))
with open(os.path.join(OUT, "og-image.png"), "wb") as f:
    f.write(og)
print("wrote og-image.png 1200 x 630", len(og), "bytes")

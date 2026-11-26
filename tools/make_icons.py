"""Generates simple placeholder app icons (no extra libraries needed).
Run: python tools/make_icons.py   -> writes icons/icon-180.png, -192, -512
Replace these with real artwork any time; keep the same file names.
"""
import struct, zlib, os

BG = (0x1b, 0x1f, 0x3b)
BALL = (0xff, 0xd8, 0x4d)
RING = (0x2e, 0xcc, 0x71)


def pixel(x, y, n):
    cx = cy = n / 2
    d = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5
    if d < n * 0.28:
        return BALL
    if d < n * 0.36:
        return RING
    return BG


def png(n, path):
    raw = b"".join(
        b"\x00" + b"".join(bytes(pixel(x, y, n)) for x in range(n)) for y in range(n)
    )

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    data = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(data)


root = os.path.join(os.path.dirname(__file__), "..", "icons")
os.makedirs(root, exist_ok=True)
for size in (180, 192, 512):
    png(size, os.path.join(root, f"icon-{size}.png"))
print("icons written")

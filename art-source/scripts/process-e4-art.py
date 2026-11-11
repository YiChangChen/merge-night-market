"""E4 美術批次：阿嬤提示立繪（art-manifest #42）。

用法：uv run --python 3.12 --with pillow art-source/scripts/process-e4-art.py art-source assets/images
- 原圖 `grandma-hint.png`：洋紅底。阿嬤穿紫色開襟外套，顏色接近洋紅，不能用全圖的顏色門檻去背
  （E3 的 key_magenta 會把外套吃掉）。改成「從圖片邊緣出發、只移除和邊緣相連的洋紅」，
  黑色輪廓線會把外套和背景隔開。
- 邊緣一圈半透明的混色像素，依洋紅程度降低不透明度並去掉色偏。
- 裁掉空白、長邊縮到 ≤ 1024（art-manifest 上限），存成 WebP。
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
LIMIT = 1024


def magenta_score(r: int, g: int, b: int) -> int:
    return min(r, b) - g


def key_connected_magenta(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    background = [[False] * w for _ in range(h)]
    queue: deque[tuple[int, int]] = deque()
    for x in range(w):
        queue.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        queue.extend([(0, y), (w - 1, y)])
    # 背景是接近純洋紅的區域（分數高），從邊緣往內擴散
    while queue:
        x, y = queue.popleft()
        if not (0 <= x < w and 0 <= y < h) or background[y][x]:
            continue
        r, g, b, _ = px[x, y]
        if magenta_score(r, g, b) < 120:
            continue
        background[y][x] = True
        queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    for y in range(h):
        for x in range(w):
            if background[y][x]:
                px[x, y] = (0, 0, 0, 0)
                continue
            # 緊鄰背景的混色邊緣：依洋紅程度降低不透明度，紅藍拉回綠的水準去色偏
            near = any(
                0 <= x + dx < w and 0 <= y + dy < h and background[y + dy][x + dx]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            )
            if not near:
                continue
            r, g, b, _ = px[x, y]
            score = magenta_score(r, g, b)
            if score > 60:
                alpha = max(0, min(255, int(255 * (120 - score) / 60)))
                px[x, y] = (min(r, g + 40), g, min(b, g + 40), alpha)
    return img


img = key_connected_magenta(Image.open(SRC / "grandma-hint.png"))
img = img.crop(img.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox())
if max(img.size) > LIMIT:
    ratio = LIMIT / max(img.size)
    img = img.resize((round(img.width * ratio), round(img.height * ratio)), Image.LANCZOS)
target = OUT / "characters" / "grandma.webp"
target.parent.mkdir(parents=True, exist_ok=True)
img.save(target, "WEBP", quality=90, alpha_quality=100, method=6)
print(f"characters/grandma.webp: {img.size}, {target.stat().st_size // 1024} KB")

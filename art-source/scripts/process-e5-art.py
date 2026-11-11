"""E5 美術批次：卡面 10 張與卡框 2 張（art-manifest #43–#54）。

用法：uv run --python 3.12 --with pillow art-source/scripts/process-e5-art.py art-source assets/images
- 原圖放在 art-source/，檔名依 docs/art-prompts-e5.md：card-<recipe-id>.png、frame-normal.png、frame-gold.png。
- 卡面：完整插圖，不去背；縮成 768 × 1024（3:4）存成 WebP。
- 卡框：窗口與外圍是洋紅。木框與金框都沒有接近洋紅的顏色，所以用全圖的洋紅程度去背
  （和 E4 阿嬤不同，不需要只移除與邊緣相連的區域）；邊緣的混色像素依洋紅程度降低不透明度並去掉色偏。
- 卡框外形不是方的（燈籠、屋簷凸出），所以卡面不鋪滿整張卡，而是依 FACE_INSET 往內縮，
  邊緣藏在框條底下。腳本最後檢查：內縮後卡面的外框線在兩種卡框上都必須是不透明的。
  FACE_INSET 必須和 src/game/content/cards.ts 的 CARD_FACE_INSET 一致。
"""
import sys
from pathlib import Path

from PIL import Image

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
SIZE = (768, 1024)
# 卡面相對整張卡的內縮比例（左、上、右、下）
FACE_INSET = (0.08, 0.06, 0.08, 0.10)
RECIPES = [
    "tea-fried",
    "tea-noodle",
    "fried-noodle",
    "tea-dumpling",
    "fried-dumpling",
    "noodle-dumpling",
    "tea-sweet",
    "fried-sweet",
    "noodle-sweet",
    "dumpling-sweet",
]


def magenta_score(r: int, g: int, b: int) -> int:
    return min(r, b) - g


def key_magenta(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            score = magenta_score(r, g, b)
            if score >= 120:
                px[x, y] = (0, 0, 0, 0)
            elif score > 60:
                alpha = int(255 * (120 - score) / 60)
                px[x, y] = (min(r, g + 40), g, min(b, g + 40), alpha)
    return img


def save(img: Image.Image, name: str) -> None:
    target = OUT / "cards" / f"{name}.webp"
    target.parent.mkdir(parents=True, exist_ok=True)
    img.resize(SIZE, Image.LANCZOS).save(target, "WEBP", quality=88, alpha_quality=100, method=6)
    print(f"cards/{name}.webp: {SIZE}, {target.stat().st_size // 1024} KB")


for recipe in RECIPES:
    save(Image.open(SRC / f"card-{recipe}.png").convert("RGB"), recipe)
for kind in ("normal", "gold"):
    save(key_magenta(Image.open(SRC / f"frame-{kind}.png")), f"frame-{kind}")


def check_inset(kind: str) -> None:
    alpha = Image.open(OUT / "cards" / f"frame-{kind}.webp").getchannel("A")
    w, h = alpha.size
    left, top, right, bottom = FACE_INSET
    x0, y0 = round(w * left), round(h * top)
    x1, y1 = round(w * (1 - right)) - 1, round(h * (1 - bottom)) - 1
    edge = [(x, y) for x in range(x0, x1 + 1) for y in (y0, y1)]
    edge += [(x, y) for y in range(y0, y1 + 1) for x in (x0, x1)]
    holes = [p for p in edge if alpha.getpixel(p) < 250]
    assert not holes, f"frame-{kind}: 卡面邊緣會從 {holes[:3]} 露出來，調整 FACE_INSET"
    print(f"frame-{kind}: 卡面內縮 {FACE_INSET} 的邊緣都藏在框條底下")


for kind in ("normal", "gold"):
    check_inset(kind)

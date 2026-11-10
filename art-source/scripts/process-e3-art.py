"""E3 美術批次：發明菜圖示 10 張（art-manifest #32–#41）。

用法：uv run --python 3.12 --with pillow art-source/scripts/process-e3-art.py art-source assets/images
- 素材表 `台式美食像素圖鑑.png`：洋紅底、5 欄 × 2 列，順序同 docs/art-prompts-e3.md。
- 10 道菜放進同一個大小的正方形畫布（以最大的那道為準），所有圖示的像素比例一致。
- 用最近鄰放大成整數倍，長邊不超過 512（art-manifest 尺寸上限）。
"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from sprite_tools import key_magenta, objects, trim  # noqa: E402

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
LIMIT = 512
# 畫布四周留一點空間，棋盤格裡的份數徽章才不會壓到菜
MARGIN = 6

RECIPES = [
    ["tea-fried", "tea-noodle", "fried-noodle", "tea-dumpling", "fried-dumpling"],
    ["noodle-dumpling", "tea-sweet", "fried-sweet", "noodle-sweet", "dumpling-sweet"],
]

def unmix_steam(img: Image.Image) -> Image.Image:
    """半透明的蒸氣、冰霧在原圖裡混到洋紅底，看起來偏紫。
    假設前景是灰白色：c = a·v + (1 − a)·洋紅，由紅藍與綠的差反推 a 與 v，還原成白色半透明。
    只處理紅藍幾乎相等的像素（洋紅混色的特徵），粉紅、紅色的食物不受影響。"""
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a0 = px[x, y]
            if a0 == 0 or abs(r - b) > 40:
                continue
            tint = min(r, b) - g
            if 30 < tint <= 150:
                alpha = 1 - tint / 255
                v = min(255, int(g / alpha))
                px[x, y] = (v, v, v, int(a0 * alpha))
    return img


sheet = unmix_steam(key_magenta(Image.open(SRC / "台式美食像素圖鑑.png")))
rows = objects(sheet, row_gap=12, counts=[5, 5])

dishes = {recipe: img for recipe_row, row in zip(RECIPES, rows) for recipe, img in zip(recipe_row, row)}

# 單張重產的圖（art-source/dish-<recipe>.png）取代素材表裡的那一格。
# 單張圖的解析度通常比素材表高：縮到和素材表其他菜的平均大小一致，在棋盤上看起來才一樣大。
sheet_sizes = sorted(max(img.size) for img in dishes.values())
typical = sheet_sizes[len(sheet_sizes) // 2]
for recipe in list(dishes):
    single = SRC / f"dish-{recipe}.png"
    if not single.exists():
        continue
    img = trim(unmix_steam(key_magenta(Image.open(single))))
    ratio = typical / max(img.size)
    dishes[recipe] = img.resize((round(img.width * ratio), round(img.height * ratio)), Image.LANCZOS)
    print(f"{recipe}: 使用單張重產 {single.name}")
side = max(max(img.size) for img in dishes.values()) + MARGIN * 2
scale = LIMIT // side
print(f"canvas {side}px × {scale} = {side * scale}px")

for recipe, img in dishes.items():
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(img, ((side - img.width) // 2, (side - img.height) // 2))
    out = canvas.resize((side * scale, side * scale), Image.NEAREST)
    target = OUT / "dishes" / f"{recipe}.webp"
    target.parent.mkdir(parents=True, exist_ok=True)
    out.save(target, "WEBP", lossless=True, method=6)
    print(f"dishes/{recipe}.webp: {img.size} -> {out.size}, {target.stat().st_size // 1024} KB")

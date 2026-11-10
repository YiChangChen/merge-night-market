"""E1 美術批次：去背、切圖、轉 WebP（S1.10）。

用法：uv run --python 3.12 --with pillow process_e1.py <assets/images 資料夾> <輸出資料夾>
- 洋紅底（#FF00FF）的素材：依顏色去背，再依物件之間的空隙自動切出每個物件。
- 黑底的霓虹：依亮度計算透明度（保留光暈），每個招牌再切成左、中、右三層（同一張畫布）。
- 像素圖用最近鄰放大，手機上縮放才不會糊。
"""
import sys
from pathlib import Path

from PIL import Image

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
SCALE = 3


def key_magenta(img: Image.Image) -> Image.Image:
    """洋紅去背：接近 #FF00FF 的像素變透明；邊緣帶洋紅色偏的像素去掉色偏並降低不透明度。"""
    img = img.convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, _ = px[x, y]
            # 洋紅的特徵：紅、藍都高，綠很低
            magenta = min(r, b) - g
            if magenta > 150:
                px[x, y] = (0, 0, 0, 0)
            elif magenta > 70:
                # 半透明邊緣：依洋紅程度降低不透明度，並把紅藍拉回綠的水準去色偏
                alpha = int(255 * (150 - magenta) / 80)
                px[x, y] = (min(r, g + 40), g, min(b, g + 40), alpha)
    return img


def key_black_glow(img: Image.Image) -> Image.Image:
    """黑底霓虹：亮度越高越不透明，暗的光暈保留成半透明。"""
    img = img.convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, _ = px[x, y]
            v = max(r, g, b)
            alpha = max(0, min(255, int((v - 18) * 255 / 120)))
            px[x, y] = (r, g, b, alpha)
    return img


def spans(profile: list[int], min_gap: int, min_size: int) -> list[tuple[int, int]]:
    """在投影上找出被至少 min_gap 個空白隔開的區段。"""
    result, start, gap = [], None, 0
    for i, value in enumerate(profile + [0] * min_gap):
        if value:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                end = i - gap + 1
                if end - start >= min_size:
                    result.append((start, end))
                start, gap = None, 0
    return result


def valley_cuts(profile: list[int], count: int, min_distance: int) -> list[int]:
    """已知這一列有 count 個物件：挑出 count − 1 條最空的直線當切線（彼此至少相隔 min_distance）。"""
    # 平滑一下，避免單一像素的空隙被當成谷底
    smooth = [sum(profile[max(0, i - 3) : i + 4]) for i in range(len(profile))]
    occupied = [i for i, v in enumerate(profile) if v]
    lo, hi = occupied[0], occupied[-1]
    chosen: list[int] = []
    for i in sorted(range(lo + min_distance, hi - min_distance), key=lambda i: smooth[i]):
        if all(abs(i - c) >= min_distance for c in chosen):
            chosen.append(i)
            if len(chosen) == count - 1:
                break
    return [lo] + sorted(chosen) + [hi + 1]


def objects(img: Image.Image, row_gap: int, counts: list[int]) -> list[list[Image.Image]]:
    """先依透明空隙切成列；每一列依已知的物件數，從最空的直線切成欄。回傳 [列][欄]。"""
    alpha = img.getchannel("A").point(lambda a: 1 if a > 40 else 0)
    w, h = img.size
    data = alpha.load()
    rows_profile = [sum(data[x, y] for x in range(0, w, 2)) for y in range(h)]
    bands = spans(rows_profile, row_gap, 30)
    assert len(bands) == len(counts), f"列數不對：找到 {len(bands)} 列，預期 {len(counts)} 列"
    rows = []
    for (top, bottom), count in zip(bands, counts):
        band = img.crop((0, top, w, bottom))
        band_alpha = band.getchannel("A").point(lambda a: 1 if a > 40 else 0).load()
        cols_profile = [sum(band_alpha[x, y] for y in range(0, bottom - top, 2)) for x in range(w)]
        cuts = valley_cuts(cols_profile, count, min_distance=w // (count * 2))
        rows.append([trim(band.crop((cuts[i], 0, cuts[i + 1], bottom - top))) for i in range(count)])
    return rows


def trim(img: Image.Image) -> Image.Image:
    bbox = img.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox()
    return img.crop(bbox) if bbox else img


def upscale(img: Image.Image, scale: int = SCALE) -> Image.Image:
    return img.resize((img.width * scale, img.height * scale), Image.NEAREST)


def save(img: Image.Image, name: str) -> None:
    target = OUT / name
    target.parent.mkdir(parents=True, exist_ok=True)
    img.save(target, "WEBP", lossless=True, method=6)
    print(f"{name}: {img.size}, {target.stat().st_size // 1024} KB")


# —— 攤位與老闆（洋紅底） ——
sheet = objects(key_magenta(Image.open(SRC / "台灣夜市像素攤位圖鑑.png")), row_gap=12, counts=[8, 9, 5])
extra = objects(key_magenta(Image.open(SRC / "繽紛像素夜市小吃攤 亚洲欧美.png")), row_gap=12, counts=[3])
print("sheet rows:", [len(r) for r in sheet], "extra rows:", [len(r) for r in extra])

row1 = ["tea/shutter", "tea/lv1", "tea/lv2", "tea/lv3", "fried/shutter", "fried/lv1", "fried/lv2", "fried/lv3"]
row2 = ["noodle/shutter", "noodle/lv1", "noodle/lv2", "noodle/lv3", "dumpling/shutter", "dumpling/lv2", "sweet/shutter", "sweet/lv2", "sweet/lv3"]
owners = ["tea", "fried", "noodle", "dumpling", "sweet"]
assert [len(r) for r in sheet] == [8, 9, 5], "素材表切出來的物件數量不對，需要調整空隙門檻"
assert [len(r) for r in extra] == [3], "補圖切出來的物件數量不對"

stalls = dict(zip(row1, sheet[0])) | dict(zip(row2, sheet[1]))
for name, img in stalls.items():
    save(upscale(img), f"stalls/{name}.webp")
# 補圖的原圖解析度約是素材表的兩倍：先用最近鄰縮成一半，再和其他攤位一樣放大 3 倍
for name, img in zip(["dumpling/lv1", "dumpling/lv3", "sweet/lv1"], extra[0]):
    half = img.resize((img.width // 2, img.height // 2), Image.NEAREST)
    save(upscale(half), f"stalls/{name}.webp")
for chain, img in zip(owners, sheet[2]):
    save(upscale(img), f"owners/{chain}.webp")

# —— 霓虹招牌（黑底），每個切成三層 ——
neon_rows = objects(key_black_glow(Image.open(SRC / "五款霓虹美食招牌排列.png")), row_gap=20, counts=[1, 1, 1, 1, 1])
signs = [row[0] if len(row) == 1 else None for row in neon_rows]
assert len(signs) == 5 and all(signs), f"霓虹切出來的數量不對：{[len(r) for r in neon_rows]}"
for chain, sign in zip(["tea", "fried", "noodle", "dumpling", "sweet"], signs):
    third = sign.width / 3
    for i in range(3):
        layer = Image.new("RGBA", sign.size, (0, 0, 0, 0))
        left, right = round(third * i), round(third * (i + 1))
        layer.paste(sign.crop((left, 0, right, sign.height)), (left, 0))
        save(upscale(layer, 2), f"stalls/{chain}/neon-{i + 1}.webp")

# —— 夜市街背景（不透明，縮到高度 1024 以內） ——
background = Image.open(SRC / "星光燈籠夜市街景.png").convert("RGB")
(OUT / "street").mkdir(parents=True, exist_ok=True)
# 背景不需要像素級精準，用有損壓縮控制檔案大小
background.save(OUT / "street/background.webp", "WEBP", quality=85, method=6)
print(f"street/background.webp: {background.size}, {(OUT / 'street/background.webp').stat().st_size // 1024} KB")

"""素材表處理的共用工具（E3 起使用；E1 的 process-e1-art.py 保留原樣，結果已定稿）。

- 洋紅底（#FF00FF）依顏色去背
- 依透明空隙切成列，每列依已知物件數從最空的直線切成欄
"""
from PIL import Image


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


def trim(img: Image.Image) -> Image.Image:
    bbox = img.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox()
    return img.crop(bbox) if bbox else img


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

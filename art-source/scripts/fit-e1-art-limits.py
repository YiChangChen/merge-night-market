"""把 E1 美術縮到 art-manifest 的尺寸上限以內（code review 2026-11-10）。

用法：uv run --python 3.12 --with pillow art-source/scripts/fit-e1-art-limits.py assets/images
- 老闆頭像：長邊 ≤ 512
- 霓虹圖層：寬 ≤ 1024（同一個招牌的三層用相同比例，疊起來才會對齊）
- 攤位外觀：長邊 ≤ 1024（目前都在範圍內，只做檢查）
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(sys.argv[1])
CHAINS = ["tea", "fried", "noodle", "dumpling", "sweet"]


def fit(path: Path, scale: float) -> None:
    img = Image.open(path)
    if scale >= 1:
        print(f"ok   {path.relative_to(ROOT)} {img.size}")
        return
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    # 縮放後已經不是純像素，無損壓縮反而變大；改用高品質有損（保留透明）
    resized.save(path, "WEBP", quality=90, alpha_quality=100, method=6)
    print(f"fit  {path.relative_to(ROOT)} {img.size} -> {resized.size}")


for chain in CHAINS:
    owner = ROOT / "owners" / f"{chain}.webp"
    fit(owner, 512 / max(Image.open(owner).size))

    layers = [ROOT / "stalls" / chain / f"neon-{i}.webp" for i in (1, 2, 3)]
    width = Image.open(layers[0]).width
    for layer in layers:
        fit(layer, 1024 / width)

    for name in ("shutter", "lv1", "lv2", "lv3"):
        facade = ROOT / "stalls" / chain / f"{name}.webp"
        fit(facade, 1024 / max(Image.open(facade).size))

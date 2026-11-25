"""E7 上架美術：App 圖示、Android 自適應圖示、啟動畫面、網頁 favicon、Google Play 主題圖片與圖示（S7.7）。

用法：uv run --python 3.12 --with pillow art-source/scripts/process-e7-art.py art-source assets/images
- 原圖放在 art-source/，提示詞見 docs/art-prompts-e7.md：
  - e7-icon.png：完整圖示（不透明，滿版）
  - e7-icon-foreground.png：同一個攤位，透明背景
  - e7-icon-background.png：夜空暖光，沒有物件
  - e7-feature-graphic.jpg：Google Play 主題圖片（約 2:1）
- 單色圖示由前景的不透明區域產生（純白剪影），不另外生圖。
- Android 自適應圖示的主體要在中間 66% 的安全區內；前景主體超出時，腳本會先縮小再置中。
- 商店用的兩張（512 圖示、1024 × 500 主題圖片）輸出到 art-source/store/，不放進 App。
"""
import sys
from pathlib import Path

from PIL import Image

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
STORE = SRC / 'store'
SIZE = 1024
# Android 自適應圖示的安全區：圖層 108 dp 中，中間 72 dp 一定看得到（約 66%）
SAFE = 0.66
# 單色剪影的不透明度門檻：前景的霓虹光暈是半透明的，不算進剪影
MONO_ALPHA = 128


def square(image: Image.Image, size: int = SIZE) -> Image.Image:
    return image.resize((size, size), Image.LANCZOS)


def fit_safe_zone(image: Image.Image) -> Image.Image:
    """把透明背景的主體縮進安全區並置中（主體已經在安全區內時只置中，不放大）。"""
    image = square(image.convert('RGBA'))
    bbox = image.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
    if bbox is None:
        raise SystemExit('前景圖是全透明的')
    subject = image.crop(bbox)
    limit = SIZE * SAFE
    scale = min(1.0, limit / subject.width, limit / subject.height)
    if scale < 1.0:
        subject = subject.resize(
            (round(subject.width * scale), round(subject.height * scale)), Image.LANCZOS
        )
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(subject, ((SIZE - subject.width) // 2, (SIZE - subject.height) // 2), subject)
    return canvas


def monochrome(foreground: Image.Image) -> Image.Image:
    alpha = foreground.getchannel('A').point(lambda a: 255 if a >= MONO_ALPHA else 0)
    white = Image.new('RGBA', foreground.size, (255, 255, 255, 0))
    white.putalpha(alpha)
    return white


def cover(image: Image.Image, width: int, height: int) -> Image.Image:
    """等比例縮放到蓋滿 width × height，再從中間裁切。"""
    scale = max(width / image.width, height / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)), Image.LANCZOS
    )
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def main() -> None:
    STORE.mkdir(exist_ok=True)

    # App 圖示：不透明、不要圓角（iOS 圖示有 alpha 會被退件）
    icon = square(Image.open(SRC / 'e7-icon.png').convert('RGB'))
    icon.save(OUT / 'icon.png', optimize=True)
    icon.resize((512, 512), Image.LANCZOS).save(STORE / 'play-icon-512.png', optimize=True)
    icon.resize((48, 48), Image.LANCZOS).save(OUT / 'favicon.png', optimize=True)

    # Android 自適應圖示
    foreground = fit_safe_zone(Image.open(SRC / 'e7-icon-foreground.png'))
    foreground.save(OUT / 'android-icon-foreground.png', optimize=True)
    square(Image.open(SRC / 'e7-icon-background.png').convert('RGB')).save(
        OUT / 'android-icon-background.png', optimize=True
    )
    monochrome(foreground).save(OUT / 'android-icon-monochrome.png', optimize=True)

    # 啟動畫面：和 Android 前景同一張（透明背景，底色由 app.config.ts 設定）
    foreground.save(OUT / 'splash-icon.png', optimize=True)

    # Google Play 主題圖片：1024 × 500，不透明
    feature = cover(Image.open(SRC / 'e7-feature-graphic.jpg').convert('RGB'), 1024, 500)
    feature.save(STORE / 'play-feature-graphic.png', optimize=True)

    bbox = foreground.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
    print('前景主體範圍', bbox, f'（安全區 {round(SIZE * (1 - SAFE) / 2)}–{round(SIZE * (1 + SAFE) / 2)}）')
    print('左上角顏色（啟動畫面與自適應圖示底色參考）', icon.getpixel((4, 4)))


if __name__ == '__main__':
    main()

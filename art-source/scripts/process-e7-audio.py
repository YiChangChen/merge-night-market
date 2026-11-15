"""E7 音訊素材處理（S7.1）：art-source/audio/ 的原始檔 → assets/audio/sfx-*.mp3。

用法：python -m uv run --python 3.12 --with imageio-ffmpeg python -I art-source/scripts/process-e7-audio.py
- ffmpeg 由 imageio-ffmpeg 提供（不必安裝到系統）。
- 每個音效：去掉開頭的靜音 → 從 start 起截取 length 秒 → 結尾淡出 → 單聲道 44.1 kHz、mp3 96 kbps。
- 音量：先量平均與峰值，再調到目標平均音量（mean），峰值壓在 -4 dB（mp3 編碼後的實際峰值約 -1 dB 以內）。
- 對應表和 docs/audio-manifest.md、src/services/audio-assets.ts 的 id 一致；換素材時只改 SOURCES。
"""
import re
import subprocess
from pathlib import Path

import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SRC = Path("art-source/audio")
OUT = Path("assets/audio")
KENNEY = SRC / "kenney_interface-sounds" / "Audio"

# id: (原始檔, 開始秒數（去掉開頭靜音之後）, 長度秒數, 淡出秒數, 目標平均音量 dB)
SOURCES = {
    "sfx-merge": (KENNEY / "pluck_001.ogg", 0.0, 0.4, 0.05, -16),
    "sfx-merge-fried": (SRC / "abrarhussain73-cooking-and-frying-in-oil-on-griddle-129349.mp3", 1.0, 1.0, 0.3, -20),
    "sfx-cash": (SRC / "modestas123123-cash-register-kaching-sound-effect-125042.mp3", 0.0, 1.0, 0.25, -18),
    "sfx-shutter": (SRC / "universfield-opening-metal-door-199581.mp3", 0.0, 1.4, 0.3, -18),
    "sfx-neon": (SRC / "u_g0akwz8ml1-sonido-de-luz-de-neon-194458.mp3", 0.0, 1.5, 0.4, -19),
    "sfx-fireworks": (SRC / "audiocoffee-christmas-fireworks-impact-174521.mp3", 0.0, 2.5, 0.6, -17),
    "sfx-gong": (SRC / "freesound_community-old-zildjian-gong-quite-natural-34294.mp3", 0.0, 2.5, 1.0, -18),
    "sfx-reject": (SRC / "universfield-error-notification-04-199275.mp3", 0.0, 0.6, 0.15, -20),
    "sfx-queue-tick": (SRC / "freesound_community-metronome-85688.mp3", 0.0, 0.15, 0.05, -22),
    "sfx-star": (SRC / "universfield-magic-spell-02-250240.mp3", 0.0, 1.2, 0.4, -18),
    "sfx-hint": (SRC / "dragon-studio-notification-bell-sound-1-376885.mp3", 0.0, 1.2, 0.4, -18),
    "sfx-reward": (SRC / "universfield-coin-drop-229314.mp3", 0.0, 1.2, 0.3, -18),
}

PEAK_LIMIT = -4.0  # mp3 編碼會讓瞬間的峰值過衝約 2–3 dB，留足餘量，輸出實際峰值約在 -1 dB 以內


def trim_filter(start: float, length: float, fade: float) -> str:
    return (
        # 去掉開頭低於 -45 dB 的靜音
        "silenceremove=start_periods=1:start_threshold=-45dB:start_duration=0.02,"
        f"atrim=start={start}:duration={length},asetpts=PTS-STARTPTS,"
        f"afade=t=out:st={max(0.0, length - fade)}:d={fade}"
    )


def measure(path: Path, chain: str) -> tuple[float, float]:
    result = subprocess.run(
        [FFMPEG, "-hide_banner", "-i", str(path), "-af", f"{chain},volumedetect", "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf8", errors="replace",
    ).stderr
    mean = re.search(r"mean_volume: (-?[\d.]+) dB", result)
    peak = re.search(r"max_volume: (-?[\d.]+) dB", result)
    if mean is None or peak is None:
        # ffmpeg 失敗（檔案壞掉、格式不支援）或沒有任何聲音時量不到音量
        raise SystemExit(f"量不到音量：{path}\n{result[-800:]}")
    return float(mean.group(1)), float(peak.group(1))


OUT.mkdir(parents=True, exist_ok=True)
for name, (source, start, length, fade, target_mean) in SOURCES.items():
    assert source.exists(), source
    chain = trim_filter(start, length, fade)
    mean, peak = measure(source, chain)
    gain = min(target_mean - mean, PEAK_LIMIT - peak)
    target = OUT / f"{name}.mp3"
    subprocess.run(
        [
            FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
            # 原始檔的浮點峰值可能超過 0 dB（volumedetect 量到的是截斷後的值），最後用 limiter 壓在上限內
            "-af", f"{chain},volume={gain:.2f}dB,alimiter=limit={10 ** (PEAK_LIMIT / 20):.3f}:attack=1:level=disabled",
            "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "96k", str(target),
        ],
        check=True,
    )
    out_mean, out_peak = measure(target, "anull")
    print(f"{name:16} {source.name[:40]:40} gain {gain:+5.1f} dB → mean {out_mean:5.1f} peak {out_peak:5.1f}  {target.stat().st_size // 1024} KB")

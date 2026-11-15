"""S7.2 占位音檔：背景音樂與 3 句叫賣。正式素材交付後（docs/audio-manifest.md）由 process-e7-audio.py 取代，本腳本隨之刪除。

用法：python -m uv run --python 3.12 --with imageio-ffmpeg python -I art-source/scripts/make-placeholder-e7-2.py
- 背景音樂：8 秒、首尾相接的五聲音階琶音（可以無縫循環）。
- 叫賣：3 組不同的上行音型，聽得出是哪一句（不是人聲）。
"""
import math
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

import imageio_ffmpeg

RATE = 22050
OUT = Path("assets/audio")
# 五聲音階（C D E G A）
SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]


def note(freq: float, length: float, volume: float = 0.4) -> list[float]:
    samples = []
    for i in range(int(RATE * length)):
        t = i / RATE
        env = min(1.0, t / 0.01) * math.exp(-3.0 * t)
        samples.append(volume * env * (math.sin(2 * math.pi * freq * t) + 0.3 * math.sin(4 * math.pi * freq * t)))
    return samples


def overlay(base: list[float], add: list[float], at: int) -> None:
    for i, value in enumerate(add):
        if at + i < len(base):
            base[at + i] += value


def bgm() -> list[float]:
    length = 8.0
    track = [0.0] * int(RATE * length)
    pattern = [0, 2, 4, 5, 4, 2, 3, 1, 0, 2, 4, 6, 5, 4, 2, 1]
    step = length / len(pattern)
    for index, degree in enumerate(pattern):
        overlay(track, note(SCALE[degree], step * 1.6, 0.25), int(index * step * RATE))
        # 每拍一個低音
        if index % 4 == 0:
            overlay(track, note(SCALE[0] / 2, step * 3.5, 0.2), int(index * step * RATE))
    # 首尾淡入淡出 20 ms，循環時不爆音
    fade = int(0.02 * RATE)
    for i in range(fade):
        track[i] *= i / fade
        track[-1 - i] *= i / fade
    return track


def call(degrees: list[int]) -> list[float]:
    track: list[float] = []
    for degree in degrees:
        track += note(SCALE[degree], 0.18, 0.5)
    track += note(SCALE[degrees[-1]], 0.5, 0.5)
    return track


TRACKS = {
    "bgm-night-market": bgm(),
    "voice-call-1": call([0, 2, 4, 7]),
    "voice-call-2": call([4, 2, 4, 6]),
    "voice-sold-out": call([7, 6, 5, 4, 7]),
}

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
OUT.mkdir(parents=True, exist_ok=True)
for name, samples in TRACKS.items():
    peak = max(1e-6, max(abs(s) for s in samples))
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "raw.wav"
        with wave.open(str(raw), "wb") as file:
            file.setnchannels(1)
            file.setsampwidth(2)
            file.setframerate(RATE)
            file.writeframes(b"".join(struct.pack("<h", int(s / peak * 0.5 * 32767)) for s in samples))
        target = OUT / f"{name}.mp3"
        subprocess.run(
            [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw),
             "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "96k", str(target)],
            check=True,
        )
    print(f"{target}: {len(samples) / RATE:.1f}s {target.stat().st_size // 1024} KB")

// 音效服務的網頁版（S7.1）：不播放任何聲音（no-op），介面和原生版相同。

export function startAudioService(_options: { random?: () => number } = {}): () => void {
  return () => {};
}

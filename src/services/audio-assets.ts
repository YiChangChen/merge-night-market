// 音效檔案（S7.1）：art-source/audio/ 的原始素材經 art-source/scripts/process-e7-audio.py 剪輯、統一音量後的 mp3。
// 換素材時改處理腳本的對應表再重跑，這裡不必改（docs/audio-manifest.md）。
export const SOUND_IDS = [
  'sfx-merge',
  'sfx-merge-fried',
  'sfx-cash',
  'sfx-shutter',
  'sfx-neon',
  'sfx-fireworks',
  'sfx-gong',
  'sfx-reject',
  'sfx-queue-tick',
  'sfx-star',
  'sfx-hint',
  'sfx-reward',
  // 叫賣語音（S7.2、FR44）
  'voice-call-1',
  'voice-call-2',
  'voice-sold-out',
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

export const SOUND_ASSETS: Record<SoundId, number> = {
  'sfx-merge': require('../../assets/audio/sfx-merge.mp3'),
  'sfx-merge-fried': require('../../assets/audio/sfx-merge-fried.mp3'),
  'sfx-cash': require('../../assets/audio/sfx-cash.mp3'),
  'sfx-shutter': require('../../assets/audio/sfx-shutter.mp3'),
  'sfx-neon': require('../../assets/audio/sfx-neon.mp3'),
  'sfx-fireworks': require('../../assets/audio/sfx-fireworks.mp3'),
  'sfx-gong': require('../../assets/audio/sfx-gong.mp3'),
  'sfx-reject': require('../../assets/audio/sfx-reject.mp3'),
  'sfx-queue-tick': require('../../assets/audio/sfx-queue-tick.mp3'),
  'sfx-star': require('../../assets/audio/sfx-star.mp3'),
  'sfx-hint': require('../../assets/audio/sfx-hint.mp3'),
  'sfx-reward': require('../../assets/audio/sfx-reward.mp3'),
  'voice-call-1': require('../../assets/audio/voice-call-1.mp3'),
  'voice-call-2': require('../../assets/audio/voice-call-2.mp3'),
  'voice-sold-out': require('../../assets/audio/voice-sold-out.mp3'),
};

/** 背景音樂（S7.2）：循環播放 */
export const BGM_ASSET: number = require('../../assets/audio/bgm-night-market.mp3');

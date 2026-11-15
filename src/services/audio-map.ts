// 遊戲事件對應的音效（S7.1、GDD〈音效與音樂〉）。純函式，原生版與網頁版共用，方便測試。
import type { GameEvent } from '@/game/events';

import type { SoundId } from './audio-assets';

export type SoundPlay = {
  id: SoundId;
  /** 播放速度；油鍋聲會跟著階數變快，音高一起升高 */
  rate?: number;
  /** 0–1，沒有指定時是 1 */
  volume?: number;
};

// 炸物鏈的油鍋聲：音量和音高隨品項階數遞增（GDD）；L2 是基準
const FRIED_RATE_PER_LEVEL = 0.08;
const FRIED_RATE_MIN = 0.9;
const FRIED_RATE_MAX = 1.5;
const FRIED_VOLUME_BASE = 0.6;
const FRIED_VOLUME_PER_LEVEL = 0.06;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function soundForEvent(event: GameEvent): SoundPlay | null {
  switch (event.type) {
    case 'item_merged': {
      if (event.chain !== 'fried') return { id: 'sfx-merge' };
      const steps = event.level - 2;
      return {
        id: 'sfx-merge-fried',
        rate: clamp(1 + FRIED_RATE_PER_LEVEL * steps, FRIED_RATE_MIN, FRIED_RATE_MAX),
        volume: clamp(FRIED_VOLUME_BASE + FRIED_VOLUME_PER_LEVEL * steps, 0, 1),
      };
    }
    case 'order_completed':
      return { id: 'sfx-cash' };
    case 'stall_reopened':
      return { id: 'sfx-shutter' };
    case 'stall_upgraded':
      return { id: 'sfx-neon' };
    case 'queue_sold_out':
      return { id: 'sfx-fireworks' };
    case 'dish_invented':
      // 鑼聲只給第一次發明；已發現的配方又做出一份時，鑼太隆重，用合成音
      return { id: event.first ? 'sfx-gong' : 'sfx-merge' };
    case 'invent_rejected':
      return { id: 'sfx-reject' };
    case 'card_starred':
      return { id: 'sfx-star' };
    case 'hint_shown':
      return { id: 'sfx-hint' };
    case 'ad_rewarded':
      return { id: 'sfx-reward' };
    default:
      return null;
  }
}

/** 完售叫賣延後播放，等煙火響過 */
export const SOLD_OUT_VOICE_DELAY_MS = 700;

/**
 * 叫賣語音（S7.2、FR44）：新一波人龍隨機一句招呼，完售時道謝。random 是 [0, 1) 的亂數，由服務注入。
 */
export function voiceForEvent(
  event: GameEvent,
  random: () => number
): { id: SoundId; delayMs: number } | null {
  if (event.type === 'wave_started') {
    return { id: random() < 0.5 ? 'voice-call-1' : 'voice-call-2', delayMs: 0 };
  }
  if (event.type === 'queue_sold_out')
    return { id: 'voice-sold-out', delayMs: SOLD_OUT_VOICE_DELAY_MS };
  return null;
}

/** 人龍最後 3 人的節奏音間隔（毫秒）：剩越少越快；其他情況沒有節奏音（補完 S2.2） */
export function tickInterval(remaining: number): number | null {
  if (remaining === 3) return 900;
  if (remaining === 2) return 650;
  if (remaining === 1) return 420;
  return null;
}

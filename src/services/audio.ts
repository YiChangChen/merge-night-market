// 音效服務（S7.1、S7.2）：GameEvent 的三個訂閱者之一（另兩個是 FxController、Telemetry）。只讀事件，絕不呼叫 apply。
// 只在 src/app/_layout.tsx 的啟動序列呼叫一次。網頁版見 audio.web.ts（no-op）。
import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { AppState, type AppStateStatus } from 'react-native';

import { gameEvents } from '@/game/events';
import { isQueueFinalStretch } from '@/game/queue';
import { useGameStore } from '@/game/store';

import { BGM_ASSET, SOUND_ASSETS, SOUND_IDS, type SoundId } from './audio-assets';
import { type SoundPlay, soundForEvent, tickInterval, voiceForEvent } from './audio-map';
import { log } from './log';
import { useSettings } from './settings';

/** 預載時每一幀建立幾個 player（分批預載，不在同一幀卡住 JS 執行緒） */
export const LOAD_BATCH = 6;

/** 背景音樂的音量：墊在音效底下 */
export const BGM_VOLUME = 0.35;

/**
 * 每個音效準備幾個 player 輪流用（實機回饋：連續合成時有時沒聲音）。
 * 同一個 player 還在播時又觸發，seekTo 與 play 會互相干擾，那一次就被吞掉；常連續觸發的音效多準備幾個。
 */
export function poolSize(id: SoundId): number {
  if (id === 'sfx-merge' || id === 'sfx-merge-fried') return 4;
  if (id === 'sfx-cash' || id === 'sfx-queue-tick' || id === 'sfx-reward' || id === 'sfx-reject') {
    return 2;
  }
  return 1;
}

/**
 * 啟動音效服務，回傳停止函式。
 * - 事件訂閱馬上生效；音訊模式與預載排在首幀之後（E6 retro A3：不拖慢冷啟動），預載完成前的事件直接略過。
 * - 載入或播放失敗只記 log.warn（每個音效一次），靜默跳過，不影響遊戲。
 * - 音效（含叫賣）與背景音樂分別跟著設定的「音效」「音樂」開關（S7.2）。
 * @param random 叫賣挑句子用的亂數（測試可以注入）
 */
export function startAudioService({
  random = Math.random,
}: { random?: () => number } = {}): () => void {
  const players = new Map<SoundId, AudioPlayer[]>();
  // 每個音效下一次要用哪一個 player（輪流）
  const cursors = new Map<SoundId, number>();
  const warned = new Set<string>();

  const warnOnce = (key: string, message: string, error: unknown) => {
    if (warned.has(key)) return;
    warned.add(key);
    log.warn('audio', message, { key, error: String(error) });
  };

  // App 在前景（iOS 進背景後的寬限期內計時器仍會跑，背景時不發聲）；stop 之後不再播放
  let appActive = AppState.currentState !== 'background';
  let stopped = false;

  const play = ({ id, rate, volume }: SoundPlay) => {
    if (stopped || !appActive || !useSettings.getState().sfx) return;
    const pool = players.get(id);
    if (!pool || pool.length === 0) return;
    const index = cursors.get(id) ?? 0;
    cursors.set(id, (index + 1) % pool.length);
    const player = pool[index];
    try {
      player.volume = volume ?? 1;
      if (rate !== undefined) player.setPlaybackRate(rate);
      // 輪到的 player 通常已經播完：先回到開頭，完成後再播放（同時呼叫會互相干擾）
      player
        .seekTo(0)
        .then(() => {
          if (!stopped) player.play();
        })
        .catch((error: unknown) => warnOnce(id, '音效播放失敗', error));
    } catch (error) {
      warnOnce(id, '音效播放失敗', error);
    }
  };

  // 叫賣（S7.2）：完售那句延後，等煙火響過
  const voiceTimers = new Set<ReturnType<typeof setTimeout>>();
  const unsubscribe = gameEvents.subscribe((event) => {
    const sound = soundForEvent(event);
    if (sound) play(sound);
    const voice = voiceForEvent(event, random);
    if (!voice) return;
    if (voice.delayMs === 0) {
      play({ id: voice.id });
      return;
    }
    const timer = setTimeout(() => {
      voiceTimers.delete(timer);
      play({ id: voice.id });
    }, voice.delayMs);
    voiceTimers.add(timer);
  });

  // 背景音樂（S7.2）：設定讀完、音樂開啟、App 在前景、已經載入時才播放
  // （設定還沒讀完就播，上次關掉音樂的玩家會先聽到一下）
  // 是否在播放看 player 的實際狀態：iOS 來電、Siri 中斷或拔耳機時，系統會直接暫停 player，
  // 之後任何一次 AppState 或設定變化都會把它播回來
  let bgm: AudioPlayer | null = null;
  const updateBgm = () => {
    if (!bgm) return;
    const { loaded, music } = useSettings.getState();
    const shouldPlay = appActive && loaded && music;
    try {
      if (shouldPlay === bgm.playing) return;
      if (shouldPlay) bgm.play();
      else bgm.pause();
    } catch (error) {
      warnOnce('bgm', '背景音樂播放失敗', error);
    }
  };
  const unsubscribeSettings = useSettings.subscribe(updateBgm);

  // 分批預載（E7 延後項目）：首幀之後先設定音訊模式，接著每一幀只建立 LOAD_BATCH 個 player，
  // 不在同一幀同步建立二十幾個原生 player。順序和 SOUND_IDS 一樣，最後是背景音樂；還沒載入的音效直接略過。
  const loadTasks: (() => void)[] = [];
  for (const id of SOUND_IDS) {
    for (let i = 0; i < poolSize(id); i++) {
      loadTasks.push(() => {
        try {
          const player = createAudioPlayer(SOUND_ASSETS[id]);
          // 油鍋聲的速度跟著階數變快，關掉音高校正，音高才會一起升高
          if (id === 'sfx-merge-fried') player.shouldCorrectPitch = false;
          const pool = players.get(id) ?? [];
          pool.push(player);
          players.set(id, pool);
        } catch (error) {
          warnOnce(id, '音效載入失敗', error);
        }
      });
    }
  }
  loadTasks.push(() => {
    try {
      bgm = createAudioPlayer(BGM_ASSET);
      bgm.loop = true;
      bgm.volume = BGM_VOLUME;
    } catch (error) {
      warnOnce('bgm', '背景音樂載入失敗', error);
    }
    updateBgm();
  });

  let frame = 0;
  const loadBatch = () => {
    for (const task of loadTasks.splice(0, LOAD_BATCH)) task();
    if (loadTasks.length > 0) frame = requestAnimationFrame(loadBatch);
  };
  frame = requestAnimationFrame(() => {
    // iOS 靜音開關打開時不發聲，並和其他 App（例如音樂）混音
    setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    }).catch((error: unknown) => warnOnce('mode', '設定音訊模式失敗', error));
    loadBatch();
  });

  // 人龍最後 3 人的節奏音：剩越少越快；冷卻中、不在最後 3 人、App 在背景時停止（補完 S2.2）
  // 換節奏時接著上一聲算（距上一聲已超過新間隔就馬上響），連續快速出餐時才不會一直被重設而不響
  let tickTimer: ReturnType<typeof setTimeout> | undefined;
  let tickEvery: number | null = null;
  let lastTickAt: number | null = null;
  const scheduleTick = (delay: number) => {
    tickTimer = setTimeout(() => {
      lastTickAt = Date.now();
      play({ id: 'sfx-queue-tick' });
      if (tickEvery !== null) scheduleTick(tickEvery);
    }, delay);
  };
  const updateTicker = () => {
    const queue = useGameStore.getState().state?.queue;
    const next =
      appActive && queue && isQueueFinalStretch(queue) ? tickInterval(queue.remaining) : null;
    if (next === tickEvery) return;
    const wasTicking = tickEvery !== null;
    tickEvery = next;
    clearTimeout(tickTimer);
    tickTimer = undefined;
    if (next === null) {
      lastTickAt = null;
      return;
    }
    // 剛進入最後 3 人：從現在起算一個間隔
    if (!wasTicking || lastTickAt === null) lastTickAt = Date.now();
    scheduleTick(Math.max(0, next - (Date.now() - lastTickAt)));
  };
  const unsubscribeStore = useGameStore.subscribe((store, previous) => {
    if (store.state?.queue !== previous.state?.queue) updateTicker();
  });
  const appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    appActive = state !== 'background';
    updateTicker();
    // 背景音樂：進背景暫停、回前景繼續
    updateBgm();
  });
  updateTicker();

  return () => {
    // 取消預載、取消訂閱、清空 player 之後，就不會再播放任何音效
    stopped = true;
    cancelAnimationFrame(frame);
    unsubscribe();
    unsubscribeStore();
    unsubscribeSettings();
    appStateSubscription.remove();
    clearTimeout(tickTimer);
    for (const timer of voiceTimers) clearTimeout(timer);
    voiceTimers.clear();
    for (const player of [...players.values()].flat().concat(bgm ? [bgm] : [])) {
      try {
        player.remove();
      } catch {
        // 釋放失敗沒有影響
      }
    }
    players.clear();
    bgm = null;
  };
}

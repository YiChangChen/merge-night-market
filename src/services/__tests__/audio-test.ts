// S7.1：音效服務與事件音效；S7.2：背景音樂、叫賣語音、設定開關。
import { AppState } from 'react-native';

import { createGame } from '@/game/engine';
import { type GameEvent, gameEvents } from '@/game/events';
import { useGameStore } from '@/game/store';

import { BGM_VOLUME, poolSize, startAudioService } from '../audio';
import { SOUND_IDS, type SoundId } from '../audio-assets';
import { SOLD_OUT_VOICE_DELAY_MS, soundForEvent, tickInterval, voiceForEvent } from '../audio-map';
import { log } from '../log';
import { DEFAULT_SETTINGS, setMusicEnabled, setSfxEnabled, useSettings } from '../settings';

type FakePlayer = {
  /** 依呼叫順序對應的音效（服務依 SOUND_IDS 的順序、每個音效 poolSize 個建立；建立失敗的那次也算一次呼叫） */
  id: string;
  source: unknown;
  volume: number;
  loop: boolean;
  shouldCorrectPitch: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  setPlaybackRate: jest.Mock;
  remove: jest.Mock;
};

const players: FakePlayer[] = [];
// 建立順序：每個音效依 poolSize 連續建立，最後是背景音樂
const CREATION_ORDER: string[] = [
  ...SOUND_IDS.flatMap((id) => Array<string>(poolSize(id)).fill(id)),
  'bgm',
];
const mockCreate = jest.fn((source: unknown): FakePlayer => {
  const player: FakePlayer = {
    id: CREATION_ORDER[(mockCreate.mock.calls.length - 1) % CREATION_ORDER.length],
    source,
    volume: 1,
    loop: false,
    shouldCorrectPitch: true,
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setPlaybackRate: jest.fn(),
    remove: jest.fn(),
  };
  players.push(player);
  return player;
});
const mockMode = jest.fn((_mode: unknown) => Promise.resolve());

jest.mock('expo-audio', () => ({
  createAudioPlayer: (source: unknown) => mockCreate(source),
  setAudioModeAsync: (mode: unknown) => mockMode(mode),
}));

const NOW = 1_000_000;

/** 這個音效的所有 player（建立失敗時陣列順序會錯開，不能用 index） */
function poolOf(id: SoundId): FakePlayer[] {
  return players.filter((candidate) => candidate.id === id);
}

/** 這個音效的第一個 player */
function playerOf(id: SoundId): FakePlayer {
  const player = poolOf(id)[0];
  if (!player) throw new Error(`沒有 ${id} 的 player`);
  return player;
}

/** 播放是在 seekTo(0) 完成之後才呼叫：先讓 Promise 跑完 */
async function flush() {
  await jest.advanceTimersByTimeAsync(0);
}

/** 播放過的音效（不含背景音樂） */
function playedIds(): string[] {
  return players
    .filter((player) => player.id !== 'bgm')
    .flatMap((player) => player.play.mock.calls.map(() => player.id));
}

function bgmPlayer(): FakePlayer {
  const player = players.find((candidate) => candidate.id === 'bgm');
  if (!player) throw new Error('沒有背景音樂的 player');
  return player;
}

beforeEach(() => {
  jest.useFakeTimers();
  players.length = 0;
  mockCreate.mockClear();
  mockMode.mockClear();
  useSettings.setState({ ...DEFAULT_SETTINGS, loaded: true });
  // RN 的 AppState 是 jest mock；被其他測試 spy 再還原後會回傳 undefined，每個測試前設回可以移除的訂閱
  jest.mocked(AppState.addEventListener).mockImplementation(() => ({ remove: jest.fn() }) as never);
  useGameStore.setState({ state: createGame(NOW, 1), status: { kind: 'ready' } });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('音效檔案', () => {
  it('每個音效 id 都有對應的 mp3（process-e7-audio.py 的輸出）', () => {
    const fs = jest.requireActual<{ existsSync(file: string): boolean }>('fs');
    for (const id of SOUND_IDS) {
      expect(fs.existsSync(`${process.cwd()}/assets/audio/${id}.mp3`)).toBe(true);
    }
  });
});

describe('soundForEvent：事件對應的音效', () => {
  it.each<[GameEvent, SoundId]>([
    [{ type: 'order_completed', kind: 'normal', coins: 10 }, 'sfx-cash'],
    [{ type: 'stall_reopened', stall: 'noodle', level: 1 }, 'sfx-shutter'],
    [{ type: 'stall_upgraded', stall: 'tea', level: 2 }, 'sfx-neon'],
    [{ type: 'queue_sold_out', wave: 1, length: 12 }, 'sfx-fireworks'],
    [{ type: 'dish_invented', recipe: 'tea-fried', first: true }, 'sfx-gong'],
    [{ type: 'dish_invented', recipe: 'tea-fried', first: false }, 'sfx-merge'],
    [{ type: 'invent_rejected', recipes: [] }, 'sfx-reject'],
    [{ type: 'card_starred', recipe: 'tea-fried', stars: 2 }, 'sfx-star'],
    [{ type: 'hint_shown', recipe: 'tea-fried' }, 'sfx-hint'],
    [{ type: 'ad_rewarded', placement: 'energy' }, 'sfx-reward'],
    [{ type: 'item_merged', chain: 'tea', level: 3 }, 'sfx-merge'],
  ])('%o → %s', (event, id) => {
    expect(soundForEvent(event)?.id).toBe(id);
  });

  it('炸物合成用油鍋聲，階數越高越快（音高越高）、越響，有上下限', () => {
    const fried = (level: number) => soundForEvent({ type: 'item_merged', chain: 'fried', level });
    expect(fried(2)).toEqual({ id: 'sfx-merge-fried', rate: 1, volume: 0.6 });
    expect(fried(4)?.rate).toBeCloseTo(1.16);
    expect(fried(4)?.volume).toBeCloseTo(0.72);
    const rates = [2, 3, 4, 5, 6, 7, 8].map((level) => fried(level)?.rate ?? 0);
    expect([...rates].sort((a, b) => a - b)).toEqual(rates);
    expect(fried(20)?.rate).toBe(1.5);
    expect(fried(20)?.volume).toBe(1);
    expect(fried(1)?.rate).toBe(0.92);
  });

  it('tickInterval：最後 3 人越來越快，其他情況沒有節奏音', () => {
    expect(tickInterval(3)).toBe(900);
    expect(tickInterval(2)).toBe(650);
    expect(tickInterval(1)).toBe(420);
    expect(tickInterval(4)).toBeNull();
    expect(tickInterval(0)).toBeNull();
  });
});

describe('startAudioService', () => {
  it('首幀之後才預載：設定音訊模式（遵守靜音開關、和其他 App 混音），每個音效 poolSize 個 player', async () => {
    const stop = startAudioService();
    expect(mockCreate).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(20);
    expect(mockMode).toHaveBeenCalledWith({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
    expect(mockCreate).toHaveBeenCalledTimes(CREATION_ORDER.length);
    expect(poolOf('sfx-merge')).toHaveLength(4);
    expect(poolOf('sfx-gong')).toHaveLength(1);
    // 炸物的 player 都不做音高校正：速度變快時音高跟著升高
    expect(poolOf('sfx-merge-fried').every((player) => !player.shouldCorrectPitch)).toBe(true);
    stop();
  });

  it('預載完成前的事件直接略過；之後依事件播放，炸物設定速度與音量', async () => {
    const stop = startAudioService();
    gameEvents.emit({ type: 'order_completed', kind: 'normal', coins: 10 });
    await jest.advanceTimersByTimeAsync(20);
    expect(playedIds()).toEqual([]);

    gameEvents.emit({ type: 'order_completed', kind: 'normal', coins: 10 });
    gameEvents.emit({ type: 'item_merged', chain: 'fried', level: 4 });
    await flush();
    expect(playedIds().sort()).toEqual(['sfx-cash', 'sfx-merge-fried']);
    const fried = playerOf('sfx-merge-fried');
    expect(fried.setPlaybackRate).toHaveBeenCalledWith(expect.closeTo(1.16));
    expect(fried.volume).toBeCloseTo(0.72);
    expect(fried.seekTo).toHaveBeenCalledWith(0);
    stop();
  });

  it('播放失敗只記一次 log.warn，不丟例外；停止後不再反應並釋放 player', async () => {
    const warn = jest.spyOn(log, 'warn').mockImplementation(() => {});
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);
    for (const cash of poolOf('sfx-cash')) {
      cash.play.mockImplementation(() => {
        throw new Error('boom');
      });
    }

    expect(() => {
      gameEvents.emit({ type: 'order_completed', kind: 'normal', coins: 10 });
      gameEvents.emit({ type: 'order_completed', kind: 'normal', coins: 10 });
    }).not.toThrow();
    await flush();
    expect(warn).toHaveBeenCalledTimes(1);

    stop();
    gameEvents.emit({ type: 'stall_upgraded', stall: 'tea', level: 2 });
    expect(playerOf('sfx-neon').play).not.toHaveBeenCalled();
    expect(players.every((player) => player.remove.mock.calls.length === 1)).toBe(true);
    warn.mockRestore();
  });

  it('停止時取消事件訂閱（不留下訂閱者）', () => {
    const unsubscribe = jest.fn();
    const spy = jest.spyOn(gameEvents, 'subscribe').mockReturnValue(unsubscribe);
    const stop = startAudioService();
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('音效關閉（S7.2 設定）：不播放；打開後恢復', async () => {
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);
    setSfxEnabled(false);
    gameEvents.emit({ type: 'order_completed', kind: 'normal', coins: 10 });
    await flush();
    expect(playedIds()).toEqual([]);
    setSfxEnabled(true);
    gameEvents.emit({ type: 'order_completed', kind: 'normal', coins: 10 });
    await flush();
    expect(playedIds()).toEqual(['sfx-cash']);
    stop();
  });

  it('載入失敗（建立 player 或設定模式出錯）：只記 log.warn，其他音效照常', async () => {
    const warn = jest.spyOn(log, 'warn').mockImplementation(() => {});
    mockMode.mockImplementationOnce(() => Promise.reject(new Error('mode')));
    mockCreate.mockImplementationOnce(() => {
      throw new Error('load');
    });
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);

    expect(warn).toHaveBeenCalledTimes(2);
    // 第一個合成音的 player 建立失敗，其餘 3 個照常
    expect(poolOf('sfx-merge')).toHaveLength(3);
    gameEvents.emit({ type: 'order_completed', kind: 'normal', coins: 10 });
    await flush();
    expect(playedIds()).toEqual(['sfx-cash']);
    stop();
    warn.mockRestore();
  });

  it('回到開頭完成之前不播放（同時呼叫 seekTo 與 play 會互相干擾）', async () => {
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);
    const cash = playerOf('sfx-cash');
    cash.seekTo.mockReturnValue(new Promise(() => {}));
    gameEvents.emit({ type: 'order_completed', kind: 'normal', coins: 10 });
    await flush();
    expect(cash.seekTo).toHaveBeenCalledWith(0);
    expect(cash.play).not.toHaveBeenCalled();
    stop();
  });

  it('連續合成（實機回饋：有時沒聲音）：輪流用不同的 player，每一次都從頭播放', async () => {
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);
    for (let i = 0; i < 6; i++) {
      gameEvents.emit({ type: 'item_merged', chain: 'tea', level: 2 });
    }
    await flush();
    const pool = poolOf('sfx-merge');
    // 6 次輪流分給 4 個 player：2、2、1、1
    expect(pool.map((player) => player.play.mock.calls.length)).toEqual([2, 2, 1, 1]);
    // 每次都先回到開頭，完成後才播放
    for (const player of pool) {
      expect(player.seekTo.mock.calls.length).toBe(player.play.mock.calls.length);
    }
    stop();
  });
});

describe('人龍最後 3 人的節奏音（補完 S2.2）', () => {
  function setQueue(remaining: number, cooling = false) {
    useGameStore.setState((store) => ({
      state: store.state && {
        ...store.state,
        queue: {
          ...store.state.queue,
          length: 12,
          remaining,
          cooldownEndsAt: cooling ? NOW + 60_000 : null,
        },
      },
    }));
  }
  const ticks = () =>
    poolOf('sfx-queue-tick').reduce((sum, player) => sum + player.play.mock.calls.length, 0);

  it('剩 3 人開始、剩越少越快；完售冷卻後停止', async () => {
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);
    setQueue(5);
    await jest.advanceTimersByTimeAsync(2000);
    expect(ticks()).toBe(0);

    setQueue(3);
    await jest.advanceTimersByTimeAsync(900 * 2);
    expect(ticks()).toBe(2);

    setQueue(1);
    await jest.advanceTimersByTimeAsync(420 * 3);
    expect(ticks()).toBe(5);

    setQueue(0, true);
    await jest.advanceTimersByTimeAsync(5000);
    expect(ticks()).toBe(5);
    stop();
  });

  it('App 在背景時不播；回到前景再開始', async () => {
    let handler: ((state: string) => void) | undefined;
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      handler = listener as (state: string) => void;
      return { remove: jest.fn() } as never;
    });
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);
    setQueue(2);
    handler?.('background');
    await jest.advanceTimersByTimeAsync(3000);
    expect(ticks()).toBe(0);

    handler?.('active');
    await jest.advanceTimersByTimeAsync(650);
    expect(ticks()).toBe(1);
    stop();
    spy.mockRestore();
  });
});

describe('叫賣語音（S7.2、FR44）', () => {
  it('voiceForEvent：新一波隨機一句招呼；完售延後道謝；其他事件沒有', () => {
    const wave = { type: 'wave_started', wave: 2, length: 12 } as const;
    expect(voiceForEvent(wave, () => 0.1)).toEqual({ id: 'voice-call-1', delayMs: 0 });
    expect(voiceForEvent(wave, () => 0.9)).toEqual({ id: 'voice-call-2', delayMs: 0 });
    expect(voiceForEvent({ type: 'queue_sold_out', wave: 1, length: 12 }, () => 0)).toEqual({
      id: 'voice-sold-out',
      delayMs: SOLD_OUT_VOICE_DELAY_MS,
    });
    expect(
      voiceForEvent({ type: 'order_completed', kind: 'normal', coins: 1 }, () => 0)
    ).toBeNull();
  });

  it('新一波人龍：播注入的亂數選到的那一句', async () => {
    const stop = startAudioService({ random: () => 0.9 });
    await jest.advanceTimersByTimeAsync(20);
    gameEvents.emit({ type: 'wave_started', wave: 2, length: 12 });
    await flush();
    expect(playedIds()).toEqual(['voice-call-2']);
    stop();
  });

  it('完售：煙火馬上響，道謝在煙火之後', async () => {
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);
    gameEvents.emit({ type: 'queue_sold_out', wave: 1, length: 12 });
    await flush();
    expect(playedIds()).toEqual(['sfx-fireworks']);
    await jest.advanceTimersByTimeAsync(SOLD_OUT_VOICE_DELAY_MS);
    expect(playedIds().sort()).toEqual(['sfx-fireworks', 'voice-sold-out']);
    stop();
  });

  it('音效關閉時不播叫賣；停止後延後的道謝也不播', async () => {
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);
    setSfxEnabled(false);
    gameEvents.emit({ type: 'wave_started', wave: 2, length: 12 });
    await flush();
    expect(playedIds()).toEqual([]);

    setSfxEnabled(true);
    gameEvents.emit({ type: 'queue_sold_out', wave: 1, length: 12 });
    const voice = playerOf('voice-sold-out');
    stop();
    // 延後的道謝計時器也一併清掉（不留下計時器）
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(SOLD_OUT_VOICE_DELAY_MS * 2);
    expect(voice.play).not.toHaveBeenCalled();
  });
});

describe('背景音樂（S7.2）', () => {
  it('首幀後建立：循環、音量 0.35，音樂開啟且在前景時播放', async () => {
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);
    const bgm = bgmPlayer();
    expect(bgm.loop).toBe(true);
    expect(bgm.volume).toBe(BGM_VOLUME);
    expect(bgm.play).toHaveBeenCalledTimes(1);
    stop();
  });

  it('關閉音樂：暫停；再打開：繼續；音效開關不影響音樂', async () => {
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);
    const bgm = bgmPlayer();
    setMusicEnabled(false);
    expect(bgm.pause).toHaveBeenCalledTimes(1);
    setSfxEnabled(false);
    expect(bgm.play).toHaveBeenCalledTimes(1);
    setMusicEnabled(true);
    expect(bgm.play).toHaveBeenCalledTimes(2);
    stop();
  });

  it('啟動時音樂是關的：不播放', async () => {
    useSettings.setState({ music: false });
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);
    expect(bgmPlayer().play).not.toHaveBeenCalled();
    stop();
  });

  it('設定還沒讀完時不播（上次關掉音樂的玩家不會先聽到一下）', async () => {
    useSettings.setState({ ...DEFAULT_SETTINGS, loaded: false });
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);
    expect(bgmPlayer().play).not.toHaveBeenCalled();
    // 讀到的設定是音樂關閉
    useSettings.setState({ music: false, loaded: true });
    expect(bgmPlayer().play).not.toHaveBeenCalled();
    stop();
  });

  it('App 進背景暫停，回前景繼續', async () => {
    let handler: ((state: string) => void) | undefined;
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      handler = listener as (state: string) => void;
      return { remove: jest.fn() } as never;
    });
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);
    const bgm = bgmPlayer();
    handler?.('background');
    expect(bgm.pause).toHaveBeenCalledTimes(1);
    handler?.('active');
    expect(bgm.play).toHaveBeenCalledTimes(2);
    stop();
    spy.mockRestore();
  });

  it('停止時取消設定的訂閱', () => {
    const unsubscribe = jest.fn();
    const spy = jest.spyOn(useSettings, 'subscribe').mockReturnValue(unsubscribe);
    const stop = startAudioService();
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('停止時釋放背景音樂的 player', async () => {
    const stop = startAudioService();
    await jest.advanceTimersByTimeAsync(20);
    const bgm = bgmPlayer();
    stop();
    expect(bgm.remove).toHaveBeenCalledTimes(1);
  });
});

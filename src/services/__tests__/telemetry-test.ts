// S7.3：數據埋點（PostHog）。
import { AppState } from 'react-native';

import { createGame } from '@/game/engine';
import { gameEvents } from '@/game/events';
import { useGameStore } from '@/game/store';

import { log } from '../log';
import { daysSinceFirstLaunch, eventProperties, startTelemetry, trackAdShown } from '../telemetry';

const mockCapture = jest.fn();
const mockFlush = jest.fn(() => Promise.resolve());
const mockConstruct = jest.fn();

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: class {
    constructor(key: string, options: unknown) {
      mockConstruct(key, options);
    }
    capture(event: string, props: unknown) {
      mockCapture(event, props);
    }
    flush() {
      return mockFlush();
    }
  },
}));

const SETTINGS = { key: 'phc_test', host: 'https://us.i.posthog.com' };
const NOW = Date.UTC(2026, 10, 15, 4, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function setReady(firstLaunchAt = NOW, tutorialStep = 0) {
  const base = createGame(firstLaunchAt, 1);
  useGameStore.setState({
    state: { ...base, meta: { ...base.meta, tutorialStep } },
    status: { kind: 'ready' },
  });
}

function captured(): [string, unknown][] {
  return mockCapture.mock.calls as [string, unknown][];
}

let appStateHandler: ((state: string) => void) | undefined;

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  mockCapture.mockClear();
  mockFlush.mockClear();
  mockConstruct.mockClear();
  appStateHandler = undefined;
  jest.mocked(AppState.addEventListener).mockImplementation((_type, listener) => {
    appStateHandler = listener as (state: string) => void;
    return { remove: jest.fn() } as never;
  });
  setReady();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('純函式', () => {
  it('eventProperties：去掉 type，陣列改成逗號字串加數量（扁平）', () => {
    expect(eventProperties({ type: 'stall_upgraded', stall: 'tea', level: 2 })).toEqual({
      stall: 'tea',
      level: 2,
    });
    expect(
      eventProperties({ type: 'invent_rejected', recipes: ['tea-fried', 'fried-sweet'] })
    ).toEqual({ recipes: 'tea-fried,fried-sweet', recipes_count: 2 });
    expect(eventProperties({ type: 'dish_invented', recipe: 'tea-fried', first: true })).toEqual({
      recipe: 'tea-fried',
      first: true,
    });
  });

  it('daysSinceFirstLaunch：安裝當天是第 0 天', () => {
    expect(daysSinceFirstLaunch(NOW, NOW)).toBe(0);
    expect(daysSinceFirstLaunch(NOW, NOW + DAY - 1)).toBe(0);
    expect(daysSinceFirstLaunch(NOW, NOW + DAY)).toBe(1);
    expect(daysSinceFirstLaunch(NOW, NOW + 7 * DAY + 5)).toBe(7);
    // 時鐘倒退不會變負數
    expect(daysSinceFirstLaunch(NOW, NOW - DAY)).toBe(0);
  });
});

describe('startTelemetry', () => {
  it('沒有 Project API Key：什麼都不做', async () => {
    const stop = startTelemetry({ settings: null });
    await jest.advanceTimersByTimeAsync(20);
    gameEvents.emit({ type: 'order_completed', kind: 'normal', coins: 10 });
    expect(mockConstruct).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
    stop();
  });

  it('首幀之後才初始化；匿名、不擷取生命週期與 geoip、離線暫存', async () => {
    const stop = startTelemetry({ settings: SETTINGS });
    expect(mockConstruct).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(20);

    expect(mockConstruct).toHaveBeenCalledWith('phc_test', {
      host: 'https://us.i.posthog.com',
      captureAppLifecycleEvents: false,
      persistence: 'file',
      flushAt: 20,
      flushInterval: 30_000,
      personProfiles: 'never',
      disableGeoip: true,
    });
    stop();
  });

  it('初始化前的事件略過；之後 GameEvent 用同名送出，屬性扁平', async () => {
    const stop = startTelemetry({ settings: SETTINGS });
    gameEvents.emit({ type: 'order_completed', kind: 'normal', coins: 10 });
    await jest.advanceTimersByTimeAsync(20);
    mockCapture.mockClear();

    gameEvents.emit({ type: 'stall_upgraded', stall: 'tea', level: 2 });
    gameEvents.emit({ type: 'ad_rewarded', placement: 'energy' });
    expect(captured()).toEqual([
      ['stall_upgraded', { stall: 'tea', level: 2 }],
      ['ad_rewarded', { placement: 'energy' }],
    ]);
    stop();
  });

  it('app_open：讀檔完成後送一次（附天數）；進背景再回來算新的一次', async () => {
    setReady(NOW - 3 * DAY);
    const stop = startTelemetry({ settings: SETTINGS });
    await jest.advanceTimersByTimeAsync(20);
    expect(captured()).toEqual([['app_open', { days_since_first_launch: 3 }]]);

    // 同一次開啟中的 store 更新不會重複送
    useGameStore.setState((store) => ({ state: store.state && { ...store.state, coins: 5 } }));
    expect(captured().filter(([name]) => name === 'app_open')).toHaveLength(1);

    appStateHandler?.('background');
    expect(mockFlush).toHaveBeenCalledTimes(1);
    appStateHandler?.('active');
    expect(captured().filter(([name]) => name === 'app_open')).toHaveLength(2);
    stop();
  });

  it('app_open：還在讀檔就初始化時，等讀檔完成才送', async () => {
    useGameStore.setState({ state: null, status: { kind: 'loading' } });
    const stop = startTelemetry({ settings: SETTINGS });
    await jest.advanceTimersByTimeAsync(20);
    expect(captured()).toEqual([]);

    setReady(NOW - DAY);
    expect(captured()).toEqual([['app_open', { days_since_first_launch: 1 }]]);
    stop();
  });

  it('tutorial_step：教學步驟變大時送；讀檔時的第一次不算', async () => {
    setReady(NOW, 1);
    const stop = startTelemetry({ settings: SETTINGS });
    await jest.advanceTimersByTimeAsync(20);
    mockCapture.mockClear();

    useGameStore.setState((store) => ({
      state: store.state && { ...store.state, meta: { ...store.state.meta, tutorialStep: 2 } },
    }));
    useGameStore.setState((store) => ({ state: store.state && { ...store.state, coins: 9 } }));
    expect(captured()).toEqual([['tutorial_step', { step: 2 }]]);
    stop();
  });

  it('trackAdShown：送 ad_shown；沒有初始化時不送', async () => {
    trackAdShown('energy');
    expect(mockCapture).not.toHaveBeenCalled();

    const stop = startTelemetry({ settings: SETTINGS });
    await jest.advanceTimersByTimeAsync(20);
    trackAdShown('sellout-double');
    expect(captured()).toContainEqual(['ad_shown', { placement: 'sellout-double' }]);
    stop();
  });

  it('初始化失敗：只記 log.warn，之後不送也不丟例外', async () => {
    const warn = jest.spyOn(log, 'warn').mockImplementation(() => {});
    mockConstruct.mockImplementationOnce(() => {
      throw new Error('init');
    });
    const stop = startTelemetry({ settings: SETTINGS });
    await jest.advanceTimersByTimeAsync(20);
    expect(() =>
      gameEvents.emit({ type: 'order_completed', kind: 'normal', coins: 10 })
    ).not.toThrow();
    expect(mockCapture).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    stop();
    warn.mockRestore();
  });

  it('送出失敗：只記一次 log.warn，不丟例外', async () => {
    const warn = jest.spyOn(log, 'warn').mockImplementation(() => {});
    const stop = startTelemetry({ settings: SETTINGS });
    await jest.advanceTimersByTimeAsync(20);
    mockCapture.mockImplementation(() => {
      throw new Error('capture');
    });
    expect(() => {
      gameEvents.emit({ type: 'order_completed', kind: 'normal', coins: 10 });
      gameEvents.emit({ type: 'order_completed', kind: 'normal', coins: 10 });
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    mockCapture.mockReset();
    stop();
    warn.mockRestore();
  });

  it('停止時取消訂閱並把排隊的事件送出', async () => {
    const unsubscribe = jest.fn();
    const spy = jest.spyOn(gameEvents, 'subscribe').mockReturnValue(unsubscribe);
    const stop = startTelemetry({ settings: SETTINGS });
    await jest.advanceTimersByTimeAsync(20);
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockFlush).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

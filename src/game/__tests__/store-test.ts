import { BALANCE } from '../content';
import { createGame, type GameState } from '../engine';
import { type GameEvent, gameEvents } from '../events';
import { useGameStore } from '../store';

const NOW = 1_000_000;

function freshGame(overrides: Partial<GameState> = {}): GameState {
  return { ...createGame(NOW, 1), ...overrides };
}

describe('useGameStore', () => {
  let now: jest.SpyInstance<number, []>;

  beforeEach(() => {
    now = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    useGameStore.setState({ state: null, status: { kind: 'loading' } });
  });

  afterEach(() => {
    now.mockRestore();
  });

  it('還沒讀檔（state 為 null）時，apply 不做任何事', () => {
    const action = jest.fn((state: GameState) => state);

    useGameStore.getState().apply(action);

    expect(action).not.toHaveBeenCalled();
    expect(useGameStore.getState().state).toBeNull();
  });

  it('hydrate 之後狀態是 ready', () => {
    useGameStore.getState().hydrate(freshGame());

    expect(useGameStore.getState().status).toEqual({ kind: 'ready' });
  });

  it('讀檔失敗：狀態是 failed、state 維持 null，apply 不做任何事（不會觸發存檔）', () => {
    const action = jest.fn((state: GameState) => state);

    useGameStore.getState().failLoad('migration-failed');
    useGameStore.getState().apply(action);

    expect(useGameStore.getState().status).toEqual({ kind: 'failed', reason: 'migration-failed' });
    expect(useGameStore.getState().state).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it('resetLoad 讓重試回到 loading', () => {
    useGameStore.getState().failLoad('storage-error');

    useGameStore.getState().resetLoad();

    expect(useGameStore.getState().status).toEqual({ kind: 'loading' });
  });

  it('hydrate 會先結算時間，再放進 store', () => {
    const loaded = freshGame({ energy: 50, energyUpdatedAt: NOW - 3 * BALANCE.energyRegenMs });

    useGameStore.getState().hydrate(loaded);

    expect(useGameStore.getState().state?.energy).toBe(53);
  });

  it('apply 先執行 syncAll，再把結算後的 state 交給 action', () => {
    useGameStore.setState({ state: freshGame({ energy: 50, energyUpdatedAt: NOW }) });
    now.mockReturnValue(NOW + 2 * BALANCE.energyRegenMs);
    let seen: number | undefined;

    useGameStore.getState().apply((state) => {
      seen = state.energy;
      return { ...state, coins: state.coins + 7 };
    });

    expect(seen).toBe(52);
    expect(useGameStore.getState().state?.energy).toBe(52);
    expect(useGameStore.getState().state?.coins).toBe(freshGame().coins + 7);
  });

  it('依序分派 action 產生的事件，分派後 events 清空', () => {
    useGameStore.setState({ state: freshGame() });
    const events: GameEvent[] = [
      { type: 'item_merged', chain: 'tea', level: 2 },
      { type: 'stall_upgraded', stall: 'tea', level: 2 },
    ];
    const received: GameEvent[] = [];
    const unsubscribe = gameEvents.subscribe((event) => received.push(event));

    useGameStore.getState().apply((state) => ({ ...state, events }));
    unsubscribe();

    expect(received).toEqual(events);
    expect(useGameStore.getState().state?.events).toEqual([]);
  });

  it('訂閱者收到事件時，store 已經是新的 state', () => {
    useGameStore.setState({ state: freshGame({ coins: 0 }) });
    let coinsSeen: number | undefined;
    const unsubscribe = gameEvents.subscribe(() => {
      coinsSeen = useGameStore.getState().state?.coins;
    });

    useGameStore.getState().apply((state) => ({
      ...state,
      coins: 99,
      events: [{ type: 'item_merged', chain: 'tea', level: 2 }],
    }));
    unsubscribe();

    expect(coinsSeen).toBe(99);
  });

  it('action 沒有改變 state 時，不觸發 store 更新', () => {
    const state = freshGame({ energyUpdatedAt: NOW });
    useGameStore.setState({ state });
    const listener = jest.fn();
    const unsubscribe = useGameStore.subscribe(listener);

    useGameStore.getState().apply((current) => current);
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
    expect(useGameStore.getState().state).toBe(state);
  });
});

describe('時間快轉（除錯面板）', () => {
  let now: jest.SpyInstance<number, []>;

  beforeEach(() => {
    now = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    useGameStore.setState({ state: null, status: { kind: 'loading' }, timeOffsetMs: 0 });
  });

  afterEach(() => {
    now.mockRestore();
    useGameStore.setState({ timeOffsetMs: 0 });
  });

  it('advanceTime 讓下一次 syncAll 使用快轉後的時間（體力依快轉時間回復）', () => {
    useGameStore.setState({
      state: { ...createGame(NOW, 1), energy: 50, energyUpdatedAt: NOW },
      status: { kind: 'ready' },
    });

    useGameStore.getState().advanceTime(3 * BALANCE.energyRegenMs);

    expect(useGameStore.getState().timeOffsetMs).toBe(3 * BALANCE.energyRegenMs);
    expect(useGameStore.getState().state?.energy).toBe(53);
  });

  it('偏移量會累加；resetTime 歸零', () => {
    useGameStore.getState().advanceTime(1000);
    useGameStore.getState().advanceTime(2000);
    expect(useGameStore.getState().timeOffsetMs).toBe(3000);

    useGameStore.getState().resetTime();
    expect(useGameStore.getState().timeOffsetMs).toBe(0);
  });

  it('快轉量不合法時不變', () => {
    useGameStore.getState().advanceTime(-1000);
    useGameStore.getState().advanceTime(Number.NaN);
    expect(useGameStore.getState().timeOffsetMs).toBe(0);
  });
});

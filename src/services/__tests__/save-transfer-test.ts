// 存檔匯入是資料安全的一部分（不合法的資料絕不能取代目前的遊戲），所以和 save-test 一樣例外替服務層寫測試。
import * as Clipboard from 'expo-clipboard';

import { createGame } from '@/game/engine';
import lv3 from '@/game/save/__tests__/fixtures/save-v1-lv3.json';
import { serializeSave } from '@/game/save';
import { useGameStore } from '@/game/store';

import { exportSaveToClipboard, importSaveFromClipboard } from '../save-transfer';

jest.mock('expo-clipboard', () => {
  let text = '';
  return {
    setStringAsync: jest.fn(async (value: string) => {
      text = value;
      return true;
    }),
    getStringAsync: jest.fn(async () => text),
  };
});

const NOW = 1_000_000;
let quiet: jest.SpyInstance[] = [];

beforeEach(async () => {
  useGameStore.setState({ state: createGame(NOW, 1), status: { kind: 'ready' }, timeOffsetMs: 0 });
  await Clipboard.setStringAsync('');
  quiet = (['info', 'warn'] as const).map((level) =>
    jest.spyOn(console, level).mockImplementation(() => {})
  );
});

afterEach(() => quiet.forEach((spy) => spy.mockRestore()));

describe('exportSaveToClipboard', () => {
  it('複製目前的存檔 JSON，不含暫態 events', async () => {
    const result = await exportSaveToClipboard();

    const copied = await Clipboard.getStringAsync();
    expect(result).toEqual({ ok: true, length: copied.length });
    expect(JSON.parse(copied).version).toBe(2);
    expect(JSON.parse(copied)).not.toHaveProperty('events');
  });
});

describe('importSaveFromClipboard', () => {
  it('合法的 v2 存檔：取代目前的遊戲', async () => {
    const other = { ...createGame(NOW, 9), coins: 4321, level: 5 };
    await Clipboard.setStringAsync(serializeSave(other));

    const result = await importSaveFromClipboard();

    expect(result).toEqual({ ok: true, level: 5, coins: 4321, migratedFrom: null });
    expect(useGameStore.getState().state?.coins).toBe(4321);
  });

  it('v1 存檔：先遷移再匯入（可以拿 v1 fixture 來測遷移）', async () => {
    await Clipboard.setStringAsync(JSON.stringify(lv3));

    const result = await importSaveFromClipboard();

    expect(result).toMatchObject({ ok: true, level: lv3.level, migratedFrom: 1 });
    expect(useGameStore.getState().state?.version).toBe(2);
  });

  it.each([
    ['剪貼簿是空的', '', 'empty-clipboard'],
    ['不是 JSON', 'hello', 'corrupt-json'],
    ['結構不合法', JSON.stringify({ ...createGame(NOW, 1), coins: -1 }), 'invalid'],
  ])('%s：拒絕匯入，目前的遊戲完全不變', async (_name, text, reason) => {
    const before = useGameStore.getState().state;
    await Clipboard.setStringAsync(text);

    const result = await importSaveFromClipboard();

    expect(result).toEqual({ ok: false, reason });
    expect(useGameStore.getState().state).toBe(before);
  });

  it('還沒讀檔完成時不匯入', async () => {
    useGameStore.setState({ state: null, status: { kind: 'loading' } });
    await Clipboard.setStringAsync(serializeSave(createGame(NOW, 2)));

    expect(await importSaveFromClipboard()).toEqual({ ok: false, reason: 'not-ready' });
    expect(useGameStore.getState().state).toBeNull();
  });
});

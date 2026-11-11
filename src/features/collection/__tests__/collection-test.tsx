// S5.2：收藏冊（FR34、FR35、UX-DR8）。
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RECIPES_BY_ID } from '@/game/content';
import { createGame } from '@/game/engine';
import { useGameStore } from '@/game/store';
import type { GameState, InventionState } from '@/game/types';

import { starText } from '../card-view';
import { CollectionScreen } from '../collection-screen';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const made = (count: number): InventionState => ({
  discovered: true,
  made: count,
  failures: 0,
  clueSeen: false,
});

function setInventions(inventions: GameState['inventions']) {
  useGameStore.setState({
    state: { ...createGame(1_000_000, 1), inventions },
    status: { kind: 'ready' },
  });
}

async function renderCollection() {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <CollectionScreen />
    </SafeAreaProvider>
  );
}

describe('收藏冊網格（FR35、UX-DR8）', () => {
  it('10 張卡牌，最上方顯示收集進度 x/10', async () => {
    setInventions({ 'tea-fried': made(1), 'fried-sweet': made(4) });
    await renderCollection();

    expect(screen.getByTestId('collection-progress')).toHaveTextContent('2/10');
    for (const recipe of Object.keys(RECIPES_BY_ID)) {
      expect(screen.getByTestId(`card-${recipe}`)).toBeTruthy();
    }
  });

  it('三種狀態：剪影、剪影加線索、已發現（卡面、菜名、星等）', async () => {
    setInventions({
      'tea-fried': made(3),
      'tea-noodle': { discovered: false, made: 0, failures: 2, clueSeen: true },
    });
    await renderCollection();

    // 已發現：菜名與星等
    const found = within(screen.getByTestId('card-tea-fried'));
    expect(found.getByText('紅茶鹽酥雞套餐')).toBeTruthy();
    expect(found.getByText('★★☆☆☆')).toBeTruthy();
    expect(screen.queryByTestId('card-silhouette-tea-fried')).toBeNull();

    // 看過線索：剪影＋線索台詞，不露出菜名
    const clue = within(screen.getByTestId('card-tea-noodle'));
    expect(clue.getByTestId('card-silhouette-tea-noodle')).toBeTruthy();
    expect(clue.getByText(RECIPES_BY_ID['tea-noodle'].clue)).toBeTruthy();
    expect(clue.getByText('？？？')).toBeTruthy();
    expect(screen.queryByText('茶香蚵仔麵線')).toBeNull();

    // 沒紀錄：只有剪影，沒有線索
    const unknown = within(screen.getByTestId('card-dumpling-sweet'));
    expect(unknown.getByTestId('card-silhouette-dumpling-sweet')).toBeTruthy();
    expect(screen.queryByTestId('card-clue-dumpling-sweet')).toBeNull();
    expect(screen.queryByText(RECIPES_BY_ID['dumpling-sweet'].clue)).toBeNull();
  });

  it('沒看過線索的卡，就算有失敗紀錄也不顯示線索', async () => {
    setInventions({ 'tea-noodle': { discovered: false, made: 0, failures: 4, clueSeen: false } });
    await renderCollection();

    expect(screen.queryByTestId('card-clue-tea-noodle')).toBeNull();
  });

  it('★5 換金框，★4 還是一般框（FR34）', async () => {
    setInventions({ 'tea-fried': made(15), 'tea-noodle': made(14) });
    await renderCollection();

    expect(screen.getByTestId('card-frame-gold-tea-fried')).toBeTruthy();
    expect(screen.getByTestId('card-frame-normal-tea-noodle')).toBeTruthy();
    expect(screen.getByTestId('card-frame-normal-dumpling-sweet')).toBeTruthy();
  });
});

describe('卡牌詳情', () => {
  it('點已發現的卡：卡面、故事、老闆、製作次數、下一顆星還差幾份；關閉回到網格', async () => {
    setInventions({ 'fried-sweet': made(4) });
    await renderCollection();

    await fireEvent.press(screen.getByTestId('open-card-fried-sweet'));

    const detail = within(screen.getByTestId('card-detail'));
    expect(detail.getByTestId('card-fried-sweet')).toBeTruthy();
    expect(detail.getByTestId('card-story')).toHaveTextContent(/^小葵第一天出攤沒人買/);
    expect(detail.getByText('小葵・甜品車')).toBeTruthy();
    expect(detail.getByTestId('card-made')).toHaveTextContent('已製作 4 份');
    expect(detail.getByTestId('card-next-star')).toHaveTextContent('再做 2 份升到 ★3');

    await fireEvent.press(detail.getByTestId('close-card-detail'));
    expect(screen.queryByTestId('card-detail')).toBeNull();
  });

  it('★5 的卡顯示已滿星', async () => {
    setInventions({ 'tea-fried': made(20) });
    await renderCollection();

    await fireEvent.press(screen.getByTestId('open-card-tea-fried'));
    expect(screen.getByTestId('card-next-star')).toHaveTextContent('已滿星！');
  });

  it('未發現的卡不能點開', async () => {
    setInventions({ 'tea-noodle': { discovered: false, made: 0, failures: 0, clueSeen: true } });
    await renderCollection();

    expect(screen.getByTestId('open-card-tea-noodle')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('open-card-tea-noodle'));
    expect(screen.queryByTestId('card-detail')).toBeNull();
  });
});

describe('E5 code review', () => {
  it('網格的按鈕帶卡牌的無障礙標籤；未發現的卡標成停用', async () => {
    setInventions({
      'tea-fried': made(3),
      'tea-noodle': { discovered: false, made: 0, failures: 0, clueSeen: true },
    });
    await renderCollection();

    expect(screen.getByTestId('open-card-tea-fried').props.accessibilityLabel).toBe(
      '紅茶鹽酥雞套餐，2 星'
    );
    const clue = screen.getByTestId('open-card-tea-noodle');
    expect(clue.props.accessibilityLabel).toBe(
      `還沒發現的發明菜。線索：${RECIPES_BY_ID['tea-noodle'].clue}`
    );
    expect(clue.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('詳情開著時，底下的標題列與網格對讀螢幕軟體隱藏', async () => {
    setInventions({ 'tea-fried': made(3) });
    await renderCollection();
    expect(screen.getByTestId('collection-grid').props.importantForAccessibility).toBeUndefined();

    await fireEvent.press(screen.getByTestId('open-card-tea-fried'));

    // 被隱藏的元素預設查不到，這也代表讀螢幕軟體看不到
    expect(screen.queryByTestId('collection-grid')).toBeNull();
    for (const id of ['collection-grid', 'collection-header']) {
      const element = screen.getByTestId(id, { includeHiddenElements: true });
      expect(element.props.importantForAccessibility).toBe('no-hide-descendants');
      expect(element.props.accessibilityElementsHidden).toBe(true);
    }
  });

  it('沒有上一頁（深連結直接開啟）時，關閉改回夜市街', async () => {
    const canGoBack = jest.spyOn(router, 'canGoBack').mockReturnValue(false);
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const back = jest.spyOn(router, 'back').mockImplementation(() => {});
    setInventions({});
    await renderCollection();

    await fireEvent.press(screen.getByTestId('close-collection'));

    expect(replace).toHaveBeenCalledWith('/street');
    expect(back).not.toHaveBeenCalled();
    canGoBack.mockRestore();
    replace.mockRestore();
    back.mockRestore();
  });

  it('starText 把範圍外的星等限制在 0–5，不會拋錯', () => {
    expect(starText(-1)).toBe('☆☆☆☆☆');
    expect(starText(7)).toBe('★★★★★');
  });
});

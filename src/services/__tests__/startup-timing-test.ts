// E6 retro A3：冷啟動各階段的時間。
import { getStartupMarks, markStartup, resetStartupMarks } from '../startup-timing';

beforeEach(() => {
  resetStartupMarks();
});

describe('startup timing', () => {
  it('依階段順序列出，同一個階段只記第一次', () => {
    markStartup('save-loaded', 900);
    markStartup('js-start', 100);
    markStartup('js-start', 5000);
    markStartup('board-visible', 1200);

    expect(getStartupMarks()).toEqual([
      { stage: 'js-start', label: 'JS 開始執行', at: 100 },
      { stage: 'save-loaded', label: '存檔讀完', at: 900 },
      { stage: 'board-visible', label: '棋盤第一次畫出來', at: 1200 },
    ]);
  });
});

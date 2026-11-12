// 實機回饋：手機網頁高度不夠時棋盤格太小 → 先縮客人圖，把高度讓給棋盤。
import { fitBoard, MIN_ART_SCALE } from '../board-layout';

const ART = { width: 146, height: 111 };

describe('fitBoard', () => {
  it('高度夠（App）：格子由寬度決定，客人圖不變', () => {
    // 寬 366 → 每格 52；棋盤要 8 × 52 = 416，加客人圖 111 = 527
    expect(fitBoard({ boardWidth: 366, height: 600, art: ART })).toEqual({
      cellSize: 52,
      art: ART,
    });
  });

  it('高度略不夠：只縮客人圖，格子維持寬度決定的大小', () => {
    const result = fitBoard({ boardWidth: 366, height: 500, art: ART });
    expect(result.cellSize).toBe(52);
    expect(result.art.height).toBeLessThan(ART.height);
    expect(result.art.height).toBe(500 - 416);
    // 等比縮放
    expect(result.art.width / result.art.height).toBeCloseTo(ART.width / ART.height, 1);
  });

  it('高度很不夠（手機網頁）：客人圖縮到下限，格子由剩下的高度決定，但比不縮時大', () => {
    const height = 400;
    const result = fitBoard({ boardWidth: 366, height, art: ART });
    expect(result.art.height).toBe(Math.floor(ART.height * MIN_ART_SCALE));
    expect(result.cellSize).toBe(Math.floor((height - result.art.height) / 8));
    const withoutShrink = Math.floor((height - ART.height) / 8);
    expect(result.cellSize).toBeGreaterThan(withoutShrink);
  });
});

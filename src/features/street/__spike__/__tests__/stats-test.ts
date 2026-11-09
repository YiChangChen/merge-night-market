import { JANK_THRESHOLD_MS, median, summarizeFrames } from '../stats';

describe('summarizeFrames', () => {
  it('穩定 60 Hz：平均約 60 FPS，沒有卡頓', () => {
    const deltas = Array<number>(600).fill(1000 / 60);
    const summary = summarizeFrames(deltas);

    expect(summary.frames).toBe(600);
    expect(summary.avgFps).toBeCloseTo(60, 5);
    expect(summary.jankPercent).toBe(0);
  });

  it('120 Hz 螢幕：平均約 120 FPS，不算卡頓', () => {
    const summary = summarizeFrames(Array<number>(1200).fill(1000 / 120));

    expect(summary.avgFps).toBeCloseTo(120, 5);
    expect(summary.jankPercent).toBe(0);
  });

  it('間隔超過門檻的幀算卡頓，比例以幀數計算', () => {
    const deltas = [...Array<number>(90).fill(16), ...Array<number>(10).fill(50)];
    const summary = summarizeFrames(deltas);

    expect(summary.jankPercent).toBe(10);
    // 總時間 90×16 + 10×50 = 1940 ms，共 100 幀
    expect(summary.avgFps).toBeCloseTo(100 / 1.94, 5);
  });

  it('剛好等於門檻不算卡頓', () => {
    expect(summarizeFrames([JANK_THRESHOLD_MS]).jankPercent).toBe(0);
  });

  it('沒有資料時回傳 0，不會除以零', () => {
    expect(summarizeFrames([])).toEqual({ frames: 0, avgFps: 0, jankPercent: 0 });
  });
});

describe('median', () => {
  it('奇數個取中間值', () => {
    expect(median([58, 61, 55])).toBe(58);
  });

  it('偶數個取中間兩個的平均', () => {
    expect(median([100, 300, 200, 400])).toBe(250);
  });

  it('空陣列回傳 null', () => {
    expect(median([])).toBeNull();
  });
});

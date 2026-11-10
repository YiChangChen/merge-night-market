// 攤位與老闆的文字必須和 docs/content.md 的定稿（S1.0）一致。
import { CHAIN_IDS, STALLS } from '../content';

type Fs = { readFileSync(file: string, encoding: 'utf8'): string };
type Process = { cwd(): string };
const fs = jest.requireActual<Fs>('fs');
const process = jest.requireActual<Process>('process');

const doc = fs.readFileSync(`${process.cwd()}/docs/content.md`, 'utf8');

describe('STALLS 與 docs/content.md 一致', () => {
  it.each(CHAIN_IDS)('%s：攤位名稱、老闆名字與人設都出現在定稿表格的同一列', (chain) => {
    const stall = STALLS[chain];
    const row = doc.split(/\r?\n/).find((line) => line.includes(`\`${chain}\``));
    expect(row).toBeDefined();
    expect(row).toContain(stall.name);
    expect(row).toContain(stall.owner.name);
    expect(row).toContain(stall.owner.persona);
  });
});

describe('E1 美術（art-manifest #1–#31）', () => {
  type FsExists = { existsSync(file: string): boolean };
  const { existsSync } = jest.requireActual<FsExists>('fs');
  const root = `${process.cwd()}/assets/images`;

  it.each(CHAIN_IDS)('%s：外觀 4 張、霓虹 3 層、老闆頭像的檔案都在，而且都接上了', (chain) => {
    const files = [
      ...['shutter', 'lv1', 'lv2', 'lv3', 'neon-1', 'neon-2', 'neon-3'].map((name) => `stalls/${chain}/${name}.webp`),
      `owners/${chain}.webp`,
    ];
    for (const file of files) expect(existsSync(`${root}/${file}`)).toBe(true);

    const { art } = STALLS[chain];
    expect(art.facade).toHaveLength(4);
    expect(art.neon).toHaveLength(3);
    for (const asset of [...art.facade, ...art.neon, art.owner]) expect(asset).toBeTruthy();
  });

  it('夜市街背景', () => {
    expect(existsSync(`${root}/street/background.webp`)).toBe(true);
  });
});

describe('E1 美術尺寸上限（art-manifest，code review 2026-11-10）', () => {
  type FsRead = { readFileSync(file: string): Uint8Array };
  const { readFileSync } = jest.requireActual<FsRead>('fs');
  const root = `${process.cwd()}/assets/images`;

  /** 從 WebP 檔頭讀寬高（支援 VP8X 延伸格式與 VP8L 無損格式）。 */
  function webpSize(file: string): { width: number; height: number } {
    const b = readFileSync(`${root}/${file}`);
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === 'VP8X') {
      return {
        width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
        height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
      };
    }
    if (chunk === 'VP8L') {
      return {
        width: 1 + (((b[22] & 0x3f) << 8) | b[21]),
        height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)),
      };
    }
    // VP8（簡單有損）：起始碼之後是 14 位元的寬高
    return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
  }

  it.each(CHAIN_IDS)('%s：頭像 ≤ 512、霓虹寬 ≤ 1024、攤位外觀 ≤ 1024', (chain) => {
    const owner = webpSize(`owners/${chain}.webp`);
    expect(Math.max(owner.width, owner.height)).toBeLessThanOrEqual(512);
    const neon = [1, 2, 3].map((i) => webpSize(`stalls/${chain}/neon-${i}.webp`));
    for (const layer of neon) {
      expect(layer.width).toBeLessThanOrEqual(1024);
      // 三層同一張畫布，疊起來才會對齊
      expect(layer).toEqual(neon[0]);
    }
    for (const name of ['shutter', 'lv1', 'lv2', 'lv3']) {
      const facade = webpSize(`stalls/${chain}/${name}.webp`);
      expect(Math.max(facade.width, facade.height)).toBeLessThanOrEqual(1024);
    }
  });
});

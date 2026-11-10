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

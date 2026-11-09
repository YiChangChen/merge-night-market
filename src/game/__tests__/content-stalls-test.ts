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

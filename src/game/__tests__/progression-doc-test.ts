// docs/balance.md 的「進度模擬」表由 sim/progression-bot.ts 產生（S7.5），這個測試確保文件與數值同步。
// 改了 balance.ts 或規則之後，執行 UPDATE_BALANCE_DOC=1 npx jest progression-doc 重新產生。
import { CHAIN_IDS, STALLS } from '../content';
import {
  type Milestone,
  percentile,
  PROFILES,
  type RunResult,
  simulateRun,
} from '../sim/progression-bot';

// 和 balance-doc-test 一樣：用 requireActual 讀寫檔案，不另外引入 @types/node
type Fs = {
  readFileSync(file: string, encoding: 'utf8'): string;
  writeFileSync(file: string, data: string): void;
};
type Process = { cwd(): string; env: Record<string, string | undefined> };
const fs = jest.requireActual<Fs>('fs');
const process = jest.requireActual<Process>('process');

const DOC = `${process.cwd()}/docs/balance.md`;
const START = '<!-- progression-sim:start -->';
const END = '<!-- progression-sim:end -->';
const SEEDS = 20;

const MILESTONES: [Milestone, string][] = [
  ['firstUpgrade', '第一次升級攤位'],
  ['firstInvention', '第一次發明'],
  ['reopenNoodle', '重開麵線'],
  ['reopenDumpling', '重開蒸籠'],
  ['reopenSweet', '重開甜品'],
  ['allLv2', '5 攤都到 Lv2'],
  ['allLv3', '5 攤都到 Lv3（走完 MVP）'],
];

function days(runs: RunResult[], milestone: Milestone): string {
  const values = runs.map((run) => run.milestones[milestone]?.day);
  const reached = values.filter((value): value is number => value !== undefined);
  if (reached.length < runs.length) return `${reached.length}/${runs.length} 局達成`;
  const median = percentile(reached, 50);
  const low = percentile(reached, 10);
  const high = percentile(reached, 90);
  return low === high ? `第 ${median} 天` : `第 ${median} 天（${low}–${high}）`;
}

function table(): string {
  const results = PROFILES.map((profile) =>
    Array.from({ length: SEEDS }, (_, index) => simulateRun(profile, index + 1))
  );
  const rows = [
    `| 里程碑 | ${PROFILES.map((profile) => profile.name).join(' | ')} |`,
    `|---|${PROFILES.map(() => '---').join('|')}|`,
  ];
  for (const [milestone, label] of MILESTONES) {
    rows.push(`| ${label} | ${results.map((runs) => days(runs, milestone)).join(' | ')} |`);
  }
  const median = (pick: (run: RunResult) => number) => (runs: RunResult[]) =>
    percentile(runs.map(pick), 50);
  const sessions = (runs: RunResult[]) => runs.flatMap((run) => run.sessions);
  rows.push(
    `| 走完 MVP 的訂單數（中位數） | ${results.map(median((run) => run.ordersCompleted)).join(' | ')} |`,
    `| 花掉的金幣（中位數） | ${results.map(median((run) => run.coinsSpent)).join(' | ')} |`,
    `| 平均單次遊玩（分鐘） | ${results
      .map((runs) => {
        const all = sessions(runs);
        return (all.reduce((sum, s) => sum + s.durationMs, 0) / all.length / 60_000).toFixed(1);
      })
      .join(' | ')} |`,
    `| 因體力用完而結束的開啟 | ${results
      .map((runs) => {
        const all = sessions(runs);
        return `${Math.round((100 * all.filter((s) => s.energyOut).length) / all.length)}%`;
      })
      .join(' | ')} |`
  );
  return rows.join('\n');
}

it('docs/balance.md 的進度模擬表與規則層一致', () => {
  const doc = fs.readFileSync(DOC, 'utf8').replace(/\r\n/g, '\n');
  const start = doc.indexOf(START);
  const end = doc.indexOf(END);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const expected = `${START}\n${table()}\n${END}`;

  if (process.env.UPDATE_BALANCE_DOC === '1') {
    fs.writeFileSync(DOC, doc.slice(0, start) + expected + doc.slice(end + END.length));
    return;
  }
  expect(doc.slice(start, end + END.length)).toBe(expected);
});

it('每一局都能走完 MVP，而且花掉的金幣剛好是全部重開與升級的總和', () => {
  // GDD M2 的假設是約 9,900：3 攤重開，加上 5 攤升 Lv2、Lv3
  const total = CHAIN_IDS.reduce(
    (sum, chain) =>
      sum +
      (STALLS[chain].reopenCoins ?? 0) +
      STALLS[chain].upgradeCoins[2] +
      STALLS[chain].upgradeCoins[3],
    0
  );
  expect(total).toBe(9900);
  for (const profile of PROFILES) {
    const run = simulateRun(profile, 1);
    expect(run.finished).toBe(true);
    expect(run.coinsSpent).toBe(total);
  }
});

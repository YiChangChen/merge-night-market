// docs/balance.md 的「各玩家等級每單期望金幣」表由規則層函式產生，這個測試確保文件與數值同步。
// 更新文件：UPDATE_BALANCE_DOC=1 npx jest balance-doc
import { expectedOrderCoins, stallsForPlayerLevel } from '../engine';

// 專案的 tsconfig 只載入 jest 型別；用 requireActual 搭配最小型別宣告讀寫檔案，不另外引入 @types/node
type Fs = {
  readFileSync(file: string, encoding: 'utf8'): string;
  writeFileSync(file: string, data: string): void;
};
type Process = { cwd(): string; env: Record<string, string | undefined> };
const fs = jest.requireActual<Fs>('fs');
const process = jest.requireActual<Process>('process');

// Jest 以專案根目錄為工作目錄執行
const DOC = `${process.cwd()}/docs/balance.md`;
const START = '<!-- expected-order-coins:start -->';
const END = '<!-- expected-order-coins:end -->';

function table(): string {
  const opening = stallsForPlayerLevel(1);
  const rows = ['| 玩家等級 | 開局攤位（手搖飲、炸物 Lv1） | 可重開的攤位全開（各 Lv1） |', '|---|---|---|'];
  for (let level = 1; level <= 10; level++) {
    const atOpening = expectedOrderCoins(level, opening).toFixed(1);
    const allOpen = expectedOrderCoins(level, stallsForPlayerLevel(level)).toFixed(1);
    rows.push(`| Lv${level} | ${atOpening} | ${allOpen} |`);
  }
  return rows.join('\n');
}

it('docs/balance.md 的期望金幣表與規則層一致', () => {
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

// S3.3：放開後播什麼動畫，依規則層的判定（resolveDrop）決定。
import { releasePlan } from '../release-plan';

describe('releasePlan', () => {
  it.each([
    ['move', { swapBack: false, source: 'target', shake: false }],
    ['swap', { swapBack: true, source: 'target', shake: false }],
    ['merge', { swapBack: false, source: 'none', shake: false }],
    ['stack', { swapBack: false, source: 'target', shake: false }],
    ['invent', { swapBack: false, source: 'target', shake: false }],
    ['reject', { swapBack: false, source: 'origin', shake: true }],
  ] as const)('%s', (kind, expected) => {
    expect(releasePlan(kind)).toEqual(expected);
  });
});

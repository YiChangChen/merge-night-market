// 送審前的全域檢查（S7.7）：npm run release-check
// 每一項都會列出結果；有任何一項沒通過就以 exit code 1 結束。只讀檔案，不改任何東西。
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const results = [];
const check = (name, ok, detail = '', reminder = false) =>
  results.push({ name, ok, detail, reminder });
// 正式金鑰與 ad unit ID 由 EAS 的 production 環境變數注入：本機跑時只列為提醒，在 EAS 上（或加 --eas）才算失敗
const onEas = Boolean(process.env.EAS_BUILD) || process.argv.includes('--eas');
const secret = (name, ok, detail = '') => check(name, ok, detail, !onEas);
const isSet = (value) => typeof value === 'string' && value.length > 0;

// 1. src/ 內沒有 TODO(content)
function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const todos = walk(join(root, 'src'))
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, index) =>
        line.includes('TODO(content)') ? [`${file.slice(root.length + 1)}:${index + 1}`] : []
      )
  );
check('src/ 內沒有 TODO(content)', todos.length === 0, todos.slice(0, 5).join('、'));

// 2. docs/art-manifest.md 的 54 列全部是「定稿」
const manifestRows = readFileSync(join(root, 'docs/art-manifest.md'), 'utf8')
  .split('\n')
  .filter((line) => /^\| *\d+ *\|/.test(line))
  .map((line) => line.split('|').map((cell) => cell.trim()));
// 狀態欄可以在「定稿」後面加註（例如重產紀錄）
const notFinal = manifestRows
  .filter((cells) => !cells[5]?.startsWith('定稿'))
  .map((cells) => `#${cells[1]}`);
check(
  'art-manifest 54 列全部定稿',
  manifestRows.length === 54 && notFinal.length === 0,
  manifestRows.length === 54 ? notFinal.join('、') : `找到 ${manifestRows.length} 列`
);

// 3. 圖示與啟動畫面不是 Expo 範本（範本檔的 SHA-256，取自專案建立時的 init commit）
const TEMPLATE_ASSETS = {
  'assets/images/icon.png': '7a667804bb80a6a424a5daf18a2599c4f32237cf06fe78fc0de45dbb09e0eccf',
  'assets/images/splash-icon.png':
    '27b060a757a29038c9618586baa0ba3894dbe60d084c6059df497ff429c2d92f',
  'assets/images/android-icon-background.png':
    'fb139c2dee362ebf2070e23b96da6fc0d43f8492de38b8af1fd7223e19b5861d',
  'assets/images/android-icon-foreground.png':
    '9e3d0315a33c6799de601dd34cd8bf8cc3a8d16f3bf75592baec2ceb7240b391',
  'assets/images/android-icon-monochrome.png':
    '6371fc2c12e33ad2215a86c281db3d682a81bebe7c957a842c13b8bf00cceb83',
  'assets/images/favicon.png': 'a4e030697a7571b3e95d31860e4da55d2f98e5e861e2b55e414f45a8556828ba',
  'assets/expo.icon/Assets/expo-symbol 2.svg':
    'ad117d20fd819f4ec71876ce09c0e8b9275b1f20c5ec3c9d7d1914977ceffec6',
};
const stillTemplate = Object.entries(TEMPLATE_ASSETS)
  .filter(([file, hash]) => {
    try {
      return (
        createHash('sha256')
          .update(readFileSync(join(root, file)))
          .digest('hex') === hash
      );
    } catch {
      return false;
    }
  })
  .map(([file]) => file);
check('圖示與啟動畫面已換掉 Expo 範本', stillTemplate.length === 0, stillTemplate.join('、'));

// 4. 隱私權政策沒有待填欄位
const privacy = readFileSync(join(root, 'docs/privacy-policy.md'), 'utf8');
const blanks = privacy.match(/［[^］]*］/g) ?? [];
check(
  '隱私權政策沒有待填的［ ］欄位，也不是草稿',
  blanks.length === 0 && !privacy.includes('**草稿'),
  [...new Set(blanks)].join(' ')
);

// 5. production 設定：bundle id、package、沒有除錯入口、正式 ad unit ID
let config = null;
try {
  const json = execSync('npx expo config --type public --json', {
    cwd: root,
    env: { ...process.env, APP_VARIANT: 'production', EXPO_NO_DOTENV: '1' },
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString();
  config = JSON.parse(json);
} catch (error) {
  check('讀取 production 的 app config', false, String(error).slice(0, 120));
}
if (config) {
  check('iOS bundleIdentifier 已設定', Boolean(config.ios?.bundleIdentifier));
  check('Android package 已設定', Boolean(config.android?.package));
  check(
    'production 沒有除錯入口',
    config.extra?.debugTools === false && config.extra?.expoGoDebugTools === false
  );
  const units = config.extra?.adUnitIds;
  const missingUnits = units
    ? ['ios', 'android'].flatMap((os) =>
        ['energy', 'selloutDouble']
          .filter((key) => !isSet(units[os]?.[key]))
          .map((key) => `${os}.${key}`)
      )
    : ['全部'];
  secret('正式 ad unit ID 都已注入', missingUnits.length === 0, missingUnits.join('、'));
  secret('PostHog Project API Key 已注入', isSet(config.extra?.posthogKey));
  secret('Sentry DSN 已注入', isSet(config.extra?.sentryDsn));
}

// 結果
let failed = 0;
for (const { name, ok, detail, reminder } of results) {
  if (!ok && !reminder) failed += 1;
  const mark = ok ? '✓' : reminder ? '△' : '✗';
  const note = !ok && reminder ? '［本機無法確認，EAS 上以 production 環境變數為準］' : '';
  console.log(`${mark} ${name}${!ok && detail ? `（${detail}）` : ''}${note}`);
}
console.log(failed === 0 ? '\n全部通過，可以送審。' : `\n${failed} 項沒通過。`);
process.exit(failed === 0 ? 0 : 1);

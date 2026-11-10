// Story 3.1：配方與發明菜資料的完整性（FR26、FR30）。內容依 docs/content.md 第 2、3 節的定稿。
import { webpSize } from '../../../test-utils/webp-size';
import { CHAIN_IDS, CHAINS, RECIPE_IDS, RECIPES, RECIPES_BY_ID } from '../content';

type Fs = {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
};
type Process = { cwd(): string };
const fs = jest.requireActual<Fs>('fs');
const { cwd } = jest.requireActual<Process>('process');

const doc = fs.readFileSync(`${cwd()}/docs/content.md`, 'utf8');
const docLines = doc.split(/\r?\n/);
// 第 2 節（配方）與第 3 節（線索台詞）都以 `recipe-id` 開頭的表格列
const rowsFor = (id: string) => docLines.filter((line) => line.includes(`\`${id}\``));

describe('RECIPES 與 docs/content.md 一致', () => {
  it('10 道配方，順序與定稿表格相同', () => {
    expect(RECIPE_IDS).toEqual([
      'tea-fried',
      'tea-noodle',
      'fried-noodle',
      'tea-dumpling',
      'fried-dumpling',
      'noodle-dumpling',
      'tea-sweet',
      'fried-sweet',
      'noodle-sweet',
      'dumpling-sweet',
    ]);
  });

  it.each(RECIPES)('$id：名稱、材料、負責老闆與定稿表格同一列', (recipe) => {
    const [recipeRow] = rowsFor(recipe.id);
    expect(recipeRow).toContain(recipe.name);
    for (const ingredient of [recipe.a, recipe.b]) {
      const itemName = CHAINS[ingredient.chain].items[ingredient.level - 1].name;
      expect(recipeRow).toContain(`${itemName}（${ingredient.chain} L${ingredient.level}）`);
    }
    expect(recipeRow).toContain(`（${recipe.owner}）`);
  });

  it.each(RECIPES)('$id：線索台詞與定稿一致', (recipe) => {
    const clueRow = rowsFor(recipe.id)[1];
    expect(clueRow).toContain(recipe.clue);
  });
});

describe('配方規則（FR26）', () => {
  it('每道配方的鏈和階數都存在', () => {
    for (const recipe of RECIPES) {
      for (const { chain, level } of [recipe.a, recipe.b]) {
        expect(CHAIN_IDS).toContain(chain);
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(CHAINS[chain].items.length);
      }
    }
  });

  it('每條鏈恰好出現在 4 道配方', () => {
    for (const chain of CHAIN_IDS) {
      const count = RECIPES.filter((r) => r.a.chain === chain || r.b.chain === chain).length;
      expect(count).toBe(4);
    }
  });

  it('沒有同鏈配方，負責老闆是兩條鏈其中之一', () => {
    for (const recipe of RECIPES) {
      expect(recipe.a.chain).not.toBe(recipe.b.chain);
      expect([recipe.a.chain, recipe.b.chain]).toContain(recipe.owner);
    }
  });

  it('10 個 id 不重複，而且就是「材料 A 鏈-材料 B 鏈」', () => {
    expect(new Set(RECIPE_IDS).size).toBe(10);
    for (const recipe of RECIPES) expect(recipe.id).toBe(`${recipe.a.chain}-${recipe.b.chain}`);
  });

  it('RECIPES_BY_ID 可以用 id 查到同一道配方', () => {
    for (const recipe of RECIPES) expect(RECIPES_BY_ID[recipe.id]).toBe(recipe);
  });
});

describe('發明菜圖示（art-manifest #32–#41）', () => {
  const root = `${cwd()}/assets/images/dishes`;

  it('圖檔和 RecipeId 一一對應，不多不少', () => {
    const files = fs.readdirSync(root).filter((name) => name.endsWith('.webp'));
    expect(files.map((name) => name.replace(/\.webp$/, '')).sort()).toEqual([...RECIPE_IDS].sort());
  });

  it.each(RECIPES)('$id：已接上圖示，長邊 ≤ 512', (recipe) => {
    expect(recipe.art).toBeTruthy();
    const { width, height } = webpSize(`${root}/${recipe.id}.webp`);
    expect(Math.max(width, height)).toBeLessThanOrEqual(512);
  });
});

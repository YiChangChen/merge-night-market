// 可重現的亂數。種子存在 state 裡，每取一次就推進一次。

type Seeded = { rngSeed: number };

// mulberry32：種子放在 state 裡，讓結果可重現，存讀檔也不會改變
export function nextRandom<S extends Seeded>(state: S): [number, S] {
  const seed = (state.rngSeed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, { ...state, rngSeed: seed }];
}

export function randomInt<S extends Seeded>(state: S, maxExclusive: number): [number, S] {
  const [value, next] = nextRandom(state);
  return [Math.floor(value * maxExclusive), next];
}

// 數據埋點的網頁版（S7.3）：不送任何資料（no-op），介面和原生版相同。
import type { Placement } from '@/game/daily';

export function trackAdShown(_placement: Placement): void {}

export function trackEnergyBlocked(): void {}

export function startTelemetry(
  _options: { settings?: { key: string; host: string } | null } = {}
): () => void {
  return () => {};
}

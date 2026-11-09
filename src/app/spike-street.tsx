// Spike A 原型路由（暫時）：只在 debugTools 開啟時可進入，結論出來後刪除。
import { Redirect } from 'expo-router';

import { SpikeStreetScreen } from '@/features/street';
import { config } from '@/services/config';

export default function SpikeStreetRoute() {
  if (!config.debugTools) return <Redirect href="/" />;
  return <SpikeStreetScreen />;
}

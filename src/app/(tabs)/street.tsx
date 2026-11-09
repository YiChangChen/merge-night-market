// 夜市街分頁。
import { StreetScreen } from '@/features/street';
import { useTabSwitchTiming } from '@/features/tabs';

export default function StreetTab() {
  useTabSwitchTiming('street');
  return <StreetScreen />;
}

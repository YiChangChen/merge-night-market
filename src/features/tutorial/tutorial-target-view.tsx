import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import { type TutorialTargetId, useTutorialTarget } from './tutorial-targets';

type Props = {
  id: TutorialTargetId;
  /** 所在畫面在前景時才登記 */
  active?: boolean;
  /** 教學完成後仍然登記（棋盤：合成小提示） */
  always?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** 用一層 View 包住引導目標（列表項目、分頁按鈕這類不方便直接掛 hook 的地方）。 */
export function TutorialTarget({ id, active = true, always = false, style, children }: Props) {
  const { ref, onLayout } = useTutorialTarget(id, active, { always });
  return (
    // Android 要 collapsable={false}，這層 View 才不會被最佳化掉而量不到
    <View ref={ref} onLayout={onLayout} collapsable={false} style={style}>
      {children}
    </View>
  );
}

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useOverlayStore } from '@/features/overlays';
import { BALANCE, type ChainId } from '@/game/content';
import { upgradeCheck } from '@/game/stalls';
import { useGameStore } from '@/game/store';
import { type TutorialFocus, tutorialFocus } from '@/game/tutorial-focus';

import { type TargetRect, type TutorialTargetId, useTutorialTargets } from './tutorial-targets';

/** 第 3 步的攤位：開局就開著的兩攤，tea 優先 */
const FIRST_UPGRADE_CHAINS: readonly ChainId[] = ['tea', 'fried'];
const FINGER_SIZE = 40;

/** 棋盤上某一格在視窗中的位置（由棋盤外框推算） */
function cellRect(board: TargetRect, cell: number): TargetRect {
  const size = board.width / BALANCE.boardColumns;
  return {
    x: board.x + (cell % BALANCE.boardColumns) * size,
    y: board.y + Math.floor(cell / BALANCE.boardColumns) * size,
    width: size,
    height: size,
  };
}

/** 第 3 步（升級攤位）手指要指的位置（視窗座標）；沒有合適的目標時回傳 null。 */
export function pickUpgradeTarget(
  rects: Partial<Record<TutorialTargetId, TargetRect>>,
  context: { upgradable: ChainId | null; panelOpen: boolean }
): TargetRect | null {
  // 金幣還不夠時不指，免得玩家一直被帶去夜市街
  if (!context.upgradable) return null;
  if (context.panelOpen) return rects.upgrade ?? null;
  const stall = rects[`stall-${context.upgradable}` as TutorialTargetId];
  if (stall) return stall;
  // 分頁按鈕只在棋盤畫面在前景時指（棋盤目標有登記）：收藏冊、設定等畫面疊在上面時不指（E6 code review）
  return rects.board ? (rects['tab-street'] ?? null) : null;
}

/** tutorialFocus 轉成字串給 selector 回傳（物件每次都是新的，會造成重繪） */
function encodeFocus(focus: TutorialFocus | null): string | null {
  if (!focus) return null;
  if (focus.kind === 'merge') return `merge:${focus.pair[0]}:${focus.pair[1]}`;
  if (focus.kind === 'order') return `order:${focus.index}`;
  return `generator:${focus.cell}`;
}

/**
 * 新手手指（S6.4、FR40、UX-DR11）：掛在根層，依教學步驟指向目標。整層 pointerEvents="none"，不擋任何操作；
 * 有完售、發明、阿嬤提示等全螢幕演出時隱藏。
 * 第 1、2 步依第一張訂單（tutorialFocus）指產生器、提示合成或指訂單；第 3 步指升級。
 * 教學完成後的合成小提示不在這裡：由棋盤晃動那一對品項（merge-hint.ts）。
 */
export function TutorialGuide() {
  const step = useGameStore((store) => store.state?.meta.tutorialStep ?? BALANCE.tutorialSteps);
  const board = useGameStore((store) => store.state?.board ?? null);
  const upgradable = useGameStore((store) => {
    const state = store.state;
    if (!state || step !== 2) return null;
    return (
      FIRST_UPGRADE_CHAINS.find(
        (chain) => state.stalls[chain].level === 1 && upgradeCheck(state, chain)?.ok
      ) ?? null
    );
  });
  const panel = useOverlayStore((store) => store.stallPanel);
  const showing = useOverlayStore(
    (store) =>
      store.sellout !== null ||
      store.invention !== null ||
      store.hint !== null ||
      // 升星演出（E6 code review）
      store.starred !== null ||
      // 體力不足的提示卡開著時讓開，不疊在卡片上（S6.2 實機回饋）
      store.energyPrompt
  );
  const focusKey = useGameStore((store) =>
    store.state && step < 2 ? encodeFocus(tutorialFocus(store.state)) : null
  );
  const rects = useTutorialTargets((store) => store.rects);

  if (!board || showing) return null;
  const done = step >= BALANCE.tutorialSteps;
  const boardRect = rects.board;

  // 第 1、2 步：依第一張訂單決定指產生器、提示合成，或指訂單（tutorialFocus）；攤位面板開著時不顯示
  if (!done && step < 2) {
    if (panel !== null || !focusKey) return null;
    const [kind, first, second] = focusKey.split(':');
    if (kind === 'merge') {
      if (!boardRect) return null;
      return (
        <MergeHint
          from={cellRect(boardRect, Number(first))}
          to={cellRect(boardRect, Number(second))}
        />
      );
    }
    const target =
      kind === 'order'
        ? rects[`order-${first}` as TutorialTargetId]
        : boardRect && cellRect(boardRect, Number(first));
    return target ? <FingerLayer target={target} /> : null;
  }

  // 第 3 步：升級按鈕 → 攤位 → 夜市街分頁
  if (!done) {
    const target = pickUpgradeTarget(rects, { upgradable, panelOpen: panel !== null });
    if (target) return <FingerLayer target={target} />;
  }

  // 教學完成後的合成小提示改由棋盤自己晃動那一對（merge-hint.ts，實機回饋）
  return null;
}

function FingerLayer({ target }: { target: TargetRect }) {
  return (
    <View testID="tutorial-guide" pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Finger target={target} />
    </View>
  );
}

/** 合成提示：圈出兩格，手指從第一格拖到第二格 */
function MergeHint({ from, to }: { from: TargetRect; to: TargetRect }) {
  const pulse = useSharedValue(0);
  const drag = useSharedValue(0);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
    drag.set(
      withRepeat(
        withSequence(
          withTiming(0, { duration: 250 }),
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 350 })
        ),
        -1
      )
    );
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(drag);
    };
  }, [drag, pulse]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.45 + 0.55 * pulse.get() }));
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const fingerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.get() * dx }, { translateY: drag.get() * dy }],
  }));
  return (
    <View testID="merge-hint" pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[from, to].map((rect, index) => (
        <Animated.View
          key={index}
          testID="merge-hint-ring"
          style={[
            styles.ring,
            { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
            ringStyle,
          ]}
        />
      ))}
      <Animated.Text
        testID="merge-hint-finger"
        style={[
          styles.finger,
          {
            left: from.x + from.width / 2 - FINGER_SIZE / 2,
            top: from.y + from.height / 2,
          },
          fingerStyle,
        ]}>
        👆
      </Animated.Text>
    </View>
  );
}

/** 指尖對準目標中心、上下輕點的手指 */
function Finger({ target }: { target: TargetRect }) {
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.set(
      withRepeat(withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }), -1, true)
    );
    return () => cancelAnimation(bob);
  }, [bob]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: bob.get() * 10 }] }));
  return (
    <Animated.Text
      testID="tutorial-finger"
      style={[
        styles.finger,
        {
          left: target.x + target.width / 2 - FINGER_SIZE / 2,
          top: target.y + target.height / 2,
        },
        style,
      ]}>
      👆
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#FFD23F',
    backgroundColor: '#FFD23F33',
  },
  finger: {
    position: 'absolute',
    width: FINGER_SIZE,
    fontSize: FINGER_SIZE * 0.85,
    textAlign: 'center',
    textShadowColor: '#000000AA',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
});

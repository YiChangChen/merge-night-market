import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInRight, LinearTransition, ZoomOut } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/shallow';

import { Board, InfoBar } from '@/features/board';
import { EnergyPrompt } from '@/features/energy';
import { fitBoard } from '@/features/board/board-layout';
import { SaveErrorScreen } from '@/features/errors';
import { customerArtSize, ORDER_LABEL_HEIGHT, OrderCard } from '@/features/orders';
import { useOverlayStore } from '@/features/overlays';
import { QUEUE_METER_HEIGHT, QueueMeter } from '@/features/queue-meter';
import { TutorialTarget } from '@/features/tutorial';
import { useIdleMergePair } from '@/features/tutorial/merge-hint';
import { BALANCE, BOARD_BACKGROUND } from '@/game/content';
import { maxEnergy } from '@/game/daily';
import { applyDrop, resolveDrop } from '@/game/drop';
import { dismissOrder } from '@/game/orders';
import {
  completeOrder,
  findOrderCells,
  getSpawnBlocker,
  msUntilNextEnergy,
  sellPiece,
  tapGenerator,
  xpToNextLevel,
} from '@/game/engine';
import { useGameStore } from '@/game/store';
import { useTabSwitchTiming } from '@/features/tabs';
import { retryLoadGame, startOverAfterSaveFailure } from '@/services/game-session';

const MAX_BOARD_WIDTH = 480;
const SCREEN_PADDING = 12;
// 棋盤以外的 HUD、資訊列與間距總高，不含訂單與客流計量條
const NON_BOARD_HEIGHT = 106;
// 客流計量條（S2.2）的高度加上它下方的間距（content 的 gap）
const QUEUE_METER_SPACE = QUEUE_METER_HEIGHT + 10;
const ORDER_GAP = 8;
const TOAST_MS = 1800;
const ORDER_SHIFT_MS = 260;
const ORDER_ENTER_MS = 260;
const ORDER_EXIT_MS = 160;
// 背景圖的寬高比（768×1376）
const BACKGROUND_ASPECT = 768 / 1376;

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function Hud() {
  const state = useGameStore(
    useShallow((store) =>
      store.state
        ? {
            level: store.state.level,
            xp: store.state.xp,
            coins: store.state.coins,
            energy: store.state.energy,
            energyUpdatedAt: store.state.energyUpdatedAt,
            // 開幕週的體力上限（S6.1）依首次啟動時間推算
            firstLaunchAt: store.state.meta.firstLaunchAt,
          }
        : null
    )
  );
  // 除錯面板快轉時，倒數也要用同一個時間
  const timeOffsetMs = useGameStore((store) => store.timeOffsetMs);
  // 倒數只影響這裡，計時放在 Hud 裡，每秒才不會重畫整個畫面
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!state) return null;
  const energyState = { ...state, meta: { firstLaunchAt: state.firstLaunchAt } };
  const untilNext = msUntilNextEnergy(energyState, now + timeOffsetMs);
  const cap = maxEnergy(energyState, now + timeOffsetMs);
  return (
    <View style={styles.hud}>
      <Text style={styles.hudText}>
        ⭐ Lv.{state.level}（{state.xp}/{xpToNextLevel(state.level)}）
      </Text>
      <Text style={styles.hudText}>🪙 {state.coins}</Text>
      <Text style={styles.hudText} testID="energy">
        ⚡ {state.energy}/{cap}
        {untilNext !== null ? ` · ${formatCountdown(untilNext)}` : ''}
      </Text>
    </View>
  );
}

function Orders({
  artSize,
  onComplete,
  onDismiss,
  active,
}: {
  artSize: { width: number; height: number };
  onComplete: (id: number) => void;
  onDismiss: (id: number) => void;
  /** 棋盤分頁在前景（新手引導才量測第一張訂單的位置） */
  active: boolean;
}) {
  const orders = useGameStore((store) => store.state?.orders);
  const board = useGameStore((store) => store.state?.board);
  if (!orders || !board) return null;
  return (
    // 高度和棋盤版面計算時預留的一致（客人圖 + 品名標籤），不依賴子元件撐開
    <View style={[styles.orders, { height: artSize.height + ORDER_LABEL_HEIGHT }]}>
      {orders.map((order, index) => (
        <Animated.View
          key={order.id}
          // 等其他卡片讓出位置才進場，避免疊在一起
          entering={FadeInRight.delay(ORDER_SHIFT_MS).duration(ORDER_ENTER_MS)}
          exiting={ZoomOut.duration(ORDER_EXIT_MS)}
          layout={LinearTransition.duration(ORDER_SHIFT_MS)}
          style={styles.orderSlot}>
          {/* 新手引導第 2 步指向做得出來的那張訂單（S6.4） */}
          <TutorialTarget id={`order-${index}`} active={active} style={styles.orderSlot}>
            <OrderCard
              order={order}
              ready={findOrderCells({ board }, order) !== null}
              artSize={artSize}
              onComplete={onComplete}
              onDismiss={onDismiss}
            />
          </TutorialTarget>
        </Animated.View>
      ))}
    </View>
  );
}

export default function GameScreen() {
  const board = useGameStore((store) => store.state?.board);
  const loadFailure = useGameStore((store) =>
    store.status.kind === 'failed' ? store.status.reason : null
  );
  const apply = useGameStore((store) => store.apply);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // 底部分頁列（含安全區）佔掉的高度；棋盤高度要扣掉它
  const tabBarHeight = useBottomTabBarHeight();
  useTabSwitchTiming('index');
  // 分頁失焦時暫停棋盤的循環動畫（冒熱氣）
  const focused = useIsFocused();
  // 選取記住「哪一格的哪一個棋子」：賣掉、升級用掉、或待放的產生器補進同一格時，
  // id 不同就自動取消，選取不會跳到別的棋子上（code review 2026-11-11、RC-6）
  const [selection, setSelection] = useState<{ cell: number; id: number; game: number } | null>(
    null
  );
  // 這一局的識別：開新局或匯入存檔後不同，舊的選取不會指到新局裡剛好同 id 的棋子（E4 code review）
  const gameId = useGameStore((store) => store.state?.meta.firstLaunchAt ?? 0);
  // 演出或攤位面板蓋住棋盤時，暫停棋盤的循環動畫（冒熱氣）
  const overlayBlocking = useOverlayStore(
    (store) =>
      store.stallPanel !== null ||
      store.sellout !== null ||
      store.invention !== null ||
      store.hint !== null ||
      store.energyPrompt
  );
  const [toast, setToast] = useState<string | null>(null);
  // 體力不足的提示卡（S6.2）：點產生器遇到 no-energy 時打開；切到別的分頁時不顯示。
  // 開關放在 overlay store，新手引導才會在提示卡打開時讓開（實機回饋）
  const energyPrompt = useOverlayStore((store) => store.energyPrompt);
  const openEnergyPrompt = useOverlayStore((store) => store.openEnergyPrompt);
  const closeEnergyPrompt = useOverlayStore((store) => store.closeEnergyPrompt);
  const onEnergyRewarded = useCallback(() => setToast(`+${BALANCE.adEnergy} 體力！`), []);
  // 切到別的分頁就關掉提示卡：留著的話，夜市街上的新手引導也會被當成「有卡片擋著」而藏起來
  useEffect(() => {
    if (!focused) closeEnergyPrompt();
  }, [closeEnergyPrompt, focused]);
  // 合成小提示（S6.4）：棋盤停著一段時間，可以合成的一對會晃動
  const hintCells = useIdleMergePair(focused && !overlayBlocking);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (loadFailure) {
    return (
      <SaveErrorScreen
        reason={loadFailure}
        onRetry={retryLoadGame}
        onStartOver={startOverAfterSaveFailure}
      />
    );
  }
  if (!board) return <View style={styles.screen} />;

  const selected =
    selection !== null && selection.game === gameId && board[selection.cell]?.id === selection.id
      ? selection.cell
      : null;

  const boardWidth = Math.min(windowWidth - SCREEN_PADDING * 2, MAX_BOARD_WIDTH);
  // 客人圖與棋盤共用剩下的高度；高度不夠時（例如手機網頁有瀏覽器工具列）先縮客人圖，棋盤格才不會太小
  const { cellSize, art: artSize } = fitBoard({
    boardWidth,
    height:
      windowHeight -
      insets.top -
      tabBarHeight -
      NON_BOARD_HEIGHT -
      QUEUE_METER_SPACE -
      ORDER_LABEL_HEIGHT,
    art: customerArtSize((boardWidth + ORDER_GAP) / BALANCE.orderSlots),
  });

  // 背景維持直式比例：手機填滿寬度，寬螢幕置中，兩側露出與夜空相近的底色
  const backgroundWidth = Math.min(
    windowWidth,
    Math.max(windowHeight * BACKGROUND_ASPECT, boardWidth + SCREEN_PADDING * 2)
  );

  const handleTapCell = (cell: number) => {
    // 事件當下才讀最新的 state，不必為了這裡訂閱整個 state
    const state = useGameStore.getState().state;
    if (!state) return;
    const piece = state.board[cell];
    setSelection(piece ? { cell, id: piece.id, game: gameId } : null);
    if (piece?.kind !== 'generator') return;
    const blocker = getSpawnBlocker(state);
    if (blocker === 'no-energy') openEnergyPrompt();
    if (blocker === 'board-full') setToast('棋盤滿了，先合成或賣掉一些');
    apply((current) => tapGenerator(current, cell));
  };

  // 放開時才查一次判定，決定播哪種動畫（不訂閱 store，拖曳時不會重繪）
  const previewDrop = (from: number, to: number) => {
    const state = useGameStore.getState().state;
    return state ? resolveDrop(state, from, to) : null;
  };

  const handleMove = (from: number, to: number) => {
    setSelection(null);
    // 落子的判定一律交給規則層（RC-4、NP-1）；時間由 apply 傳入
    apply((current, now) => applyDrop(current, from, to, now));
  };

  const handleSell = (cell: number) => {
    // 發明菜還有剩（一次只賣 1 份）時同一個棋子還在，保持選取方便連續賣；
    // 賣完或換成別的棋子（例如補進來的產生器）時，下面的 selected 會自動變成 null（RC-6）
    apply((current) => sellPiece(current, cell));
  };

  // 請線索客人先走（RC-9）：移除後補一張新訂單，不扣人龍
  const handleDismissOrder = (id: number) => {
    apply((current, now) => dismissOrder(current, id, now));
  };

  const handleCompleteOrder = (id: number) => {
    setSelection(null);
    apply((current, now) => completeOrder(current, id, now));
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <Image
        source={BOARD_BACKGROUND}
        contentFit="cover"
        contentPosition="bottom"
        draggable={false}
        style={[
          styles.background,
          { width: backgroundWidth, left: (windowWidth - backgroundWidth) / 2 },
        ]}
      />
      <View style={[styles.content, { width: boardWidth }]}>
        <Hud />
        <QueueMeter />
        <Orders
          artSize={artSize}
          onComplete={handleCompleteOrder}
          onDismiss={handleDismissOrder}
          active={focused}
        />
        <InfoBar selected={selected} onSell={handleSell} />
        <View style={styles.boardArea}>
          {/* 新手引導第 1 步與合成小提示：依棋盤外框算出格子位置（S6.4） */}
          <TutorialTarget id="board" active={focused} always>
            <Board
              board={board}
              cellSize={cellSize}
              selected={selected}
              onTapCell={handleTapCell}
              onMove={handleMove}
              previewDrop={previewDrop}
              animate={focused && !overlayBlocking}
              hintCells={hintCells}
            />
          </TutorialTarget>
        </View>
        {energyPrompt && focused ? (
          <EnergyPrompt onClose={closeEnergyPrompt} onRewarded={onEnergyRewarded} />
        ) : null}
        {toast ? (
          <View pointerEvents="none" style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#0A1E3D',
    // 網頁版靠長按與拖曳操作，不能觸發文字選取
    userSelect: 'none',
  },
  background: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    gap: 10,
    paddingTop: 8,
  },
  boardArea: {
    alignItems: 'center',
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hudText: {
    color: '#FFF3D6',
    fontSize: 14,
    fontWeight: '600',
  },
  orders: {
    flexDirection: 'row',
    gap: ORDER_GAP,
  },
  orderSlot: {
    flex: 1,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#000000CC',
  },
  toastText: {
    color: '#FFF3D6',
    fontSize: 14,
  },
});

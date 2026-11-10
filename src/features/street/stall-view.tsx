import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useOverlayStore } from '@/features/overlays';
import { type ChainId, STALLS } from '@/game/content';
import { useGameStore } from '@/game/store';

import { NeonSign } from './neon-sign';
import { RollingShutter } from './rolling-shutter';

export const STALL_WIDTH = 220;

// 占位外觀：依等級改變店面高度與標示（FR14）。
// TODO(content): art-manifest#2-21 正式的攤位外觀圖（鐵捲門／Lv1 小攤／Lv2 店面／Lv3 大店）到位後換成圖片
const APPEARANCE = [
  { label: '鐵捲門', height: 0.62 },
  { label: 'Lv1 小攤', height: 0.62 },
  { label: 'Lv2 店面', height: 0.8 },
  { label: 'Lv3 大店', height: 1 },
] as const;

const FACADE_MAX_HEIGHT = 240;

type StallViewProps = {
  chain: ChainId;
  /** 夜市街在前景時才播放循環動畫 */
  animate: boolean;
};

/**
 * 夜市街上的一個攤位，點一下開啟攤位面板（UX-DR3）。只訂閱自己的攤位等級：拖曳棋子、出單都不會讓它重繪。
 * 圖層由下往上：外觀 → 霓虹 → 鐵捲門（Lv0）→ 老闆。招牌菜（E3）與人龍頭像（S2.3）之後加入。
 */
export const StallView = memo(function StallView({ chain, animate }: StallViewProps) {
  const level = useGameStore((store) => store.state?.stalls[chain].level ?? 0);
  const stall = STALLS[chain];
  const appearance = APPEARANCE[level];
  const closed = level === 0;
  const facadeHeight = FACADE_MAX_HEIGHT * appearance.height;
  // 重開演出（FxController 收到 stall_reopened 後觸發）
  const opening = useOverlayStore((store) => store.shutterOpening[chain]);
  const openPanel = useOverlayStore((store) => store.openStallPanel);
  const finishShutter = useOverlayStore((store) => store.finishShutter);
  const onShutterDone = useCallback(() => finishShutter(chain), [chain, finishShutter]);
  // 升級演出（FxController 收到 stall_upgraded 後觸發）
  const powerOn = useOverlayStore((store) => store.neonPowerOn[chain]);
  const finishNeonPowerOn = useOverlayStore((store) => store.finishNeonPowerOn);
  const onPowerOnDone = useCallback(() => finishNeonPowerOn(chain), [chain, finishNeonPowerOn]);

  return (
    <Pressable
      testID={`stall-${chain}`}
      accessibilityRole="button"
      accessibilityLabel={`${stall.name}，${appearance.label}`}
      onPress={() => openPanel(chain)}
      style={styles.stall}>
      <NeonSign
        name={stall.name}
        color={stall.neon}
        level={level}
        animate={animate}
        powerOn={powerOn}
        onPowerOnDone={onPowerOnDone}
      />
      <View style={[styles.facade, { height: facadeHeight }]}>
        <View style={[styles.body, { backgroundColor: closed ? '#2B2F45' : stall.color }]}>
          {closed ? (
            <View testID={`stall-${chain}-shutter`} style={styles.shutter}>
              {Array.from({ length: 7 }, (_, index) => (
                <View key={index} style={styles.slat} />
              ))}
            </View>
          ) : (
            <View style={styles.counter}>
              <View style={[styles.awning, { backgroundColor: stall.neon }]} />
            </View>
          )}
          <Text style={styles.levelLabel}>{appearance.label}</Text>
          {opening !== undefined && !closed ? (
            <RollingShutter key={opening} height={facadeHeight} onDone={onShutterDone} />
          ) : null}
        </View>
      </View>
      <View style={styles.owner}>
        {/* TODO(content): art-manifest#27-31 老闆頭像到位後換成圖片 */}
        <View style={[styles.avatar, { borderColor: stall.neon }, closed && styles.avatarClosed]}>
          <Text style={styles.avatarText}>{stall.owner.name.slice(-1)}</Text>
        </View>
        <View style={styles.ownerText}>
          <Text style={styles.ownerName}>{stall.owner.name}</Text>
          <Text style={styles.persona} numberOfLines={2}>
            {stall.owner.persona}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  stall: {
    width: STALL_WIDTH,
    justifyContent: 'flex-end',
    gap: 10,
  },
  facade: {
    justifyContent: 'flex-end',
  },
  body: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  shutter: {
    ...StyleSheet.absoluteFill,
    gap: 4,
    padding: 6,
    backgroundColor: '#7D8597',
  },
  slat: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: '#5C677D',
  },
  counter: {
    ...StyleSheet.absoluteFill,
  },
  awning: {
    height: 18,
    opacity: 0.85,
  },
  levelLabel: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#00000066',
  },
  owner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#11173A',
  },
  avatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: '#1E2550',
  },
  avatarClosed: {
    opacity: 0.4,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  ownerText: {
    flex: 1,
  },
  ownerName: {
    color: '#FFD966',
    fontSize: 14,
    fontWeight: '700',
  },
  persona: {
    color: '#C9D1E8',
    fontSize: 11,
    lineHeight: 15,
  },
});

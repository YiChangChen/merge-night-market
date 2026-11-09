// 收集 UI 執行緒與 JS 執行緒的幀間隔，量測固定時間後回傳統計。只給 Spike A 使用。
import { useEffect, useRef, useState } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { type FrameSummary, summarizeFrames } from './stats';

export const MEASURE_MS = 30_000;

export type RunResult = { ui: FrameSummary; js: FrameSummary };

export function useFrameRecorder() {
  const uiDeltas = useSharedValue<number[]>([]);
  const jsDeltas = useRef<number[]>([]);
  const rafId = useRef<number | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 用 ref 防止連點：state 要等 React commit 才更新，連點兩次會啟動兩個量測
  const measuringRef = useRef(false);
  // 按「清除」時遞增；量測中途清除，這一輪結果就不再加回去
  const epoch = useRef(0);
  const [measuring, setMeasuring] = useState(false);
  const [runs, setRuns] = useState<RunResult[]>([]);

  // UI 執行緒：每一幀記錄與上一幀的間隔
  const uiFrames = useFrameCallback((frame) => {
    'worklet';
    const delta = frame.timeSincePreviousFrame;
    if (delta === null) return;
    uiDeltas.modify((list) => {
      'worklet';
      list.push(delta);
      return list;
    });
  }, false);

  const stopJsLoop = () => {
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = null;
  };

  const finish = (runEpoch: number) => {
    uiFrames.setActive(false);
    stopJsLoop();
    stopTimer.current = null;
    measuringRef.current = false;
    if (runEpoch === epoch.current) {
      const result: RunResult = {
        ui: summarizeFrames(uiDeltas.get()),
        js: summarizeFrames(jsDeltas.current),
      };
      setRuns((previous) => [...previous, result]);
    }
    setMeasuring(false);
  };

  const start = () => {
    if (measuringRef.current) return;
    measuringRef.current = true;
    uiDeltas.set([]);
    jsDeltas.current = [];
    setMeasuring(true);
    uiFrames.setActive(true);

    // JS 執行緒：用 requestAnimationFrame 量 JS 是否跟得上每一幀
    let last: number | null = null;
    const loop = (time: number) => {
      if (last !== null) jsDeltas.current.push(time - last);
      last = time;
      rafId.current = requestAnimationFrame(loop);
    };
    rafId.current = requestAnimationFrame(loop);

    const runEpoch = epoch.current;
    stopTimer.current = setTimeout(() => finish(runEpoch), MEASURE_MS);
  };

  const clearRuns = () => {
    epoch.current += 1;
    setRuns([]);
  };

  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      stopJsLoop();
      uiFrames.setActive(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在卸載時清理
    []
  );

  return { start, measuring, runs, clearRuns };
}

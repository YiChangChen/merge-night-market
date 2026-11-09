// 統一的日誌介面。全專案只有這個檔案可以呼叫 console.*（lint 規則 no-console）。
// 熱路徑（拖曳手勢、worklet、每秒 tick、syncAll、render）一律不寫 log；
// 內容不得包含個資，存檔只記摘要（例如 level、coins），不記完整 JSON。

// 架構〈Logging〉定義的 scope，另加 'render' 給根層 ErrorBoundary 使用。
export type LogScope = 'save' | 'ads' | 'audio' | 'telemetry' | 'store' | 'boot' | 'fx' | 'render';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function write(level: LogLevel, scope: LogScope, message: string, data?: unknown) {
  // TODO(S7.4): 正式版把 warn 以上記成 Sentry breadcrumb，error 另外送一筆 Sentry event。
  if (!__DEV__) return;
  const line = `[${scope}] ${message}`;
  if (data === undefined) console[level](line);
  else console[level](line, data);
}

export const log = {
  /** 開發時的細節，正式版完全不輸出。 */
  debug: (scope: LogScope, message: string, data?: unknown) => write('debug', scope, message, data),
  /** 里程碑，例如啟動完成、遷移完成。 */
  info: (scope: LogScope, message: string, data?: unknown) => write('info', scope, message, data),
  /** 預期內的失敗，系統已經降級處理。 */
  warn: (scope: LogScope, message: string, data?: unknown) => write('warn', scope, message, data),
  /** 資料可能受損，或流程中斷。 */
  error: (scope: LogScope, message: string, data?: unknown) => write('error', scope, message, data),
};

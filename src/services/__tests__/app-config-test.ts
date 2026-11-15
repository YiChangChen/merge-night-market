// S7.3：app.config.ts 只把 PostHog 的 Project API Key（phc_）注入 App，其他 key 一律不注入，避免密鑰被打包。
type AppConfig = (context: { config: Record<string, unknown> }) => {
  extra?: { posthogKey?: string | null; posthogHost?: string };
};

function extraWith(env: Record<string, string | undefined>) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key];
  let extra: ReturnType<AppConfig>['extra'];
  try {
    jest.isolateModules(() => {
      const appConfig = jest.requireActual<{ default: AppConfig }>('../../../app.config').default;
      extra = appConfig({ config: {} }).extra;
    });
  } finally {
    process.env = saved;
  }
  return extra;
}

describe('app.config.ts 的 PostHog 設定', () => {
  it('Project API Key（phc_）：注入；沒設 host 時用 US', () => {
    expect(extraWith({ POSTHOG_KEY: 'phc_public', POSTHOG_HOST: undefined })).toMatchObject({
      posthogKey: 'phc_public',
      posthogHost: 'https://us.i.posthog.com',
    });
  });

  it('可以指定 host（例如 EU）', () => {
    expect(
      extraWith({ POSTHOG_KEY: 'phc_public', POSTHOG_HOST: 'https://eu.i.posthog.com' })
        ?.posthogHost
    ).toBe('https://eu.i.posthog.com');
  });

  it.each([
    ['Secret API Key（phs_）', 'phs_secret'],
    ['Personal API Key（phx_）', 'phx_personal'],
    ['沒有設定', undefined],
  ])('%s：不注入', (_name, key) => {
    expect(extraWith({ POSTHOG_KEY: key })?.posthogKey).toBeNull();
  });
});

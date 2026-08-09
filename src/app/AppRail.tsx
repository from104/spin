// §6.8 / 프로토타입 template.html 84px 앱 레일. 5개 화면 + 테마 토글.
import type { ComponentType } from 'react';
import { IconHome, IconLibrary, IconMoon, IconPresent, IconSettings, IconSun } from '../ui/icons.tsx';
import type { IconProps } from '../ui/icons.tsx';
import { useSettingsState, useSettingsActions } from '../store/settings/SettingsProvider.tsx';
import { useAppNav } from './useAppHistory.ts';
import { SCREEN_NAV_LABELS } from './screens.ts';
import type { Screen } from './screens.ts';

const NAV_ITEMS: ReadonlyArray<{ key: Screen; Icon: ComponentType<IconProps> }> = [
  { key: 'home', Icon: IconHome },
  { key: 'library', Icon: IconLibrary },
  { key: 'present', Icon: IconPresent },
  { key: 'settings', Icon: IconSettings },
];

/** §7.5a "<nav aria-label='주요 메뉴'>" + aria-current="page". */
export function AppRail() {
  const { screen, go } = useAppNav();
  const { prefs } = useSettingsState();
  const { setPrefs } = useSettingsActions();
  const isDark = prefs.theme === 'dark';

  return (
    <nav
      aria-label="주요 메뉴"
      style={{
        flex: 'none',
        width: 84,
        background: 'var(--panel)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1rem 0 0.875rem',
        gap: '0.3125rem',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.375rem',
        }}
      >
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1rem', color: 'var(--accent-ink-strong)', letterSpacing: '-0.03rem' }}>
          SP
        </span>
      </div>
      <div
        aria-hidden
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.1rem',
          color: 'var(--faint-text)',
          marginBottom: '0.875rem',
        }}
      >
        SPIN
      </div>

      {NAV_ITEMS.map(({ key, Icon }) => {
        const active = screen === key;
        return (
          <button
            key={key}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => go(key)}
            style={{
              position: 'relative',
              width: 64,
              height: 58,
              borderRadius: 13,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3125rem',
              color: active ? 'var(--text)' : 'var(--faint-text)',
              background: active ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent',
              border: active ? '1.5px solid var(--accent)' : '1.5px solid transparent',
            }}
          >
            <span style={{ display: 'flex', color: active ? 'var(--accent)' : 'currentColor' }}>
              <Icon />
            </span>
            <span style={{ fontSize: '0.65625rem', fontWeight: 600, letterSpacing: '-0.0125rem' }}>{SCREEN_NAV_LABELS[key]}</span>
          </button>
        );
      })}

      <button
        type="button"
        aria-label={isDark ? '라이트 테마로 전환' : '다크 테마로 전환'}
        title="테마 전환"
        onClick={() => setPrefs({ theme: isDark ? 'light' : 'dark' })}
        style={{
          marginTop: 'auto',
          width: 44,
          height: 44,
          border: '1px solid var(--border)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
        }}
      >
        {isDark ? <IconSun /> : <IconMoon />}
      </button>
    </nav>
  );
}

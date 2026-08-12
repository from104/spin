// §6.8 / 프로토타입 template.html 84px 앱 레일. 3단 + 테마 토글.
//
// 2026-08-12 재편(계획서 2.1): 레일 항목이 화면 키와 1:1 이 아니게 됐다. `present` 는 화면
// 키로 살아 있지만 레일에서는 빠진다 — 레일로 시연에 들어오면 대상이 없어 빈 화면만 뜬다.
// 시연 중 활성은 SCREEN_TO_RAIL 이 [드릴]로 접는다. 이 컴포넌트는 여전히 **화면 키만** 보고
// StageTarget 은 모른다(레일이 편집기 상태에 결합되는 것을 막는다).
import type { ComponentType } from 'react';
import { IconHome, IconLibrary, IconMoon, IconSettings, IconSun } from '../ui/icons.tsx';
import type { IconProps } from '../ui/icons.tsx';
import { useSettingsState, useSettingsActions } from '../store/settings/SettingsProvider.tsx';
import { useAppNav } from './useAppHistory.ts';
import { RAIL_ITEMS, SCREEN_NAV_LABELS, SCREEN_TO_RAIL } from './screens.ts';
import type { RailKey } from './screens.ts';

const RAIL_ICONS: Record<RailKey, ComponentType<IconProps>> = {
  board: IconHome,
  drills: IconLibrary,
  settings: IconSettings,
};

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

      {RAIL_ITEMS.map((key) => {
        const Icon = RAIL_ICONS[key];
        const active = SCREEN_TO_RAIL[screen] === key;
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

      {/* 버전 — 값은 package.json 하나에서만 나온다(vite define). 화면에 박아 두면
          릴리스 때 반드시 어긋난다. 사용자가 "지금 뭘 보고 있는지" 를 말할 수 있어야
          제보를 커밋에 붙일 수 있어서 눈에 띄지 않게, 그러나 항상 보이게 둔다. */}
      <span
        style={{
          marginTop: 8,
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '0.625rem',
          fontWeight: 600,
          letterSpacing: '0.02em',
          color: 'var(--faint-text)',
        }}
      >
        v{__APP_VERSION__}
      </span>
    </nav>
  );
}

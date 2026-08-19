// §6.8 / 프로토타입 template.html 84px 앱 레일. 3단 + 테마 토글.
//
// 2026-08-12 재편(계획서 2.1): 레일 항목이 화면 키와 1:1 이 아니게 됐다. `present` 는 화면
// 키로 살아 있지만 레일에서는 빠진다 — 레일로 시연에 들어오면 대상이 없어 빈 화면만 뜬다.
// 시연 중 활성은 SCREEN_TO_RAIL 이 [드릴]로 접는다. 이 컴포넌트는 여전히 **화면 키만** 보고
// StageTarget 은 모른다(레일이 편집기 상태에 결합되는 것을 막는다).
//
// 3.-2: **좁은 창에서는 이 컴포넌트가 아예 서지 않는다** — AppShell 이 `useIsNarrow()` 로 갈라
// AppNavSegment(헤더 좌측 3칸)를 대신 세운다. 여기 84 는 크롬 예산의 appRail 행 `wide` 값이고,
// 그래서 이 폭을 바꾸면 chromeBudget.test.ts 의 소스 대조가 빨간불이 된다.
import { IconMoon, IconSun } from '../ui/icons.tsx';
import { useSettingsState, useSettingsActions } from '../store/settings/SettingsProvider.tsx';
import { useAppNav } from './useAppHistory.ts';
import { RAIL_ITEMS, SCREEN_NAV_LABELS, railFor } from './screens.ts';
import type { RailKey } from './screens.ts';
import { RAIL_ICONS, RAIL_NAV_TARGETS } from './navChrome.ts';
import { useT } from '../i18n/useT.ts';
import { useLocale } from '../i18n/useLocale.ts';

/** §7.5a "<nav aria-label='주요 메뉴'>" + aria-current="page".
 *
 *  `active` 는 AppShell 이 계산해 내려보낸다(screens.railFor) — 화면 키만으로는 드릴 편집
 *  중에도 [보드]에 불이 들어온다. 안 주면 화면 키만으로 접어 옛 동작이 된다. */
export function AppRail({ active }: { active?: RailKey } = {}) {
  const { screen, go } = useAppNav();
  const activeKey = active ?? railFor(screen);
  const { prefs } = useSettingsState();
  const { setPrefs } = useSettingsActions();
  const isDark = prefs.theme === 'dark';
  const locale = useLocale();
  const t = useT();

  return (
    <nav
      aria-label={t('app.nav.mainMenu')}
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
      {/* 2026-08-14 기현님이 주신 앱 아이콘 — 옛 자리는 액센트색 타일에 'SP' 두 글자였다.
          **SVG 다**(기현님 지시). 42px 로 그리지만 200% 배율 화면에서도 안 뭉개지고, 코트
          짧은 변의 흰 파선처럼 얇은 획이 살아남는 유일한 길이다. 파일 하나로 파비콘·홈 화면·
          설치형 아이콘까지 함께 굽는다(`art/README.md`).
          `borderRadius` 를 안 건다: 마크가 **원**이라 자를 모서리가 없다(옛 타일은 둥근 사각이라
          필요했다). 여기에 라운드를 걸면 원의 상하좌우가 미세하게 깎인다.
          `aria-hidden` 은 그대로다 — 바로 아래 'SPIN' 워드마크가 같은 것을 한 번 더 말하므로,
          둘 다 읽히면 스크린리더가 "SP SPIN" 을 읽는다(alt 를 비워 두는 것과 같은 이유). */}
      <img src="/logo.svg" alt="" aria-hidden width={42} height={42} style={{ display: 'block', marginBottom: '0.375rem' }} />
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
        const active = activeKey === key;
        return (
          <button
            key={key}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => go(key, RAIL_NAV_TARGETS[key])}
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
            <span style={{ fontSize: '0.65625rem', fontWeight: 600, letterSpacing: '-0.0125rem' }}>{SCREEN_NAV_LABELS[locale][key]}</span>
          </button>
        );
      })}

      <button
        type="button"
        aria-label={isDark ? t('app.theme.toggleToLight') : t('app.theme.toggleToDark')}
        title={t('app.theme.toggleTitle')}
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

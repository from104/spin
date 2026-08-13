// 3.-2 §5.2 — 좁은 창(`useIsNarrow`)에서 84px 앱 레일이 접혀 들어가는 자리. **헤더 좌측 3칸
// 세그먼트**다. 폭 예산 117 중 84 가 이 한 행이라, 이걸 안 걷으면 §5.4 의 '남는 폭'이 172 →
// 88 로 줄어 `--hit` 56 을 켤 때 트레이가 요구하는 117 을 못 댄다.
//
// ⚠️ **판 위에 오버레이로 얹지 않는다.** 좌측에 뜨는 오버레이는 `edgePanBandPx = 56` 및 2.6 의
// 마진 띠 팬과 같은 픽셀을 두고 다툰다 — 판 가장자리를 잡아 밀려던 손이 내비를 누른다.
// 헤더 안으로 들어가야 그 충돌이 원인째 사라진다(심사관 1 [치명] 2번).
//
// 레일과 **같은 세 항목·같은 아이콘·같은 활성 표시**를 쓴다(navChrome.ts 의 RAIL_ICONS).
// 화면 키만 보고 `SCREEN_TO_RAIL` 로 접는 것도 레일과 같다 — 이 컴포넌트도 StageTarget 을
// 모른다(내비가 편집기 상태에 결합되는 것을 막는 2.1 원칙 3).
import { IconMoon, IconSun } from '../ui/icons.tsx';
import { useSettingsState, useSettingsActions } from '../store/settings/SettingsProvider.tsx';
import { useAppNav } from './useAppHistory.ts';
import { RAIL_ITEMS, SCREEN_NAV_LABELS, railFor } from './screens.ts';
import type { RailKey } from './screens.ts';
import { RAIL_ICONS, RAIL_NAV_TARGETS } from './navChrome.ts';

/** §7.5a "<nav aria-label='주요 메뉴'>" + aria-current="page" — 레일과 **같은 이름·같은 계약**
 *  이다. 좁은 창에서 이름이 바뀌면 스크린리더 사용자에게는 다른 앱이 된다.
 *  `active` 도 레일과 같은 값을 AppShell 에게서 받는다(AppRail 의 같은 prop). */
export function AppNavSegment({ active }: { active?: RailKey } = {}) {
  const { screen, go } = useAppNav();
  const activeKey = active ?? railFor(screen);
  const { prefs } = useSettingsState();
  const { setPrefs } = useSettingsActions();
  const isDark = prefs.theme === 'dark';

  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
      {/* 세로 여백도 테두리도 두지 않는다 — 칸 높이(--hit)가 그대로 세그먼트 높이여야
          헤더 52 안에 선다(navChrome.ts 의 headerContentMaxPx). */}
      <nav aria-label="주요 메뉴" style={{ display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
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
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3125rem',
                // 칸이 곧 표적이다. 폭도 하한을 둬야 아이콘만 남는 상황에서 44 밑으로 안 간다.
                minHeight: 'var(--hit)',
                minWidth: 'var(--hit)',
                padding: '0 0.5rem',
                borderRadius: '0.625rem',
                fontSize: '0.75rem',
                fontWeight: active ? 700 : 600,
                letterSpacing: '-0.0125rem',
                whiteSpace: 'nowrap',
                color: active ? 'var(--text)' : 'var(--faint-text)',
                background: active ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent',
                border: active ? '1.5px solid var(--accent)' : '1.5px solid transparent',
              }}
            >
              <span style={{ display: 'flex', color: active ? 'var(--accent)' : 'currentColor' }}>
                <Icon size={17} />
              </span>
              {SCREEN_NAV_LABELS[key]}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        aria-label={isDark ? '라이트 테마로 전환' : '다크 테마로 전환'}
        title="테마 전환"
        onClick={() => setPrefs({ theme: isDark ? 'light' : 'dark' })}
        style={{
          flex: 'none',
          width: 'var(--hit)',
          height: 'var(--hit)',
          border: '1px solid var(--border)',
          borderRadius: '0.625rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
        }}
      >
        {isDark ? <IconSun /> : <IconMoon />}
      </button>

      {/* 버전 — 레일이 지고 있던 것을 함께 옮긴다. 좁은 창이라고 조용히 없애면 제보에 붙일
          숫자가 그 기기에서만 사라진다(AppRail.tsx 의 같은 주석). 표적은 아니라 예산에
          들어가지 않고, 폭도 30px 남짓이다. */}
      <span
        style={{
          flex: 'none',
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '0.625rem',
          fontWeight: 600,
          letterSpacing: '0.02em',
          color: 'var(--faint-text)',
        }}
      >
        v{__APP_VERSION__}
      </span>
    </div>
  );
}

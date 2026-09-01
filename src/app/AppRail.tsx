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
import { useRef, useState } from 'react';
import { IconHelp, IconLanguage, IconMoon, IconSun } from '../ui/icons.tsx';
import { LanguageModal } from './LanguageModal.tsx';
import { useSettingsState, useSettingsActions } from '../store/settings/SettingsProvider.tsx';
import { useAppNav } from './useAppHistory.ts';
import { RAIL_ITEMS, SCREEN_NAV_LABELS, railFor } from './screens.ts';
import type { RailKey } from './screens.ts';
import { RAIL_ICONS, RAIL_NAV_TARGETS } from './navChrome.ts';
import { useT } from '../i18n/useT.ts';
import { useLocale } from '../i18n/useLocale.ts';
import { useHelpShow } from '../ui/help/HelpTriggerProvider.tsx';

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
  const showHelp = useHelpShow();
  // 언어 모달(2026-09-02) — 레일이 직접 쥔다. 여는 버튼이 여기 하나뿐이라 위로 끌어올릴
  // 이유가 없고, 올리면 AppShell 이 모달 하나를 더 아는 값이 없는 결합이 는다.
  const [langOpen, setLangOpen] = useState(false);
  const langBtnRef = useRef<HTMLButtonElement | null>(null);

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

      {/* [언어] — 설정 화면에서 옮겨 왔다(2026-09-02 기현 지시). **[도움말] 바로 위**다.
          `marginTop:'auto'` 도 여기로 함께 왔다: 바닥 뭉치의 **맨 위 항목**이 그것을 지녀야
          아래 셋(도움말·테마·버전)이 평범한 flow 로 뒤따라 바닥에 붙는다. 도움말에 남겨 두면
          언어 버튼만 목록 바로 밑에 떠서 뭉치가 갈라진다.

          아이콘이 지구본인 근거는 IconLanguage 주석에 있다 — 요약하면, 언어를 바꾸려는 사람은
          지금 화면 글자를 못 읽는 사람일 수 있어서 아이콘이 글자면 안 된다. */}
      <button
        type="button"
        ref={langBtnRef}
        aria-label={t('settings.language.title')}
        title={t('settings.language.title')}
        aria-haspopup="dialog"
        onClick={() => setLangOpen(true)}
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
        <IconLanguage />
      </button>
      <LanguageModal open={langOpen} onClose={() => setLangOpen(false)} returnFocusRef={langBtnRef} />

      {/* [도움말] — §0.5 Phase 5(계획서 §A) "테마 토글 위에 [도움말] 버튼". */}
      <button
        type="button"
        aria-label={t('help.center.title')}
        title={t('help.center.title')}
        onClick={showHelp}
        style={{
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
        <IconHelp />
      </button>
      <button
        type="button"
        aria-label={isDark ? t('app.theme.toggleToLight') : t('app.theme.toggleToDark')}
        title={t('app.theme.toggleTitle')}
        onClick={() => setPrefs({ theme: isDark ? 'light' : 'dark' })}
        style={{
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

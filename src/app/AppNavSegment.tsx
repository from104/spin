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
import { useRef, useState } from 'react';
import { IconHelp, IconLanguage, IconMoon, IconSun } from '../ui/icons.tsx';
import { LanguageModal } from './LanguageModal.tsx';
import { ChangelogModal } from './ChangelogModal.tsx';
import { useSettingsState, useSettingsActions } from '../store/settings/SettingsProvider.tsx';
import { useAppNav } from './useAppHistory.ts';
import { RAIL_ITEMS, SCREEN_NAV_LABELS, railFor } from './screens.ts';
import type { RailKey } from './screens.ts';
import { RAIL_ICONS, RAIL_NAV_TARGETS } from './navChrome.ts';
import { useT } from '../i18n/useT.ts';
import { useLocale } from '../i18n/useLocale.ts';
import { useHelpShow } from '../ui/help/HelpTriggerProvider.tsx';

/** §7.5a "<nav aria-label='주요 메뉴'>" + aria-current="page" — 레일과 **같은 이름·같은 계약**
 *  이다. 좁은 창에서 이름이 바뀌면 스크린리더 사용자에게는 다른 앱이 된다.
 *  `active` 도 레일과 같은 값을 AppShell 에게서 받는다(AppRail 의 같은 prop). */
export function AppNavSegment({ active }: { active?: RailKey } = {}) {
  const { screen, go } = useAppNav();
  const activeKey = active ?? railFor(screen);
  const locale = useLocale();
  const t = useT();

  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
      {/* 세로 여백도 테두리도 두지 않는다 — 칸 높이(--hit)가 그대로 세그먼트 높이여야
          헤더 52 안에 선다(navChrome.ts 의 headerContentMaxPx). */}
      {/* 앱 아이콘 — **헤더 맨 왼쪽**이다(기현 지시 2026-08-14: *"좁은 창 헤더에서도 왼쪽 상단에
          아이콘이 있어야 함"*). 넓은 창 84px 레일이 그 모양이라 그렇다: 로고가 맨 위, 그 아래
          이동 3칸, 맨 끝에 테마·버전. 좁은 창은 그 기둥을 눕힌 것이므로 순서가 같아야 한다.
          ⚠️ **42 가 아니라 28 이다.** 헤더 한 줄이 48px 이고 그 안에 `--hit`(44) 짜리 표적이
          서므로, 로고가 그보다 크면 로고가 헤더 높이를 밀어 버린다. 로고는 표적이 아니라
          표식이라 작아도 제 일을 한다(레일에서는 84px 폭이 남아 42 를 쓸 수 있었다).
          `aria-hidden` 인 이유는 레일과 같다 — 이동 3칸이 앱 이름을 이미 말한다. */}
      <img
        src="/logo.svg"
        alt=""
        aria-hidden
        width={28}
        height={28}
        style={{ display: 'block', flex: 'none', marginRight: '0.125rem' }}
      />
      <nav aria-label={t('app.nav.mainMenu')} style={{ display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
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
              {SCREEN_NAV_LABELS[locale][key]}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/** 테마 토글 + 버전 — 좁은 창 헤더의 **오른 끝**이다.
 *
 *  2026-08-14 기현님 지시: *"좁은창 헤더에서 테마 선택, 버전이 오른 끝으로 가야 일관성 있다."*
 *  넓은 창의 84px 레일이 그렇게 생겼기 때문이다: 이동 3칸이 **맨 위**, 테마와 버전이 **맨 끝**.
 *  좁은 창에서 레일이 헤더로 접힐 때 넷을 한 덩어리로 왼쪽에 몰아 두었더니, 같은 앱인데
 *  창 폭에 따라 두 물건의 관계가 달라졌다 — 접는 것이지 재배치하는 것이 아니어야 한다.
 *
 *  그래서 세그먼트가 **둘로 갈린다**: 이동은 `AppNavSegment`(헤더 좌측), 이 둘은 여기(우측 끝).
 *  AppHeader 가 자기 우측 조작부 **맨 끝**에 꽂는다 — 코트 전환·검색·주 액션보다 뒤다.
 *  자주 쓰는 것일수록 앞이고, 테마는 한 번 정하면 끝, 버전은 아예 표적도 아니다. */
export function AppNavAside() {
  const { prefs } = useSettingsState();
  const { setPrefs } = useSettingsActions();
  const isDark = prefs.theme === 'dark';
  const t = useT();
  const showHelp = useHelpShow();
  const [langOpen, setLangOpen] = useState(false);
  const langBtnRef = useRef<HTMLButtonElement | null>(null);
  // 2026-09-03 기현 지시 — 버전 번호를 누르면 이번 버전의 변경 내역이 뜬다.
  const [changelogOpen, setChangelogOpen] = useState(false);
  const versionBtnRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
      {/* [언어] — 넓은 레일에서 [도움말] **위**인 것이 여기서는 **앞**이다(이 줄은 가로다).
          ⚠️ 좁은 창에는 AppRail 이 아예 안 선다(AppShell 의 `!narrow`). 언어를 레일에만 두면
             **태블릿에서 언어를 바꿀 길이 통째로 사라진다** — 2026-09-02 개편으로 설정 화면의
             언어 섹션을 뺐기 때문에 대체 경로도 없다. 태블릿은 이 앱의 주 대상 기기다. */}
      <button
        type="button"
        ref={langBtnRef}
        aria-label={t('settings.language.title')}
        title={t('settings.language.title')}
        aria-haspopup="dialog"
        onClick={() => setLangOpen(true)}
        // 넓은 레일과 **같은 정도로** 진하다 — 지구본만 악센트색, 테두리는 그대로
        // (AppRail 의 그 주석에 근거). 두 곳이 갈리면 창을 좁혔을 때만 강조가 사라지는,
        // 가장 늦게 발견되는 어긋남이 된다.
        style={{
          flex: 'none',
          width: 'var(--hit)',
          height: 'var(--hit)',
          border: '1px solid var(--border-strong)',
          borderRadius: '0.625rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
        }}
      >
        <IconLanguage />
      </button>
      <LanguageModal open={langOpen} onClose={() => setLangOpen(false)} returnFocusRef={langBtnRef} />
      {/* [도움말] — §0.5 Phase 5(계획서 §A) "좁은 창에서는 AppNavAside 에 함께 들어간다".
          넓은 레일과 같은 순서(도움말 → 테마 → 버전)로 맨 앞에 둔다. */}
      <button
        type="button"
        aria-label={t('help.center.title')}
        title={t('help.center.title')}
        onClick={showHelp}
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
        <IconHelp />
      </button>
      <button
        type="button"
        aria-label={isDark ? t('app.theme.toggleToLight') : t('app.theme.toggleToDark')}
        title={t('app.theme.toggleTitle')}
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
          들어가지 않고, 폭도 30px 남짓이다.
          2026-09-03 기현 지시로 **눌러서 이번 버전 변경 내역**을 보는 문이 됐다 — AppRail.tsx
          와 같은 배선(ChangelogModal.tsx, CHANGELOG.md 를 정본으로 파싱). */}
      <button
        type="button"
        ref={versionBtnRef}
        aria-label={t('app.changelog.openTitle', { version: __APP_VERSION__ })}
        title={t('app.changelog.openTitle', { version: __APP_VERSION__ })}
        aria-haspopup="dialog"
        onClick={() => setChangelogOpen(true)}
        style={{
          flex: 'none',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '0.625rem',
          fontWeight: 600,
          letterSpacing: '0.02em',
          color: 'var(--faint-text)',
        }}
      >
        v{__APP_VERSION__}
      </button>
      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} returnFocusRef={versionBtnRef} />
    </div>
  );
}


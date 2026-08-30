// §6.8 헤더(프로토타입 template.html 62px 헤더 그대로) + 조건부 표시:
// 코트 스위치 (editor|present) && courtMode / 검색 library / 시연 버튼 (editor && courtMode) ||
// library / 주 액션 home|library → 새 드릴, editor → 저장, present → 편집으로.
//
// AppHeader 자신은 화면별 상태(courtMode, 저장 여부 등)를 모른다 — 그건 EditorProvider 등
// 화면 전용 Provider 안에서만 얻을 수 있고 AppHeader 는 그 밖(AppShell)에서 렌더된다.
// 그래서 "헤더에 뭘 보여줄지"는 각 화면 컴포넌트가 useAppHeader(config) 로 선언하고,
// AppHeader 는 그 선언을 구독만 하는 순수 표시 컴포넌트다.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Button } from '../ui/Button.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import { IconLock, IconSearch } from '../ui/icons.tsx';
import type { CourtMode } from '../model/court.ts';
import { COURT_MODES, COURT_MODE_SHORT_LABELS } from '../model/court.ts';
import { AppNavAside, AppNavSegment } from './AppNavSegment.tsx';
import { headerPadCss } from './navChrome.ts';
import type { RailKey } from './screens.ts';
import { useT } from '../i18n/useT.ts';
import { useLocale } from '../i18n/useLocale.ts';

export interface HeaderPrimaryAction {
  label: string;
  onAction(): void;
  icon?: ReactNode;
  disabled?: boolean;
}
export interface HeaderCourtSwitch {
  value: CourtMode;
  /** 드릴 편집에서 코트 모드는 불변이다(§6.8/D12) — 거기서는 항상 true 다. 클릭해도 바뀌지
   *  않고 onLockedAttempt 로 토스트를 띄우는 쪽(공 도구 제한 §6.10 과 동일 패턴)이 이 값을 쓴다.
   *
   *  자유 전술판(§6.8 재편)에서만 false 가 될 수 있다. 그것도 **판이 리셋 상태일 때만** —
   *  D12 대로 full↔half 전환은 배치를 보존할 수 없으므로, 잃을 배치가 없을 때로 한정해
   *  손실 자체를 원천 차단한다. 그 판정은 화면 쪽 책임이고 여기는 결과만 받는다. */
  locked?: boolean;
  onLockedAttempt?(): void;
  /** locked=false 일 때만 불린다. */
  onChange?(mode: CourtMode): void;
}
export interface HeaderSearch {
  value: string;
  onChange(v: string): void;
  placeholder?: string;
}
/** §텍스트의 소속(기현님 확정 2026-08-17, PLAN-STEP-EDITING.md) — 드릴 짧은 설명은 편집
 *  화면 **헤더 인라인**(제목 옆/밑 한 줄, 클릭하면 편집)이다. `subtitle`(화면마다 고정
 *  문구를 보여주기만 하는 필드 — present/library/settings 가 쓴다)과 굳이 겹치지 않는
 *  이유: 저 필드들은 onChange 가 없는 **정적** 텍스트라, 같은 슬롯에 "편집 가능"이라는
 *  새 뜻을 얹으면 그 화면들도 실수로 클릭-편집이 되거나(타입을 합치면) 조건 분기가
 *  늘어난다. 별도 필드로 두면 description 을 안 주는 화면은 한 줄도 안 바뀐다. */
export interface HeaderDescriptionField {
  value: string;
  /** 값이 비었을 때 보여줄 조용한 안내 — 예: '설명 추가'. */
  placeholder: string;
  maxLength: number;
  onChange(v: string): void;
}
/** 드릴 이름 인라인 편집(기현님 지시 2026-08-18: *"드릴 이름 정도만 왼쪽 상단에 배치하고
 *  동적으로 수정 가능해야함"*) — 옛 인스펙터 [제목] 필드의 후계다(인스펙터 폐기). 모양은
 *  HeaderDescriptionField 와 같은 클릭-편집이지만 **빈 값을 커밋하지 않는다**: 이름은 목록
 *  카드·시연·자동저장 전부의 얼굴이라 '' 이 되면 드릴을 못 알아본다(옛 인스펙터도 같은
 *  가드였다). 지우고 blur 하면 원래 이름으로 되돌아간다. */
export interface HeaderTitleField {
  value: string;
  maxLength: number;
  onChange(v: string): void;
}
// ⚠️ 2026-08-28 (기현 지시) — **`HeaderInfoButton`/`infoButton` 이 통째로 폐기됐다.**
// 옛 자리는 제목 바로 우측의 ⓘ 였고(2026-08-20), 편집·시연 두 화면이 그 하나를 공유했다.
// 폐기 이유는 자리가 아니라 **아이콘**이다: 같은 글리프 하나라서 눌러 보기 전에는 그 화면에서
// 드릴 정보를 고칠 수 있는지 볼 수만 있는지 알 수 없었다. 지금은 각 화면의 오른쪽 세로 바가
// 자기 칸으로 낸다 — features/editor/FunctionBar(IconDrillInfoEdit, 연필)와
// features/present/PresentSideBar(IconDrillInfoRead, 눈). 밑판이 같고 수정자만 다른 한 벌이다.
// 여기에 되살리지 마라 — 같은 이름('드릴 정보')의 표적이 둘이 되면 그 이름으로 찍는 테스트가
// "여러 개" 로 터진다(위 되돌리기·다시하기가 헤더에서 빠진 것과 같은 이유).
export interface HeaderConfig {
  title: string;
  /** 있으면 제목이 클릭-편집이 된다(드릴 편집 헤더 전용). `title` 은 그대로 둔다 — 편집이
   *  없는 화면·폴백 표시가 그 값을 쓴다. */
  titleField?: HeaderTitleField | null;
  subtitle?: string;
  /** 편집중 배지 등. */
  badge?: string;
  /** 드릴 편집 헤더 전용 — 자유 전술판·다른 화면은 안 준다(헤더가 비어 있거나 subtitle 을 쓴다).
   *  `compact` 에서는 안 그린다(아래 주석). */
  description?: HeaderDescriptionField | null;
  primary?: HeaderPrimaryAction | null;
  search?: HeaderSearch | null;
  courtSwitch?: HeaderCourtSwitch | null;
  /** 컴팩트 모드(2026-08-20, 기현님 지시 — "드릴 편집 화면과 시연 화면은 비슷한 레이아웃이어야
   *  ux가 좋아진다") — 드릴 편집·시연 두 화면 공용 헤더. 켜지면 높이가 좁은 창과 같은 48 로
   *  줄고(아래 AppHeader 의 headerPadCss 인자), `subtitle`·`description` 을 안 그린다 — 제목·
   *  ⓘ·상황별 전환 버튼(primary) 한 줄만 남는다. */
  compact?: boolean;
}

// ⚠️ 2026-08-14 기현님 지시(*"undo, redo 버튼을 줌 버튼과 묶어 배치"*)로 **되돌리기·다시하기가
// 헤더에서 통째로 빠졌다.** 옛 자리는 아래 우측 조작부의 첫 칸이었고, 근거는 *"단축키만 있으면
// 기능이 있다는 사실 자체를 알 수 없다"* 였다 — 그 근거는 지금도 맞고 버튼도 그대로 있다.
// 바뀐 것은 **어디에** 있느냐 하나다: features/editor/StageControls.tsx 의 HistoryGroup 이
// 트레이 줌 바로 아래에 같은 이름·같은 툴팁으로 낸다. 판을 만지는 손과 헤더는 화면의 정반대
// 끝이라, 한 번 되돌릴 때마다 발 마우스가 판을 떠나 왕복해야 했다.
// 여기에 되살리지 마라 — 같은 이름의 표적이 둘이 되면 §3 표적 예산이 35→37 로 오르고,
// `getByRole('button', { name: '되돌리기' })` 로 찍는 테스트 여럿이 "여러 개" 로 터진다.

const EMPTY_CONFIG: HeaderConfig = { title: '' };

interface HeaderContextValue {
  config: HeaderConfig;
  publish(next: HeaderConfig): void;
}
const HeaderContext = createContext<HeaderContextValue | null>(null);

/** AppShell 이 트리 최상단에서 감싼다(계약 밖 확장 export — 화면들이 useAppHeader 로 헤더
 *  내용을 선언할 수 있게 하는 통로). */
export function HeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HeaderConfig>(EMPTY_CONFIG);
  const value = useMemo<HeaderContextValue>(
    () => ({ config, publish: (next) => setConfig((prev) => (headerConfigEqual(prev, next) ? prev : next)) }),
    [config],
  );
  return <HeaderContext.Provider value={value}>{children}</HeaderContext.Provider>;
}

function headerConfigEqual(a: HeaderConfig, b: HeaderConfig): boolean {
  return (
    a.title === b.title &&
    !!a.titleField === !!b.titleField &&
    a.titleField?.value === b.titleField?.value &&
    a.titleField?.maxLength === b.titleField?.maxLength &&
    a.subtitle === b.subtitle &&
    a.badge === b.badge &&
    !!a.description === !!b.description &&
    a.description?.value === b.description?.value &&
    a.description?.placeholder === b.description?.placeholder &&
    a.description?.maxLength === b.description?.maxLength &&
    !!a.primary === !!b.primary &&
    a.primary?.label === b.primary?.label &&
    a.primary?.disabled === b.primary?.disabled &&
    !!a.search === !!b.search &&
    a.search?.value === b.search?.value &&
    a.search?.placeholder === b.search?.placeholder &&
    !!a.courtSwitch === !!b.courtSwitch &&
    a.courtSwitch?.value === b.courtSwitch?.value &&
    a.courtSwitch?.locked === b.courtSwitch?.locked &&
    !!a.compact === !!b.compact &&
    true
  );
}

/** 화면 컴포넌트가 자신의 헤더 내용을 선언한다. 함수 프로퍼티는 렌더마다 새로 만들어져도
 *  안전하다 — 항상 최신 config 를 가리키는 ref 를 통해 호출하므로 effect 의존성에 함수를
 *  넣지 않는다(넣으면 매 렌더 재구독 → 무한 루프 위험). publish 쪽은 얕은 비교로 항등이면
 *  state 를 바꾸지 않아 불필요한 리렌더도 없다. */
export function useAppHeader(config: HeaderConfig): void {
  const ctx = useContext(HeaderContext);
  // ctx 는 안정적이지 않다 — HeaderProvider 의 config state 가 바뀔 때마다 useMemo 가 새
  // {config, publish} 객체를 만든다(publish 성공 = config 변경 = ctx 참조 변경). 그래서 ctx 를
  // effect 의존성에 넣으면 "내가 방금 publish 한 결과로 ctx 가 바뀐 것"과 "정말 언마운트된 것"을
  // 구분하지 못한다 — 실제로 넣었더니 매 publish 마다 언마운트 cleanup 이 잘못 발동해 헤더를
  // 비웠다 채웠다를 무한 반복했다(테스트로 재현·회귀 방지). ref 로만 최신값을 들고 다닌다.
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const latest = useRef(config);
  latest.current = config;

  const key = JSON.stringify([
    config.title,
    config.titleField ? [config.titleField.value, config.titleField.maxLength] : null,
    config.subtitle,
    config.badge,
    config.description ? [config.description.value, config.description.placeholder, config.description.maxLength] : null,
    config.primary ? [config.primary.label, config.primary.disabled ?? false] : null,
    config.search ? [config.search.value, config.search.placeholder ?? ''] : null,
    config.courtSwitch ? [config.courtSwitch.value, config.courtSwitch.locked ?? true] : null,
    config.compact ?? false,
  ]);

  useEffect(() => {
    if (!ctxRef.current) return;
    const c = latest.current;
    ctxRef.current.publish({
      title: c.title,
      titleField: c.titleField
        ? {
            value: c.titleField.value,
            maxLength: c.titleField.maxLength,
            onChange: (v) => latest.current.titleField?.onChange(v),
          }
        : null,
      subtitle: c.subtitle,
      badge: c.badge,
      description: c.description
        ? {
            value: c.description.value,
            placeholder: c.description.placeholder,
            maxLength: c.description.maxLength,
            onChange: (v) => latest.current.description?.onChange(v),
          }
        : null,
      primary: c.primary ? { ...c.primary, onAction: () => latest.current.primary?.onAction() } : null,
      search: c.search
        ? { value: c.search.value, placeholder: c.search.placeholder, onChange: (v) => latest.current.search?.onChange(v) }
        : null,
      courtSwitch: c.courtSwitch
        ? {
            value: c.courtSwitch.value,
            locked: c.courtSwitch.locked ?? true,
            onLockedAttempt: () => latest.current.courtSwitch?.onLockedAttempt?.(),
            onChange: (m) => latest.current.courtSwitch?.onChange?.(m),
          }
        : null,
      compact: c.compact,
    });
    // key 로 원시값 변화만 추적한다 — ctxRef 는 ref 라 의존성 배열에 넣을 필요도, 넣어서도 안 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // 화면 전환으로 이 훅이 "정말" 언마운트되면 헤더를 비운다 — 다음 화면이 자기 것을 선언하기
  // 전 잠깐이라도 이전 화면의 저장 버튼 등이 남아있는 걸 막는다. 의존성 배열을 비워서 ctx 참조가
  // 바뀔 때마다(= 매 publish 성공마다) 돌지 않고 실제 unmount 한 번에만 돈다.
  useEffect(() => {
    return () => {
      ctxRef.current?.publish(EMPTY_CONFIG);
    };
  }, []);
}

const HEADER_STYLE: CSSProperties = {
  flex: 'none',
  // ⚠️ 높이를 고정하지 않는다. 태블릿 세로처럼 폭이 좁으면 우측 조작부(되돌리기·코트 전환·
  //    주 액션)가 62px 한 줄에 다 안 들어가 화면 밖으로 잘려 나간다(실기에서 '드릴로 저장'
  //    이 반 잘린 채 겹쳐 보였다). 잘라 없애느니 두 줄로 흐르게 둔다.
  minHeight: 62,
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  rowGap: '0.5rem',
  gap: '0.875rem',
  borderBottom: '1px solid var(--border)',
  background: 'var(--panel)',
};

/** 프로토타입 62px 헤더. `config` 를 직접 받으면 그걸 그린다 — home/library/settings 는
 *  app-shell 에 의존할 수 없어(§8) useAppHeader 로 스스로를 알릴 수 없으므로 AppShell 이 정적으로
 *  계산해 여기 꽂는다. `config` 를 생략하면(editor/present) HeaderProvider 구독으로 돌아간다 —
 *  그 두 화면은 courtMode·저장 상태처럼 화면 전용 Provider 안의 값이 필요해서 useAppHeader 로
 *  스스로 선언해야 한다.
 *
 *  `narrow` (3.-2): 좁은 창이면 84px 레일 대신 **헤더 좌측 3칸 세그먼트**가 내비를 진다.
 *  이 boolean 을 헤더가 스스로 `useIsNarrow()` 로 구하지 않고 **AppShell 에게서 받는** 이유는,
 *  레일과 세그먼트가 같은 판정을 나눠 갖게 하기 위해서다 — 훅을 두 곳에서 부르면 두 state 가
 *  각자 갱신되는 프레임에 둘 다 서거나 둘 다 없는 순간이 열린다. */
export function AppHeader({
  config: override,
  narrow = false,
  activeRail,
}: {
  config?: HeaderConfig;
  narrow?: boolean;
  /** 좁은 창 세그먼트의 활성 항목. `narrow` 와 **같은 이유로** AppShell 에게서 받는다(위 주석) —
   *  레일과 세그먼트가 같은 판정을 나눠 갖지 않으면 창 폭에 따라 다른 항목에 불이 들어온다. */
  activeRail?: RailKey;
}) {
  const ctx = useContext(HeaderContext);
  const config = override ?? ctx?.config ?? EMPTY_CONFIG;
  const t = useT();

  return (
    // ⚠️ 2026-08-20 — `config.compact` 는 `minHeight` 를 62 → **48** 로 덮어쓴다(드릴 편집·시연
    // 공용 헤더). HEADER_STYLE 의 `minHeight: 62` 리터럴은 그대로 둔다 — chromeBudget.test.ts
    // 가 소스에서 그 글자를 찾아 예산 표(row.wide)와 대조한다. 패딩도 좁은 창 값(HEADER_PAD_PX
    // .narrow)으로 맞춘다 — `narrow` prop(레일↔세그먼트 판정)과는 독립이다: 넓은 창에서도
    // compact 면 48px 여야 하고, 그때 좌측 세그먼트는 안 선다(아래 `{narrow && …}` 그대로).
    <header style={{ ...HEADER_STYLE, padding: headerPadCss(narrow || !!config.compact), ...(config.compact ? { minHeight: 48 } : null) }}>
      {narrow && <AppNavSegment active={activeRail} />}
      <div style={{ minWidth: 0, flex: '1 1 12rem' }}>
        {/* ⚠️ `compact`(드릴 편집·시연)에서만 **가운데 정렬**이다(기현 지시 2026-08-30:
            *"드릴 편집 화면, 시연 화면에서 드릴 제목 및 편집중 아이콘, 제목 수정 폼을 가운데
            정렬로"*). 다른 화면은 왼쪽 그대로 — 목록·설정처럼 부제·설명이 함께 서는 헤더에서
            제목만 가운데로 가면 두 줄이 어긋난 계단이 된다.
            ⚠️ 여기서 말하는 "가운데" 는 **이 칸의 가운데**다(헤더 전체의 가운데가 아니다).
            오른쪽 액션은 `flex:'none'` 으로 자기 폭을 갖고, 이 칸이 그 나머지를 채운다. 헤더
            절대 중앙에 맞추려면 왼쪽에 같은 폭의 빈 칸을 세워야 하는데, 그러면 긴 제목이
            훨씬 일찍 잘린다 — 제목을 읽는 것이 가운데 두는 것보다 중요하다. */}
        <div
          style={{
            fontSize: '0.9375rem',
            fontWeight: 700,
            letterSpacing: '-0.02rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5625rem',
            ...(config.compact ? { justifyContent: 'center' } : null),
          }}
        >
          {config.titleField ? (
            <HeaderTitleEditor cfg={config.titleField} centered={!!config.compact} />
          ) : (
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {config.title}
            </span>
          )}
          {config.badge && (
            <span
              style={{
                flex: 'none',
                fontSize: '0.625rem',
                fontWeight: 700,
                color: 'var(--accent-text)',
                border: '1px solid var(--accent)',
                padding: '0.125rem 0.4375rem',
                borderRadius: '0.375rem',
              }}
            >
              {config.badge}
            </span>
          )}
        </div>
        {/* compact 는 subtitle·description 을 안 그린다(§A) — 한 줄(제목·ⓘ·전환 버튼)만 남긴다. */}
        {!config.compact && config.subtitle && (
          <div
            style={{
              fontSize: '0.71875rem',
              color: 'var(--faint-text)',
              marginTop: '0.125rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {config.subtitle}
          </div>
        )}
        {!config.compact && config.description && <HeaderDescriptionEditor cfg={config.description} />}
      </div>

      <div style={{ marginLeft: 'auto', flex: 'none', display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
        {config.courtSwitch && <CourtSwitchControl cfg={config.courtSwitch} />}

        {config.search && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5625rem',
              padding: '0 0.8125rem',
              minHeight: 44,
              border: '1px solid var(--border)',
              borderRadius: '0.625rem',
              color: 'var(--faint-text)',
              fontSize: '0.8125rem',
              minWidth: 210,
            }}
          >
            <IconSearch />
            <span className="sr-only">{t('app.header.drillSearchLabel')}</span>
            <input
              type="search"
              id="drill-search"
              value={config.search.value}
              placeholder={config.search.placeholder ?? t('app.header.drillSearchPlaceholder')}
              onChange={(e) => config.search?.onChange(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                color: 'var(--text)',
                font: 'inherit',
                width: '100%',
              }}
            />
          </label>
        )}

        {config.primary && (
          <Button variant="primary" data-tut="header-primary" icon={config.primary.icon} disabled={config.primary.disabled} onClick={config.primary.onAction}>
            {config.primary.label}
          </Button>
        )}

        {/* 테마·버전 — **맨 끝**이다(기현 지시 2026-08-14: *"좁은창 헤더에서 테마 선택, 버전이
            오른 끝으로 가야 일관성 있다"*). 넓은 창의 84px 레일이 그 모양이라 그렇다: 이동은
            맨 위, 이 둘은 맨 끝. 좁은 창에서 레일이 접힐 때 넷을 왼쪽에 몰아 두면 같은 앱인데
            창 폭에 따라 두 물건의 관계가 달라진다 — 접는 것이지 재배치가 아니어야 한다.
            코트 전환·검색·주 액션보다 뒤인 이유: 자주 쓰는 것일수록 앞이고 테마는 한 번
            정하면 끝, 버전은 표적도 아니다. */}
        {narrow && <AppNavAside />}
      </div>
    </header>
  );
}

/** 드릴 이름 — 헤더 인라인 클릭 편집(2026-08-18, HeaderTitleField 머리말이 근거).
 *  HeaderDescriptionEditor 와 같은 관용구(표시 버튼 ↔ 편집 input, blur 커밋, Enter=blur 위임,
 *  Esc=되돌림)에 두 가지만 다르다: 글꼴이 제목 그대로(부모 div 에서 상속)이고, **trim 결과가
 *  비면 커밋하지 않는다**(이름 없는 드릴을 만들지 않는다 — 인터페이스 주석). */
function HeaderTitleEditor({ cfg, centered = false }: { cfg: HeaderTitleField; centered?: boolean }) {
  const [editing, setEditing] = useState(false);
  const t = useT();
  // 표시 버튼은 줄어들어 글자에 맞으므로 부모의 justifyContent 가 이미 가운데로 보낸다.
  // **입력 칸은 다르다** — 폭 100% 라 칸 자체는 늘 꽉 차고, 안의 글자가 왼쪽에 붙어 있으면
  // 편집을 시작하는 순간 제목이 가운데에서 왼쪽으로 뛴다. 그래서 글자 정렬을 함께 넘긴다.
  const textAlign = centered ? ('center' as const) : ('left' as const);

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        defaultValue={cfg.value}
        maxLength={cfg.maxLength}
        aria-label={t('app.header.drillNameLabel')}
        onBlur={(e) => {
          const v = e.target.value.trim().slice(0, cfg.maxLength);
          if (v.length > 0 && v !== cfg.value) cfg.onChange(v);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur(); // onBlur 가 커밋한다 — 경로를 둘로 안 만든다.
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.currentTarget.value = cfg.value; // 커밋 없이 되돌린다.
            setEditing(false);
          }
        }}
        style={{
          minWidth: 0,
          width: '100%',
          maxWidth: 360,
          font: 'inherit',
          letterSpacing: 'inherit',
          color: 'var(--text)',
          background: 'var(--elev)',
          border: '1px solid var(--border-strong)',
          borderRadius: '0.375rem',
          padding: '0.125rem 0.4375rem',
          textAlign,
        }}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={t('app.header.drillNameEditButton', { title: cfg.value })}
      title={t('app.header.drillNameEditHint')}
      onClick={() => setEditing(true)}
      style={{
        minWidth: 0,
        font: 'inherit',
        letterSpacing: 'inherit',
        color: 'var(--text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textAlign,
        padding: 0,
      }}
    >
      {cfg.value}
    </button>
  );
}

/** 드릴 설명 — 헤더 인라인 클릭 편집(§텍스트의 소속, 기현님 확정 2026-08-17).
 *
 *  두 모습이다: **표시**(버튼 — 값이 있으면 그 글, 비었으면 조용한 placeholder) ↔
 *  **편집**(text input, 클릭하면 바뀐다). InspectorPanel 의 [제목]·[설명] 필드와 같은
 *  커밋 관용구를 쓴다 — blur 에서 trim+slice 해서 넘긴다. 여기서 그대로 따르는 이유는
 *  드릴 메타(description)가 판이 아니라 목록 카드 부제·이 헤더 정도만 읽는 값이라,
 *  타이핑 중 계속 반영해야 할 소비자가 없어서다(적는 동안 따라올 것이 없다).
 *
 *  Enter = blur 위임(커밋), Esc = DOM 값을 되돌리고 표시 모드로 — 커밋하지 않는다. */
function HeaderDescriptionEditor({ cfg }: { cfg: HeaderDescriptionField }) {
  const [editing, setEditing] = useState(false);
  const t = useT();

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        defaultValue={cfg.value}
        maxLength={cfg.maxLength}
        placeholder={cfg.placeholder}
        aria-label={t('app.header.drillDescLabel')}
        onBlur={(e) => {
          const v = e.target.value.trim().slice(0, cfg.maxLength);
          if (v !== cfg.value) cfg.onChange(v);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur(); // 위 onBlur 가 커밋한다 — 경로를 둘로 안 만든다.
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.currentTarget.value = cfg.value; // 커밋 없이 되돌린다.
            setEditing(false);
          }
        }}
        style={{
          display: 'block',
          marginTop: '0.125rem',
          width: '100%',
          maxWidth: 360,
          fontSize: '0.71875rem',
          color: 'var(--text)',
          background: 'var(--elev)',
          border: '1px solid var(--border-strong)',
          borderRadius: '0.375rem',
          padding: '0.1875rem 0.4375rem',
        }}
      />
    );
  }

  const hasValue = cfg.value.length > 0;
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      style={{
        display: 'block',
        marginTop: '0.125rem',
        maxWidth: '100%',
        fontSize: '0.71875rem',
        color: 'var(--faint-text)',
        fontStyle: hasValue ? 'normal' : 'italic',
        opacity: hasValue ? 1 : 0.75,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textAlign: 'left',
      }}
    >
      {hasValue ? cfg.value : cfg.placeholder}
    </button>
  );
}

/** §6.8 "코트 모드 스위치는 v1 에서 불변" — §6.10 공 도구 제한과 동일 패턴으로 네이티브
 *  disabled 대신 aria-disabled + tabIndex 유지 + 클릭 시 토스트를 화면 쪽에서 띄운다
 *  (onLockedAttempt). 잠금 표시는 자물쇠 아이콘 12px. */
function CourtSwitchControl({ cfg }: { cfg: HeaderCourtSwitch }) {
  const locked = cfg.locked ?? true;
  const locale = useLocale();
  const t = useT();
  // 헤더 코트 스위치·설정 화면이 같은 라벨을 썼다 — model/court.ts 의 공용 딕셔너리에서
  // 로케일별로 뽑는다(둘이 각자 리터럴 배열을 들고 있던 것을 i18n C2 에서 합쳤다).
  const courtOptions = COURT_MODES.map((m) => ({ value: m, label: COURT_MODE_SHORT_LABELS[locale][m] }));
  if (!locked) {
    return (
      <Segmented
        ariaLabel={t('app.header.courtSwitchAriaLabel')}
        value={cfg.value}
        onChange={(v) => cfg.onChange?.(v as CourtMode)}
        options={courtOptions}
        dense
      />
    );
  }
  return (
    <div
      role="radiogroup"
      aria-label={t('app.header.courtSwitchLockedAriaLabel')}
      aria-describedby="court-lock-hint"
      style={{ display: 'flex', gap: '0.25rem', padding: '0.1875rem', border: '1px solid var(--border)', borderRadius: '0.625rem' }}
    >
      <span id="court-lock-hint" className="sr-only">
        {t('app.header.courtSwitchLockedHint')}
      </span>
      {courtOptions.map((opt) => {
        const active = opt.value === cfg.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled="true"
            aria-describedby="court-lock-hint"
            tabIndex={0}
            onClick={() => cfg.onLockedAttempt?.()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                cfg.onLockedAttempt?.();
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.375rem 0.6875rem',
              borderRadius: '0.4375rem',
              fontSize: '0.75rem',
              fontWeight: active ? 700 : 500,
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--accent-ink-strong)' : 'var(--muted)',
              opacity: active ? 1 : 0.6,
              cursor: 'not-allowed',
            }}
          >
            {!active && <IconLock />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}


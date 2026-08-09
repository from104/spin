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
import { IconLock, IconPresent, IconSearch, IconUndo, IconRedo } from '../ui/icons.tsx';
import type { CourtMode } from '../model/court.ts';

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
export interface HeaderConfig {
  title: string;
  subtitle?: string;
  /** 편집중 배지 등. */
  badge?: string;
  primary?: HeaderPrimaryAction | null;
  presentButton?: { onAction(): void } | null;
  search?: HeaderSearch | null;
  courtSwitch?: HeaderCourtSwitch | null;
  /** 편집기 되돌리기/다시하기. 단축키(Ctrl+Z/Y)만으로는 존재를 알 수 없어 버튼으로도 낸다. */
  history?: HeaderHistory | null;
}

export interface HeaderHistory {
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
}

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
    a.subtitle === b.subtitle &&
    a.badge === b.badge &&
    !!a.primary === !!b.primary &&
    a.primary?.label === b.primary?.label &&
    a.primary?.disabled === b.primary?.disabled &&
    !!a.presentButton === !!b.presentButton &&
    !!a.search === !!b.search &&
    a.search?.value === b.search?.value &&
    a.search?.placeholder === b.search?.placeholder &&
    !!a.courtSwitch === !!b.courtSwitch &&
    a.courtSwitch?.value === b.courtSwitch?.value &&
    a.courtSwitch?.locked === b.courtSwitch?.locked &&
    !!a.history === !!b.history &&
    a.history?.canUndo === b.history?.canUndo &&
    a.history?.canRedo === b.history?.canRedo
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
    config.subtitle,
    config.badge,
    config.primary ? [config.primary.label, config.primary.disabled ?? false] : null,
    !!config.presentButton,
    config.search ? [config.search.value, config.search.placeholder ?? ''] : null,
    config.courtSwitch ? [config.courtSwitch.value, config.courtSwitch.locked ?? true] : null,
    config.history ? [config.history.canUndo, config.history.canRedo] : null,
  ]);

  useEffect(() => {
    if (!ctxRef.current) return;
    const c = latest.current;
    ctxRef.current.publish({
      title: c.title,
      subtitle: c.subtitle,
      badge: c.badge,
      primary: c.primary ? { ...c.primary, onAction: () => latest.current.primary?.onAction() } : null,
      presentButton: c.presentButton ? { onAction: () => latest.current.presentButton?.onAction() } : null,
      search: c.search
        ? { value: c.search.value, placeholder: c.search.placeholder, onChange: (v) => latest.current.search?.onChange(v) }
        : null,
      history: c.history
        ? {
            canUndo: c.history.canUndo,
            canRedo: c.history.canRedo,
            onUndo: () => latest.current.history?.onUndo(),
            onRedo: () => latest.current.history?.onRedo(),
          }
        : null,
      courtSwitch: c.courtSwitch
        ? {
            value: c.courtSwitch.value,
            locked: c.courtSwitch.locked ?? true,
            onLockedAttempt: () => latest.current.courtSwitch?.onLockedAttempt?.(),
            onChange: (m) => latest.current.courtSwitch?.onChange?.(m),
          }
        : null,
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

const COURT_SWITCH_OPTIONS = [
  { value: 'full' as const, label: '풀' },
  { value: 'half' as const, label: '하프' },
  { value: 'flat' as const, label: '플랫' },
];

const HEADER_STYLE: CSSProperties = {
  flex: 'none',
  height: '3.875rem',
  minHeight: 62,
  display: 'flex',
  alignItems: 'center',
  gap: '0.875rem',
  padding: '0 1.5rem',
  borderBottom: '1px solid var(--border)',
  background: 'var(--panel)',
};

/** 프로토타입 62px 헤더. `config` 를 직접 받으면 그걸 그린다 — home/library/settings 는
 *  app-shell 에 의존할 수 없어(§8) useAppHeader 로 스스로를 알릴 수 없으므로 AppShell 이 정적으로
 *  계산해 여기 꽂는다. `config` 를 생략하면(editor/present) HeaderProvider 구독으로 돌아간다 —
 *  그 두 화면은 courtMode·저장 상태처럼 화면 전용 Provider 안의 값이 필요해서 useAppHeader 로
 *  스스로 선언해야 한다. */
export function AppHeader({ config: override }: { config?: HeaderConfig }) {
  const ctx = useContext(HeaderContext);
  const config = override ?? ctx?.config ?? EMPTY_CONFIG;

  return (
    <header style={HEADER_STYLE}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.02rem', display: 'flex', alignItems: 'center', gap: '0.5625rem' }}>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {config.title}
          </span>
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
        {config.subtitle && <div style={{ fontSize: '0.71875rem', color: 'var(--faint-text)', marginTop: '0.125rem' }}>{config.subtitle}</div>}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        {config.history && <HistoryControl cfg={config.history} />}
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
            <span className="sr-only">드릴 검색</span>
            <input
              type="search"
              id="drill-search"
              value={config.search.value}
              placeholder={config.search.placeholder ?? '드릴 검색…'}
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

        {config.presentButton && (
          <Button variant="secondary" icon={<IconPresent size={15} />} onClick={config.presentButton.onAction}>
            시연
          </Button>
        )}

        {config.primary && (
          <Button variant="primary" icon={config.primary.icon} disabled={config.primary.disabled} onClick={config.primary.onAction}>
            {config.primary.label}
          </Button>
        )}
      </div>
    </header>
  );
}

/** §6.8 "코트 모드 스위치는 v1 에서 불변" — §6.10 공 도구 제한과 동일 패턴으로 네이티브
 *  disabled 대신 aria-disabled + tabIndex 유지 + 클릭 시 토스트를 화면 쪽에서 띄운다
 *  (onLockedAttempt). 잠금 표시는 자물쇠 아이콘 12px. */
function CourtSwitchControl({ cfg }: { cfg: HeaderCourtSwitch }) {
  const locked = cfg.locked ?? true;
  if (!locked) {
    return (
      <Segmented
        ariaLabel="코트 형태"
        value={cfg.value}
        onChange={(v) => cfg.onChange?.(v as CourtMode)}
        options={COURT_SWITCH_OPTIONS}
        dense
      />
    );
  }
  return (
    <div
      role="radiogroup"
      aria-label="코트 형태(변경 불가)"
      aria-describedby="court-lock-hint"
      style={{ display: 'flex', gap: '0.25rem', padding: '0.1875rem', border: '1px solid var(--border)', borderRadius: '0.625rem' }}
    >
      <span id="court-lock-hint" className="sr-only">
        코트 형태는 드릴을 만든 뒤에는 바꿀 수 없습니다.
      </span>
      {COURT_SWITCH_OPTIONS.map((opt) => {
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

/** 되돌리기·다시하기. 단축키(Ctrl+Z / Ctrl+Shift+Z)만 있으면 기능이 있다는 사실 자체를
 *  알 수 없어 버튼으로도 낸다. 히스토리가 비면 disabled 로 두되(자명한 비활성), 툴팁에
 *  단축키를 적어 키보드 사용자가 옮겨갈 수 있게 한다. */
function HistoryControl({ cfg }: { cfg: HeaderHistory }) {
  const btn = (enabled: boolean) => ({
    width: 44,
    height: 44,
    borderRadius: '0.625rem',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: enabled ? 'var(--text)' : 'var(--faint-text)',
    opacity: enabled ? 1 : 0.45,
    cursor: enabled ? 'pointer' : 'default',
  });
  return (
    <div style={{ display: 'flex', gap: '0.25rem' }}>
      <button
        type="button"
        aria-label="되돌리기"
        title="되돌리기 (Ctrl+Z)"
        disabled={!cfg.canUndo}
        onClick={cfg.onUndo}
        style={btn(cfg.canUndo)}
      >
        <IconUndo />
      </button>
      <button
        type="button"
        aria-label="다시하기"
        title="다시하기 (Ctrl+Shift+Z)"
        disabled={!cfg.canRedo}
        onClick={cfg.onRedo}
        style={btn(cfg.canRedo)}
      >
        <IconRedo />
      </button>
    </div>
  );
}

import { useRef } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** 아이콘만 있는 항목처럼 시각 라벨과 접근 가능한 이름이 다를 때. */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** 컨테이너 `aria-label` — 코트 스위치·테마·속도·포메이션·카테고리 필터 각각의 용도. */
  ariaLabel: string;
  /** 카테고리 알약처럼 촘촘한 그룹은 §7.1 예외로 44px 대신 40px 을 허용한다. */
  dense?: boolean;
  id?: string;
}

// §7.7: 세그먼티드(코트 스위치·테마·속도·포메이션)·카테고리 알약은 컨테이너 role="radiogroup" +
// aria-label, 항목 role="radio" aria-checked, 좌우 방향키 순회 + 로빙 tabindex.
// 활성 표시는 배경색 외에 font-weight:700 차이도 준다.
// §7.4: 텍스트 컴포넌트라 rem 으로 쓴다. 폰트 하한 11px(0.6875rem)을 지킨다.
export function Segmented<T extends string>({ options, value, onChange, ariaLabel, dense, id }: SegmentedProps<T>) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // 비활성 항목도 순회 대상에 포함한다(§7.8 "aria-disabled 처리" — 건너뛰면 스크린리더가
  // 비활성 사유를 읽을 기회가 없다). tabIndex=-1 이어도 ref.focus() 는 항상 동작한다.
  const moveFocus = (index: number) => {
    const n = options.length;
    const next = ((index % n) + n) % n;
    itemRefs.current[next]?.focus();
    const opt = options[next];
    if (!opt.disabled) onChange(opt.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(index + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      moveFocus(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      moveFocus(options.length - 1);
    }
  };

  const containerStyle: CSSProperties = {
    display: 'inline-flex',
    gap: dense ? '0.5rem' : '0.25rem',
    padding: dense ? 0 : '0.25rem',
    borderRadius: '0.75rem',
    background: dense ? 'transparent' : 'var(--elev)',
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} id={id} style={containerStyle}>
      {options.map((opt, i) => {
        const active = opt.value === value;
        const itemStyle: CSSProperties = {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          minHeight: dense ? '2.5rem' : 'var(--hit)',
          padding: dense ? '0.5rem 1.125rem' : '0.4rem 0.9rem',
          borderRadius: dense ? '0.6rem' : '0.55rem',
          fontSize: '0.8125rem',
          fontWeight: active ? 700 : 500,
          border: dense && !active ? '1px solid var(--border)' : '1px solid transparent',
          background: active ? 'var(--accent)' : 'transparent',
          color: active ? 'var(--accent-ink-strong)' : 'var(--muted)',
          opacity: opt.disabled ? 0.5 : 1,
          cursor: opt.disabled ? 'not-allowed' : 'pointer',
        };
        return (
          <button
            key={opt.value}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.ariaLabel}
            aria-disabled={opt.disabled || undefined}
            tabIndex={active ? 0 : -1}
            className={active ? 'on-accent' : undefined}
            style={itemStyle}
            onClick={() => !opt.disabled && onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

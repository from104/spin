import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'warning';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

const TONE_COLOR: Record<BadgeTone, string> = {
  neutral: 'var(--faint-text)',
  accent: 'var(--accent-text)',
  warning: '#e08a12',
};

/** 카운트·상태 배지 — 도구 레일의 `10/10` 공 개수, 스텝 `n/N` 등 짧은 숫자·상태 표시.
 *  §6.10: "n ≥ 8 이면 --accent-text". */
export function Badge({ tone = 'neutral', className, style, children, ...rest }: BadgeProps) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.6875rem',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    color: TONE_COLOR[tone],
  };
  return (
    <span className={className} style={{ ...base, ...style }} {...rest}>
      {children}
    </span>
  );
}

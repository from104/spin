import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { TYPE_FALLBACK_COLOR, inkFor } from '../core/colors.ts';

export type PillTone = 'neutral' | 'accent' | 'category';

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  /** tone="category" 일 때 배경색. 글자색은 `inkFor()` 로 유도한다(§2.9). */
  color?: string;
  children: ReactNode;
}

/** 정적 라벨 칩 — 드릴 카드의 카테고리 태그, 코트 배지 등. 상호작용하는 단일/복수
 *  선택 그룹(코트 스위치·카테고리 필터)은 `Segmented` 가 담당한다(§7.7). */
export function Pill({ tone = 'neutral', color, className, style, children, ...rest }: PillProps) {
  const bg = tone === 'category' ? (color ?? 'var(--elev)') : tone === 'accent' ? 'var(--accent)' : 'var(--elev)';
  const fg =
    tone === 'category'
      ? inkFor(color ?? TYPE_FALLBACK_COLOR)
      : tone === 'accent'
        ? 'var(--accent-ink-strong)'
        : 'var(--muted)';
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.2rem 0.6rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.3,
    background: bg,
    color: fg,
  };
  return (
    <span className={className} style={{ ...base, ...style }} {...rest}>
      {children}
    </span>
  );
}

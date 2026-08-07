import type { CSSProperties, ReactNode } from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  id?: string;
}

const TRACK_W = 46;
const TRACK_H = 26;
const THUMB = 20;

/** 설정 토글 46×26 — §7.3 "래퍼 min-height:44". `role="switch"` 버튼 하나가 트랙+라벨을
 *  전부 감싸 클릭 영역을 넓힌다. Space/Enter 는 네이티브 button 클릭으로 처리되므로
 *  별도 키보드 핸들러가 필요 없다. */
export function Toggle({ checked, onChange, label, ariaLabel, ariaDescribedBy, id }: ToggleProps) {
  const wrapperStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.625rem',
    minHeight: 'var(--hit)',
  };
  const trackStyle: CSSProperties = {
    flex: 'none',
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    background: checked ? 'var(--accent)' : 'var(--elev)',
    border: '1px solid var(--border)',
    position: 'relative',
    transition: 'background .15s ease',
  };
  const thumbStyle: CSSProperties = {
    position: 'absolute',
    top: (TRACK_H - THUMB) / 2 - 1,
    left: checked ? TRACK_W - THUMB - 3 : 2,
    width: THUMB,
    height: THUMB,
    borderRadius: '50%',
    background: checked ? 'var(--accent-ink-strong)' : 'var(--muted)',
    transition: 'left .15s ease',
  };
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      onClick={() => onChange(!checked)}
      style={{ ...wrapperStyle, background: 'transparent', border: 'none' }}
    >
      <span style={trackStyle}>
        <span style={thumbStyle} />
      </span>
      {label !== undefined && <span style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{label}</span>}
    </button>
  );
}

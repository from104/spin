import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  fullWidth?: boolean;
}

// §7.3 주 조작 컨트롤 44×44 이상 → min-height: var(--hit). §7.4 텍스트 컴포넌트는 rem 으로 쓴다.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', icon, fullWidth, className, style, disabled, children, ...rest },
  ref,
) {
  const disabledLike = disabled || rest['aria-disabled'] === true || rest['aria-disabled'] === 'true';
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    minHeight: 'var(--hit)',
    padding: '0 1rem',
    borderRadius: '0.7rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1,
    width: fullWidth ? '100%' : undefined,
    border: variant === 'secondary' ? '1px solid var(--border)' : '1px solid transparent',
    background: variant === 'primary' ? 'var(--accent)' : 'transparent',
    color: variant === 'primary' ? 'var(--accent-ink-strong)' : 'var(--text)',
    opacity: disabledLike ? 0.5 : 1,
    cursor: disabledLike ? 'not-allowed' : 'pointer',
  };
  const onAccentClass = variant === 'primary' ? 'on-accent' : '';
  return (
    <button
      ref={ref}
      type="button"
      className={[onAccentClass, className].filter(Boolean).join(' ')}
      disabled={disabled}
      style={{ ...base, ...style }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

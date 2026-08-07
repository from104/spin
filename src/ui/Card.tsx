import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react';

interface CardOwnProps {
  interactive?: boolean;
  children: ReactNode;
}

export type CardProps =
  | ({ as?: 'div' } & CardOwnProps & HTMLAttributes<HTMLDivElement>)
  | ({ as: 'button' } & CardOwnProps & ButtonHTMLAttributes<HTMLButtonElement>)
  | ({ as: 'a' } & CardOwnProps & AnchorHTMLAttributes<HTMLAnchorElement>);

const BASE: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '1.125rem',
  borderRadius: '1rem',
  border: '1px solid var(--border)',
  background: 'var(--panel)',
  color: 'inherit',
  textAlign: 'left',
};

/** 대문·라이브러리 카드 컨테이너. `interactive` 는 카드 전체가 클릭 가능한 경우
 *  (§6.11 "대문 '다음 훈련 세션' 카드는... 카드 전체가 버튼")에 hover/포커스 표시를 켠다. */
export function Card(props: CardProps) {
  const { as = 'div', interactive, className, style, children, ...rest } = props;
  const interactiveStyle: CSSProperties = interactive
    ? { cursor: 'pointer', transition: 'border-color .15s ease' }
    : {};
  const finalStyle = { ...BASE, ...interactiveStyle, ...style };
  if (as === 'button') {
    return (
      <button type="button" className={className} style={finalStyle} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
        {children}
      </button>
    );
  }
  if (as === 'a') {
    return (
      <a className={className} style={finalStyle} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }
  return (
    <div className={className} style={finalStyle} {...(rest as HTMLAttributes<HTMLDivElement>)}>
      {children}
    </div>
  );
}

import type { ElementType, ReactNode } from 'react';

interface VisuallyHiddenProps {
  as?: ElementType;
  children: ReactNode;
}

/** §7.2 `.sr-only` — 시각적으로 숨기되 스크린리더에는 노출한다. */
export function VisuallyHidden({ as: Tag = 'span', children }: VisuallyHiddenProps) {
  return <Tag className="sr-only">{children}</Tag>;
}

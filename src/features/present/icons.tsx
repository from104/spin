// §6.9 시연 전용 아이콘 — ui-kit(§8 icons.tsx 소유)에 없는 것만 로컬로 그린다(DrillCard 의
// IconMore 로컬 아이콘과 같은 선례).
import type { SVGProps } from 'react';

export type IconProps = { size?: number } & Omit<SVGProps<SVGSVGElement>, 'width' | 'height'>;

const strokeBase = {
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconFullscreenEnter({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
    </svg>
  );
}

export function IconFullscreenExit({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M9 4v4a1 1 0 0 1-1 1H4M15 4v4a1 1 0 0 0 1 1h4M9 20v-4a1 1 0 0 0-1-1H4M15 20v-4a1 1 0 0 1 1-1h4" />
    </svg>
  );
}

export function IconLoop({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" />
      <path d="M18 3v4h-4M6 21v-4h4" />
    </svg>
  );
}

export function IconHelp({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M9.3 9.3a2.7 2.7 0 1 1 4 2.35c-.85.5-1.3 1-1.3 2.05" />
      <circle cx="12" cy="17" r="0.35" fill="currentColor" stroke="none" />
    </svg>
  );
}

import type { SVGProps } from 'react';

// docs/prototype/logic.js 의 navDefs·toolDefs, docs/prototype/template.html 인라인 svg 를
// 이식한 아이콘 세트. 프로토타입은 svg 문자열을 dangerouslySetInnerHTML 로 박아 넣었지만
// 여기서는 정식 JSX 컴포넌트로 옮긴다.
// 버튼 안 장식 아이콘이므로 기본 aria-hidden — 접근 가능한 이름은 부모 버튼의 aria-label 이 맡는다(§7.7).

export type IconProps = { size?: number } & Omit<SVGProps<SVGSVGElement>, 'width' | 'height'>;

const strokeBase = {
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const fillBase = { fill: 'currentColor' as const };

// ── 레일 내비게이션 (navDefs, 기본 19px) ─────────────────────────────
export function IconHome({ size = 19, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V21h13V9.5" />
    </svg>
  );
}

export function IconLibrary({ size = 19, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  );
}

export function IconEditor({ size = 19, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M15.5 4.5 19.5 8.5 8 20H4v-4z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </svg>
  );
}

export function IconPresent({ size = 19, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M12 16v4M8.5 20h7" />
    </svg>
  );
}

export function IconSettings({ size = 19, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M4.2 7.2l2.6 1.5M17.2 15.3l2.6 1.5M4.2 16.8l2.6-1.5M17.2 8.7l2.6-1.5" />
    </svg>
  );
}

// ── 편집기 도구 8종 (toolDefs, 기본 18px) — §6.10 ──────────────────────
export function IconToolSelect({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M3 3l7.5 18 2.3-7.2L20 11.5z" />
    </svg>
  );
}

export function IconToolRoute({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M4 20c8 0 8-14 16-14" />
      <path d="M14 6h6v6" />
    </svg>
  );
}

export function IconToolPass({ size = 18, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable={false}
      {...strokeBase}
      strokeDasharray="3 3"
      {...rest}
    >
      <path d="M4 12h13" />
      <path d="M13 7l6 5-6 5" />
    </svg>
  );
}

export function IconToolBall({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5v17" opacity=".55" />
    </svg>
  );
}

/** 콘 도구. 프로토타입에는 없던 도구라(부록 A, §6.10) render-court 의 `ConeMark` 실루엣을
 *  본떠 채운 삼각형 + 밑변 사각 베이스로 새로 그렸다. */
export function IconToolCone({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...fillBase} {...rest}>
      <path d="M12 3.5 19 18h-14z" />
      <path d="M6.5 16h11v3h-11z" />
    </svg>
  );
}

export function IconToolPlayer({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <rect x="5" y="4" width="9" height="13" rx="2" />
      <path d="M18 8v6M15 11h6" />
    </svg>
  );
}

export function IconToolNote({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M5 6h14M12 6v13" />
    </svg>
  );
}

export function IconToolErase({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M4 16l7-7 7 7-4 4H8z" />
      <path d="M9 21h11" />
    </svg>
  );
}

// ── 헤더 · 공용 (template.html 인라인) ──────────────────────────────
export function IconSun({ size = 17, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconMoon({ size = 17, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export function IconSearch({ size = 15, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function IconPlus({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable={false}
      {...strokeBase}
      strokeWidth={2.6}
      {...rest}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconClose({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconLevel({ size = 13, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
    </svg>
  );
}

export function IconClock({ size = 13, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconListSteps({ size = 13, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}

export function IconChevronPrev({ size = 14, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...fillBase} {...rest}>
      <path d="M6 5h2v14H6zM20 5v14l-11-7z" />
    </svg>
  );
}

export function IconChevronNext({ size = 14, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...fillBase} {...rest}>
      <path d="M16 5h2v14h-2zM4 5l11 7-11 7z" />
    </svg>
  );
}

export function IconPlay({ size = 16, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...fillBase} {...rest}>
      <path d="M7 5v14l12-7z" />
    </svg>
  );
}

export function IconPause({ size = 16, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...fillBase} {...rest}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

/** 헤더 코트 알약 잠금 표시 12px — §6.8 "코트 모드 스위치는 v1 에서 불변이다". */
export function IconLock({ size = 12, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <rect x="5" y="10" width="14" height="9" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** 팀 색 스와치 선택 표시 안쪽 체크 — §7.7. */
export function IconCheck({ size = 14, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M5 12l5 5L19 7" />
    </svg>
  );
}

/** 세션 드로어 드릴 목록 드래그 핸들 — §6.11 "⠿". 폰트 글리프 대신 아이콘으로 그려
 *  기기별 Braille 문자 렌더링 편차를 피한다. */
export function IconGripDots({ size = 16, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...fillBase} {...rest}>
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

/** 되돌리기 — 반시계 화살표. 다시하기(IconRedo)와 좌우 대칭이라 나란히 놓으면 방향이 읽힌다. */
export function IconUndo({ size = 17, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

/** 다시하기 — IconUndo 의 좌우 반전. */
export function IconRedo({ size = 17, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </svg>
  );
}

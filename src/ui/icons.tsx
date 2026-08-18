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
/** 레일 첫 항목 = **판**. 2026-08-12 재편(screens.ts:10)에서 화면 키만 `home`→`board` 로
 *  개명하고 그림은 프로토타입의 집(`M3 10.5 12 3l9 7.5`)을 그대로 뒀던 것을 2026-08-14
 *  기현님 지시로 판(코트)으로 바꿨다 — 레일에는 대문이 없고 판이 있다.
 *
 *  그림 결정 셋:
 *  · **가운데 원을 그리지 않는다.** FIPFA Laws 2025 에 센터 서클이 없다(5차에서 코트 그림에서도
 *    걷어냈다). 흔한 축구공/센터서클 아이콘을 그대로 쓰면 아이콘이 규칙과 어긋난 그림을 가르친다.
 *  · **골 지역 ㄷ자 둘 + 하프웨이 선**으로 판임을 말한다. 이 셋이 이 종목 코트의 전부다.
 *  · 안쪽 선만 `strokeWidth 1.6` — 19px 로 줄면 외곽선(2)과 골 지역 선 사이 여백이 2.2 단위
 *    (≈1.7px)까지 좁아진다. 안쪽을 굵게 두면 둘이 뭉개져 그냥 사각형이 된다. */
export function IconBoard({ size = 19, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <rect x="2" y="5.5" width="20" height="13" rx="2" />
      <path d="M12 5.5v13" strokeWidth={1.6} />
      <path d="M2 9h4v6H2M22 9h-4v6h4" strokeWidth={1.6} />
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

/** 세션(훈련 한 회의 계획) — 클립보드 + 목록 줄. C5(2026-08-18)에서 레일 4번째 항목으로
 *  합류했다. 드릴(格子 IconLibrary)과 구분되는 "순서 있는 목록" 은유다. */
export function IconSessions({ size = 19, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <rect x="4.5" y="4" width="15" height="17" rx="2" />
      <path d="M9 4V2.8h6V4" strokeWidth={1.6} />
      <path d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4.5" strokeWidth={1.6} />
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

// 복제(§복제, 기현님 확정 2026-08-17) — 스텝 카드 복제 버튼·틈(gap) + 버튼이 함께 쓴다.
// 겹친 두 네모의 익숙한 '복사' 문법. 앞 네모(원본)는 실선, 뒤 네모(복제본)는 앞 네모에
// 가려 보이는 모서리만 실선으로 그려 "하나가 늘어난다"는 인상을 준다.
export function IconCopy({ size = 14, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M6 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V6" />
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

/** 사슬 토글(④, 기현님 확정 2026-08-17) — 스텝 사이 틈(내부 경계에만)에 다는 연결 표시.
 *  기본은 연결이라 조용한 두 고리(맞물림)만 그린다. 끊긴 쪽(IconChainCut)과 **뷰박스·고리
 *  크기를 맞춰** 두 그림이 "같은 것의 이어진/끊긴 버전"으로 한눈에 읽히게 한다. */
export function IconChainLinked({ size = 12, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <rect x="2.5" y="8" width="10" height="8" rx="4" />
      <rect x="11.5" y="8" width="10" height="8" rx="4" />
    </svg>
  );
}

/** 끊김. 색만으로 구별하지 않는다(계획서 §사슬 "색만이 아니라 모양·aria 로도 구분") — 두 고리를
 *  벌리고 그 틈을 대각선으로 가른다. IconChainLinked 와 같은 고리 크기·자리를 양옆으로 밀어냈을
 *  뿐이라 "끊어졌다" 는 것이 형태 자체에서 나온다(테두리 색만 accent 로 바꾸는 흔한 실수를 피함). */
export function IconChainCut({ size = 12, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <rect x="1" y="8" width="8" height="8" rx="4" />
      <rect x="15" y="8" width="8" height="8" rx="4" />
      <path d="M5 19 19 5" />
    </svg>
  );
}

/** 도구 고정(연속 배치) 배지 — §6.10a.
 *
 *  ⚠️ **자물쇠(IconLock)를 쓰지 않는다.** 이 앱에서 자물쇠는 이미 "이 개체는 안 움직인다"
 *  (개체 잠금 플래그)라는 다른 뜻을 갖고 있어서, 같은 글리프를 도구 쪽에 쓰면 코치는
 *  "이 도구가 잠겨서 못 쓴다" 로 읽는다 — 뜻이 정반대다. 핀은 '꽂아 둔다' 라 겹치지 않는다. */
export function IconPin({ size = 9, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M9 3h6l-1 6 4 4H6l4-4-1-6Z" />
      <path d="M12 13v8" />
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

// ── 오른쪽 기능 바(2026-08-14 기현님 재설계) ────────────────────────────────────────────
// 헤더의 코트 전환·하단 바의 [코트 비우기]·[내보내기]·속도 제한·[보기]가 한 기둥으로 모이면서
// 각자 아이콘이 필요해졌다. 바에서는 아이콘 아래 2~4자 이름이 함께 서므로 **아이콘 혼자
// 뜻을 다 지지 않아도 된다** — 글자가 못 하는 일(한눈에 자리를 찾는 것)만 맡는다.

/** 골대 원위치 — 골대(ㄷ자)와 제자리로 돌아가는 화살표. */
export function IconGoalReset({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M5 4v9M19 4v9M5 4h14" />
      <path d="M12 22V15m0 0-3 3m3-3 3 3" />
    </svg>
  );
}

/** 진영 바꾸기 — 세로선(골라인/하프라인) 양쪽의 **깃발 둘**이 자리를 맞바꾼다.
 *  화살표를 쓰지 않는 이유: 되돌리기·다시하기와 같은 굽은 화살표가 이미 기둥에 둘 있어,
 *  세 번째 화살표가 그 둘과 한 덩어리로 읽힌다. 이 버튼이 바꾸는 것은 **자리**다.
 *
 *  ⚠️ 2026-08-16 — 원 둘에서 삼각 깃발 둘로 바꿨다. 이 버튼이 뒤집는 것은 판 위의 진영
 *  표시(SideMarks)이고, 그것이 원을 버린 순간 이 아이콘만 옛 모양으로 남으면 버튼이
 *  무엇을 뒤집는지가 안 보인다. **판의 모양이 바뀌면 이 아이콘도 함께 바뀐다.**
 *  같은 날 두 번째·세 번째 지시로 **깃대에 매달린 페넌트 둘**이 되었고 **둘 다 오른쪽**을
 *  향한다 — 판에서 그렇기 때문이다. 표식과 그것을 세는 선을 잇던 짧은 선은 지웠다: 깃대가
 *  생기면서 획이 여섯이 되어 18 px 에서 뭉갰고, 가운데 세로선만으로도 "양쪽" 은 읽힌다. */
export function IconSides({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M12 3v18" strokeWidth={1.6} />
      <path d="M4 4v8.2M4 4v6l5.2-3Z" strokeWidth={1.6} />
      <path d="M14.5 9.5v8.2m0-8.2v6l5.2-3Z" strokeWidth={1.6} />
    </svg>
  );
}

/** 코트 비우기 — 쓸어 담는 통. 파괴적 동작이라 뚜껑이 열린 모양으로 그린다. */
export function IconClear({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
    </svg>
  );
}

/** 내보내기 — 상자 밖으로 나가는 화살표(공유가 아니라 **꺼내기**다: 인쇄·이미지·백업). */
export function IconExport({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M12 15V3m0 0-4 4m4-4 4 4" />
      <path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}

/** 속도 제한 — 계기판 바늘. 숫자가 아니라 **한계**를 말하는 그림이다. */
export function IconSpeed({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M3.5 17a9 9 0 1 1 17 0" />
      <path d="M12 17l4.5-5" />
    </svg>
  );
}

/** 보기(격자·골 지역 가이드·도움말) — 눈. 판을 **바꾸지 않고 보는 방식만** 바꾸는 것들이다. */
export function IconEye({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

/** 격자 — 예전에는 '#' 글자였다. [보기] 가 팝오버에서 **서랍**으로 바뀌면서(2026-08-16) 하위
 *  항목이 기능 바 칸과 같은 모양(아이콘 + 2~4자)이 됐고, 글자 하나를 아이콘 자리에 세우면
 *  그 밑의 이름 줄과 같은 말을 두 번 하게 된다. 획 넷은 실제 격자와 같은 뜻이다. */
export function IconGrid({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}

/** 골 지역 가이드 — 골라인 + ㄷ자 하나. IconBoard 는 판 전체를 말하느라 ㄷ자를 **둘** 그리는데,
 *  여기서 말하는 것은 "그 구획을 켠다" 라 하나면 족하고, 18px 에서 둘은 뭉갠다. */
export function IconRuleZone({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M4 3v18" />
      <path d="M4 7.5h8v9H4" />
    </svg>
  );
}

/** 도움말 — 2026-08-16 기현 지시로 [보기] 안에서 **기둥 상시 칸**으로 나왔다. 한 번에 닿아야
 *  하는 것이 메뉴 안에 있었다. */
export function IconHelp({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.3a2.6 2.6 0 1 1 3.3 3.2c-.6.2-.8.7-.8 1.3v.3" />
      <path d="M12 17.1v.8" />
    </svg>
  );
}

/** 확대(줌 인) — 돋보기에 +. 옛 ZoomGroup 은 IconPlus 만 썼는데, 기능 바에서는 [코트]·[골대]와
 *  나란히 서므로 "무엇에 대한 +인가" 가 그림에 있어야 한다. */
export function IconZoomIn({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
      <path d="M10.5 7.5v6M7.5 10.5h6" />
    </svg>
  );
}

/** 축소(줌 아웃) — IconZoomIn 과 한 획만 다르다. 나란히 놓였을 때 그 한 획이 유일한 차이라야
 *  방향을 헷갈리지 않는다. */
export function IconZoomOut({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
      <path d="M7.5 10.5h6" />
    </svg>
  );
}

/** 줌 초기화 — 코트 테두리에 딱 맞추는 네 모서리. '100%' 라는 글자를 아이콘으로 쓰면
 *  2~4자 이름과 겹쳐 같은 말을 두 번 하게 된다. */
export function IconZoomReset({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

/** 드릴로 저장 — 라이브러리(책 세 권)에 **+**. 옛 자리는 헤더의 주 액션 버튼이었고 글자였다
 *  ([드릴로 저장]). 기능 바로 내려오면서 그림이 필요해졌는데, "저장" 의 통상 기호(플로피)는
 *  이 앱에서 거짓말이다 — 자유 전술판은 **이미** 저장되어 있고(스냅샷), 이 버튼이 하는 일은
 *  그 판을 **드릴 라이브러리에 새 항목으로 넣는 것**이다. 그래서 라이브러리 + 다. */
export function IconSaveDrill({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M4 4v16M8.5 4v16M13 4v16" />
      <path d="M18.5 12v8M14.5 16h8" />
    </svg>
  );
}

// ── 작도 도형 3종 (2026-08-14 기현 지시) ────────────────────────────────────────────────
// 면을 채우지 않고 **테두리만** 그린다: 실제 도형이 반투명 면이라, 아이콘까지 면을 채우면
// 옆의 이동·패스(선 도구)와 무게가 달라 서랍 안에서 이 셋만 튀어 보인다.

/** 원(타원) 도형. 정원이 아니라 **타원**으로 그린다 — 가로·세로를 따로 늘릴 수 있다는 것이
 *  이 도구의 성질이고, 아이콘이 정원이면 그 성질이 그림에서 사라진다. */
export function IconShapeEllipse({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <ellipse cx="12" cy="12" rx="9" ry="6.5" />
    </svg>
  );
}

/** 정삼각형 도형 — 크기를 바꿔도 정삼각형을 유지한다(기현 결정)는 것을 그림이 미리 말한다. */
export function IconShapeTriangle({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <path d="M12 4 21 19H3Z" />
    </svg>
  );
}

/** 사각형 도형. 모서리를 살짝 둥글리는 이유는 코트 칩·상자와 같은 리듬이기 때문이다. */
export function IconShapeRect({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...strokeBase} {...rest}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    </svg>
  );
}

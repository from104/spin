// 4개 드래그 존의 글리프와 그것으로 만든 마우스 커서.
// ZoneHandles(핸들 원)와 ChairChip(차체 위 존 구간)이 같은 그림을 써야 "이 핸들 = 이 구간"
// 이 읽히므로 한 곳에 둔다.
import type { DragZone } from '../model/chair.ts';

/** viewBox −6..6 기준으로 그린 존 글리프. 네 개가 똑같이 생긴 흰 원이면 어느 게 무슨 동작인지
 *  알 수 없다 — 차체 어디를 잡느냐로 동작이 갈리는 게 이 앱의 핵심 조작이라 그림이 곧 설명이다. */
export const ZONE_GLYPH: Record<DragZone, string> = {
  // ← 뒤로 끌기
  towRear: 'M3.6,-3.4 L-3.4,0 L3.6,3.4 M-3.4,0 H4.2',
  // ✥ 사방 이동
  translate:
    'M0,-4.4 V4.4 M-4.4,0 H4.4 M0,-4.4 L-1.6,-2.8 M0,-4.4 L1.6,-2.8 M0,4.4 L-1.6,2.8 M0,4.4 L1.6,2.8 M-4.4,0 L-2.8,-1.6 M-4.4,0 L-2.8,1.6 M4.4,0 L2.8,-1.6 M4.4,0 L2.8,1.6',
  // ↻ 제자리 회전
  spin: 'M3.9,-1.2 A4.1,4.1 0 1 1 1.2,-3.9 M1.0,-4.6 L2.2,-3.6 L0.9,-2.5',
  // → 앞으로 끌기
  towFront: 'M-3.6,-3.4 L3.4,0 L-3.6,3.4 M3.4,0 H-4.2',
};

// ── 견인 존 커서 — 줄을 쥔 손 ─────────────────────────────────────────────────────────
// 핸들에 그리는 ←/→ 는 칩 로컬 프레임이라 차체와 함께 돌아 항상 맞는 방향을 가리킨다.
// 하지만 **마우스 커서는 회전시킬 수 없다** — 차체가 도는 동안 고정된 화살표는 곧 엉뚱한
// 쪽을 가리킨다. 그래서 커서만은 방향 없는 그림으로 둔다: 줄을 쥐고 있다는 사실 자체가
// "이건 끌고 가는 조작" 이라는 정보고, 방향은 화면의 리시와 핸들이 이미 보여 준다.

/** 줄 — 쥔 손을 가로질러 양쪽으로 빠져나간다. 검정 밑선 + 흰 심으로 어떤 배경에서도 보이게. */
const rope = (y: number): string =>
  `<path d="M-10,${y} H10" stroke="#0b0f14" stroke-width="3.2" stroke-linecap="round"/>` +
  `<path d="M-10,${y} H10" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>`;

const GRIP_ART =
  rope(-4.5) +
  // 쥔 손 — 위쪽 아치 세 개가 접힌 손가락 마디다. 네모+세로선으로 그리면 24px 에서
  // 아령처럼 보여 손으로 안 읽힌다(실측 비교 후 채택).
  `<path d="M-6.4,-2.2 a2.1,2.1 0 0 1 4.2,0 a2.1,2.1 0 0 1 4.2,0 a1.9,1.9 0 0 1 3.8,0 v3.4 ` +
  `a5.6,5.6 0 0 1 -5.6,5.6 h-1.4 a5.2,5.2 0 0 1 -5.2,-5.2 z" ` +
  `fill="#fff" stroke="#0b0f14" stroke-width="1.9" stroke-linejoin="round"/>` +
  // 엄지
  `<path d="M-6.4,0.4 h-2.2 a1.9,1.9 0 0 0 0,3.8 h2.2" fill="#fff" stroke="#0b0f14" stroke-width="1.7" stroke-linejoin="round"/>`;

/** 실제로 끄는 동안의 손 — 줄에 더 붙고, 마디 아치가 작고, 전체가 뭉툭하다.
 *  브라우저의 grab → grabbing 관례와 같은 뜻이다: 올려놓았다 / 잡았다. */
const GRIP_CLOSED_ART =
  rope(-2.6) +
  `<path d="M-6,-0.9 a1.5,1.5 0 0 1 3,0 a1.5,1.5 0 0 1 3,0 a1.4,1.4 0 0 1 2.8,0 v2.2 ` +
  `a5.1,5.1 0 0 1 -5.1,5.1 h-1.2 a4.9,4.9 0 0 1 -4.9,-4.9 z" ` +
  `fill="#fff" stroke="#0b0f14" stroke-width="1.9" stroke-linejoin="round"/>` +
  `<path d="M-6,1.1 h-2 a1.7,1.7 0 0 0 0,3.4 h2" fill="#fff" stroke="#0b0f14" stroke-width="1.7" stroke-linejoin="round"/>`;

/** 존별 마우스 커서 — 누르기 전에 커서만 보고 무슨 동작인지 알 수 있게.
 *  표준 커서에는 '회전' 도 '줄 쥐기' 도 없으므로 직접 그린다.
 *  hotspot 은 12 12(중앙). 커스텀 커서를 못 쓰는 환경을 위해 표준 커서를 폴백으로 붙인다. */
function build(zone: DragZone, dragging = false): string {
  const tow = zone === 'towRear' || zone === 'towFront';
  const art = tow
    ? dragging
      ? GRIP_CLOSED_ART
      : GRIP_ART
    : `<circle r="10.2" fill="#fff" stroke="#0b0f14" stroke-width="2"/>` +
      `<path d="${ZONE_GLYPH[zone]}" fill="none" stroke="#0b0f14" stroke-width="1.9" ` +
      `stroke-linecap="round" stroke-linejoin="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="-12 -12 24 24">${art}</svg>`;
  const fallback = tow ? (dragging ? 'grabbing' : 'grab') : zone === 'translate' ? 'move' : 'crosshair';
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, ${fallback}`;
}

export const ZONE_CURSOR: Record<DragZone, string> = {
  towRear: build('towRear'),
  translate: build('translate'),
  spin: build('spin'),
  towFront: build('towFront'),
};

/** 실제로 끄는 동안 스테이지 전체에 거는 커서. 포인터 캡처 때문에 커서가 핸들 밖으로
 *  나가도 손 모양이 유지되어야 하므로, 개체가 아니라 컨테이너에 건다. */
export const ZONE_CURSOR_DRAGGING: Record<DragZone, string> = {
  towRear: build('towRear', true),
  translate: build('translate', true),
  spin: build('spin', true),
  towFront: build('towFront', true),
};

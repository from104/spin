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

/** 존 글리프를 그대로 마우스 커서로 만든다 — 누르기 전에 커서만 보고 무슨 동작인지 알 수 있게.
 *  표준 커서에는 '회전'이 없고 앞/뒤 견인도 구분되지 않으므로 네 개 다 직접 그린다.
 *  hotspot 은 12 12(중앙). 커스텀 커서를 못 쓰는 환경을 위해 표준 커서를 폴백으로 붙인다. */
function build(zone: DragZone): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="-12 -12 24 24">` +
    `<circle r="10.2" fill="#fff" stroke="#0b0f14" stroke-width="2"/>` +
    `<path d="${ZONE_GLYPH[zone]}" fill="none" stroke="#0b0f14" stroke-width="1.9" ` +
    `stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const fallback = zone === 'translate' ? 'move' : 'grab';
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, ${fallback}`;
}

export const ZONE_CURSOR: Record<DragZone, string> = {
  towRear: build('towRear'),
  translate: build('translate'),
  spin: build('spin'),
  towFront: build('towFront'),
};

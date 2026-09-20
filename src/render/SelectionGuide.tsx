// 선택 가이드 사각형(§6.10e) — 이동 앵커가 **무엇을 감싸고 있는지** 그려 준다.
// 2026-09-14 기현님 실기: *"그룹화 했을 때 가이드 사각형이 필요하다. 이동 앵커가 엉뚱한 곳에
// 위치한 것처럼 보인다."*
//
// 진단이 정확했다. 앵커는 **고른 것 전부를 감싼 상자**의 위 중앙에 뜨는데 그 상자가 안 보이니,
// 개체 다섯을 고르면 앵커가 아무 개체와도 맞지 않는 허공에 떠 있는 것으로 읽힌다. 상자를
// 그리면 그 자리가 곧 설명이 된다.
//
// **언제 뜨는가는 여기서 정하지 않는다** — `moveAnchorGuide`(moveAnchorIds.ts) 하나가 정한다.
// 규칙의 출처가 둘이면 «앵커는 떴는데 상자는 없다» 가 생긴다.
//
// 왜 파선 + 모서리 갈고리인가: 판 위에 이미 사각형이 셋 있다 — 규칙 존(흰 파선 8 6), 러버밴드
// (강조색 파선), 도형 rect(반투명 면 + 진한 테두리). 파선 간격만 다른 넷째는 눈으로 못 가른다.
// **모서리 갈고리**는 그 셋 중 아무도 안 쓰는 모양이라 한눈에 갈린다.
import type { AABB } from '../physics/bounds.ts';

export interface SelectionGuideProps {
  /** 감쌀 월드 상자 — 앵커가 쓰는 그 상자(`selectionBounds`)와 **같은 값**이어야 한다. */
  box: AABB;
  pxPerUnit: number;
}

/** 상자에서 바깥으로 띄우는 여백(CSS px). 개체 테두리에 딱 붙으면 개체의 일부로 읽힌다. */
const PAD_CSS_PX = 4;
/** 모서리 갈고리의 한 변(CSS px). */
const HOOK_CSS_PX = 9;

export function SelectionGuide({ box, pxPerUnit }: SelectionGuideProps) {
  const pad = PAD_CSS_PX / pxPerUnit;
  const hook = HOOK_CSS_PX / pxPerUnit;
  const x = box.minX - pad;
  const y = box.minY - pad;
  const w = box.maxX - box.minX + pad * 2;
  const h = box.maxY - box.minY + pad * 2;
  // 갈고리가 서로 먹지 않게 — 짧은 변의 절반을 넘지 않는다(작은 개체에서 X 자가 되는 것을 막는다).
  const k = Math.min(hook, w / 2, h / 2);
  const sw = 1 / pxPerUnit;

  // 네 모서리 갈고리. 한 path 로 그린다 — 요소 넷보다 싸고, 파선과 달리 **모양**이 뜻을 진다.
  const hooks = [
    `M ${x} ${y + k} V ${y} H ${x + k}`,
    `M ${x + w - k} ${y} H ${x + w} V ${y + k}`,
    `M ${x + w} ${y + h - k} V ${y + h} H ${x + w - k}`,
    `M ${x + k} ${y + h} H ${x} V ${y + h - k}`,
  ].join(' ');

  return (
    <g aria-hidden="true" data-selection-guide="" pointerEvents="none">
      {/* 케이싱 — 밝은 코트 위에서도 흰 선이 보이게 하는 어두운 밑줄. 선택 링의 2겹 규약과 같다. */}
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="rgba(0,0,0,.55)" strokeWidth={sw * 3} strokeDasharray={`${2 / pxPerUnit} ${5 / pxPerUnit}`} />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="rgba(255,255,255,.85)" strokeWidth={sw} strokeDasharray={`${2 / pxPerUnit} ${5 / pxPerUnit}`} />
      <path d={hooks} fill="none" stroke="rgba(0,0,0,.55)" strokeWidth={sw * 3.4} strokeLinecap="butt" />
      <path d={hooks} fill="none" stroke="var(--accent)" strokeWidth={sw * 1.6} strokeLinecap="butt" />
    </g>
  );
}

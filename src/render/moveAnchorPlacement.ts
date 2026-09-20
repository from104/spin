// 이동 앵커가 **화면 어디에** 놓이는가. 순수 함수 하나뿐이다(DOM·SVG·React 없음).
// 2026-09-13 기현님 지시: *"도형·메모·다중 선택에서 객체가 겹쳐 있으면 집어 드래그로 옮기기가
// 쉽지 않더라. 이동용 앵커가 필요하다. 위치는 객체를 화면 기준 사각형으로 감쌌을 때 중앙 위.
// 앵커가 화면 위에 가까이 있을 때는 중앙 아래."*
//
// 왜 떼어 놓나: 이 산수가 틀리면 앵커가 **화면 밖으로 나가 영영 못 잡는다.** 그런데 그 사고는
// SVG 를 그려 봐야만 보이는 종류가 아니라 숫자로 재면 되는 종류다 — 재는 것은 여기서 재고,
// 그리는 쪽(MoveAnchor.tsx)은 받은 점에 그리기만 한다.
//
// 좌표는 전부 **클라이언트 CSS px**(뷰포트 기준)다. 월드 좌표로 옮기는 일은 부르는 쪽 몫이다
// (`worldToClient`/`clientToWorld` — useStageMetrics.ts). 화면 기준으로 재는 이유가 지시에
// 그대로 있다: 판이 90° 돌아 있어도 사람 눈에는 "위" 가 화면의 위다.

/** 화면에 놓인 사각형. `right`·`bottom` 은 포함 경계다. */
export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface MoveAnchorPlacement {
  clientX: number;
  clientY: number;
  /** 위가 모자라 아래로 내려갔는가. 그리는 쪽이 꼬리(말풍선 꼭지)를 뒤집는 데 쓴다. */
  below: boolean;
}

export interface MoveAnchorPlacementOpts {
  /** 상자 모서리와 앵커의 **보이는 원** 사이 틈(px). */
  gapPx: number;
  /** 보이는 원의 반지름(px). */
  viewRadiusPx: number;
  /** 잡히는 원의 반지름(px). 뒤집는 판정과 좌우 물림이 이 값을 본다 — 표적이 잘리면
   *  "보이는데 안 잡힌다" 가 되기 때문이다. */
  hitRadiusPx: number;
}

/**
 * 고른 것을 감싼 화면 사각형(`box`) 위에 앵커를 놓는다. 무대 밖으로 나가지 않게 `stage` 안에서만.
 *
 * 규칙 셋:
 * ① 기본은 **중앙 위** — 상자 위 모서리에서 `gap + viewRadius` 만큼 올린다.
 * ② 그 자리에서 **잡히는 원이 무대 위쪽에 잘리면 중앙 아래**로 뒤집는다. 판정에 보이는 원이
 *    아니라 잡히는 원을 쓰는 이유: 눈에 보이는 동그라미가 다 보여도 44px 표적의 절반이 무대
 *    밖이면 발 마우스·터치로는 못 잡는다.
 * ③ 좌우로는 무대 안으로 **물린다**(clamp). 개체가 화면 밖으로 반쯤 나가 있을 때 "중앙" 을
 *    고집하면 앵커도 같이 나가 버려 옮길 길이 사라진다 — 중앙이라는 모양보다 잡히는 것이 먼저다.
 *
 * 아래로 뒤집었는데 그쪽도 모자라면 그냥 아래다. 무대가 앵커보다 얇은 경우인데, 그때는 ③의
 * 물림이 세로로도 걸려 결국 무대 안에 남는다.
 */
export function moveAnchorPlacement(box: ScreenRect, stage: ScreenRect, opts: MoveAnchorPlacementOpts): MoveAnchorPlacement {
  const { gapPx, viewRadiusPx, hitRadiusPx } = opts;
  const offset = gapPx + viewRadiusPx;

  const aboveY = box.top - offset;
  const below = aboveY - hitRadiusPx < stage.top;
  const rawY = below ? box.bottom + offset : aboveY;

  const cx = (box.left + box.right) / 2;
  return {
    clientX: clamp(cx, stage.left + hitRadiusPx, stage.right - hitRadiusPx),
    clientY: clamp(rawY, stage.top + hitRadiusPx, stage.bottom - hitRadiusPx),
    below,
  };
}

/** `lo > hi` 인 무대(앵커보다 좁은 창)에서도 NaN 을 내지 않는다 — 그때는 lo 로 모인다. */
function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return Math.min(hi, Math.max(lo, v));
}

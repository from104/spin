// 잠긴 개체의 **붉은 테두리** (기현 지시 2026-08-14: *"붉은 태두리로 표시"*).
//
// 개체 다섯 종류(휠체어·공·콘·메모·화살표)가 각자 그리면 반지름·굵기가 어긋나고, 그러면
// "이건 잠긴 건가 선택된 건가" 를 매번 눈으로 재야 한다. 그래서 링은 여기 하나뿐이다.
//
// ── 왜 2겹인가 ──────────────────────────────────────────────────────────────────────
// 선택 링(`sel-ring`)이 쓰는 규약을 그대로 따른다: 어두운 바깥 선 위에 색 선을 얹는다.
// 코트(#1f7a46)와 칩 색이 둘 다 밝아, 한 겹만 그리면 개체 색에 따라 링이 묻힌다.
//
// ── 왜 실선인가 (선택 링은 파선이다) ─────────────────────────────────────────────────
// 둘이 같은 개체에 동시에 뜰 수 있다 — 잠긴 것을 고를 수 있기 때문이다(잠김은 **이동**만
// 막는다). 그때 색만 다르면 두 링이 한 링처럼 읽힌다. 선의 **모양**이 다르면 겹쳐도 갈린다.
import { LOCK_RING_COLOR } from '../../core/colors.ts';

export interface LockRingProps {
  /** 개체 반경(월드 px). 선택 링과 같은 값을 쓴다 — 두 링이 같은 자리에 겹쳐야 한 물건으로 읽힌다. */
  r: number;
}

export function LockRing({ r }: LockRingProps) {
  return (
    <g className="lock-ring" pointerEvents="none" aria-hidden="true">
      <circle cx={0} cy={0} r={r} fill="none" stroke="rgba(0,0,0,.65)" strokeWidth={4.5} />
      <circle cx={0} cy={0} r={r} fill="none" stroke={LOCK_RING_COLOR} strokeWidth={2.4} />
    </g>
  );
}

/** 휠체어처럼 **네모난** 개체용. 원으로 감싸면 차체 모서리가 링 밖으로 삐져나온다. */
export function LockRingRect({ x, y, width, height, rx }: { x: number; y: number; width: number; height: number; rx: number }) {
  return (
    <g className="lock-ring" pointerEvents="none" aria-hidden="true">
      <rect x={x} y={y} width={width} height={height} rx={rx} fill="none" stroke="rgba(0,0,0,.65)" strokeWidth={4.5} />
      <rect x={x} y={y} width={width} height={height} rx={rx} fill="none" stroke={LOCK_RING_COLOR} strokeWidth={2.4} />
    </g>
  );
}

// 잠긴 개체의 **보라 반투명 덮개** (기현 지시 2026-08-14, 실측 뒤 변경).
//
// ── 왜 붉은 테두리에서 바뀌었나 ─────────────────────────────────────────────────────
// 처음 지시는 *"붉은 태두리로 표시"* 였고 그렇게 넣었다. 기현님이 실기로 써 보고:
// *"실측 해보니 선택 테두리와 겹친다. 대신 보라색 반투명 레이어로 표시하는 게 낫겠다."*
//
// 겹침은 색의 문제가 아니라 **자리**의 문제였다. 잠긴 것을 고를 수 있어야 하므로(그래야 잠금을
// 푼다) 두 표시가 **동시에** 뜨는 것이 정상 상태인데, 둘 다 개체 둘레의 링이라 같은 픽셀을
// 두고 다툰다. 선 모양을 다르게 해도(실선 대 파선) 링 두 개가 겹친 것은 링 하나로 읽힌다.
// 덮개는 **면**이라 링과 축이 다르다 — 겹칠 자리가 아예 없다.
//
// ⚠️ **팀 색에 보라(#7c5cd6)가 있다.** 그래서 그 팀 칩 위에서는 덮개가 가장 약하게 읽힌다.
// 그것과 갈리도록 훨씬 **진하고 채도 높은** 보라를 쓴다(아래 상수의 검산 참고). 기현님이
// 색을 지정하셨으므로 색 자체는 안 바꾸되, 한계는 여기 적어 둔다 — 보라 팀을 쓰면서 잠금을
// 자주 쓰게 되면 그때 다시 볼 자리다.
import { LOCK_TINT_COLOR, LOCK_TINT_OPACITY } from '../../core/colors.ts';

/** 원형 개체(공·콘·메모)용. `r` 은 그 개체의 선택 링과 **같은 반지름**이다 —
 *  덮개가 개체보다 작으면 가장자리가 삐져나와 "덜 잠긴" 것처럼 보인다. */
export function LockTint({ r }: { r: number }) {
  return <circle className="lock-tint" cx={0} cy={0} r={r} fill={LOCK_TINT_COLOR} fillOpacity={LOCK_TINT_OPACITY} pointerEvents="none" />;
}

/** 네모난 개체(휠체어)용. 원으로 덮으면 차체 모서리가 밖으로 나온다. */
export function LockTintRect({ x, y, width, height, rx }: { x: number; y: number; width: number; height: number; rx: number }) {
  return (
    <rect
      className="lock-tint"
      x={x}
      y={y}
      width={width}
      height={height}
      rx={rx}
      fill={LOCK_TINT_COLOR}
      fillOpacity={LOCK_TINT_OPACITY}
      pointerEvents="none"
    />
  );
}

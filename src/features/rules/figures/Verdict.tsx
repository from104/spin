// 판정 배지(✓/✕ + 표제 + 부제) — 조항 도해가 공통으로 쓰는 결론 표시(2026-08-21).
// 처음엔 제2조 공기압 도해(BallFigure.tsx) 안에 갇혀 있었다. 세 번째로 재사용하는 자리가
// 생기면서(제1조 바닥재 도해) 밖으로 뺐다 — PowerchairGlyph.tsx 와 같은 이유다.
//
// ⚠️ `cy` 는 배지 원의 중심이다. 표제·부제 y 좌표는 `cy` 로부터 **고정 오프셋**을 더해
// 계산한다(원래 BallFieldFigure 가 `P_FLOOR + VERDICT_HEAD_DY` 식으로 쓰던 것과 같은 간격을
// 상수로 옮겼을 뿐 — 픽셀 결과는 그대로다). 호출부가 자기 좌표계에서 `cy` 하나만 넘기면 된다.
const HEAD_DY = 30;
const TAIL_DY = 47;

export interface VerdictProps {
  cx: number;
  cy: number;
  ok: boolean;
  head: string;
  tail: string;
  /** 표제·부제의 `cy` 기준 오프셋. 기본값(30/47)은 배지가 빈 자리에 설 때의 간격이고, 배지가
   *  **칸 안**에 서서 글이 칸 아래로 나가야 할 때 늘린다(2026-09-03 pf-quota — 기본값으로는
   *  56 높이 칸의 바닥선이 표제를 관통했다). */
  headDy?: number;
  tailDy?: number;
}

export function Verdict({ cx, cy, ok, head, tail, headDy = HEAD_DY, tailDy = TAIL_DY }: VerdictProps) {
  const color = ok ? 'var(--accent)' : 'var(--muted)';
  return (
    <g>
      <circle cx={cx} cy={cy} r={11} fill="none" stroke={color} strokeWidth={2} />
      {ok ? (
        <path d={`M ${cx - 5} ${cy} l 3.6 4 l 6.6 -8`} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <g stroke={color} strokeWidth={2.4} strokeLinecap="round">
          <line x1={cx - 4.6} y1={cy - 4.6} x2={cx + 4.6} y2={cy + 4.6} />
          <line x1={cx + 4.6} y1={cy - 4.6} x2={cx - 4.6} y2={cy + 4.6} />
        </g>
      )}
      <text x={cx} y={cy + headDy} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={ok ? 'var(--accent-text)' : 'var(--text)'}>
        {head}
      </text>
      <text x={cx} y={cy + tailDy} textAnchor="middle" fontSize={11.5} fill="var(--faint-text)">
        {tail}
      </text>
    </g>
  );
}

// 말풍선 다리 — 그림 위 한 지점에 점을 찍고 라벨까지 파선을 긋는다(2026-08-21).
// 처음엔 제4조 장비 도해(EquipmentFigure.tsx) 안에 갇혀 있었다. 제1조 코트 규격 도해가
// 두 번째로 쓰면서 밖으로 뺐다 — `PowerchairGlyph.tsx`·`Verdict.tsx` 와 같은 이유다.
// 라벨은 항상 가운데 정렬이라 호출부가 텍스트가 왼쪽·오른쪽 어느 쪽으로 자라는지 고민할
// 필요가 없다 — 라벨 지점을 여백이 있는 쪽에 잡기만 하면 된다.
export interface CalloutProps {
  ax: number;
  ay: number;
  lx: number;
  ly: number;
  label: string;
}

export function Callout({ ax, ay, lx, ly, label }: CalloutProps) {
  return (
    <g>
      <line x1={ax} y1={ay} x2={lx} y2={ly} stroke="var(--muted)" strokeWidth={1.1} strokeDasharray="3 3" opacity={0.8} />
      <circle cx={ax} cy={ay} r={3} fill="var(--accent)" stroke="var(--panel)" strokeWidth={1} />
      <text x={lx} y={ly} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--text)">
        {label}
      </text>
    </g>
  );
}

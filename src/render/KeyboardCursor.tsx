// §7.5d 키보드 배치 커서. 배치 도구(ball/cone/player/note)가 활성이고 포커스가 코트
// 컨테이너 자신일 때 십자 커서를 보인다. 순수 키보드 상태(저빈도)라 물리 60fps 경로와
// 무관하게 일반 React 렌더(transform prop)로 충분하다 — §6.1 규칙 1 은 TransformWriter 가
// 구동하는 개체(휠체어·공·콘)에 대한 규칙이다.
export interface KeyboardCursorProps {
  visible: boolean;
  x: number;
  y: number;
  /** aria-live 문구와 같은 셀 라벨(예: "c3") — 커서 옆에 시각적으로도 보조 표시한다. */
  label?: string | null;
}

export function KeyboardCursor({ visible, x, y, label }: KeyboardCursorProps) {
  if (!visible) return null;
  return (
    <g aria-hidden="true" pointerEvents="none" transform={`translate(${x} ${y})`}>
      <line x1={-11} y1={0} x2={11} y2={0} stroke="var(--accent)" strokeWidth={2} />
      <line x1={0} y1={-11} x2={0} y2={11} stroke="var(--accent)" strokeWidth={2} />
      <circle r={3} fill="var(--accent)" />
      {label && (
        <text x={15} y={-11} fontFamily="'Space Grotesk',sans-serif" fontSize={11} fontWeight={700} fill="var(--accent)">
          {label}
        </text>
      )}
    </g>
  );
}

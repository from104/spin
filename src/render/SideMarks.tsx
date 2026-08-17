// 진영 표시 — 골라인 **바로 뒤**에 그 골을 지키는 팀의 삼각 깃발 둘 (기현 지시 2026-08-15/16).
//
// **이 파일은 그리기만 한다.** 좌표·색·크기와 그 근거는 전부 `sideFlags.ts` 에 있다 —
// PNG 내보내기가 같은 값을 읽어야 해서 떼어 둔 것이다(그 파일 머리말).
import { memo } from 'react';
import {
  FLAG_STROKE,
  FLAG_STROKE_W,
  POLE_W,
  sideFlagGroups,
  type SideFlagInput,
} from './sideFlags.ts';

export type SideMarksProps = SideFlagInput;

export const SideMarks = memo(function SideMarks(props: SideMarksProps) {
  const groups = sideFlagGroups(props);
  if (groups.length === 0) return null; // 플랫 코트 — 진영이라는 개념이 없다

  return (
    // 판정·조작과 무관한 표식이라 접근성 트리와 포인터에서 모두 뺀다. 진영을 **말로** 알리는
    // 것은 진영 버튼의 접근성 이름이 진다(FunctionBar/InspectorPanel).
    <g aria-hidden="true" pointerEvents="none" data-side-marks="">
      {groups.map((g, i) => (
        <g key={g.key} data-side-mark={g.defender} data-side-index={i}>
          {g.flags.map((f) => (
            <g key={f.role} data-side-flag={f.role}>
              {/* 깃대를 먼저 그린다 — 페넌트가 그 위를 덮어야 매달린 것으로 보인다.
                  그래서 **눈에 남는 깃대는 아래 토막**(SIDE_FLAG_TAIL_PX)뿐이다. */}
              <line x1={f.poleX} y1={f.poleY1} x2={f.poleX} y2={f.poleY2} stroke={FLAG_STROKE} strokeWidth={POLE_W} strokeLinecap="round" />
              <polygon points={f.pennant} fill={f.fill} stroke={FLAG_STROKE} strokeWidth={FLAG_STROKE_W} strokeLinejoin="round" />
            </g>
          ))}
        </g>
      ))}
    </g>
  );
});

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
import { uprightAt, useStageRot } from './stageRot.tsx';

export type SideMarksProps = SideFlagInput;

export const SideMarks = memo(function SideMarks(props: SideMarksProps) {
  // §6.4 — **판이 돌아도 깃발은 화면에서 제 모양을 지킨다**(기현 지시 2026-08-27). 격자 라벨과
  // 같은 규칙이다: 회전 그룹 안에 있으니 그대로 두면 깃대가 눕고 꼭짓점이 아래를 향하는데,
  // 그러면 *"꼭짓점이 다 오른쪽"*(2026-08-16)이 화면에서 성립하지 않는다.
  //
  // 되돌림은 여기서 걸고, 그에 맞춘 **자리**는 `sideFlagGroups` 가 잡는다(rot 을 넘기는 이유).
  // 둘을 갈라 둔 것은 PNG·인쇄 때문이다 — 그쪽은 판을 안 돌리므로 rot 0 으로 예전 그대로다.
  const rot = useStageRot();
  const groups = sideFlagGroups({ ...props, rot });
  if (groups.length === 0) return null; // 플랫 코트 — 진영이라는 개념이 없다

  return (
    // 판정·조작과 무관한 표식이라 접근성 트리와 포인터에서 모두 뺀다. 진영을 **말로** 알리는
    // 것은 진영 버튼의 접근성 이름이 진다(FunctionBar/InspectorPanel).
    <g aria-hidden="true" pointerEvents="none" data-side-marks="">
      {groups.map((g, i) => (
        <g key={g.key} data-side-mark={g.defender} data-side-index={i}>
          {g.flags.map((f) => (
            <g key={f.role} data-side-flag={f.role} transform={uprightAt(rot, f.cx, f.cy)}>
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

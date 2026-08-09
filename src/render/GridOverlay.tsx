// §3.3 격자 렌더. 좌표는 model/grid.ts 의 gridGeom 에서만 가져온다 — 직접 계산하지 않는다.
// 격자 라벨은 장식이다(코트 대비 1.5:1 이하, 어떤 WCAG 기준도 통과 못함). 셀 주소의 권위 있는
// 출처는 인스펙터·aria-live 리전이므로 이 레이어는 aria-hidden + pointer-events:none 이 필수다.
import { memo } from 'react';
import type { CourtMode } from '../model/court.ts';
import { gridGeom } from '../model/grid.ts';
import { uprightAt, useStageRot } from './stageRot.tsx';

export interface GridOverlayProps {
  mode: CourtMode;
  /** prefs.showGridLabels — false 면 축 헤더/셀 텍스트 블록을 그리지 않는다(선만 남는다). */
  showLabels: boolean;
}

const FONT = "'Space Grotesk',sans-serif";

export const GridOverlay = memo(function GridOverlay({ mode, showLabels }: GridOverlayProps) {
  // 판이 돌아도 칸 이름은 바로 서 있어야 읽힌다(§6.4).
  const rot = useStageRot();
  const g = gridGeom(mode);
  const xMin = g.vx[0];
  const xMax = g.vx[g.vx.length - 1];
  const yMin = g.hy[0];
  const yMax = g.hy[g.hy.length - 1];

  return (
    <g aria-hidden="true" pointerEvents="none">
      <g stroke="#ffffff" strokeWidth={1} opacity={0.22} shapeRendering="crispEdges">
        {g.inner.vx.map((x) => (
          <line className="grid-line" key={`v${x}`} x1={x} y1={yMin} x2={x} y2={yMax} />
        ))}
        {g.inner.hy.map((y) => (
          <line className="grid-line" key={`h${y}`} x1={xMin} y1={y} x2={xMax} y2={y} />
        ))}
      </g>
      {g.major && (
        <g stroke="#ffffff" strokeWidth={1} opacity={0.34} shapeRendering="crispEdges">
          {g.major.vx.map((x) => (
            <line className="grid-line" key={`mv${x}`} x1={x} y1={yMin} x2={x} y2={yMax} />
          ))}
          {g.major.hy.map((y) => (
            <line className="grid-line" key={`mh${y}`} x1={xMin} y1={y} x2={xMax} y2={y} />
          ))}
        </g>
      )}
      {/* full·half 는 칸이 커서(125×90px) 칸마다 라벨을 얹을 수 있다.
          flat 은 1 m 격자라 340칸이고 한 칸이 25×25px 뿐이라 칸마다 얹으면 판독 불가 노이즈가
          된다 — 스프레드시트식 축 헤더(a..t / 1..17)로 대신한다. 코치가 "b4" 로 칸을 지목하는
          것은 그대로 되므로 요구사항이 요구한 기능은 유지된다. (요구사항 원문의 칸 번호 예시는
          풀 코트 절에만 달려 있다.) */}
      {showLabels && mode !== 'flat' && (
        <g
          className="grid-cell-labels"
          fill="#ffffff"
          opacity={0.2}
          fontFamily={FONT}
          fontSize={18}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {g.cells.map((c) => (
            <text className="grid-cell-label" key={c.text} x={c.x} y={c.y} transform={uprightAt(rot, c.x, c.y)}>
              {c.text}
            </text>
          ))}
        </g>
      )}
      {showLabels && g.axis && (
        <g
          className="grid-axis-labels"
          fill="#ffffff"
          opacity={0.28}
          fontFamily={FONT}
          fontSize={11}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {g.axis.map((a) => (
            <text className="grid-axis-label" key={`${a.x},${a.y}`} x={a.x} y={a.y} transform={uprightAt(rot, a.x, a.y)}>
              {a.text}
            </text>
          ))}
        </g>
      )}
    </g>
  );
});

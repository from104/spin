// §6.10 트레이에서 끌고 있는 말의 고스트.
//
// 코트 축척(pxPerUnit)을 받아 **실제로 놓일 크기**로 그린다. 고정 크기로 그리면 손을 떼는
// 순간 개체가 갑자기 커지거나 작아져서, 내려놓은 자리와 눈이 어긋난다. 판 위의 말을 집어
// 옮기는 느낌이 목적이므로 크기가 변하면 안 된다.
import { BALL, CHAIR, CONE } from '../../core/constants.ts';
import { CONE_COLORS, inkFor } from '../../core/colors.ts';
import type { Drill } from '../../model/drill.ts';
import type { TrayDragItem } from './useTrayDrag.ts';

export interface TrayGhostProps {
  item: TrayDragItem;
  pxPerUnit: number;
  drill: Drill;
  coneSlot: 0 | 1;
}

export function TrayGhost({ item, pxPerUnit, drill, coneSlot }: TrayGhostProps) {
  const k = pxPerUnit > 0 ? pxPerUnit : 1;
  const shadow = 'drop-shadow(0 6px 10px rgba(0,0,0,.5))';

  if (item.kind === 'ball') {
    const d = BALL.viewRadiusPx * 2 * k;
    return <div style={{ width: d, height: d, borderRadius: '50%', background: '#f2f5f8', border: '1px solid rgba(0,0,0,.35)', filter: shadow, opacity: 0.9 }} />;
  }

  if (item.kind === 'cone') {
    const w = CONE.viewWidthPx * k;
    const h = CONE.viewHeightPx * k;
    return (
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: `${w / 2}px solid transparent`,
          borderRight: `${w / 2}px solid transparent`,
          borderBottom: `${h}px solid ${CONE_COLORS[coneSlot]}`,
          filter: shadow,
          opacity: 0.9,
        }}
      />
    );
  }

  if (item.kind === 'note') return null;

  const def = drill.cast.chairs.find((c) => c.id === item.chairId);
  if (!def) return null;
  const teamStyle = drill.teams[def.team];
  const color = def.color ?? (def.isGk ? teamStyle.gkColor : teamStyle.color);
  return (
    <div
      style={{
        width: CHAIR.lengthPx * k,
        height: CHAIR.widthPx * k,
        borderRadius: 4 * k,
        background: color,
        color: inkFor(color),
        border: `${Math.max(1, 0.6 * k)}px solid rgba(255,255,255,.85)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: Math.max(9, 13 * k),
        fontWeight: 700,
        filter: shadow,
        opacity: 0.9,
      }}
    >
      {def.number}
    </div>
  );
}

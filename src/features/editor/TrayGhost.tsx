// §6.10 트레이에서 끌고 있는 말의 고스트.
//
// 코트 축척(pxPerUnit)을 받아 **실제로 놓일 크기**로 그린다. 고정 크기로 그리면 손을 떼는
// 순간 개체가 갑자기 커지거나 작아져서, 내려놓은 자리와 눈이 어긋난다. 판 위의 말을 집어
// 옮기는 느낌이 목적이므로 크기가 변하면 안 된다.
import { BALL, CHAIR, CONE } from '../../core/constants.ts';
import { CONE_COLORS, inkFor } from '../../core/colors.ts';
import type { Drill } from '../../model/drill.ts';
import { courtDefFor } from '../../model/court.ts';
import { placeHeadingDeg } from '../../model/rules.ts';
import { DISC_RADIUS_PX, DISC_LABEL_FONT_PX } from '../../model/chairDisc.ts';
import { strokeFor } from '../../core/colors.ts';
import type { TrayDragItem } from './useTrayDrag.ts';

export interface TrayGhostProps {
  item: TrayDragItem;
  pxPerUnit: number;
  drill: Drill;
  coneSlot: 0 | 1;
  /** 심플 모드 — 휠체어 고스트도 원으로(놓이는 모양과 같아야 손을 뗄 때 안 튄다, model/chairDisc.ts). */
  simple?: boolean;
}

export function TrayGhost({ item, pxPerUnit, drill, coneSlot, simple = false }: TrayGhostProps) {
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
  // 손을 떼면 **이 각도로 놓인다**(placement.ts 와 같은 출처). 고스트만 눕혀 두면 놓는
  // 순간 칩이 90° 홱 돌아, 내려놓은 자리와 눈이 어긋난다 — 크기를 축척에 맞추는 것과
  // 같은 이유다. 각도를 여기 박아 두지 않는 이유이기도 하다: 코트 종류가 정한다.
  const court = courtDefFor(drill.courtMode, drill.courtSize);
  const headingDeg = placeHeadingDeg(court, def.team, drill.defense);
  if (simple) {
    const d = DISC_RADIUS_PX * 2 * k;
    const stroke = strokeFor(color);
    return (
      <div
        data-shape="disc"
        style={{
          position: 'relative',
          width: d,
          height: d,
          filter: shadow,
          opacity: 0.9,
          // 돌리지 않는다 — 원에는 방향이 없다(2026-11-19 「전면 표시 없애고」). 차체 고스트만 놓일 방향(headingDeg)으로 돈다.
        }}
      >
        <svg width={d} height={d} viewBox={`${-DISC_RADIUS_PX} ${-DISC_RADIUS_PX} ${DISC_RADIUS_PX * 2} ${DISC_RADIUS_PX * 2}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
          <circle r={DISC_RADIUS_PX} fill={color} stroke={stroke} strokeWidth={Math.max(1, 0.6 * k) / k} />
        </svg>
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: inkFor(color),
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: Math.max(9, DISC_LABEL_FONT_PX * k),
            fontWeight: 700,
          }}
        >
          {def.number}
        </span>
      </div>
    );
  }
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
        transform: `rotate(${headingDeg}deg)`,
      }}
    >
      {/* 등번호는 절대 눕지 않는다(§3.4 — 코트에서도 writer 가 rotate(-θ) 를 기록한다). */}
      <span style={{ transform: `rotate(${-headingDeg}deg)`, display: 'block' }}>{def.number}</span>
    </div>
  );
}

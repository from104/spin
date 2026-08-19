// §3.4 휠체어 — 저장형 ↔ 런타임형 자세 변환, 드래그 존 판정, 기하.
// physics-kin(kinematics.ts/obb.ts) 이 ChairPose·DragZone·ZoneConfig 를 타입 전용으로 이 파일에서
// 가져다 쓴다(Wave 1 산출물 실측 확인) — 필드를 계약과 다르게 바꾸면 그쪽이 깨진다.
import type { Vec2 } from '../core/units.ts';
import { CHAIR } from '../core/constants.ts';
import { radToStoredDeg, storedDegToRad } from '../core/angle.ts';
import type { Locale } from '../i18n/locale.ts';

export type DragZone = 'towRear' | 'translate' | 'spin' | 'towFront';
export const DRAG_ZONES = ['towRear', 'translate', 'spin', 'towFront'] as const;

/** 존 핸들의 발화·툴팁 이름 — `features/editor/useEditorPointer.ts`(존을 잡을 때 발화)와
 *  `render/ZoneHandles.tsx`(견인 핸들의 SVG &lt;title&gt;) 가 같은 값을 쓴다. render/ 가 features/
 *  를 import 할 수 없어(계층 역행) 두 곳이 각자 사본을 들고 있었다 — 여기 한 곳으로 모은다. */
export const ZONE_LABEL: Record<Locale, Record<DragZone, string>> = {
  ko: { towRear: '후방 견인', translate: '평행 이동', spin: '제자리 회전', towFront: '전방 견인' },
  en: { towRear: 'rear tow', translate: 'translate', spin: 'spin in place', towFront: 'front tow' },
  ja: { towRear: '後方けん引', translate: '平行移動', spin: 'その場回転', towFront: '前方けん引' },
};

/** 저장형(디스크·IDB·JSON). angleDeg 는 [-180,180) 로 랩되고 0.1° 로 반올림된다. */
export interface StoredChairPose {
  x: number;
  y: number;
  angleDeg: number;
}
/** 런타임형(물리·렌더). theta 는 rad, 드래그 중에는 연속(unwrapped). */
export interface ChairPose {
  x: number;
  y: number;
  theta: number;
}

export const poseFromStored = (p: StoredChairPose): ChairPose => ({
  x: p.x,
  y: p.y,
  theta: storedDegToRad(p.angleDeg),
});
export const poseToStored = (p: ChairPose): StoredChairPose => ({
  x: Math.round(p.x * 10) / 10,
  y: Math.round(p.y * 10) / 10,
  angleDeg: radToStoredDeg(p.theta),
});

export interface ZoneConfig {
  sTowRearMax: number;
  sSpinMin: number;
  sTowFrontMin: number;
  grabPadPx: number;
}

const unitFwd = (theta: number): Vec2 => ({ x: Math.cos(theta), y: Math.sin(theta) });

/** 잡은 점을 body frame 으로. ax = 축 방향(부호), lat = 측방(부호). 단위 px.
 *  §10.9 grabOf 와 동일 식: s = sPivot + ax/L. */
export function projectGrab(pose: ChairPose, p: Vec2): { ax: number; lat: number; s: number } {
  const e = unitFwd(pose.theta);
  const rx = p.x - pose.x;
  const ry = p.y - pose.y;
  const ax = rx * e.x + ry * e.y;
  const lat = e.x * ry - e.y * rx;
  const s = CHAIR.sPivot + ax / CHAIR.lengthPx;
  return { ax, lat, s };
}

export function classifyZone(s: number, z: ZoneConfig): DragZone {
  if (s <= z.sTowRearMax) return 'towRear';
  if (s < z.sSpinMin) return 'translate';
  if (s < z.sTowFrontMin) return 'spin';
  return 'towFront';
}

/** 로컬 hull 사각형(피벗 기준). §3.4 렌더 rect 와 동일: x∈[-7.5,30], y∈[-12.5,12.5]. */
export function chairCorners(p: ChairPose): [Vec2, Vec2, Vec2, Vec2] {
  const u = unitFwd(p.theta);
  const v: Vec2 = { x: -u.y, y: u.x };
  const rear = -CHAIR.pivotToRearPx;
  const front = CHAIR.pivotToFrontPx;
  const halfW = CHAIR.widthPx / 2;
  const local: [Vec2, Vec2, Vec2, Vec2] = [
    { x: rear, y: -halfW },
    { x: front, y: -halfW },
    { x: front, y: halfW },
    { x: rear, y: halfW },
  ];
  return local.map((c) => ({
    x: p.x + c.x * u.x + c.y * v.x,
    y: p.y + c.x * u.y + c.y * v.y,
  })) as [Vec2, Vec2, Vec2, Vec2];
}

/** 피벗 + lever·u(θ). 존 핸들 렌더 위치와 grabFromLever 의 래치 레버가 같은 식에서 나와야 스냅이 없다. */
export function pointAtLever(p: ChairPose, leverPx: number): Vec2 {
  const u = unitFwd(p.theta);
  return { x: p.x + leverPx * u.x, y: p.y + leverPx * u.y };
}

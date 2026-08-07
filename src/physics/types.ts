// 물리·운동학 공유 타입. §5.1. UI 가 의존하는 최소 계약.
// 주의(계약서와 다른 점): 원문 코드블록은 `DragZone`·`CastId`·`ChairId` 도 import 하지만
// 이 파일 안 어디서도 쓰이지 않아 noUnusedLocals(tsconfig.app.json) 에서 TS6133 로 실패한다
// (constants.ts 의 기존 조치와 같은 사유). 실제로 쓰이는 타입만 남긴다.
import type { Vec2 } from '../core/units.ts';
import type { ChairPose } from '../model/chair.ts';

export interface DragLimits {
  vLinPxPerS: number;
  omegaRadPerS: number;
}

/** pointerdown 에 래치되는 body-frame 그랩. 드래그 내내 불변.
 *  ★ blocker 수정: rho ≥ 0 인 극좌표만 쓴다. 부호 있는 레버(ax만으로 전/후방을 구분)로
 *  되돌리면 §5.2 가 잡은 §10.9 G1 스냅 회귀가 재발한다. */
export interface GrabLatch {
  ax: number;
  lat: number; // body frame px (부호 있음, 존 판정·릴리스 오프셋 계산용)
  rho: number; // = hypot(ax, lat) ≥ 0. 로프 길이
  beta: number; // = atan2(lat, ax). 헤딩 대비 잡은점 방위
}

/** spin 전용 증분 추적 상태. pointerdown 마다 새로 만든다(=phiPrev undefined). */
export interface ZoneState {
  phiPrev?: number;
}

export interface KinInput {
  pose: ChairPose;
  grab: GrabLatch;
  target: Vec2;
  dt: number;
}

export interface Bounds {
  w: number;
  h: number;
}

export type BodyKind = 'chair' | 'ball' | 'cone' | 'wall';

/** [x, y, theta] × n 을 한 버퍼에 담는다 (렌더 alpha 보간용). */
export interface PoseBuffer {
  readonly ids: string[];
  data: Float64Array;
}

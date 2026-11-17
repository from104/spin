// 휠체어 조정 모드(`drive`)의 **순수 운동학** — docs/PLAN-SIMPLE-DRIVE.md 결정 B3·B4·B9 ①.
//
// 차동 구동 하나로 정리한다: 입력 두 축 `fwd ∈ [-1,1]`(앞 +)·`turn ∈ [-1,1]`(오른쪽 +)을 목표 선속도·각속도로 바꾸고,
// 고정 가속도로 램프해 따라간 뒤 자세를 적분한다. React·물리·DOM 을 모른다 — 게임 모드(여러 대·여러 조종자)가 이 파일을
// 그대로 쓰고, 단위 시험이 고정 dt 로 잰다(model.test.ts).
//
// ⚠️ 벽·잠긴 개체에 막히는 것은 여기서 다루지 않는다. 막힘은 물리가 정하고, 컨트롤러가 매 프레임 바디 자세를 읽어
//    `withPose` 로 되먹인다 — 이 모델이 벽 너머로 혼자 달려 나가면 후진할 때 그 유령 거리를 되감아야 한다.
// ⚠️ 각도 규약은 물리와 같다: 보는 쪽 = (cos θ, sin θ), 화면 y 는 아래가 + 라 θ 가 늘면 **시계 방향**이다(turn + = 오른쪽).
import { DRIVE } from '../core/constants.ts';

export interface DriveInput {
  /** 앞(+)·뒤(−). */
  fwd: number;
  /** 오른쪽(+)·왼쪽(−). */
  turn: number;
}

export interface DriveState {
  x: number;
  y: number;
  theta: number;
  /** 보는 쪽 선속도(px/s). 후진이면 음수. */
  v: number;
  /** 각속도(rad/s). 시계 +. */
  omega: number;
}

export const ZERO_INPUT: DriveInput = { fwd: 0, turn: 0 };

/** 단계(1…levels)를 정수로 접는다 — 저장값·숫자키가 범위를 벗어나도 모델은 늘 정의된 속도를 쓴다. */
export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return DRIVE.defaultLevel;
  return Math.min(DRIVE.levels, Math.max(1, Math.round(level)));
}

/** 그 단계의 최고 선속도(px/s)·각속도(rad/s). 단계 n = 최고값의 n/levels(계획서 B4 표). */
export function levelLimits(level: number): { v: number; omega: number } {
  const k = clampLevel(level) / DRIVE.levels;
  return { v: DRIVE.vMaxPxPerS * k, omega: DRIVE.omegaMaxRadPerS * k };
}

/** 데드존 — 반경 deadzone 안은 0, 밖은 0→1 로 다시 펴서 작은 기울임이 계단처럼 튀지 않게 한다. 축마다 [-1,1] 로 자른다. */
export function applyDeadzone(input: DriveInput, dz: number = DRIVE.deadzone): DriveInput {
  const fwd = Math.max(-1, Math.min(1, input.fwd));
  const turn = Math.max(-1, Math.min(1, input.turn));
  const mag = Math.hypot(fwd, turn);
  if (mag <= dz) return ZERO_INPUT;
  const k = Math.min(1, (mag - dz) / (1 - dz)) / mag;
  return { fwd: fwd * k, turn: turn * k };
}

/** v 를 target 쪽으로 최대 step 만큼. */
function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}

export function initialDriveState(pose: { x: number; y: number; theta: number }): DriveState {
  return { x: pose.x, y: pose.y, theta: pose.theta, v: 0, omega: 0 };
}

/** 물리가 정한 실제 자세로 되먹인다 — 속도는 그대로 둔다(벽에 댄 채 밀면 모터는 여전히 돌고 있다). */
export function withPose(s: DriveState, pose: { x: number; y: number; theta: number }): DriveState {
  return { ...s, x: pose.x, y: pose.y, theta: pose.theta };
}

export interface DriveStepOptions {
  /** 감축 모션 — 램프를 DRIVE.rampReducedS 로 줄인다(계획서 B8). */
  reduceMotion?: boolean;
}

/** 한 프레임. dt(초)는 부르는 쪽이 이미 상한(DRIVE.maxFrameS)으로 잘라 넘긴다 — 여기서 한 번 더 자른다(순수 함수의 방어).
 *
 *  가속도는 **최고 단계 기준으로 고정**(a = Vmax₅ / rampS)이라 낮은 단계는 더 빨리 목표에 닿는다 — 단계가 바뀌어도 "밟는
 *  느낌" 은 같고, 감속(손을 뗌)도 같은 값이다(계획서 B3, D5 ⚑).
 *  적분은 반-암시적 오일러: 속도를 먼저 갱신하고 새 속도로 θ, 그다음 새 θ 로 위치를 옮긴다. 정지 상태에서 누른 첫 프레임에도
 *  바로 움직이고, 호(전진+회전)가 같은 dt 에서 같은 반지름을 그린다. */
export function stepDrive(s: DriveState, rawInput: DriveInput, level: number, dtS: number, opts: DriveStepOptions = {}): DriveState {
  const dt = Math.max(0, Math.min(DRIVE.maxFrameS, dtS));
  if (dt === 0) return s;
  const input = applyDeadzone(rawInput);
  const lim = levelLimits(level);
  const rampS = opts.reduceMotion ? DRIVE.rampReducedS : DRIVE.rampS;
  const accel = DRIVE.vMaxPxPerS / rampS;
  const alpha = DRIVE.omegaMaxRadPerS / rampS;
  // 후진 중 좌우는 민 쪽으로 **차 뒤가** 돈다(DRIVE.reverseSteerFlip) — 뒤로 가며 오른쪽을 밀면 뒤가 오른쪽으로, 즉 차체는 반시계.
  const flip = DRIVE.reverseSteerFlip && input.fwd < 0 ? -1 : 1;
  const vTarget = input.fwd * lim.v;
  const omegaTarget = input.turn * lim.omega * flip;
  const v = approach(s.v, vTarget, accel * dt);
  const omega = approach(s.omega, omegaTarget, alpha * dt);
  const theta = s.theta + omega * dt;
  return { x: s.x + v * dt * Math.cos(theta), y: s.y + v * dt * Math.sin(theta), theta, v, omega };
}

/** 멈춰 있는가 — 속도 둘 다 0. 컨트롤러가 "움직이다 섰다" 를 알아 커밋 시점을 잡는다. */
export function isStill(s: DriveState): boolean {
  return s.v === 0 && s.omega === 0;
}

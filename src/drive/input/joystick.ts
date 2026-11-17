// 화면 가상 조이스틱 입력원 — docs/PLAN-SIMPLE-DRIVE.md 결정 B5·B9 ②. 큰 원(받침) 안의 작은 원(손잡이)을 끈 만큼이 두 축이다.
// 화면 축 그대로: 위로 끌면 fwd +, 오른쪽이면 turn + — 차가 돌아가 있어도 "위 = 앞으로"(실제 파워체어 조이스틱과 같다).
//
// ⚠️ 데드존(12 %)의 **재조정**은 운동학(model.ts stepDrive → applyDeadzone) 한 곳이다. 여기서도 다시 펴면 두 번 깎여 실효
//    데드존이 ≈ 22.6 % 가 된다. 여기서는 데드존 안을 **정확히 0** 으로만 만든다 — 그 판정은 모델과 같아 두 번 해도 같고(멱등),
//    키보드와 더할 때 손가락 떨림(작은 옆 기울임)이 키 입력에 섞여 새지 않는다(모델의 데드존은 **더한 값**의 반지름만 본다).
// ⚠️ 정규화는 손잡이의 **실제 최대 이동 반경**으로 한다(받침 반경이 아니다) — 손잡이가 받침 안에 갇히는 만큼 덜 가는데 받침
//    반경으로 나누면 끝까지 밀어도 1 에 못 닿아 최고 단계 속도가 안 나온다.
import { DRIVE } from '../../core/constants.ts';
import type { DriveInput } from '../model.ts';
import { ZERO_INPUT } from '../model.ts';
import type { DriveInputSource } from './types.ts';

/** 손잡이를 받침 안(반경 travel)에 가둔 화면 변위(px). 손잡이를 그리는 자리다. */
export function clampKnob(dx: number, dy: number, travel: number): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  if (travel <= 0 || d === 0) return { x: 0, y: 0 };
  const k = d > travel ? travel / d : 1;
  return { x: dx * k, y: dy * k };
}

/** 손잡이의 화면 변위(px, 아래가 +y) → 두 축. 반경 travel 에서 길이 1, 데드존 안은 0(재조정은 모델이 한다 — 머리말). */
export function stickToInput(dx: number, dy: number, travel: number, deadzone: number = DRIVE.deadzone): DriveInput {
  const k = clampKnob(dx, dy, travel);
  if (travel <= 0) return ZERO_INPUT;
  const turn = k.x / travel;
  const fwd = (0 - k.y) / travel; // -k.y 는 가운데 줄에서 -0 이 된다
  if (Math.hypot(fwd, turn) <= deadzone) return ZERO_INPUT;
  return { fwd, turn };
}

export interface JoystickDriveSource extends DriveInputSource {
  /** 손잡이가 지금 가리키는 두 축(stickToInput 의 결과)을 넣는다. */
  set(input: DriveInput): void;
  /** reset() 이 불릴 때(창이 초점을 잃음·모드 끝·갈아타기) 화면 쪽 손짓도 끝내라고 알린다 — 입력은 0 인데 손잡이가 기운 채 남지 않게. */
  onReset(fn: () => void): () => void;
}

export function createJoystickDriveSource(): JoystickDriveSource {
  let cur: DriveInput = ZERO_INPUT;
  const listeners = new Set<() => void>();
  return {
    set(input) {
      cur = input;
    },
    read: () => cur,
    reset() {
      cur = ZERO_INPUT;
      for (const fn of listeners) fn();
    },
    onReset(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** 여러 입력원을 하나로 — 축마다 더한 뒤 [-1, 1] 로 자른다(키보드 W + 조이스틱 위 = 그냥 최고). reset 은 모두에게 간다. */
export function combineDriveSources(...sources: readonly DriveInputSource[]): DriveInputSource {
  const clamp = (v: number): number => Math.max(-1, Math.min(1, v));
  return {
    read() {
      let fwd = 0;
      let turn = 0;
      for (const s of sources) {
        const r = s.read();
        fwd += r.fwd;
        turn += r.turn;
      }
      return fwd === 0 && turn === 0 ? ZERO_INPUT : { fwd: clamp(fwd), turn: clamp(turn) };
    },
    reset() {
      for (const s of sources) s.reset();
    },
  };
}

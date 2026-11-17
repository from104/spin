// 화면 가상 조이스틱 입력원 — docs/PLAN-SIMPLE-DRIVE.md 결정 B5·B9 ②. 큰 원(받침) 안의 작은 원(손잡이)을 끈 만큼이 두 축이다.
// 화면 축 그대로: 위로 끌면 fwd +, 오른쪽이면 turn + — 차가 돌아가 있어도 "위 = 앞으로"(실제 파워체어 조이스틱과 같다).
//
// ⚠️ 데드존(DRIVE.deadzone, 20 %)은 **축마다** 이 파일 한 곳에서 깎는다(운동학은 모른다). 한 축이 그 안이면 그 축은 0 이고 손잡이는
//    십자선에 **붙어 보인다**(snapKnob) — 앞으로 밀다 손가락이 조금 옆으로 새도 곧게 가고, 옆으로 밀면 제자리에서 돈다. 밖은
//    0→1 로 다시 펴서 가운데서 멀수록 빠르다(선형). 두 축이 다 안이면(가운데 20 % 사각) 선다.
// ⚠️ 정규화는 손잡이의 **실제 최대 이동 반경**으로 한다(받침 반경이 아니다) — 끝까지 밀면 1 에 닿아야 최고 단계 속도가 나온다.
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

/** 받침 안에 가둔 뒤 데드존 안의 축을 십자선에 붙인 자리(px) — 손잡이를 그리는 자리이고, 입력도 이 자리에서 읽는다. */
export function snapKnob(dx: number, dy: number, travel: number, deadzone: number = DRIVE.deadzone): { x: number; y: number } {
  const k = clampKnob(dx, dy, travel);
  const band = deadzone * travel;
  return { x: Math.abs(k.x) < band ? 0 : k.x, y: Math.abs(k.y) < band ? 0 : k.y };
}

/** 한 축: 데드존 안은 0, 밖은 0→1 로 다시 편다. */
function rescale(v: number, dz: number): number {
  const a = Math.abs(v);
  if (a <= dz) return 0;
  return Math.sign(v) * Math.min(1, (a - dz) / (1 - dz));
}

/** 손잡이의 화면 변위(px, 아래가 +y) → 두 축. 반경 travel 에서 길이 1, 축마다 데드존(머리말). */
export function stickToInput(dx: number, dy: number, travel: number, deadzone: number = DRIVE.deadzone): DriveInput {
  if (travel <= 0) return ZERO_INPUT;
  const k = clampKnob(dx, dy, travel);
  const turn = rescale(k.x / travel, deadzone);
  const fwd = rescale(-k.y / travel, deadzone);
  return fwd === 0 && turn === 0 ? ZERO_INPUT : { fwd: fwd + 0, turn: turn + 0 }; // + 0 은 -0 을 0 으로
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

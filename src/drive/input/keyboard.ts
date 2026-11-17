// 키보드 입력원 — docs/PLAN-SIMPLE-DRIVE.md 결정 B5. 어느 키가 무엇인지는 keymap.ts 의 `drive.*` 가 정본이고, 여기는 눌린 물리 키
// 집합을 두 축으로 접기만 한다(누르는 동안 1, 떼면 0 — 부드러움은 운동학의 램프가 맡는다).
//
// ⚠️ 떼기는 **물리 키(code)로만** 푼다. 누를 때는 keymap 이 수식키를 보고 고르지만(matchesKey), 뗄 때 같은 판정을 하면 W 를 쥔 채
//    Shift 를 누르고 떼는 순간 keyup 이 아무 정의에도 안 맞아 W 가 영영 눌린 채로 남는다 — 휠체어가 혼자 달아난다.
// ⚠️ 대각(앞 + 오른쪽)은 길이 1 로 접는다 — 실제 조이스틱의 끝은 원이라 대각이 √2 가 아니다. 다음 단계의 화면 조이스틱과 같은 감각.
import { KEYMAP } from '../../core/keymap.ts';
import type { DriveInput } from '../model.ts';
import { ZERO_INPUT } from '../model.ts';
import type { DriveInputSource } from './types.ts';

type Axis = 'forward' | 'back' | 'left' | 'right';
const AXES: readonly Axis[] = ['forward', 'back', 'left', 'right'];

/** code → 축. keymap 의 drive.forward/back/left/right 에서 만든다(키를 두 곳에 적지 않는다). */
const AXIS_OF: ReadonlyMap<string, Axis> = new Map(
  AXES.flatMap((a) => (KEYMAP.find((d) => d.id === `drive.${a}`)?.codes ?? []).map((c) => [c, a] as const)),
);

export interface KeyboardDriveSource extends DriveInputSource {
  /** 움직임 키를 눌렀다 — 그 키가 움직임 키면 true(부르는 쪽이 사건을 먹는다). 자동 반복은 그대로 true 다. */
  press(code: string): boolean;
  /** 키를 뗐다 — 수식키와 무관하게 그 물리 키를 푼다. 움직임 키였으면 true. */
  release(code: string): boolean;
}

export function isDriveMotionCode(code: string): boolean {
  return AXIS_OF.has(code);
}

export function createKeyboardDriveSource(): KeyboardDriveSource {
  const down = new Set<string>();
  const held = (a: Axis): boolean => {
    for (const c of down) if (AXIS_OF.get(c) === a) return true;
    return false;
  };
  return {
    press(code) {
      if (!AXIS_OF.has(code)) return false;
      down.add(code);
      return true;
    },
    release(code) {
      return down.delete(code) || AXIS_OF.has(code);
    },
    read(): DriveInput {
      if (down.size === 0) return ZERO_INPUT;
      const fwd = (held('forward') ? 1 : 0) - (held('back') ? 1 : 0);
      const turn = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
      const mag = Math.hypot(fwd, turn);
      return mag > 1 ? { fwd: fwd / mag, turn: turn / mag } : { fwd, turn };
    },
    reset() {
      down.clear();
    },
  };
}

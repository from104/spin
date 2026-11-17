// 화면 조이스틱의 손잡이 변위 → 두 축(joystick.ts) — docs/PLAN-SIMPLE-DRIVE.md B5·C2.
// 지우면 새는 실기 버그: 위로 끌었는데 뒤로 가거나 왼쪽으로 끌었는데 오른쪽으로 도는 것(화면 y 는 아래가 +), 끝까지 밀어도
// 최고 단계 속도가 안 나오는 것(받침 반경으로 정규화), 데드존 안의 옆 떨림으로 곧게 못 가는 것, 기운 만큼 빨라지지 않는 것, 키보드로 몰 때 조이스틱을
// 살짝 건드린 손가락 떨림이 섞여 차가 비스듬히 가는 것, 놓았는데(reset) 손잡이가 기운 채 남는 것.
import { describe, expect, it, vi } from 'vitest';
import { DRIVE } from '../../core/constants.ts';
import { ZERO_INPUT } from '../model.ts';
import { combineDriveSources, createJoystickDriveSource, snapKnob, stickToInput } from './joystick.ts';
import type { DriveInputSource } from './types.ts';

const R = 50; // 손잡이 최대 이동 반경(px)
const fixed = (fwd: number, turn: number): DriveInputSource => ({ read: () => ({ fwd, turn }), reset: () => undefined });

describe('stickToInput — 화면 변위 → fwd·turn', () => {
  it('위 = 앞(fwd +), 오른쪽 = turn +, 끝까지 밀면 1 이고 받침 밖으로 끌어도 받침 끝과 같다', () => {
    expect(stickToInput(0, -R, R)).toEqual({ fwd: 1, turn: 0 });
    expect(stickToInput(R, 0, R)).toEqual({ fwd: 0, turn: 1 });
    expect(stickToInput(0, -3 * R, R)).toEqual({ fwd: 1, turn: 0 });
    const far = stickToInput(3 * R, 3 * R, R); // 오른쪽 아래로 받침 밖까지 = 받침 끝 대각선
    const diag = (Math.SQRT1_2 - DRIVE.deadzone) / (1 - DRIVE.deadzone);
    expect(far.fwd).toBeCloseTo(-diag, 9);
    expect(far.turn).toBeCloseTo(diag, 9);
  });

  it('축마다 데드존 — 안의 축은 0 이고 손잡이는 십자선에 붙는다, 밖은 가운데서 멀수록 빠르다', () => {
    const dz = DRIVE.deadzone;
    expect(stickToInput(0.1 * R, -0.1 * R, R)).toEqual(ZERO_INPUT); // 가운데
    const ahead = stickToInput((dz - 0.02) * R, -0.6 * R, R); // 앞으로, 옆으로 조금 샘
    expect(ahead.turn).toBe(0);
    expect(ahead.fwd).toBeCloseTo((0.6 - dz) / (1 - dz), 9);
    expect(snapKnob((dz - 0.02) * R, -0.6 * R, R)).toEqual({ x: 0, y: -0.6 * R });
    const spin = stickToInput(-0.8 * R, (dz - 0.02) * R, R); // 왼쪽으로, 아래로 조금 샘 = 제자리 반시계
    expect(spin.fwd).toBe(0);
    expect(spin.turn).toBeCloseTo(-(0.8 - dz) / (1 - dz), 9);
    expect(stickToInput(0, -0.5 * R, R).fwd).toBeLessThan(stickToInput(0, -0.9 * R, R).fwd);
  });
});

describe('조이스틱 입력원 + 키보드 합치기', () => {
  it('축마다 더해 [-1,1] 로 자르고, 데드존 안의 손가락 떨림은 키 입력에 섞이지 않는다', () => {
    const stick = createJoystickDriveSource();
    const both = combineDriveSources(fixed(1, 0), stick); // W 를 누른 채
    stick.set(stickToInput(0, -R, R)); // 조이스틱도 끝까지 위
    expect(both.read()).toEqual({ fwd: 1, turn: 0 });
    stick.set(stickToInput(0.1 * R, 0, R)); // 옆으로 10 % 떨림
    expect(both.read()).toEqual({ fwd: 1, turn: 0 });
  });

  it('reset 은 입력을 0 으로 하고 화면 쪽 손짓에도 알린다(합친 입력원을 거쳐도)', () => {
    const stick = createJoystickDriveSource();
    const onReset = vi.fn();
    stick.onReset(onReset);
    stick.set({ fwd: 0.5, turn: 0.5 });
    combineDriveSources(fixed(0, 0), stick).reset();
    expect(stick.read()).toEqual(ZERO_INPUT);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

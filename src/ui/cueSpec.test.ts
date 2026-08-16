// §4.3 P1-4 — 신호의 모양(순수). 합성은 jsdom 에서 못 재지만 **무엇을 낼 것인가** 는 전부 잰다.
import { describe, expect, it } from 'vitest';
import { cueSpec } from './cueSpec.ts';
import type { CueKind } from './cueSpec.ts';

const KINDS: CueKind[] = ['drop', 'blocked', 'trayReturn', 'trayArm', 'erase'];

describe('cueSpec — 계획서가 못박은 값', () => {
  it("놓임 '탁' 은 20ms 노이즈 버스트 + 로우패스이고 진동은 10ms 다", () => {
    const s = cueSpec('drop');
    expect(s.source).toBe('noise');
    expect(s.durationMs).toBe(20);
    expect(s.vibrateMs).toBe(10);
    // 로우패스가 실제로 걸린다 — 컷오프가 가청 상한(20kHz)에 있으면 필터가 없는 것과 같다.
    expect(s.cutoffHz).toBeLessThan(20000);
    expect(s.cutoffHz).toBeGreaterThan(0);
  });

  it('트레이 신호들만 음정이 있다 — 놓임·막힘과 소리의 종류 자체가 다르다', () => {
    const tray = cueSpec('trayReturn');
    expect(tray.source).toBe('sweep');
    expect(tray.fromHz).toBeGreaterThan(tray.toHz);
    expect(tray.toHz).toBeGreaterThan(0); // exponentialRamp 는 0 을 받으면 던진다
    expect(cueSpec('drop').source).toBe('noise');
    expect(cueSpec('blocked').source).toBe('noise');
  });

  // ── §6.10c 트레이 드롭 ──────────────────────────────────────────────────────────
  // 예고와 결과가 **소리로 구별돼야** 한다. 눈이 선수에게 가 있는 동안 판단하는 것이
  // "지금 놓으면 어떻게 되는가" 이기 때문이다.
  it('예고는 올라가고, 실제로 치우는 두 소리는 내려간다 — 방향이 뜻이다', () => {
    const arm = cueSpec('trayArm');
    expect(arm.source).toBe('sweep');
    expect(arm.toHz).toBeGreaterThan(arm.fromHz);
    for (const k of ['trayReturn', 'erase'] as CueKind[]) {
      const s = cueSpec(k);
      expect(s.fromHz, k).toBeGreaterThan(s.toHz);
      expect(s.toHz, k).toBeGreaterThan(0);
    }
  });

  it('예고가 가장 약하다 — 아무 일도 안 난 사건이 결과보다 크게 울리면 안 된다', () => {
    const arm = cueSpec('trayArm');
    for (const k of ['trayReturn', 'erase'] as CueKind[]) {
      expect(arm.gain, k).toBeLessThan(cueSpec(k).gain);
      expect(arm.durationMs, k).toBeLessThan(cueSpec(k).durationMs);
      expect(arm.vibrateMs, k).toBeLessThan(cueSpec(k).vibrateMs);
    }
  });

  // 빼기는 상자로 돌아가고 삭제는 안 돌아온다(removal.ts). 결과가 다르면 소리도 달라야 한다 —
  // 같으면 그 소리는 "돌아갔다" 를 뜻할 수 없다.
  it('삭제는 상자 빔보다 더 낮게·더 길게 떨어지고 더 세게 떤다', () => {
    const erase = cueSpec('erase');
    const tray = cueSpec('trayReturn');
    expect(erase.toHz).toBeLessThan(tray.toHz);
    expect(erase.durationMs).toBeGreaterThan(tray.durationMs);
    expect(erase.vibrateMs).toBeGreaterThan(tray.vibrateMs);
  });

  it('모든 신호가 들릴 수 있는 값이다 — 길이 > 0, 게인 (0,1], 진동 > 0', () => {
    for (const k of KINDS) {
      const s = cueSpec(k);
      expect(s.durationMs, k).toBeGreaterThan(0);
      expect(s.gain, k).toBeGreaterThan(0);
      expect(s.gain, k).toBeLessThanOrEqual(1);
      expect(s.vibrateMs, k).toBeGreaterThan(0);
    }
  });

  it('매번 새 객체를 준다 — 호출자가 반환값을 만져도 다음 호출이 오염되지 않는다', () => {
    const a = cueSpec('drop');
    const b = cueSpec('drop');
    expect(a).not.toBe(b);
    a.gain = 0.99;
    expect(cueSpec('drop').gain).not.toBe(0.99);
  });
});

describe("cueSpec — 막힘 '툭' 만 세기를 읽는다", () => {
  it('세기가 오르면 게인·컷오프·길이·진동이 함께 오른다', () => {
    const soft = cueSpec('blocked', 0);
    const mid = cueSpec('blocked', 0.5);
    const hard = cueSpec('blocked', 1);
    expect(soft.gain).toBeLessThan(mid.gain);
    expect(mid.gain).toBeLessThan(hard.gain);
    expect(soft.cutoffHz).toBeLessThan(hard.cutoffHz);
    expect(soft.durationMs).toBeLessThan(hard.durationMs);
    expect(soft.vibrateMs).toBeLessThan(hard.vibrateMs);
  });

  it('가장 센 막힘도 놓임보다 어둡다 — 두 소리가 귀에서 구별돼야 눈을 안 쓴다', () => {
    expect(cueSpec('blocked', 1).cutoffHz).toBeLessThan(cueSpec('drop').cutoffHz);
  });

  it('세기는 0..1 로 잘린다 — 음수도 100 도 양끝으로 접힌다', () => {
    expect(cueSpec('blocked', -5)).toEqual(cueSpec('blocked', 0));
    expect(cueSpec('blocked', 99)).toEqual(cueSpec('blocked', 1));
  });

  it('NaN 은 가장 약한 값으로 접힌다 — 세기는 나눗셈에서 오므로 0/0 이 반드시 온다', () => {
    expect(cueSpec('blocked', NaN)).toEqual(cueSpec('blocked', 0));
    // Infinity 는 방향이 분명하므로 그냥 잘린다(NaN 처럼 0 으로 몰지 않는다).
    expect(cueSpec('blocked', Number.POSITIVE_INFINITY)).toEqual(cueSpec('blocked', 1));
    expect(cueSpec('blocked', Number.NEGATIVE_INFINITY)).toEqual(cueSpec('blocked', 0));
  });

  it('진동 길이는 정수 ms 다 — 하드웨어가 그보다 잘게 못 떤다', () => {
    for (const t of [0, 0.13, 0.37, 0.5, 0.82, 1]) {
      expect(Number.isInteger(cueSpec('blocked', t).vibrateMs), `t=${t}`).toBe(true);
    }
  });

  it('놓임과 상자 빔은 세기를 무시한다 — 세기가 없는 사건이다', () => {
    expect(cueSpec('drop', 0)).toEqual(cueSpec('drop', 1));
    expect(cueSpec('trayReturn', 0)).toEqual(cueSpec('trayReturn', 1));
    expect(cueSpec('trayArm', 0)).toEqual(cueSpec('trayArm', 1));
    expect(cueSpec('erase', 0)).toEqual(cueSpec('erase', 1));
    // 대조군: 같은 두 인자를 막힘에 주면 실제로 달라진다(무시가 '아무 일도 안 함' 이 아니다).
    expect(cueSpec('blocked', 0)).not.toEqual(cueSpec('blocked', 1));
  });
});

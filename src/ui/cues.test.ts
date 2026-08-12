// §4.3 P1-4 어댑터의 **게이트와 수명**. 합성(renderCue)은 여기 없다 — jsdom 에 WebAudio 가
// 없어서 잴 수 없고, 그래서 그 함수에는 판단을 두지 않았다(cues.ts 머리말).
//
// 완료 판정의 본체가 이 파일에 있다: **`prefs.a11y.sound` 가 꺼져 있으면 AudioContext 를
// 아예 열지 않는다.** 껐는데 열리면 그건 거짓말이다.
import { describe, expect, it, vi } from 'vitest';
import { createCuePlayer } from './cues.ts';
import type { CueDeps } from './cues.ts';
import { cueSpec } from './cueSpec.ts';

interface FakeCtx {
  state: string;
  resume: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function fakeCtx(state: string = 'running'): FakeCtx {
  return { state, resume: vi.fn(() => Promise.resolve()), close: vi.fn(() => Promise.resolve()) };
}

/** 컨텍스트를 **몇 번** 열려고 했는지가 이 파일의 주 계측점이다. */
function harness(opts: { ctx?: FakeCtx | null } = {}) {
  const made = 'ctx' in opts ? opts.ctx : fakeCtx();
  const makeContext = vi.fn(() => (made ? (made as unknown as AudioContext) : null));
  const render = vi.fn<CueDeps['render']>();
  const vibrate = vi.fn<CueDeps['vibrate']>();
  const player = createCuePlayer({ makeContext, render, vibrate });
  return { player, makeContext, render, vibrate, ctx: made };
}

describe('cues — 꺼져 있으면 AudioContext 를 아예 열지 않는다', () => {
  it('기본값은 꺼짐이다 — 아무도 켜지 않았는데 소리가 나지 않는다', () => {
    const h = harness();
    h.player.play('drop');
    h.player.play('blocked', 1);
    h.player.play('trayReturn');
    h.player.arm();
    expect(h.makeContext, 'AudioContext 를 열려고 시도했다').not.toHaveBeenCalled();
    expect(h.render).not.toHaveBeenCalled();
    expect(h.player.isOpen()).toBe(false);

    // ★ 대조군 — 스파이가 아예 안 걸린 것이 아니다. 켜면 같은 호출이 전부 통과한다.
    h.player.setEnabled(true);
    h.player.play('drop');
    expect(h.makeContext).toHaveBeenCalledTimes(1);
    expect(h.render).toHaveBeenCalledTimes(1);
    expect(h.player.isOpen()).toBe(true);
  });

  it('꺼져 있으면 진동도 안 한다 — 소리와 진동은 한 스위치다', () => {
    const h = harness();
    h.player.play('drop');
    expect(h.vibrate).not.toHaveBeenCalled();

    h.player.setEnabled(true);
    h.player.play('drop');
    expect(h.vibrate).toHaveBeenCalledWith(cueSpec('drop').vibrateMs);
  });

  it('껐던 순간 열려 있던 컨텍스트는 닫는다 — 끄기가 "다음부터" 가 아니다', () => {
    const h = harness();
    h.player.setEnabled(true);
    h.player.play('drop');
    expect(h.player.isOpen()).toBe(true);

    h.player.setEnabled(false);
    expect(h.ctx!.close).toHaveBeenCalledTimes(1);
    expect(h.player.isOpen()).toBe(false);

    h.render.mockClear();
    h.player.play('drop');
    expect(h.render).not.toHaveBeenCalled();
  });

  it('reset() 은 끄고 닫고 미지원 기억까지 지운다', () => {
    const h = harness();
    h.player.setEnabled(true);
    h.player.play('drop');
    h.player.reset();
    expect(h.player.isOpen()).toBe(false);
    expect(h.ctx!.close).toHaveBeenCalledTimes(1);
    h.player.play('drop');
    expect(h.render).toHaveBeenCalledTimes(1); // reset 뒤의 호출은 안 울렸다
  });
});

describe('cues — 첫 사용자 제스처에서 한 번만 연다', () => {
  it('세 번 울려도 컨텍스트는 하나다', () => {
    const h = harness();
    h.player.setEnabled(true);
    h.player.play('drop');
    h.player.play('blocked', 0.5);
    h.player.play('trayReturn');
    expect(h.makeContext).toHaveBeenCalledTimes(1);
    expect(h.render).toHaveBeenCalledTimes(3);
  });

  it('arm() 이 미리 열어 두면 뒤이은 play 는 새로 열지 않는다 — 첫 탁이 삼켜지는 것을 막는 배선이다', () => {
    const h = harness();
    h.player.setEnabled(true);
    h.player.arm();
    expect(h.makeContext).toHaveBeenCalledTimes(1);
    expect(h.render).not.toHaveBeenCalled(); // 여는 것과 울리는 것은 다르다
    h.player.play('drop');
    expect(h.makeContext).toHaveBeenCalledTimes(1);
  });

  it("'suspended' 로 태어난 컨텍스트는 깨운다 — 자동재생 정책이 그렇게 준다", () => {
    const h = harness({ ctx: fakeCtx('suspended') });
    h.player.setEnabled(true);
    h.player.arm();
    expect(h.ctx!.resume).toHaveBeenCalledTimes(1);
  });

  it("'running' 이면 깨우지 않는다 — 대조군", () => {
    const h = harness({ ctx: fakeCtx('running') });
    h.player.setEnabled(true);
    h.player.arm();
    expect(h.ctx!.resume).not.toHaveBeenCalled();
  });

  it('백그라운드에서 멎은 컨텍스트는 다음 제스처에 다시 깨운다', () => {
    const h = harness();
    h.player.setEnabled(true);
    h.player.arm();
    h.ctx!.state = 'suspended'; // 탭이 숨겨졌다 돌아온 상태
    h.player.play('drop');
    expect(h.ctx!.resume).toHaveBeenCalledTimes(1);
    expect(h.makeContext).toHaveBeenCalledTimes(1); // 새로 열지는 않는다
  });
});

describe('cues — WebAudio 가 없는 기기', () => {
  it('컨텍스트를 못 열어도 던지지 않고, 진동은 그대로 나간다', () => {
    const h = harness({ ctx: null });
    h.player.setEnabled(true);
    expect(() => h.player.play('drop')).not.toThrow();
    expect(h.render).not.toHaveBeenCalled();
    expect(h.vibrate).toHaveBeenCalledTimes(1); // 두 채널은 독립이다
  });

  it('미지원이면 두 번 묻지 않는다 — 놓을 때마다 생성자를 두드리지 않는다', () => {
    const h = harness({ ctx: null });
    h.player.setEnabled(true);
    h.player.play('drop');
    h.player.play('drop');
    h.player.play('drop');
    expect(h.makeContext).toHaveBeenCalledTimes(1);
    expect(h.vibrate).toHaveBeenCalledTimes(3);
  });
});

describe('cues — 세기를 신호로 옮긴다', () => {
  it('play 가 넘긴 세기가 그대로 spec 이 된다', () => {
    const h = harness();
    h.player.setEnabled(true);
    h.player.play('blocked', 0.2);
    h.player.play('blocked', 0.9);
    expect(h.render.mock.calls[0]![0]).toEqual(cueSpec('blocked', 0.2));
    expect(h.render.mock.calls[1]![0]).toEqual(cueSpec('blocked', 0.9));
    expect(h.render.mock.calls[0]![0]!.gain).toBeLessThan(h.render.mock.calls[1]![0]!.gain);
  });

  it('세기를 안 주면 1 이다 — 놓임·상자 빔은 늘 같은 소리다', () => {
    const h = harness();
    h.player.setEnabled(true);
    h.player.play('drop');
    expect(h.render.mock.calls[0]![0]).toEqual(cueSpec('drop'));
  });

  it('진동 인자는 신호마다 다르다 — 세 사건이 손끝에서도 갈린다', () => {
    const h = harness();
    h.player.setEnabled(true);
    h.player.play('drop');
    h.player.play('trayReturn');
    expect(h.vibrate.mock.calls[0]![0]).toBe(cueSpec('drop').vibrateMs);
    expect(h.vibrate.mock.calls[1]![0]).toBe(cueSpec('trayReturn').vibrateMs);
    expect(h.vibrate.mock.calls[0]![0]).not.toBe(h.vibrate.mock.calls[1]![0]);
  });
});

// 부트 마크 넘겨받기 — `index.html` 의 정지 마크에서 React 로더의 회전으로 (2026-09-15).
//
// 지우면 새는 것 셋. 셋 다 **조용한** 고장이라 다른 테스트가 못 잡는다:
// ① 마크를 안 걷으면 **화면이 영영 덮인다.** 부트 마크는 `position:fixed; inset:0` 에 불투명한
//    전면 판이다. 감지가 한 줄만 어긋나도 앱은 멀쩡히 돌면서 아무것도 안 보인다 — 에러 0개.
// ② 걷는 것과 돌리는 것의 **순서**. 먼저 돌리면 부트 마크 뒤에서 사이클이 흘러가다가 마크를
//    지우는 순간 중간 자세(실기 53%)라 그림이 튄다. 정지 자세 = 사이클 0% 라는 성질이 여기서만
//    값을 낸다.
// ③ 프레임이 끝내 안 좋아져도 **언젠가는 돌아야 한다**(BOOT_SETTLE_CAP_MS). 상한이 없으면 느린
//    기기에서 정지 마크만 보다 끝난다.
//
// rAF 를 직접 돌린다 — jsdom 에는 진짜 프레임이 없고, 여기서 재려는 것은 «프레임 간격을 이렇게
// 주면 언제 넘어가는가» 라는 판정이지 실제 타이밍이 아니다(실제 타이밍은 WebKit 실측이 본다).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { AppLoaderOverlay } from './AppLoaderOverlay.tsx';
import { BOOT_SETTLE_CAP_MS, BOOT_SETTLE_FRAMES, BOOT_SETTLE_FRAME_MS } from './appLoaderTiming.ts';

/** 대기 중인 rAF 콜백. 테스트가 시각을 직접 먹인다. */
let queue: FrameRequestCallback[] = [];
let now = 0;

function frame(gapMs: number): void {
  now += gapMs;
  const due = queue;
  queue = [];
  act(() => {
    for (const cb of due) cb(now);
  });
}

/** 회전 중인가 — `SpinLoaderMark` 가 `animation-play-state` 로 세우고 돌린다. */
function spinning(): boolean {
  const mark = document.querySelector<SVGElement>('.spin-mark');
  return mark?.style.animationPlayState === 'running';
}
const bootMark = (): HTMLElement | null => document.getElementById('spin-boot');

beforeEach(() => {
  now = 0;
  queue = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    queue.push(cb);
    return queue.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const el = document.createElement('div');
  el.id = 'spin-boot';
  document.body.appendChild(el);
});

afterEach(() => {
  cleanup();
  bootMark()?.remove();
  vi.restoreAllMocks();
});

/** 느린 프레임 한 번 = 아직 진정이 아니다. `BOOT_SETTLE_FRAME_MS` 를 **넘겨야** 한다. */
const SLOW = BOOT_SETTLE_FRAME_MS + 20;
const FAST = BOOT_SETTLE_FRAME_MS - 10;

describe('부트 마크 넘겨받기', () => {
  it('프레임이 느린 동안은 정지 자세로 서 있는다 — 끊기는 회전을 보여 주느니 안 돌린다', () => {
    render(<AppLoaderOverlay visible kind="boot" />);
    expect(spinning(), '마운트 직후').toBe(false);
    for (let i = 0; i < 6; i++) frame(SLOW);
    expect(spinning(), '느린 프레임만 이어지면 계속 정지').toBe(false);
    expect(bootMark(), '부트 마크도 그대로 — 두 마크가 같은 그림이라 화면은 안 바뀐다').not.toBeNull();
  });

  it('프레임이 제때 오면 **먼저 걷고 그 다음에** 돈다 — 이 순서가 이음매를 없앤다', () => {
    render(<AppLoaderOverlay visible kind="boot" />);
    for (let i = 0; i < BOOT_SETTLE_FRAMES; i++) frame(FAST);
    // 1단계: 마크는 걷혔는데 아직 안 돈다. 이 한 프레임이 «앱이 처음 래스터화되는» 비싼
    // 프레임이고(실측 75ms), 회전을 여기 겹치면 첫 발길질이 통째로 떨어진다.
    expect(bootMark(), '걷혔다').toBeNull();
    expect(spinning(), '아직 안 돈다').toBe(false);

    for (let i = 0; i < BOOT_SETTLE_FRAMES; i++) frame(FAST);
    expect(spinning(), '프레임이 다시 제때 오는 것을 보고 나서 돈다').toBe(true);
  });

  it('연속이 끊기면 처음부터 다시 센다 — 긴 작업 사이의 우연한 틈에 안 속는다', () => {
    render(<AppLoaderOverlay visible kind="boot" />);
    for (let i = 0; i < BOOT_SETTLE_FRAMES - 1; i++) frame(FAST);
    frame(SLOW);
    for (let i = 0; i < BOOT_SETTLE_FRAMES - 1; i++) frame(FAST);
    expect(bootMark(), '아직 한 칸 모자라다').not.toBeNull();
    frame(FAST);
    expect(bootMark()).toBeNull();
  });

  it('끝내 안 좋아져도 상한에서 넘어간다 — 느린 기기에서 정지 마크만 보다 끝나지 않는다', () => {
    render(<AppLoaderOverlay visible kind="boot" />);
    // 느린 프레임만으로 상한을 넘긴다.
    while (now <= BOOT_SETTLE_CAP_MS) frame(SLOW);
    expect(bootMark(), '상한에서 걷는다').toBeNull();
    frame(SLOW);
    expect(spinning(), '상한 뒤에는 프레임이 나빠도 돈다').toBe(true);
  });

  it('판이 사라져도 마크는 걷힌다 — 정리 없이 언마운트되면 화면이 영영 덮인다', () => {
    const view = render(<AppLoaderOverlay visible kind="boot" />);
    frame(FAST);
    view.unmount();
    expect(bootMark()).toBeNull();
  });

  it('부트 마크가 애초에 없으면(프리렌더 글·감축 모션) 기다리지 않고 바로 돈다', () => {
    bootMark()!.remove();
    render(<AppLoaderOverlay visible kind="boot" />);
    expect(spinning()).toBe(true);
  });
});

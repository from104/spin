// 고정 timestep 누산기 + alpha 렌더 보간 + 정착(settle) 타이머. §5.8.
import { PHYS } from '../core/constants.ts';

export interface PhysicsLoop {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  /** pointerup 이후 정착 구간을 요청한다. atRest() 가 참이 되거나 ms 가 지나면 자동으로 stop 한다
   *  (§5.9 settleMaxMs 는 하드 컷이 아니라 안전망 — 정상 경로는 atRest() 조기 종료). */
  requestSettle(ms?: number): void;
  /** blocker 회귀(§5.8): 정착 대기 중(settleDeadline 이 살아있는 상태) 새 드래그가 시작되면
   *  반드시 호출해야 한다 — 안 하면 이전 requestSettle 이 남긴 데드라인이 살아있다가 드래그
   *  도중 공이 잠깐 멈추는 순간(atRest()===true) 루프가 stop() 되어 휠체어가 얼어붙는다. */
  cancelSettle(): void;
}

export function createLoop(o: {
  step: (dtSeconds: number) => void;
  render: (alpha: number) => void;
  atRest: () => boolean;
  /** 정착 구간이 **스스로 닫힌** 순간에 한 번 불린다(멈춤 감지 또는 상한 도달). 밖에서 부른
   *  stop()·cancelSettle() 에는 불리지 않는다 — "판이 다 섰다" 를 뜻하는 신호이지 "루프가
   *  꺼졌다" 가 아니기 때문이다(§4.2 P0-2 정착 후 재커밋이 이 구분에 기댄다). */
  onSettle?: () => void;
}): PhysicsLoop {
  let running = false;
  let rafId = 0;
  let last = 0;
  let acc = 0;
  let settleDeadline: number | null = null;

  function frame(now: number): void {
    if (!running) return;
    let elapsed = now - last;
    last = now;
    if (elapsed > PHYS.accClampMs) elapsed = PHYS.accClampMs; // 탭 백그라운드 복귀
    acc += elapsed;

    let n = 0;
    while (acc >= PHYS.dtMs && n < PHYS.maxSubsteps) {
      o.step(PHYS.dtS); // ★ 항상 고정 dt. rAF dt 를 넣지 않는다
      acc -= PHYS.dtMs;
      n++;
    }
    if (n === PHYS.maxSubsteps) acc = 0; // 밀린 시간은 버린다(몰아치기 금지)
    o.render(acc / PHYS.dtMs);

    if (settleDeadline !== null && (o.atRest() || now >= settleDeadline)) {
      settleDeadline = null;
      stop();
      // stop() 뒤에 알린다 — 통지를 받은 쪽이 isRunning()==false 인 "다 선 판" 을 보게 한다.
      o.onSettle?.();
      return;
    }
    rafId = requestAnimationFrame(frame);
  }

  function start(): void {
    if (running) return;
    running = true;
    last = performance.now();
    acc = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stop(): void {
    running = false;
    settleDeadline = null;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function isRunning(): boolean {
    return running;
  }

  function requestSettle(ms: number = PHYS.settleMaxMs): void {
    settleDeadline = performance.now() + ms;
    if (!running) start();
  }

  function cancelSettle(): void {
    settleDeadline = null;
  }

  return { start, stop, isRunning, requestSettle, cancelSettle };
}

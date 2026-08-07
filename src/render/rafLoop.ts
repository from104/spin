// §6.3 — 앱 전체 단일 rAF 루프. 컴포넌트마다 requestAnimationFrame 을 열지 않는다.
// 물리 스텝(§5.8)·스텝 전환 트윈(§6.7)·드래그 포인터 흘려보내기(§6.4)가 전부 이 하나의
// 루프에 구독한다.

export interface RafScheduler {
  /** 구독을 등록하고 해지 함수를 반환한다. 첫 구독 시 루프를 켜고, 구독이 0개가 되면 잠든다. */
  add(fn: (dtMs: number, nowMs: number) => void): () => void;
}

function createRafScheduler(): RafScheduler {
  const subs = new Set<(dtMs: number, nowMs: number) => void>();
  let id = 0;
  let last = 0;

  const tick = (now: number): void => {
    const dt = Math.min(50, now - last);
    last = now;
    id = 0; // ★ 콜백이 해지해도 상태 일관
    for (const fn of Array.from(subs)) fn(dt, now); // ★ 순회 중 Set 변경 방어
    // 마지막 구독자가 tick 안에서 해지할 때(정확히 isSettled()·트윈 종료가 그렇다)
    // cancelAnimationFrame 은 이미 발화한 프레임을 취소할 수 없어 no-op 이 된다 —
    // 그래서 무조건 재예약하지 않고 남은 구독이 있을 때만 예약한다. 루프가 영원히
    // 멈추지 않으면 Wake Lock 을 켠 90분 시연에서 배터리를 그대로 태운다.
    if (subs.size && !id) id = requestAnimationFrame(tick);
  };

  function add(fn: (dtMs: number, nowMs: number) => void): () => void {
    const wasEmpty = subs.size === 0;
    subs.add(fn);
    if (wasEmpty) {
      last = performance.now();
      id = requestAnimationFrame(tick);
    }
    return () => {
      subs.delete(fn);
    };
  }

  return { add };
}

export const raf: RafScheduler = createRafScheduler();

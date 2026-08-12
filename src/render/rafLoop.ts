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

  // ★ 체인은 언제나 **하나**다(§4.2 알려진 이슈 #2, 1.5).
  //
  // 원래는 해지 함수가 `subs.delete(fn)` 만 했다. 그러면 "마지막 구독자는 나갔는데 예약은 아직
  // 살아 있는" 창이 프레임 하나만큼 열린다(tick 은 어차피 subs 가 비면 재예약하지 않으니 잠들긴
  // 한다). 그 창 안에서 새 구독이 들어오면 `wasEmpty` 만 보고 **두 번째 체인**을 예약했다.
  // 두 체인은 서로를 모른 채 각자 재예약하므로 영원히 둘로 남고, 이 일이 일어날 때마다 하나씩
  // 는다 — 실측: 해지→재구독을 5번 반복하면 프레임당 콜백이 1→6 이 된다. 체인이 n 개면 모든
  // 구독자가 한 프레임에 n 번 불린다(물리 렌더 펌프 writeFrame · 시연 보간 sampleDrill 이
  // 그만큼 곱해진다). 편집 중 브라우저가 서서히 멎는 모양이 정확히 이것이다.
  //
  // 창이 열리는 실제 경로 둘: 같은 커밋 안의 언마운트→마운트(StrictMode 이중 호출 · 화면 왕복)
  // 와, 렌더마다 deps 가 바뀌는 rAF 구독 이펙트(콜백을 인라인으로 넘기면 그렇게 된다).
  //
  // 그래서 **비면 예약을 접는다**. tick 안에서 해지될 때는 `id` 가 이미 0 이라(위 ★) 아무 일도
  // 하지 않고, 그 경우는 tick 꼬리의 `subs.size` 검사가 원래대로 잠재운다.
  function add(fn: (dtMs: number, nowMs: number) => void): () => void {
    const wasEmpty = subs.size === 0;
    subs.add(fn);
    // `!id` 는 이중 안전장치다 — 위 정리가 이미 id 를 0 으로 만들지만, "예약이 살아 있으면
    // 또 예약하지 않는다" 는 것이 이 스케줄러의 불변식이므로 그 자리에 그대로 적어 둔다.
    if (wasEmpty && !id) {
      last = performance.now();
      id = requestAnimationFrame(tick);
    }
    return () => {
      subs.delete(fn);
      if (subs.size === 0 && id) {
        cancelAnimationFrame(id);
        id = 0;
      }
    };
  }

  return { add };
}

export const raf: RafScheduler = createRafScheduler();

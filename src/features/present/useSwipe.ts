// §6.9 스와이프. `|dx| > 60 CSS px && |dx| > 2|dy|`, 엣지 20px 무시, 단일 포인터만.
// 시간 상한(SWIPE_MAX_MS)은 두지 않는다 — 느린 제스처를 배제하면 운동 장애 사용자가 스텝을
// 넘길 수 없다. 시연 모드에는 다른 포인터 조작이 없어 오작동 위험도 없다.
import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface PointerHandlers {
  onPointerDown(e: ReactPointerEvent): void;
  onPointerMove(e: ReactPointerEvent): void;
  onPointerUp(e: ReactPointerEvent): void;
  onPointerCancel(e: ReactPointerEvent): void;
}

const MIN_DX = 60;
const EDGE_PX = 20;

export function useSwipe(o: { onPrev(): void; onNext(): void }): PointerHandlers {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent): void => {
    if (start.current !== null) return; // 단일 포인터만 — 두 번째 손가락은 완전 무시
    if (e.clientX < EDGE_PX || e.clientX > window.innerWidth - EDGE_PX) return; // 엣지 스와이프 보존
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };

  const finish = (e: ReactPointerEvent): void => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > MIN_DX && Math.abs(dx) > 2 * Math.abs(dy)) {
      if (dx < 0) o.onNext();
      else o.onPrev();
    }
  };

  const onPointerUp = (e: ReactPointerEvent): void => finish(e);
  const onPointerCancel = (e: ReactPointerEvent): void => {
    if (start.current?.id === e.pointerId) start.current = null; // 취소는 스와이프로 치지 않는다
  };
  const onPointerMove = (): void => {}; // 판정은 종료 시점 1회 — 중간 추적이 필요 없다

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}

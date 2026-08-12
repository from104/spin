// §4.4 P2-3 — 스텝 사진 뭉치를 **끌어서** 다시 쌓는다.
//
// useTrayDrag 와 같은 골격이다: HTML5 드래그 앤 드롭은 태블릿에서 사실상 동작하지 않으므로
// 포인터 이벤트로 직접 만들고, 세션은 ref 에 둔다. 다른 점은 두 가지다.
//   · **미리보기만 state 다.** 칸을 넘을 때만 setState 하므로 프레임마다 리렌더가 나지 않는다
//     (§6.1 규칙 1 — React 는 프레임 단위 움직임을 구동하지 않는다). 칩이 손가락을 따라다니지
//     않고 **줄이 갈라지는** 방식인 것도 같은 이유다.
//   · **커밋은 손을 뗄 때 한 번.** 칸을 넘을 때마다 dispatch 하면 되돌리기가 지나온 칸 수만큼
//     쌓여, 한 번 끈 것을 되돌리는 데 여러 번 눌러야 한다.
import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { StepId } from '../../core/ids.ts';
import { dropIndexAt } from './bottomBarMetrics.ts';

/** 이만큼 움직이기 전에는 드래그로 치지 않는다. useTrayDrag 와 같은 값 — 같은 손가락이
 *  같은 화면에서 하는 일이라 문턱이 다르면 "여기서는 왜 안 잡히지" 가 된다. */
const DRAG_THRESHOLD_PX = 6;

export interface StepDragState {
  id: StepId;
  /** 끌기 시작할 때의 자리. */
  from: number;
  /** 지금 놓이게 될 자리(미리보기). */
  to: number;
}

export interface UseStepReorderDragOptions {
  /** 지금 **화면에 보이는 순서**대로의 칩 중심 x. 미리보기가 바뀌면 DOM 도 바뀌므로 매번 다시 잰다. */
  measureCenters(): number[];
  /** 손을 떼며 자리가 실제로 바뀌었을 때만 부른다. */
  onCommit(id: StepId, toIndex: number): void;
}

export interface StepReorderDrag {
  /** 끌고 있는 칩과 미리보기 자리. 문턱을 넘기 전에는 null. */
  state: StepDragState | null;
  /** 칩의 onPointerDown 에 그대로 연결한다. */
  start(e: ReactPointerEvent, id: StepId, from: number): void;
  /** 방금 끝난 것이 드래그였는가(=뒤따르는 click 을 삼켜야 하는가). 한 번 읽으면 지워진다. */
  consumeDragClick(): boolean;
}

export function useStepReorderDrag({ measureCenters, onCommit }: UseStepReorderDragOptions): StepReorderDrag {
  const [state, setState] = useState<StepDragState | null>(null);
  const optsRef = useRef({ measureCenters, onCommit });
  optsRef.current = { measureCenters, onCommit };
  const clickBlockedRef = useRef(false);
  const sessionRef = useRef<{
    id: StepId;
    from: number;
    to: number;
    pointerId: number;
    startX: number;
    moved: boolean;
    cleanup(): void;
  } | null>(null);

  const start = useCallback((e: ReactPointerEvent, id: StepId, from: number) => {
    if (sessionRef.current) return;
    // 주 버튼(왼쪽·터치·펜)만. 오른쪽 버튼으로 줄을 흐트러뜨릴 이유가 없다.
    if (e.button !== 0) return;

    const onMove = (ev: PointerEvent) => {
      const s = sessionRef.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      if (!s.moved) {
        if (Math.abs(ev.clientX - s.startX) < DRAG_THRESHOLD_PX) return;
        s.moved = true;
        setState({ id: s.id, from: s.from, to: s.to });
      }
      const to = dropIndexAt(optsRef.current.measureCenters(), ev.clientX, s.to);
      if (to === s.to) return; // 칸을 안 넘었으면 리렌더도 없다
      s.to = to;
      setState({ id: s.id, from: s.from, to });
    };
    const finish = (ev: PointerEvent) => {
      const s = sessionRef.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      sessionRef.current = null;
      s.cleanup();
      setState(null);
      if (!s.moved) return;
      // 문턱을 넘었으면 제자리에 놓았더라도 click 은 삼킨다 — 끌다 만 것이 선택으로 둔갑하면
      // "왜 다른 스텝이 열렸지" 가 된다.
      clickBlockedRef.current = true;
      if (s.to !== s.from) optsRef.current.onCommit(s.id, s.to);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    sessionRef.current = {
      id,
      from,
      to: from,
      pointerId: e.pointerId,
      startX: e.clientX,
      moved: false,
      cleanup() {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
      },
    };
  }, []);

  const consumeDragClick = useCallback(() => {
    const blocked = clickBlockedRef.current;
    clickBlockedRef.current = false;
    return blocked;
  }, []);

  return { state, start, consumeDragClick };
}

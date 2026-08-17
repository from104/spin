// §다중 선택(⑤) 일괄 이동 — 체크된 묶음을 통째로 끌어 옮긴다(기현님 확정 2026-08-17,
// PLAN-STEP-EDITING.md §다중 선택: "체크된 카드 아무거나 드래그하면 묶음이 함께 이동, 놓을
// 틈이 하이라이트").
//
// useStepReorderDrag(단일 카드 드래그)와 **병행**한다 — 그 훅의 계약(단일 카드 재정렬, from/to
// 가 "전체 카드 중 자기 자신을 뺀 좌표계")을 건드리지 않기 위해서다. 묶음 드래그는 좌표계가
// 다르다: 자기 자신 하나가 아니라 **그룹 전체를 뺀 나머지** 카드 중심이 기준이다(edits.ts
// moveSteps 의 toIndex 계약과 같아야 미리보기(movedOrderGroup)·커밋이 어긋나지 않는다).
//
// "from" 을 안 쓴다 — 왜인가: 체크된 카드들은 원래 화면에서 흩어져 있을 수 있다(사이사이에
// 체크 안 된 카드가 낀 채로). 그러면 "지금 몇 번째 틈에 있나" 를 대표하는 단일 숫자가 애초에
// 없다. 그래서 손을 뗄 때 **항상** onCommit 을 부르고, 진짜 무변경(이미 이웃해 있던 선택을
// 같은 자리에 도로 놓은 경우)만 걸러내는 일은 moveSteps 의 항등 반환(참조 비교)에 맡긴다 —
// withHistory 가 `next === s.present` 로 히스토리·리렌더를 억제하므로 여기서 중복으로 판정할
// 필요가 없다.
import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { StepId } from '../../core/ids.ts';
import { dropIndexInRest } from './bottomBarMetrics.ts';

/** useStepReorderDrag.ts 와 같은 값 — 같은 손가락이 같은 화면에서 하는 일이라 문턱이 다르면
 *  "여기서는 왜 안 잡히지" 가 된다. */
const DRAG_THRESHOLD_PX = 6;

export interface StepGroupDragState {
  ids: ReadonlySet<StepId>;
  /** 지금 놓이게 될 자리(미리보기) — **나머지(비선택) 카드 순서 안에서의** 삽입 자리다. */
  to: number;
}

export interface UseStepGroupReorderDragOptions {
  /** 지금 화면에 보이는 순서대로의, **그룹을 뺀 나머지** 카드 중심 y 좌표. 미리보기가 바뀌면
   *  DOM 도 바뀌므로 매번 다시 잰다(useStepReorderDrag.measureCenters 와 같은 이유). */
  measureRestCenters(groupIds: ReadonlySet<StepId>): number[];
  /** 손을 떼며 문턱을 넘겼을 때(=끌었을 때) 부른다. 자리가 실제로 안 바뀐 경우도 부른다 —
   *  위 머리말의 "from 을 안 쓴다" 참고, 무변경 판정은 커밋 쪽(moveSteps)의 몫이다. */
  onCommit(ids: StepId[], toIndex: number): void;
}

export interface StepGroupReorderDrag {
  /** 끌고 있는 묶음과 미리보기 자리. 문턱을 넘기 전에는 null. */
  state: StepGroupDragState | null;
  /** 체크된 카드의 onPointerDown 에 연결한다. `groupIds` 가 비어 있으면 아무 일도 안 한다. */
  start(e: ReactPointerEvent, groupIds: ReadonlySet<StepId>): void;
  /** 방금 끝난 것이 드래그였는가(=뒤따르는 click 을 삼켜야 하는가). 한 번 읽으면 지워진다. */
  consumeDragClick(): boolean;
}

export function useStepGroupReorderDrag({ measureRestCenters, onCommit }: UseStepGroupReorderDragOptions): StepGroupReorderDrag {
  const [state, setState] = useState<StepGroupDragState | null>(null);
  const optsRef = useRef({ measureRestCenters, onCommit });
  optsRef.current = { measureRestCenters, onCommit };
  const clickBlockedRef = useRef(false);
  const sessionRef = useRef<{
    ids: ReadonlySet<StepId>;
    to: number;
    pointerId: number;
    startY: number;
    moved: boolean;
    cleanup(): void;
  } | null>(null);

  const start = useCallback((e: ReactPointerEvent, groupIds: ReadonlySet<StepId>) => {
    if (sessionRef.current) return;
    if (e.button !== 0) return; // 주 버튼만 — useStepReorderDrag 와 같은 이유
    if (groupIds.size === 0) return;

    const onMove = (ev: PointerEvent) => {
      const s = sessionRef.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      const y = ev.clientY;
      if (!s.moved) {
        if (Math.abs(y - s.startY) < DRAG_THRESHOLD_PX) return;
        s.moved = true;
      }
      // dropIndexInRest 는 dropIndexAt 과 상한이 다르다(그 함수 머리말 참고) — 나머지 M 개
      // 사이에 묶음을 꽂을 자리는 M+1 군데라, "맨 뒤" 도 유효한 답(=M)이어야 한다.
      const to = dropIndexInRest(optsRef.current.measureRestCenters(s.ids), y);
      if (to === s.to) return; // 칸을 안 넘었으면 리렌더도 없다
      s.to = to;
      setState({ ids: s.ids, to });
    };
    const finish = (ev: PointerEvent) => {
      const s = sessionRef.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      sessionRef.current = null;
      s.cleanup();
      setState(null);
      if (!s.moved) return;
      // 문턱을 넘었으면 제자리에 놓았더라도 click 은 삼킨다 — useStepReorderDrag 와 같은 이유
      // (끌다 만 것이 체크 토글로 둔갑하면 안 된다).
      clickBlockedRef.current = true;
      optsRef.current.onCommit([...s.ids], s.to);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    sessionRef.current = {
      ids: groupIds,
      to: -1, // 실재하지 않는 값 — 문턱을 넘은 첫 onMove 가 반드시 실제 값으로 갱신하게 한다
      pointerId: e.pointerId,
      startY: e.clientY,
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

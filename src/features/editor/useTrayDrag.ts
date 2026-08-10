// §6.10 트레이 → 코트 끌어다 놓기 (2026-08-11 기현 지시).
//
// 공개판 최대의 불만이 "선수 배치·이동을 못 하겠다" 였다. 두 카톡방에서 독립적으로 같은 말이
// 나왔고(김동수·정성우), 한쪽에서는 옆 사람이 "왼쪽에서 클릭하고 코트를 클릭하세요" 라고
// 대신 설명해 줘야 했다. 즉 도구를 **고르고** 코트를 **찍는** 2단계 자체가 안 보였다.
// 판 위의 말을 집어서 옮기는 동작이면 설명이 필요 없다 — 그래서 끌어다 놓기를 넣는다.
//
// ⚠️ HTML5 드래그 앤 드롭(dragstart/drop)을 쓰지 않는다. 태블릿이 1순위 대상인데 터치에서
// 사실상 동작하지 않는다. 포인터 이벤트 + setPointerCapture 로 직접 만든다.
import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { ChairId } from '../../core/ids.ts';
import type { CourtStageHandle } from '../../render/CourtStage.tsx';
import { clientToWorld } from '../../render/useStageMetrics.ts';
import type { PlaceKind } from './placement.ts';

/** 이만큼 움직이기 전에는 드래그로 치지 않는다. 넘지 못하고 손을 떼면 **탭**으로 처리해
 *  기존 경로(도구 선택 → 코트 탭)를 그대로 살린다 — 이미 그 방식을 익힌 사용자가 있다. */
const DRAG_THRESHOLD_PX = 6;

export interface TrayDragItem {
  kind: PlaceKind;
  /** 'player' 일 때 어떤 휠체어를 끌고 있는지. 트레이가 칩마다 자기 id 를 준다. */
  chairId?: ChairId;
}

export interface UseTrayDragOptions {
  stageRef: RefObject<CourtStageHandle | null>;
  /** 코트 안에서 손을 뗐을 때. 월드 좌표가 코트 범위 안임이 보장된다. */
  onDrop(item: TrayDragItem, world: { x: number; y: number }): void;
}

export interface UseTrayDragResult {
  /** 드래그 중인 항목(고스트를 그리는 쪽이 읽는다). 문턱을 넘기 전에는 null. */
  dragging: TrayDragItem | null;
  /** 고스트 엘리먼트 **콜백 ref**. 붙는 즉시 현재 포인터 위치로 옮긴다 — 일반 ref 로 두면
   *  마운트된 첫 프레임에 (0,0) 에서 한 번 번쩍인다. */
  ghostRef(el: HTMLDivElement | null): void;
  /** 드래그 시작 시점의 코트 축척(px/월드단위). 고스트를 실제 크기로 그리는 데 쓴다. */
  pxPerUnit: number;
  /** 트레이 항목의 onPointerDown 에 그대로 연결한다. */
  start(item: TrayDragItem, e: ReactPointerEvent, onTap: () => void): void;
}

export function useTrayDrag({ stageRef, onDrop }: UseTrayDragOptions): UseTrayDragResult {
  const [dragging, setDragging] = useState<TrayDragItem | null>(null);
  const [pxPerUnit, setPxPerUnit] = useState(1);
  const ghostElRef = useRef<HTMLDivElement | null>(null);
  const lastPosRef = useRef({ x: 0, y: 0 });
  // 세션은 ref 에 둔다 — pointermove 마다 setState 하면 EditorWorkspace 전체가 리렌더된다.
  const sessionRef = useRef<{
    item: TrayDragItem;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
    onTap: () => void;
    cleanup(): void;
  } | null>(null);

  const writeGhost = useCallback((el: HTMLDivElement | null, x: number, y: number) => {
    if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  }, []);

  const ghostRef = useCallback(
    (el: HTMLDivElement | null) => {
      ghostElRef.current = el;
      writeGhost(el, lastPosRef.current.x, lastPosRef.current.y);
    },
    [writeGhost],
  );

  const finish = useCallback(
    (clientX: number | null, clientY: number | null) => {
      const s = sessionRef.current;
      if (!s) return;
      sessionRef.current = null;
      s.cleanup();
      setDragging(null);

      if (!s.moved) {
        s.onTap(); // 문턱을 못 넘었다 = 그냥 탭
        return;
      }
      if (clientX === null || clientY === null) return; // pointercancel

      const m = stageRef.current?.refreshMetrics();
      if (!m) return;
      const w = clientToWorld(m, clientX, clientY);
      // 코트 **바깥**에 놓으면 아무 일도 없다(말이 트레이로 돌아간 셈). svg 의 rect 만 보면
      // 'meet' 레터박스 띠에 떨어뜨린 것까지 통과해 판 밖에 개체가 생긴다 — view 로 판정한다.
      if (w.x < m.view.x || w.x > m.view.x + m.view.w || w.y < m.view.y || w.y > m.view.y + m.view.h) return;
      onDrop(s.item, w);
    },
    [onDrop, stageRef],
  );

  const start = useCallback(
    (item: TrayDragItem, e: ReactPointerEvent, onTap: () => void) => {
      if (sessionRef.current) return;
      const target = e.currentTarget as HTMLElement;
      const pointerId = e.pointerId;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      try {
        target.setPointerCapture(pointerId);
      } catch {
        // jsdom·구형 브라우저. 캡처가 없어도 window 리스너로 계속 따라갈 수 있다.
      }

      const onMove = (ev: PointerEvent): void => {
        const s = sessionRef.current;
        if (!s || ev.pointerId !== s.pointerId) return;
        lastPosRef.current = { x: ev.clientX, y: ev.clientY };
        if (!s.moved) {
          if (Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY) < DRAG_THRESHOLD_PX) return;
          s.moved = true;
          setPxPerUnit(stageRef.current?.refreshMetrics()?.pxPerUnit ?? 1);
          setDragging(s.item); // 고스트는 콜백 ref 가 붙는 즉시 제자리로 간다
        }
        writeGhost(ghostElRef.current, ev.clientX, ev.clientY);
        ev.preventDefault();
      };
      const onUp = (ev: PointerEvent): void => {
        if (sessionRef.current && ev.pointerId !== sessionRef.current.pointerId) return;
        finish(ev.clientX, ev.clientY);
      };
      const onCancel = (): void => finish(null, null);

      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);

      sessionRef.current = {
        item,
        pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        onTap,
        cleanup() {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onCancel);
          try {
            target.releasePointerCapture(pointerId);
          } catch {
            /* 이미 풀렸다 */
          }
        },
      };
    },
    [finish, writeGhost, stageRef],
  );

  return { dragging, ghostRef, pxPerUnit, start };
}

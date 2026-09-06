// §10.7 ObjectLayer 검증 — z-order(§3.5), transform prop 부재(§6.1 규칙 1),
// register/writeFrame 초기 프레임 확정(§6.2).
import { describe, expect, it } from 'vitest';
import { render as rtlRender } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createTransformWriter } from './transformWriter.ts';
import { ObjectLayer } from './ObjectLayer.tsx';
import type { ChairId, BallId, ConeId, NoteId, ArrowId } from '../core/ids.ts';
import type { NoteLabel as NoteLabelData } from '../model/drill.ts';
import type { Arrow } from '../model/arrow.ts';
import type { Shape } from '../model/shape.ts';
import type { SceneRef } from '../model/zOrder.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });

const chairId = 'ch_1' as ChairId;
const ballId = 'bl_1' as BallId;
const coneId = 'cn_1' as ConeId;
const noteId = 'nt_1' as NoteId;
const arrowId = 'ar_1' as ArrowId;
const shapeId = 'sh_1' as Shape['id'];
const shape: Shape = { id: shapeId, kind: 'rect', x: 100, y: 100, w: 80, h: 50, rot: 0 };

/** 판 위 개체를 **DOM 순서 그대로** 나열한다. 개체는 `id="obj-…"`, 도형은 `data-shape-id` 를
 *  달고 있어(둘은 서로 다른 표식이다) 한 번의 querySelectorAll 로 함께 센다. */
const domOrder = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('[id^="obj-"], [data-shape-id]')).map((el) => el.id || `obj-${el.getAttribute('data-shape-id')}`);

function renderLayer(initialFrame?: Record<string, { x: number; y: number; theta: number }>, order?: readonly SceneRef[]) {
  const writer = createTransformWriter();
  const notes: NoteLabelData[] = [{ id: noteId, x: 0, y: 0, text: '메모' }];
  const arrows: Arrow[] = [{ id: arrowId, from: { x: 0, y: 0 }, ctrl: { x: 5, y: 5 }, to: { x: 10, y: 10 } }];
  const { container } = render(
    <svg>
      <ObjectLayer
        writer={writer}
        chairs={[{ id: chairId, color: '#d93a3a', team: 'home', number: '4', ariaLabel: 'A팀 4번 선수' }]}
        balls={[ballId]}
        cones={[{ id: coneId, colorIndex: 0 }]}
        notes={notes}
        arrows={arrows}
        shapes={[shape]}
        order={order}
        markerUid="uid"
        selection={new Set()}
        activeId={null}
        initialFrame={initialFrame}
      />
    </svg>,
  );
  return { container, writer };
}

describe('ObjectLayer — 레이어 순서(§3.5)', () => {
  it('`order` 가 없으면 기본층(도형 → 콘 → 화살표 → 휠체어 → 공 → 메모) 그대로다', () => {
    // 지우면 새는 버그: 순서를 못 정한 스텝(= 지금까지의 모든 드릴)의 그림이 바뀐다.
    // z-order 기능의 계약은 "아무것도 안 하면 판은 한 픽셀도 안 변한다" 이고, 그것을 재는
    // 단언이 이것뿐이다.
    const { container } = renderLayer();
    expect(domOrder(container)).toEqual([`obj-${shapeId}`, `obj-${coneId}`, `obj-${arrowId}`, `obj-${chairId}`, `obj-${ballId}`, `obj-${noteId}`]);
  });

  it('★ `order` 가 있으면 DOM 순서가 그것을 따른다 — 도형이 메모·칩 **위**로 갈 수 있다', () => {
    // 지우면 새는 버그: [표시순서 ▸ 맨 앞으로] 를 눌러도 화면이 그대로다(모델만 바뀌고 판이
    // 안 따라간다). 도형을 맨 위에 두는 것을 고른 이유는 그 자리가 **옛 구조로는 표현
    // 불가능**했기 때문이다 — 도형은 ObjectLayer 밖의 층에 있어서 칩보다 위에 올 수 없었다.
    const order: SceneRef[] = [
      { kind: 'note', id: noteId },
      { kind: 'ball', id: ballId },
      { kind: 'chair', id: chairId },
      { kind: 'arrow', id: arrowId },
      { kind: 'cone', id: coneId },
      { kind: 'shape', id: shapeId },
    ];
    const { container } = renderLayer(undefined, order);
    expect(domOrder(container)).toEqual([`obj-${noteId}`, `obj-${ballId}`, `obj-${chairId}`, `obj-${arrowId}`, `obj-${coneId}`, `obj-${shapeId}`]);
  });

  it('★ `order` 가 모르는 개체는 버리지 않고 기본층 순서로 맨 위에 붙인다', () => {
    // 지우면 새는 버그: 스텝 전환 중 **퇴장하는** 화살표·메모는 이전 스텝의 것이라 이번 스텝의
    // `sceneOrder` 에 없다. 목록에 없다고 떨어뜨리면 퇴장 페이드가 화면에서 통째로 사라진다.
    const { container } = renderLayer(undefined, [{ kind: 'chair', id: chairId }]);
    expect(domOrder(container)).toEqual([`obj-${chairId}`, `obj-${shapeId}`, `obj-${coneId}`, `obj-${arrowId}`, `obj-${ballId}`, `obj-${noteId}`]);
  });
});

describe('ObjectLayer — transform 속성 부재(§6.1 규칙 1)', () => {
  it('휠체어/공/콘/메모 <g> 는 JSX 에서 transform 속성을 갖지 않는다(TransformWriter 전용)', () => {
    const { container } = renderLayer();
    for (const id of [chairId, ballId, coneId, noteId]) {
      const el = container.querySelector(`#obj-${id}`);
      expect(el).not.toBeNull();
      expect(el!.getAttribute('transform')).toBeNull();
    }
  });
});

describe('ObjectLayer — 초기 프레임 확정(§6.2)', () => {
  it('initialFrame 이 있으면 마운트 즉시(페인트 전) writeFrame 되어 transform 이 채워진다', () => {
    const { container } = renderLayer({
      [chairId]: { x: 100, y: 50, theta: 0 },
      [ballId]: { x: 10, y: 20, theta: 0 },
      [coneId]: { x: 30, y: 40, theta: 0 },
    });
    const chairEl = container.querySelector(`#obj-${chairId}`)!;
    expect(chairEl.getAttribute('transform')).toBe('translate(100.00 50.00) rotate(0.00)');
    const ballEl = container.querySelector(`#obj-${ballId}`)!;
    expect(ballEl.getAttribute('transform')).toBe('translate(10.00 20.00) rotate(0.00)');
    // initialFrame 이 없으면(예: 아직 아무도 write 하지 않음) transform 은 비어 있다(대조군).
    const noFrameEl = renderLayer().container.querySelector(`#obj-${chairId}`)!;
    expect(noFrameEl.getAttribute('transform')).toBeNull();
  });
});

describe('ObjectLayer — 등번호 역회전(§3.4)', () => {
  it('휠체어 회전 시 등번호 그룹은 반대 각도로 카운터 회전한다', () => {
    const { container, writer } = renderLayer({ [chairId]: { x: 0, y: 0, theta: 0 } });
    writer.write(chairId, 0, 0, Math.PI / 2);
    const chairEl = container.querySelector(`#obj-${chairId}`)!;
    expect(chairEl.getAttribute('transform')).toBe('translate(0.00 0.00) rotate(90.00)');
    // 등번호 카운터 그룹은 body 안에서 두 번째로 중첩된 <g> — rotate(-90) 를 갖는다.
    const counterGroup = Array.from(chairEl.querySelectorAll('g')).find((g) => g.getAttribute('transform') === 'rotate(-90.00)');
    expect(counterGroup).not.toBeUndefined();
  });
});

describe('ObjectLayer — 선택/활성 상태 반영', () => {
  it('selection 에 포함된 개체는 aria-pressed=true, activeId 는 tabIndex=0', () => {
    const writer = createTransformWriter();
    const { container } = render(
      <svg>
        <ObjectLayer
          writer={writer}
          chairs={[{ id: chairId, color: '#d93a3a', team: 'home', number: '4', ariaLabel: 'A팀 4번 선수' }]}
          balls={[ballId]}
          cones={[]}
          notes={[]}
          arrows={[]}
          markerUid="uid"
          selection={new Set([chairId])}
          activeId={ballId}
        />
      </svg>,
    );
    const chairEl = container.querySelector(`#obj-${chairId}`)!;
    expect(chairEl).toHaveAttribute('aria-pressed', 'true');
    expect(chairEl).toHaveAttribute('tabindex', '-1');
    const ballEl = container.querySelector(`#obj-${ballId}`)!;
    expect(ballEl).toHaveAttribute('tabindex', '0');
  });
});

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
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });

const chairId = 'ch_1' as ChairId;
const ballId = 'bl_1' as BallId;
const coneId = 'cn_1' as ConeId;
const noteId = 'nt_1' as NoteId;
const arrowId = 'ar_1' as ArrowId;

function renderLayer(initialFrame?: Record<string, { x: number; y: number; theta: number }>) {
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
  it('콘 → 화살표 → 휠체어 → 공 → 메모 순으로 DOM 에 나타난다', () => {
    const { container } = renderLayer();
    const ids = Array.from(container.querySelectorAll('[id^="obj-"]')).map((el) => el.id);
    expect(ids).toEqual([`obj-${coneId}`, `obj-${arrowId}`, `obj-${chairId}`, `obj-${ballId}`, `obj-${noteId}`]);
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

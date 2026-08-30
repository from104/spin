// PLAN-STEP-EDITING.md 구현 순서 ② 완료 판정 — **끌어서 순서 변경**과 **키보드 순서 변경**,
// 그리고 그 결과가 화살표·메모 id 를 보존하는가(edits.ts:235-256 크로스페이드 전제 — 깨지면
// 스텝 전환에서 화살표가 튄다).
//
// 2026-08-17 옛 TransportBar.reorder.test.tsx 의 이사 — 계약은 그대로고 축만 세로(y)로 바뀌었다.
//   · 가로 칩의 좌우(←/→) 대신 세로 카드의 상하(↑/↓) 다. 그 두 키는 전역에서 아무 것도 안
//     먹고 있다(core/keymap.ts: 스텝 이동은 PageUp/PageDown) — 그래서 충돌 없이 재사용한다.
//   · 카드는 이름을 안 보여주므로(스텝 정보 최소화) "화면 순서가 아니라 실제 어느 스텝인가"
//     를 옛 `title`(=스텝 이름) 대신 `data-step-id` 로 식별한다.
//
// 키보드 경로가 왜 장식이 아닌가: 포인터 조작(끌기)은 정밀도가 필요해 실패하기 쉬운 입력이다
// (SPIN 은 범용 앱이라 특정 입력장치를 근거로 들지 않는다 — 요점은 "포인터가 실패해도 같은
// 조작이 가능해야 한다" 는 일반 원리다). 그래서 Space 로 집고 ↑/↓ 로 옮기는 키보드 경로가
// 대체 경로가 아니라 **동등한 주 경로**다. 수식키 조합(Ctrl+↑)을 쓰지 않는 것은 동시 누르기가
// 실패하기 쉬운 손도 있기 때문이다.
//
// jsdom 은 레이아웃을 하지 않으므로 카드의 위치를 손으로 만들어 넣는다. `data-index` 가
// **화면 순서**라 그 값으로 rect 를 지어내면 미리보기로 줄이 갈릴 때 좌표도 함께 따라온다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { StepSidebar } from './StepSidebar.tsx';
import { createDrill } from '../../model/defaults.ts';
import { addStepAfter, moveStep, setArrow, setNote } from '../../model/edits.ts';
import type { Drill } from '../../model/drill.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

// StepSidebar 의 카드 썸네일(CourtThumbnail)이 useLocale()(→ SettingsProvider)을 쓴다(C7).
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });
import type { ArrowId, NoteId, StepId } from '../../core/ids.ts';

/** 카드 높이 120 · 틈+여백 12 → 중심 y = 60, 192, 324, … */
const CARD_H = 120;
const CARD_GAP = 12;
function stubCardRects() {
  const real = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const idx = this.getAttribute('data-index');
    if (idx === null) return real.call(this);
    const top = Number(idx) * (CARD_H + CARD_GAP);
    return { x: 0, y: top, left: 0, top, right: 200, bottom: top + CARD_H, width: 200, height: CARD_H, toJSON: () => ({}) } as DOMRect;
  });
}
const centerOf = (i: number) => i * (CARD_H + CARD_GAP) + CARD_H / 2;

function makeDrill(n: number): Drill {
  let d = createDrill({ courtMode: 'full' });
  for (let i = 1; i < n; i++) d = addStepAfter(d, i - 1);
  return d;
}

/** 실제 순서 변경까지 돌려 본다 — 리듀서와 같은 순수 함수(moveStep)를 그대로 태운다. */
function Harness({ initial, onReorder }: { initial: Drill; onReorder?: (id: StepId, to: number) => void }) {
  const [drill, setDrill] = useState(initial);
  const [stepId, setStepId] = useState(initial.steps[0]!.id);
  return (
    <StepSidebar
      drill={drill}
      stepId={stepId}
      onSelectStep={setStepId}
      onReorderStep={(id, to) => {
        onReorder?.(id, to);
        setDrill((d) => moveStep(d, d.steps.findIndex((s) => s.id === id), to));
      }}
      onDuplicateStep={() => {}}
      onToggleCut={() => {}}
      collapsed={false}
      onMoveSteps={() => {}}
      onDuplicateSteps={() => {}}
      onDeleteSteps={() => {}}
      onDeleteStep={() => {}}
    />
  );
}

const cards = () => screen.getAllByRole('button', { name: /^스텝 \d+$/ });
const cardOrder = () => cards().map((c) => c.getAttribute('data-step-id'));
const cardAt = (i: number) => cards()[i]!;

const down = (el: Element, y: number) => fireEvent.pointerDown(el, { pointerId: 1, clientY: y, button: 0 });
const move = (y: number) => fireEvent.pointerMove(window, { pointerId: 1, clientY: y });
const up = (y: number) => fireEvent.pointerUp(window, { pointerId: 1, clientY: y });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('끌어서 순서 변경', () => {
  it('첫 카드를 맨 뒤 중심 너머로 끌면 줄이 갈리고, 손을 뗄 때 **한 번** 커밋한다', () => {
    stubCardRects();
    const onReorder = vi.fn();
    const d = makeDrill(3);
    render(<Harness initial={d} onReorder={onReorder} />);
    const [id0, id1, id2] = d.steps.map((s) => s.id);
    expect(cardOrder()).toEqual([id0, id1, id2]);

    down(cardAt(0), centerOf(0));
    move(centerOf(1) + 1); // 2번째 카드 중심을 넘었다 — 미리보기만 바뀐다
    expect(cardOrder()).toEqual([id1, id0, id2]);
    expect(onReorder, '칸을 넘을 때마다 커밋하면 되돌리기가 지나온 칸 수만큼 쌓인다').not.toHaveBeenCalled();

    move(centerOf(2) + 1);
    expect(cardOrder()).toEqual([id1, id2, id0]);
    up(centerOf(2) + 1);
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(id0, 2);
    expect(cardOrder()).toEqual([id1, id2, id0]); // 커밋된 순서로 남는다
  });

  it('문턱(6px)을 못 넘으면 끌기가 아니라 **선택**이다', () => {
    stubCardRects();
    const onReorder = vi.fn();
    const d = makeDrill(3);
    render(<Harness initial={d} onReorder={onReorder} />);

    down(cardAt(2), centerOf(2));
    move(centerOf(2) + 4); // 4px — 문턱 미만
    up(centerOf(2) + 4);
    fireEvent.click(cardAt(2));

    expect(onReorder).not.toHaveBeenCalled();
    expect(cardOrder()).toEqual(d.steps.map((s) => s.id));
    expect(cardAt(2)).toHaveAttribute('aria-current', 'step'); // 탭 선택은 살아 있다
  });

  it('끌었다가 제자리에 놓으면 커밋도 선택도 없다 — 끌기의 뒤끝이 선택으로 둔갑하지 않는다', () => {
    stubCardRects();
    const onReorder = vi.fn();
    render(<Harness initial={makeDrill(3)} onReorder={onReorder} />);

    down(cardAt(1), centerOf(1));
    move(centerOf(1) + 20); // 문턱은 넘었지만 옆 카드 중심(centerOf(2))까지는 안 갔다
    up(centerOf(1) + 20);
    fireEvent.click(cardAt(1));

    expect(onReorder).not.toHaveBeenCalled();
    expect(cardAt(0)).toHaveAttribute('aria-current', 'step'); // 여전히 1번 스텝
    expect(cardAt(1)).not.toHaveAttribute('aria-current');
  });

  it('완료 판정: 순서를 바꿔도 화살표·메모 id 가 보존된다 (D6 크로스페이드 전제)', () => {
    stubCardRects();
    let d = makeDrill(3);
    // 스텝마다 화살표·메모를 다르게 심는다 — 통째로 같은 값이면 "안 바뀌었다" 가 무의미해진다.
    d = setArrow(d, 0, { id: 'ar_a' as ArrowId, from: { x: 10, y: 10 }, ctrl: { x: 20, y: 20 }, to: { x: 30, y: 30 } });
    d = setArrow(d, 2, { id: 'ar_c' as ArrowId, from: { x: 40, y: 40 }, ctrl: { x: 50, y: 50 }, to: { x: 60, y: 60 } });
    d = setNote(d, 0, { id: 'nt_a' as NoteId, x: 1, y: 2, text: '가' });
    d = setNote(d, 1, { id: 'nt_b' as NoteId, x: 3, y: 4, text: '나' });
    const before = d.steps.map((s) => ({ id: s.id, arrows: s.arrows, notes: s.notes }));

    let after: Drill = d;
    render(
      <Harness
        initial={d}
        onReorder={(id, to) => {
          after = moveStep(d, d.steps.findIndex((s) => s.id === id), to);
        }}
      />,
    );

    down(cardAt(0), centerOf(0));
    move(centerOf(2) + 1);
    up(centerOf(2) + 1);

    expect(after.steps.map((s) => s.id)).toEqual([before[1]!.id, before[2]!.id, before[0]!.id]);
    // id 만이 아니라 **객체 그대로** 다. 새 id 를 발급하면 크로스페이드가 매번 새 화살표를
    // 그리며 튄다(edits.ts duplicateStep 주석의 그 계약).
    expect(after.steps[2]!.arrows).toBe(before[0]!.arrows);
    expect(after.steps[2]!.notes).toBe(before[0]!.notes);
    expect(after.steps.flatMap((s) => s.arrows.map((a) => a.id)).sort()).toEqual(['ar_a', 'ar_c']);
    expect(after.steps.flatMap((s) => s.notes.map((n) => n.id)).sort()).toEqual(['nt_a', 'nt_b']);
  });
});

describe('키보드 순서 변경 (포인터가 실패하기 쉬운 상황의 동등한 주 경로)', () => {
  it('Space 로 집고 ↓/↑ 로 옮긴다', () => {
    const onReorder = vi.fn();
    const d = makeDrill(3);
    render(<Harness initial={d} onReorder={onReorder} />);
    const [id0] = d.steps.map((s) => s.id);

    const card = cardAt(0);
    card.focus();
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'ArrowDown' });
    expect(onReorder).toHaveBeenCalledWith(id0, 1);
    expect(cardOrder()[1]).toBe(id0);

    // 집은 채로 계속 옮길 수 있다 — 매번 다시 집게 하면 두 배의 입력이다.
    fireEvent.keyDown(card, { key: 'ArrowDown' });
    expect(cardOrder()[2]).toBe(id0);
    expect(onReorder).toHaveBeenLastCalledWith(id0, 2);
  });

  it('집지 않았으면 ↑/↓ 는 순서를 건드리지 않는다', () => {
    const onReorder = vi.fn();
    render(<Harness initial={makeDrill(3)} onReorder={onReorder} />);
    const card = cardAt(0);
    card.focus();
    fireEvent.keyDown(card, { key: 'ArrowDown' });
    expect(onReorder).not.toHaveBeenCalled();
    // 대조군 — 같은 카드를 집으면 같은 키가 실제로 발화한다(스파이가 안 걸린 것이 아니다).
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'ArrowDown' });
    expect(onReorder).toHaveBeenCalledTimes(1);
  });

  it('집은 동안의 ↑/↓ 는 전역(document)까지 새지 않는다 — 새면 순서와 선택이 함께 움직인다', () => {
    const globalKey = vi.fn();
    document.addEventListener('keydown', globalKey);
    try {
      render(<Harness initial={makeDrill(3)} />);
      const card = cardAt(0);
      card.focus();

      // 대조군 먼저 — 집기 전에는 전역이 받는다.
      fireEvent.keyDown(card, { key: 'ArrowDown' });
      expect(globalKey).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(card, { key: ' ' });
      globalKey.mockClear();
      fireEvent.keyDown(card, { key: 'ArrowDown' });
      expect(globalKey).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', globalKey);
    }
  });

  it('Space 는 네이티브 클릭(=선택)과 전역 재생 토글을 막는다', () => {
    const globalKey = vi.fn();
    document.addEventListener('keydown', globalKey);
    try {
      render(<Harness initial={makeDrill(3)} />);
      const card = cardAt(2);
      card.focus();
      const e = fireEvent.keyDown(card, { key: ' ' });
      expect(e, 'preventDefault 를 안 하면 Space 가 click 으로 이어져 스텝이 선택된다').toBe(false);
      expect(globalKey).not.toHaveBeenCalled();
      expect(cardAt(0)).toHaveAttribute('aria-current', 'step'); // 선택은 안 움직였다
    } finally {
      document.removeEventListener('keydown', globalKey);
    }
  });

  it('Esc 는 집기 전 자리로 되돌린다', () => {
    const onReorder = vi.fn();
    const d = makeDrill(4);
    render(<Harness initial={d} onReorder={onReorder} />);
    const id0 = d.steps[0]!.id;
    const card = cardAt(0);
    card.focus();
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'ArrowDown' });
    fireEvent.keyDown(card, { key: 'ArrowDown' });
    expect(cardOrder()[2]).toBe(id0);

    fireEvent.keyDown(card, { key: 'Escape' });
    expect(onReorder).toHaveBeenLastCalledWith(id0, 0);
    expect(cardOrder()[0]).toBe(id0);

    // 되돌린 뒤에는 집은 상태가 풀린다 — 안 풀면 Esc 한 번에 두 번 되돌아간다.
    fireEvent.keyDown(card, { key: 'ArrowDown' });
    expect(cardOrder()[0]).toBe(id0);
  });

  it('양 끝에서는 조용히 멈춘다 — 감아 돌지 않는다', () => {
    const onReorder = vi.fn();
    const d = makeDrill(3);
    render(<Harness initial={d} onReorder={onReorder} />);
    const first = cardAt(0);
    first.focus();
    fireEvent.keyDown(first, { key: ' ' });
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(onReorder).not.toHaveBeenCalled();
    expect(cardOrder()).toEqual(d.steps.map((s) => s.id));
  });

  it('Space 로 다시 놓으면 그 뒤 ↑/↓ 는 순서를 안 건드린다', () => {
    const onReorder = vi.fn();
    render(<Harness initial={makeDrill(3)} onReorder={onReorder} />);
    const card = cardAt(0);
    card.focus();
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: ' ' }); // 놓았다
    fireEvent.keyDown(card, { key: 'ArrowDown' });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('무엇을 어떻게 하는지 카드가 스스로 말한다 (aria-describedby)', () => {
    render(<Harness initial={makeDrill(2)} />);
    const hintId = cardAt(0).getAttribute('aria-describedby')!;
    expect(hintId).toBeTruthy();
    expect(document.getElementById(hintId)!.textContent).toMatch(/스페이스.*방향키/);
    expect(cardAt(1).getAttribute('aria-describedby')).toBe(hintId);
  });
});

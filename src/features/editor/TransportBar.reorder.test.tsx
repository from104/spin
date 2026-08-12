// §4.4 P2-3 완료 판정 — **끌어서 순서 변경**과 **키보드 순서 변경**, 그리고 그 결과가
// 화살표·메모 id 를 보존하는가(edits.ts:235-256 크로스페이드 전제 — 깨지면 스텝 전환에서
// 화살표가 튄다).
//
// 키보드 경로가 왜 장식이 아닌가: 이 앱의 1순위 사용자는 오른발 마우스와 입에 문 젓가락으로
// 친다(§5.5). 끌기는 그 손에서 가장 실패하기 쉬운 입력이라 대체 경로가 반드시 있어야 하고,
// 수식키 조합(Ctrl+←)도 동시 누르기라 답이 아니다 — 그래서 Space 로 집고 ←/→ 로 옮긴다.
//
// jsdom 은 레이아웃을 하지 않으므로 칩의 위치를 손으로 만들어 넣는다. 칩의 `aria-posinset` 이
// **화면 순서**라 그 값으로 rect 를 지어내면 미리보기로 줄이 갈릴 때 좌표도 함께 따라온다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { TransportBar } from './TransportBar.tsx';
import { createDrill } from '../../model/defaults.ts';
import { addStepAfter, moveStep, setArrow, setNote } from '../../model/edits.ts';
import type { Drill } from '../../model/drill.ts';
import type { ArrowId, NoteId, StepId } from '../../core/ids.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

/** 칩 폭 70 · 간격 10 → 중심 x = 35, 115, 195, … */
const CHIP_W = 70;
const CHIP_GAP = 10;
function stubChipRects() {
  const real = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const pos = this.getAttribute('aria-posinset');
    if (pos === null) return real.call(this);
    const left = (Number(pos) - 1) * (CHIP_W + CHIP_GAP);
    return { x: left, y: 0, left, top: 0, right: left + CHIP_W, bottom: 44, width: CHIP_W, height: 44, toJSON: () => ({}) } as DOMRect;
  });
}
const centerOf = (i: number) => i * (CHIP_W + CHIP_GAP) + CHIP_W / 2;

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
    <TransportBar
      drill={drill}
      stepId={stepId}
      onSelectStep={setStepId}
      onReorderStep={(id, to) => {
        onReorder?.(id, to);
        setDrill((d) => moveStep(d, d.steps.findIndex((s) => s.id === id), to));
      }}
      onAddStep={() => {}}
      playing={false}
      onTogglePlay={() => {}}
      speed={1}
      onCycleSpeed={() => {}}
    />
  );
}

const chipOrder = () => screen.getAllByRole('tab').map((c) => c.getAttribute('title'));
const chipAt = (i: number) => screen.getAllByRole('tab')[i]!;

const down = (el: Element, x: number) => fireEvent.pointerDown(el, { pointerId: 1, clientX: x, button: 0 });
const move = (x: number) => fireEvent.pointerMove(window, { pointerId: 1, clientX: x });
const up = (x: number) => fireEvent.pointerUp(window, { pointerId: 1, clientX: x });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('끌어서 순서 변경', () => {
  it('첫 칩을 맨 뒤 중심 너머로 끌면 줄이 갈리고, 손을 뗄 때 **한 번** 커밋한다', () => {
    stubChipRects();
    const onReorder = vi.fn();
    const d = makeDrill(3);
    render(<Harness initial={d} onReorder={onReorder} />, { wrapper });
    expect(chipOrder()).toEqual(['스텝 1', '스텝 2', '스텝 3']);

    down(chipAt(0), centerOf(0));
    move(centerOf(1) + 1); // 2번 칩 중심을 넘었다 — 미리보기만 바뀐다
    expect(chipOrder()).toEqual(['스텝 2', '스텝 1', '스텝 3']);
    expect(onReorder, '칸을 넘을 때마다 커밋하면 되돌리기가 지나온 칸 수만큼 쌓인다').not.toHaveBeenCalled();

    move(centerOf(2) + 1);
    expect(chipOrder()).toEqual(['스텝 2', '스텝 3', '스텝 1']);
    up(centerOf(2) + 1);
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(d.steps[0]!.id, 2);
    expect(chipOrder()).toEqual(['스텝 2', '스텝 3', '스텝 1']); // 커밋된 순서로 남는다
  });

  it('문턱(6px)을 못 넘으면 끌기가 아니라 **선택**이다', () => {
    stubChipRects();
    const onReorder = vi.fn();
    render(<Harness initial={makeDrill(3)} onReorder={onReorder} />, { wrapper });

    down(chipAt(2), centerOf(2));
    move(centerOf(2) + 4); // 4px — 문턱 미만
    up(centerOf(2) + 4);
    fireEvent.click(chipAt(2));

    expect(onReorder).not.toHaveBeenCalled();
    expect(chipOrder()).toEqual(['스텝 1', '스텝 2', '스텝 3']);
    expect(chipAt(2)).toHaveAttribute('aria-selected', 'true'); // 탭 선택은 살아 있다
  });

  it('끌었다가 제자리에 놓으면 커밋도 선택도 없다 — 끌기의 뒤끝이 선택으로 둔갑하지 않는다', () => {
    stubChipRects();
    const onReorder = vi.fn();
    render(<Harness initial={makeDrill(3)} onReorder={onReorder} />, { wrapper });

    down(chipAt(1), centerOf(1));
    move(centerOf(1) + 20); // 문턱은 넘었지만 옆 칩 중심(195)까지는 안 갔다
    up(centerOf(1) + 20);
    fireEvent.click(chipAt(1));

    expect(onReorder).not.toHaveBeenCalled();
    expect(chipAt(0)).toHaveAttribute('aria-selected', 'true'); // 여전히 1번 스텝
    expect(chipAt(1)).toHaveAttribute('aria-selected', 'false');
  });

  it('완료 판정: 순서를 바꿔도 화살표·메모 id 가 보존된다 (D6 크로스페이드 전제)', () => {
    stubChipRects();
    let d = makeDrill(3);
    // 스텝마다 화살표·메모를 다르게 심는다 — 통째로 같은 값이면 "안 바뀌었다" 가 무의미해진다.
    d = setArrow(d, 0, { id: 'ar_a' as ArrowId, kind: 'move', from: { x: 10, y: 10 }, ctrl: { x: 20, y: 20 }, to: { x: 30, y: 30 } });
    d = setArrow(d, 2, { id: 'ar_c' as ArrowId, kind: 'pass', from: { x: 40, y: 40 }, ctrl: { x: 50, y: 50 }, to: { x: 60, y: 60 } });
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
      { wrapper },
    );

    down(chipAt(0), centerOf(0));
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

describe('키보드 순서 변경 (발 마우스·스위치 사용자의 주 경로)', () => {
  it('Space 로 집고 →/← 로 옮긴다', () => {
    const onReorder = vi.fn();
    const d = makeDrill(3);
    render(<Harness initial={d} onReorder={onReorder} />, { wrapper });

    const chip = chipAt(0);
    chip.focus();
    fireEvent.keyDown(chip, { key: ' ' });
    fireEvent.keyDown(chip, { key: 'ArrowRight' });
    expect(onReorder).toHaveBeenCalledWith(d.steps[0]!.id, 1);
    expect(chipOrder()).toEqual(['스텝 2', '스텝 1', '스텝 3']);

    // 집은 채로 계속 옮길 수 있다 — 매번 다시 집게 하면 젓가락 사용자에게 두 배의 입력이다.
    fireEvent.keyDown(chip, { key: 'ArrowRight' });
    expect(chipOrder()).toEqual(['스텝 2', '스텝 3', '스텝 1']);
    expect(onReorder).toHaveBeenLastCalledWith(d.steps[0]!.id, 2);
  });

  it('집지 않았으면 ←/→ 는 순서를 건드리지 않는다 — 전역 스텝 이동 그대로다', () => {
    const onReorder = vi.fn();
    render(<Harness initial={makeDrill(3)} onReorder={onReorder} />, { wrapper });
    const chip = chipAt(0);
    chip.focus();
    fireEvent.keyDown(chip, { key: 'ArrowRight' });
    expect(onReorder).not.toHaveBeenCalled();
    // 대조군 — 같은 칩을 집으면 같은 키가 실제로 발화한다(스파이가 안 걸린 것이 아니다).
    fireEvent.keyDown(chip, { key: ' ' });
    fireEvent.keyDown(chip, { key: 'ArrowRight' });
    expect(onReorder).toHaveBeenCalledTimes(1);
  });

  it('집은 동안의 ←/→ 는 전역(document)까지 새지 않는다 — 새면 순서와 선택이 함께 움직인다', () => {
    const globalKey = vi.fn();
    document.addEventListener('keydown', globalKey);
    try {
      render(<Harness initial={makeDrill(3)} />, { wrapper });
      const chip = chipAt(0);
      chip.focus();

      // 대조군 먼저 — 집기 전에는 전역이 받는다(useEditorKeyboard 의 스텝 이동이 그 소비자다).
      fireEvent.keyDown(chip, { key: 'ArrowRight' });
      expect(globalKey).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(chip, { key: ' ' });
      globalKey.mockClear();
      fireEvent.keyDown(chip, { key: 'ArrowRight' });
      expect(globalKey).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', globalKey);
    }
  });

  it('Space 는 네이티브 클릭(=선택)과 전역 재생 토글을 막는다', () => {
    const globalKey = vi.fn();
    document.addEventListener('keydown', globalKey);
    try {
      render(<Harness initial={makeDrill(3)} />, { wrapper });
      const chip = chipAt(2);
      chip.focus();
      const e = fireEvent.keyDown(chip, { key: ' ' });
      expect(e, 'preventDefault 를 안 하면 Space 가 click 으로 이어져 스텝이 선택된다').toBe(false);
      expect(globalKey).not.toHaveBeenCalled();
      expect(chipAt(0)).toHaveAttribute('aria-selected', 'true'); // 선택은 안 움직였다
    } finally {
      document.removeEventListener('keydown', globalKey);
    }
  });

  it('Esc 는 집기 전 자리로 되돌린다', () => {
    const onReorder = vi.fn();
    const d = makeDrill(4);
    render(<Harness initial={d} onReorder={onReorder} />, { wrapper });
    const chip = chipAt(0);
    chip.focus();
    fireEvent.keyDown(chip, { key: ' ' });
    fireEvent.keyDown(chip, { key: 'ArrowRight' });
    fireEvent.keyDown(chip, { key: 'ArrowRight' });
    expect(chipOrder()).toEqual(['스텝 2', '스텝 3', '스텝 1', '스텝 4']);

    fireEvent.keyDown(chip, { key: 'Escape' });
    expect(onReorder).toHaveBeenLastCalledWith(d.steps[0]!.id, 0);
    expect(chipOrder()).toEqual(['스텝 1', '스텝 2', '스텝 3', '스텝 4']);

    // 되돌린 뒤에는 집은 상태가 풀린다 — 안 풀면 Esc 한 번에 두 번 되돌아간다.
    fireEvent.keyDown(chip, { key: 'ArrowRight' });
    expect(chipOrder()).toEqual(['스텝 1', '스텝 2', '스텝 3', '스텝 4']);
  });

  it('양 끝에서는 조용히 멈춘다 — 감아 돌지 않는다', () => {
    const onReorder = vi.fn();
    render(<Harness initial={makeDrill(3)} onReorder={onReorder} />, { wrapper });
    const first = chipAt(0);
    first.focus();
    fireEvent.keyDown(first, { key: ' ' });
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(onReorder).not.toHaveBeenCalled();
    expect(chipOrder()).toEqual(['스텝 1', '스텝 2', '스텝 3']);
  });

  it('Space 로 다시 놓으면 그 뒤 ←/→ 는 순서를 안 건드린다', () => {
    const onReorder = vi.fn();
    render(<Harness initial={makeDrill(3)} onReorder={onReorder} />, { wrapper });
    const chip = chipAt(0);
    chip.focus();
    fireEvent.keyDown(chip, { key: ' ' });
    fireEvent.keyDown(chip, { key: ' ' }); // 놓았다
    fireEvent.keyDown(chip, { key: 'ArrowRight' });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('무엇을 어떻게 하는지 칩이 스스로 말한다 (aria-describedby)', () => {
    render(<Harness initial={makeDrill(2)} />, { wrapper });
    const hintId = chipAt(0).getAttribute('aria-describedby')!;
    expect(hintId).toBeTruthy();
    expect(document.getElementById(hintId)!.textContent).toMatch(/스페이스.*방향키/);
    expect(chipAt(1).getAttribute('aria-describedby')).toBe(hintId);
  });
});

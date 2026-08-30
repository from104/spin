// ⑤ 다중 선택(기현님 확정 2026-08-17, PLAN-STEP-EDITING.md §다중 선택) — 선택 모드 토글,
// 카드 탭 의미 전환, 일괄 이동·복제·삭제. StepSidebar.test.tsx/.reorder.test.tsx 와 파일을
// 가르는 이유는 두 가지 성격(선택 모드 밖의 기본 카드 동작 vs 모드 안의 새 조작)이 섞이면
// 어느 쪽 회귀인지 파일명만으로 안 보이기 때문이다.
import { describe, expect, it, vi } from 'vitest';
import { render as rtlRender, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { StepSidebar } from './StepSidebar.tsx';
import { createDrill } from '../../model/defaults.ts';
import { duplicateStep, moveStep, moveSteps } from '../../model/edits.ts';
import { LIMITS } from '../../model/validate.ts';
import type { Drill } from '../../model/drill.ts';
import type { StepId } from '../../core/ids.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

// StepSidebar 의 카드 썸네일(CourtThumbnail)이 useLocale()(→ SettingsProvider)을 쓴다(C7).
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });

function makeDrill(n: number): Drill {
  let d = createDrill({ courtMode: 'full' });
  for (let i = 1; i < n; i++) d = duplicateStep(d, i - 1);
  return d;
}

const noop = () => {};
const cards = () => screen.getAllByRole('button', { name: /^스텝 \d+$/ });
const cardOrder = () => cards().map((c) => c.getAttribute('data-step-id'));
const cardAt = (i: number) => cards()[i]!;

function renderSidebar(d: Drill, over: Partial<Parameters<typeof StepSidebar>[0]> = {}) {
  const props = {
    drill: d,
    stepId: d.steps[0]!.id,
    onSelectStep: noop,
    onReorderStep: noop,
    onDuplicateStep: noop,
    onToggleCut: noop,
    collapsed: false,
    onMoveSteps: noop,
    onDuplicateSteps: noop,
    onDeleteSteps: noop,
    onDeleteStep: noop,
    ...over,
  };
  return render(<StepSidebar {...props} />);
}

const enterSelectMode = () => userEvent.click(screen.getByRole('button', { name: '선택 모드' }));

describe('선택 모드 진입/이탈', () => {
  it('진입 전에는 카드에 체크 표시(aria-pressed)가 없다 — 평소 카드 그대로', () => {
    renderSidebar(makeDrill(2));
    cards().forEach((c) => expect(c).not.toHaveAttribute('aria-pressed'));
    expect(screen.getByRole('button', { name: '선택 모드' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('진입하면 카드가 체크 가능(aria-pressed=false)해지고, 카운트·일괄 버튼이 나타난다', async () => {
    renderSidebar(makeDrill(2));
    await enterSelectMode();

    expect(screen.getByRole('button', { name: '선택 모드 끄기' })).toHaveAttribute('aria-pressed', 'true');
    cards().forEach((c) => expect(c).toHaveAttribute('aria-pressed', 'false'));
    expect(screen.getByText('선택 0장')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '선택 복제' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '선택 삭제' })).toBeInTheDocument();
  });

  it('카드를 체크한 뒤 모드를 끄면 체크가 전부 풀린다(화면 상태 — 리듀서에 안 남는다)', async () => {
    renderSidebar(makeDrill(3));
    await enterSelectMode();
    await userEvent.click(cardAt(0));
    await userEvent.click(cardAt(1));
    expect(screen.getByText('선택 2장')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '선택 모드 끄기' }));
    expect(screen.queryByText(/선택 \d+장/)).toBeNull();
    cards().forEach((c) => expect(c).not.toHaveAttribute('aria-pressed'));

    // 다시 켜면 0장부터 — 지난번 체크가 안 살아 있다.
    await enterSelectMode();
    expect(screen.getByText('선택 0장')).toBeInTheDocument();
  });
});

describe('카드 탭 의미 전환 — 모드 밖은 STEP_SELECT, 모드 안은 체크 토글', () => {
  // 대조군: 모드 밖에서는 이동/체크가 아니라 스텝 선택이다(StepSidebar.test.tsx 의 "카드를
  // 탭하면 그 스텝이 선택된다" 와 같은 계약을 여기서도 짧게 재확인한다 — 아래 "모드 안" 과
  // 나란히 있어야 "탭의 뜻이 바뀌었다" 는 대비가 한 파일 안에서 보인다).
  it('대조군 — 모드 밖에서 카드 탭은 onSelectStep 을 부른다', async () => {
    const onSelectStep = vi.fn();
    const d = makeDrill(2);
    renderSidebar(d, { onSelectStep });
    await userEvent.click(cardAt(1));
    expect(onSelectStep).toHaveBeenCalledWith(d.steps[1]!.id);
  });

  it('모드 안에서 카드 탭은 체크를 토글하고, onSelectStep 은 안 불린다', async () => {
    const onSelectStep = vi.fn();
    const d = makeDrill(2);
    renderSidebar(d, { onSelectStep });
    await enterSelectMode();

    await userEvent.click(cardAt(1));
    expect(cardAt(1)).toHaveAttribute('aria-pressed', 'true');
    expect(onSelectStep).not.toHaveBeenCalled();
    expect(screen.getByText('선택 1장')).toBeInTheDocument();

    // 다시 탭하면 해제
    await userEvent.click(cardAt(1));
    expect(cardAt(1)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('선택 0장')).toBeInTheDocument();
  });
});

describe('일괄 복제', () => {
  it('체크한 카드들의 id 로 onDuplicateSteps 를 부르고, 끝나면 체크를 비운다', async () => {
    const onDuplicateSteps = vi.fn();
    const d = makeDrill(3);
    renderSidebar(d, { onDuplicateSteps });
    await enterSelectMode();
    await userEvent.click(cardAt(0));
    await userEvent.click(cardAt(2));

    await userEvent.click(screen.getByRole('button', { name: '선택 복제' }));
    expect(onDuplicateSteps).toHaveBeenCalledTimes(1);
    expect(new Set(onDuplicateSteps.mock.calls[0]![0])).toEqual(new Set([d.steps[0]!.id, d.steps[2]!.id]));
    expect(screen.getByText('선택 0장')).toBeInTheDocument(); // 끝나면 비운다
  });

  it('아무 것도 안 체크했으면 잠긴다', async () => {
    renderSidebar(makeDrill(2));
    await enterSelectMode();
    expect(screen.getByRole('button', { name: '선택 복제' })).toBeDisabled();
  });

  it('정원(60장)에서는 잠기고 이유를 말한다', async () => {
    const onDuplicateSteps = vi.fn();
    renderSidebar(makeDrill(LIMITS.maxSteps), { onDuplicateSteps });
    await enterSelectMode();
    await userEvent.click(cardAt(0));
    const btn = screen.getByRole('button', { name: '선택 복제' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', expect.stringContaining(String(LIMITS.maxSteps)));
    await userEvent.click(btn);
    expect(onDuplicateSteps).not.toHaveBeenCalled();
  });

  // '한 장 더 찍기'·개별 복제 대조군과 같은 이유 — 잠김이 배선 자체가 없어서가 아님을 보인다.
  it('대조군: 59장 + 1장 체크(총 60장, 정원 안)는 열려 있고 실제로 발화한다', async () => {
    const onDuplicateSteps = vi.fn();
    renderSidebar(makeDrill(LIMITS.maxSteps - 1), { onDuplicateSteps });
    await enterSelectMode();
    await userEvent.click(cardAt(0));
    const btn = screen.getByRole('button', { name: '선택 복제' });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(onDuplicateSteps).toHaveBeenCalledTimes(1);
  });
});

describe('일괄 삭제', () => {
  // PLAN-DELETE-SAFETY.md §C-1(2026-08-20) — 되돌릴 수는 있어도 한 번의 오조작이 N장을
  // 가져가므로, 버튼 클릭은 이제 즉시 지우지 않고 ConfirmDialog 를 연다.
  it('버튼을 누르면 즉시 지우지 않고 확인 모달을 연다 — [삭제]를 눌러야 onDeleteSteps 가 불린다', async () => {
    const onDeleteSteps = vi.fn();
    const d = makeDrill(3);
    renderSidebar(d, { onDeleteSteps });
    await enterSelectMode();
    await userEvent.click(cardAt(0));

    await userEvent.click(screen.getByRole('button', { name: '선택 삭제' }));
    expect(onDeleteSteps).not.toHaveBeenCalled(); // 여기서는 아직 안 지운다

    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
    expect(onDeleteSteps).toHaveBeenCalledTimes(1);
    expect(onDeleteSteps).toHaveBeenCalledWith([d.steps[0]!.id]);
    expect(screen.getByText('선택 0장')).toBeInTheDocument();
  });

  it('확인 모달에서 [취소]를 누르면 onDeleteSteps 가 안 불리고 체크도 그대로 남는다', async () => {
    const onDeleteSteps = vi.fn();
    const d = makeDrill(3);
    renderSidebar(d, { onDeleteSteps });
    await enterSelectMode();
    await userEvent.click(cardAt(0));

    await userEvent.click(screen.getByRole('button', { name: '선택 삭제' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '취소' }));

    expect(onDeleteSteps).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('선택 1장')).toBeInTheDocument(); // 체크는 안 풀렸다
  });

  it('전량 선택(최소 1장 가드)이면 잠기고 이유를 말한다', async () => {
    const onDeleteSteps = vi.fn();
    const d = makeDrill(2);
    renderSidebar(d, { onDeleteSteps });
    await enterSelectMode();
    await userEvent.click(cardAt(0));
    await userEvent.click(cardAt(1));

    const btn = screen.getByRole('button', { name: '선택 삭제' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', expect.stringContaining('최소 1장'));
    await userEvent.click(btn);
    expect(onDeleteSteps).not.toHaveBeenCalled();
  });

  it('대조군: 전량에서 하나만 덜 체크하면(최소 1장 보장) 열려 있고 실제로 발화한다', async () => {
    const onDeleteSteps = vi.fn();
    const d = makeDrill(3);
    renderSidebar(d, { onDeleteSteps });
    await enterSelectMode();
    await userEvent.click(cardAt(0));
    await userEvent.click(cardAt(1));

    const btn = screen.getByRole('button', { name: '선택 삭제' });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
    expect(onDeleteSteps).toHaveBeenCalledTimes(1);
    expect(new Set(onDeleteSteps.mock.calls[0]![0])).toEqual(new Set([d.steps[0]!.id, d.steps[1]!.id]));
  });
});

// ── 일괄 이동(드래그) ─────────────────────────────────────────────────────────────────────
// StepSidebar.reorder.test.tsx 와 같은 기법(jsdom 은 레이아웃이 없어 rect 를 data-index 로
// 지어낸다)이지만 좌표계가 다르다 — 여기서는 "그룹을 뺀 나머지" 만 잰다
// (useStepGroupReorderDrag.ts 머리말). Harness 는 실제 moveSteps(edits.ts)를 태워 커밋 결과
// 까지 검증한다(미리보기만 보고 끝내면 커밋이 갈라져도 못 잡는다).
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
const down = (el: Element, y: number) => fireEvent.pointerDown(el, { pointerId: 1, clientY: y, button: 0 });
const move = (y: number) => fireEvent.pointerMove(window, { pointerId: 1, clientY: y });
const up = (y: number) => fireEvent.pointerUp(window, { pointerId: 1, clientY: y });

function GroupHarness({ initial, onMove }: { initial: Drill; onMove?: (ids: StepId[], toIndex: number) => void }) {
  const [drill, setDrill] = useState(initial);
  const [stepId, setStepId] = useState(initial.steps[0]!.id);
  return (
    <StepSidebar
      drill={drill}
      stepId={stepId}
      onSelectStep={setStepId}
      onReorderStep={(id, to) => setDrill((d) => moveStep(d, d.steps.findIndex((s) => s.id === id), to))}
      onDuplicateStep={() => {}}
      onToggleCut={() => {}}
      collapsed={false}
      onMoveSteps={(ids, to) => {
        onMove?.(ids, to);
        setDrill((d) => moveSteps(d, ids, to));
      }}
      onDuplicateSteps={() => {}}
      onDeleteSteps={() => {}}
      onDeleteStep={() => {}}
    />
  );
}

describe('일괄 이동(드래그) — 상대 순서 보존, 흩어진 선택은 한 덩어리로 뭉친다', () => {
  it('흩어져 있던 두 장(A·C)을 끌면 나머지(B·D) 뒤에 한 덩어리로(A,C 순서 그대로) 꽂힌다', async () => {
    stubCardRects();
    const onMove = vi.fn();
    const d = makeDrill(4); // A B C D
    const [idA, idB, idC, idD] = d.steps.map((s) => s.id);
    render(<GroupHarness initial={d} onMove={onMove} />);

    await enterSelectMode();
    await userEvent.click(cardAt(0)); // A 체크
    await userEvent.click(cardAt(2)); // C 체크 — 사이에 B(안 체크)가 끼어 흩어져 있다
    expect(screen.getByText('선택 2장')).toBeInTheDocument();

    // A 를 잡고 맨 끝 너머로 끈다.
    down(cardAt(0), centerOf(0));
    move(centerOf(3) + 40);
    up(centerOf(3) + 40);

    expect(onMove).toHaveBeenCalledTimes(1);
    const [ids, toIndex] = onMove.mock.calls[0]!;
    expect(new Set(ids)).toEqual(new Set([idA, idC]));
    expect(toIndex).toBe(2); // 나머지(B,D) 좌표계에서 "둘 다 지나침" = 맨 뒤

    // 실제 커밋(moveSteps) 결과 — 상대 순서(A 앞, C 뒤) 보존, 한 덩어리로 뭉쳤다.
    expect(cardOrder()).toEqual([idB, idD, idA, idC]);
  });

  it('문턱을 못 넘으면(제자리) 커밋하지 않는다 — 단일 드래그와 같은 규칙', async () => {
    stubCardRects();
    const onMove = vi.fn();
    const d = makeDrill(3);
    render(<GroupHarness initial={d} onMove={onMove} />);

    await enterSelectMode();
    await userEvent.click(cardAt(0));
    await userEvent.click(cardAt(1));

    down(cardAt(0), centerOf(0));
    move(centerOf(0) + 4); // 4px — 문턱(6px) 미만
    up(centerOf(0) + 4);

    expect(onMove).not.toHaveBeenCalled();
  });

  it('체크 안 된 카드를 끌면 평소처럼 단일 드래그다(묶음이 안 딸려온다)', async () => {
    stubCardRects();
    const onReorder = vi.fn();
    const onMove = vi.fn();
    const d = makeDrill(3);
    render(
      <StepSidebar
        drill={d}
        stepId={d.steps[0]!.id}
        onSelectStep={noop}
        onReorderStep={onReorder}
        onDuplicateStep={noop}
        onToggleCut={noop}
        collapsed={false}
        onMoveSteps={onMove}
        onDuplicateSteps={noop}
        onDeleteSteps={noop}
        onDeleteStep={noop}
      />,
    );
    await enterSelectMode();
    await userEvent.click(cardAt(0)); // A 만 체크, C(index 2)는 안 체크

    down(cardAt(2), centerOf(2));
    move(centerOf(0) - 1);
    up(centerOf(0) - 1);

    expect(onMove).not.toHaveBeenCalled();
    expect(onReorder).toHaveBeenCalledTimes(1);
  });
});

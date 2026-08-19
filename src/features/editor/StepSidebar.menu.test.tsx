// 스텝 카드 우클릭 메뉴(2026-08-18 기현님 지시: *"왼쪽바 스텝에 오른쪽 버튼 메뉴 연결.
// 거기에는 선턱(선턱모드 시작), 위/아래로 복제, 삭제 등이 있어야함"*) — StepCardMenu 배선.
// select/reorder 테스트와 파일을 가르는 이유도 같다: 메뉴는 제3의 진입 경로라, 카드 탭·드래그
// 회귀와 섞이면 파일명으로 원인이 안 보인다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render as rtlRender, screen, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { StepSidebar } from './StepSidebar.tsx';
import { createDrill } from '../../model/defaults.ts';
import { addStepAfter } from '../../model/edits.ts';
import { LIMITS } from '../../model/validate.ts';
import type { Drill } from '../../model/drill.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LONG_PRESS_MS } from './useLongPressMenu.ts';

// StepSidebar 의 카드 썸네일(CourtThumbnail)이 useLocale()(→ SettingsProvider)을 쓴다(C7).
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });

const noop = () => {};

function makeDrill(n: number): Drill {
  let d = createDrill({ courtMode: 'full' });
  for (let i = 1; i < n; i++) d = addStepAfter(d, i - 1);
  return d;
}

function renderSidebar(d: Drill, over: Partial<Parameters<typeof StepSidebar>[0]> = {}) {
  const props = {
    drill: d,
    stepId: d.steps[0]!.id,
    onSelectStep: noop,
    onReorderStep: noop,
    onAddStep: noop,
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

const cards = () => screen.getAllByRole('button', { name: /^스텝 \d+$/ });
const openMenuAt = (i: number) => {
  fireEvent.contextMenu(cards()[i]!, { clientX: 40, clientY: 60 });
  return screen.getByRole('menu', { name: `스텝 ${i + 1} 메뉴` });
};
const item = (name: string) => screen.getByRole('menuitem', { name });

describe('우클릭 메뉴 — 열림/닫힘', () => {
  it('카드 우클릭으로 열리고, 항목은 선택·아래로 복제·위로 복제·삭제 넷이다', () => {
    renderSidebar(makeDrill(3));
    openMenuAt(1);
    expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['선택', '아래로 복제', '위로 복제', '삭제']);
  });

  it('Esc 로 닫힌다', () => {
    renderSidebar(makeDrill(2));
    openMenuAt(0);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('바깥(백드롭) 탭으로 닫힌다 — 항목을 고르지 않으면 아무 콜백도 안 부른다', () => {
    const onDuplicateStep = vi.fn();
    const onDeleteStep = vi.fn();
    renderSidebar(makeDrill(2), { onDuplicateStep, onDeleteStep });
    const menu = openMenuAt(0);
    fireEvent.pointerDown(menu.previousElementSibling!); // 백드롭(메뉴 바로 앞 형제)
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onDuplicateStep).not.toHaveBeenCalled();
    expect(onDeleteStep).not.toHaveBeenCalled();
  });
});

describe('롱프레스 — 터치도 같은 메뉴에 닿는다(2026-08-20, 진입 방식 마우스/터치 일관성)', () => {
  afterEach(() => vi.useRealTimers());

  it('터치로 500ms 누르고 있으면 우클릭과 같은 메뉴가 열린다', () => {
    vi.useFakeTimers();
    renderSidebar(makeDrill(3));
    fireEvent.pointerDown(cards()[1]!, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 60, button: 0 });
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(screen.getByRole('menu', { name: '스텝 2 메뉴' })).toBeInTheDocument();
  });

  it('마우스로 누르고 있기만 해서는(우클릭 없이) 안 열린다 — 오른쪽 클릭이라는 정확한 손짓이 이미 있다', () => {
    vi.useFakeTimers();
    renderSidebar(makeDrill(2));
    fireEvent.pointerDown(cards()[0]!, { pointerId: 1, pointerType: 'mouse', clientX: 40, clientY: 60, button: 0 });
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS * 3));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('우클릭 메뉴 — 항목 배선', () => {
  it('[선택] — 선택 모드가 켜지고 그 카드가 체크된 채 시작한다', async () => {
    renderSidebar(makeDrill(3));
    openMenuAt(1);
    await userEvent.click(item('선택'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByText('선택 1장')).toBeInTheDocument();
    expect(cards()[1]).toHaveAttribute('aria-pressed', 'true');
    expect(cards()[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('[아래로 복제] — toIndex 없이 onDuplicateStep(id) (기본 자리 = 바로 뒤)', async () => {
    const onDuplicateStep = vi.fn();
    const d = makeDrill(3);
    renderSidebar(d, { onDuplicateStep });
    openMenuAt(1);
    await userEvent.click(item('아래로 복제'));
    expect(onDuplicateStep).toHaveBeenCalledTimes(1);
    expect(onDuplicateStep).toHaveBeenCalledWith(d.steps[1]!.id);
  });

  it('[위로 복제] — onDuplicateStep(id, 화면 자리) (사본이 자기 자리, 원본은 아래로)', async () => {
    const onDuplicateStep = vi.fn();
    const d = makeDrill(3);
    renderSidebar(d, { onDuplicateStep });
    openMenuAt(2);
    await userEvent.click(item('위로 복제'));
    expect(onDuplicateStep).toHaveBeenCalledTimes(1);
    expect(onDuplicateStep).toHaveBeenCalledWith(d.steps[2]!.id, 2);
  });

  it('[삭제] — onDeleteStep(id)', async () => {
    const onDeleteStep = vi.fn();
    const d = makeDrill(3);
    renderSidebar(d, { onDeleteStep });
    openMenuAt(0);
    await userEvent.click(item('삭제'));
    expect(onDeleteStep).toHaveBeenCalledTimes(1);
    expect(onDeleteStep).toHaveBeenCalledWith(d.steps[0]!.id);
  });
});

describe('우클릭 메뉴 — 가드', () => {
  it('마지막 1장이면 [삭제]가 잠기고 이유를 말한다', async () => {
    const onDeleteStep = vi.fn();
    renderSidebar(makeDrill(1), { onDeleteStep });
    openMenuAt(0);
    const del = item('삭제');
    expect(del).toBeDisabled();
    expect(del).toHaveAttribute('title', expect.stringContaining('최소 1장'));
    await userEvent.click(del);
    expect(onDeleteStep).not.toHaveBeenCalled();
  });

  it('정원(60장)이면 복제 둘이 잠긴다 — [선택]·[삭제]는 열려 있다(대조군)', () => {
    renderSidebar(makeDrill(LIMITS.maxSteps));
    openMenuAt(0);
    expect(item('아래로 복제')).toBeDisabled();
    expect(item('위로 복제')).toBeDisabled();
    expect(item('선택')).toBeEnabled();
    expect(item('삭제')).toBeEnabled();
  });
});

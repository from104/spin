// PLAN-STEP-EDITING.md 구현 순서 ② — 왼쪽 세로 스텝 바.
//
// 여기서 보는 것: 카드 수·번호·현재 스텝 강조, 탭 선택, [한 장 더 찍기], 썸네일 배수 배선,
// 접힘/오버레이 표시 모드. 드래그·키보드 재정렬 계약은 StepSidebar.reorder.test.tsx 다
// (옛 TransportBar.reorder.test.tsx 의 이사 — 계약 자체는 그대로다).
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepSidebar } from './StepSidebar.tsx';
import { SIDEBAR_GLYPH_SCALE } from '../../render/CourtThumbnail.tsx';
import { THUMB_GLYPH } from '../../render/CourtThumbnail.tsx';
import { createDrill } from '../../model/defaults.ts';
import { addStepAfter } from '../../model/edits.ts';
import { LIMITS } from '../../model/validate.ts';
import type { Drill } from '../../model/drill.ts';

function makeDrill(n: number): Drill {
  let d = createDrill({ courtMode: 'full' });
  for (let i = 1; i < n; i++) d = addStepAfter(d, i - 1);
  return d;
}

const noop = () => {};

function renderSidebar(d: Drill, over: Partial<Parameters<typeof StepSidebar>[0]> = {}) {
  const props = {
    drill: d,
    stepId: d.steps[0]!.id,
    onSelectStep: noop,
    onReorderStep: noop,
    onAddStep: noop,
    collapsed: false,
    ...over,
  };
  return render(<StepSidebar {...props} />);
}

const cards = () => screen.getAllByRole('button', { name: /^스텝 \d+$/ });

describe('카드 목록 — 고정(비접힘) 모드', () => {
  it('카드 수는 스텝 수와 같고, 번호를 보여준다', () => {
    const d = makeDrill(3);
    renderSidebar(d);
    const list = cards();
    expect(list).toHaveLength(3);
    list.forEach((c, i) => {
      expect(within(c).getByText(String(i + 1))).toBeInTheDocument();
    });
  });

  it('현재 스텝 카드에만 aria-current="step" 이 붙는다', () => {
    const d = makeDrill(3);
    renderSidebar(d, { stepId: d.steps[1]!.id });
    const list = cards();
    expect(list[0]).not.toHaveAttribute('aria-current');
    expect(list[1]).toHaveAttribute('aria-current', 'step');
    expect(list[2]).not.toHaveAttribute('aria-current');
  });

  it('카드를 탭하면 그 스텝이 선택된다', async () => {
    const onSelectStep = vi.fn();
    const d = makeDrill(3);
    renderSidebar(d, { onSelectStep });
    await userEvent.click(cards()[2]!);
    expect(onSelectStep).toHaveBeenCalledWith(d.steps[2]!.id);
  });

  it('스텝 이름은 카드에 없다 — "스텝 정보 최소화"(기현님 확정)', () => {
    const d = makeDrill(1);
    renderSidebar(d);
    // 기본 이름 '스텝 1' 같은 문구가 카드 안에 텍스트로 나와서는 안 된다. aria-label 자체는
    // '스텝 1' 이지만 그것은 순번이지 이름이 아니다 — 번호가 아닌 별도 이름 문구가 없음을 본다.
    expect(cards()[0]).toHaveAccessibleName('스텝 1');
    expect(cards()[0]!.textContent).toBe('1');
  });

  it('목록 끝에 [한 장 더 찍기] 가 있고 누르면 onAddStep 이 나간다', async () => {
    const onAddStep = vi.fn();
    renderSidebar(makeDrill(2), { onAddStep });
    await userEvent.click(screen.getByRole('button', { name: '한 장 더 찍기' }));
    expect(onAddStep).toHaveBeenCalledTimes(1);
  });

  it('상한(60장)에서는 [한 장 더 찍기] 가 잠기고 이유를 말한다', async () => {
    const onAddStep = vi.fn();
    renderSidebar(makeDrill(LIMITS.maxSteps), { onAddStep });
    const btn = screen.getByRole('button', { name: '한 장 더 찍기' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', expect.stringContaining(String(LIMITS.maxSteps)));
    await userEvent.click(btn);
    expect(onAddStep).not.toHaveBeenCalled();
  });

  // 위의 "안 불렸다" 가 '배선이 아예 없어서' 통과하는 것이 아님을 보이는 대조군이다
  // (옛 TransportBar.test.tsx 의 이사).
  it('대조군: 59장에서는 열려 있고 실제로 발화한다', async () => {
    const onAddStep = vi.fn();
    renderSidebar(makeDrill(LIMITS.maxSteps - 1), { onAddStep });
    const btn = screen.getByRole('button', { name: '한 장 더 찍기' });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(onAddStep).toHaveBeenCalledTimes(1);
  });

  it('틈이 카드 수 + 1 개다 — 양 끝 + 카드 사이', () => {
    const { container } = renderSidebar(makeDrill(3));
    expect(container.querySelectorAll('[data-gap-index]')).toHaveLength(4);
  });

  it('고정 모드에는 여는 버튼이 없다', () => {
    renderSidebar(makeDrill(1));
    expect(screen.queryByRole('button', { name: '스텝 목록 열기' })).toBeNull();
  });
});

// 2026-08-17 — 카드가 칩보다 4배 가까이 커서(≈200px vs ≈76px) SIDEBAR_GLYPH_SCALE 로 완전
// 보정한다. 배선이 끊기면 화면은 '점 몇 개짜리 빈 코트' 로 조용히 퇴화하고, 크기를 재는 테스트는
// CourtThumbnail 쪽에만 있어 아무도 안 세게 된다 — 그래서 여기서 배수를 확인한다
// (옛 TransportBar.test.tsx "칩 배수로 그린다" 가드의 이사).
describe('카드 썸네일 — SIDEBAR_GLYPH_SCALE 로 그린다', () => {
  it('★ 카드 안 휠체어는 THUMB_GLYPH × SIDEBAR_GLYPH_SCALE 이다', () => {
    const { container } = renderSidebar(makeDrill(1));
    const rs = [...container.querySelectorAll('circle')].map((c) => Number(c.getAttribute('r')));
    expect(rs).toContain(THUMB_GLYPH.chairR * SIDEBAR_GLYPH_SCALE);
    expect(rs).not.toContain(THUMB_GLYPH.chairR); // 배선이 끊겨 축척 1 로 퇴화하면 여기서 걸린다
  });
});

describe('접힘 모드 — 여는 버튼 + 오버레이', () => {
  it('처음엔 여는 버튼만 있고 카드 목록은 없다', () => {
    renderSidebar(makeDrill(3), { collapsed: true });
    const btn = screen.getByRole('button', { name: '스텝 목록 열기' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: '스텝 목록' })).toBeNull();
  });

  it('버튼을 누르면 오버레이로 카드 목록이 뜨고 aria-expanded 가 왕복한다', async () => {
    const d = makeDrill(3);
    renderSidebar(d, { collapsed: true });
    const btn = screen.getByRole('button', { name: '스텝 목록 열기' });

    await userEvent.click(btn);
    expect(screen.getByRole('button', { name: '스텝 목록 닫기' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: '스텝 목록' })).toBeInTheDocument();
    expect(cards()).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: '스텝 목록 닫기' }));
    expect(screen.getByRole('button', { name: '스텝 목록 열기' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: '스텝 목록' })).toBeNull();
  });

  it('바깥(배경)을 탭하면 닫힌다', async () => {
    renderSidebar(makeDrill(2), { collapsed: true });
    await userEvent.click(screen.getByRole('button', { name: '스텝 목록 열기' }));
    expect(screen.getByRole('navigation', { name: '스텝 목록' })).toBeInTheDocument();

    const backdrop = document.querySelector('[data-sidebar-backdrop]') as HTMLElement;
    await userEvent.click(backdrop);
    expect(screen.queryByRole('navigation', { name: '스텝 목록' })).toBeNull();
  });

  it('오버레이 안에서도 카드 탭이 그대로 동작한다', async () => {
    const onSelectStep = vi.fn();
    const d = makeDrill(3);
    renderSidebar(d, { collapsed: true, onSelectStep });
    await userEvent.click(screen.getByRole('button', { name: '스텝 목록 열기' }));
    await userEvent.click(cards()[1]!);
    expect(onSelectStep).toHaveBeenCalledWith(d.steps[1]!.id);
  });
});

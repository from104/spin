// §6.11/부록A 드릴 카드. 열기·더보기 메뉴(복제/파일로 내보내기/삭제) 동작과
// 판 걸이(로드맵 2.7)의 상시 노출 [시연]·코트 비율 썸네일을 확인한다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrillCard } from './DrillCard.tsx';
import { buildSummary } from '../../model/summary.ts';
import { createDrill } from '../../model/defaults.ts';
import type { CourtMode } from '../../model/court.ts';

function makeSummary(title = '카드 테스트 드릴', courtMode: CourtMode = 'full') {
  return buildSummary(createDrill({ courtMode, title }));
}

/** 필수 콜백을 전부 no-op 으로 채운 기본 prop — 각 테스트는 관심 있는 것만 스파이로 덮는다. */
function noopHandlers() {
  return { onOpen: () => {}, onPresent: () => {}, onDuplicate: () => {}, onDelete: () => {}, onExport: () => {} };
}

describe('DrillCard', () => {
  it('카드를 클릭하면 onOpen 이 호출된다', async () => {
    const onOpen = vi.fn();
    const d = makeSummary();
    render(<DrillCard drill={d} {...noopHandlers()} onOpen={onOpen} />);
    await userEvent.setup().click(screen.getByRole('button', { name: `${d.title} 열기` }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('상시 노출 [시연] 을 클릭하면 onPresent 만 호출된다 — onOpen 은 안 불린다', async () => {
    // 대조군: [시연] 이 카드면 버튼 안에 겹쳐 들어가 열기를 겸하게 되는 회귀를 잡는다.
    const onPresent = vi.fn();
    const onOpen = vi.fn();
    const d = makeSummary();
    render(<DrillCard drill={d} {...noopHandlers()} onOpen={onOpen} onPresent={onPresent} />);
    await userEvent.setup().click(screen.getByRole('button', { name: `${d.title} 시연 시작` }));
    expect(onPresent).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('썸네일 상자가 그 드릴 코트의 실제 비율이다 — full 825/525, half 525/450', () => {
    // 판 걸이: 320/192 고정 틀이 아니라 COURT_DEFS viewBox 비율. 카드 둘을 나란히 그려
    // 서로 다른 비율이 나오는 것까지 본다(한 장만 보면 "전부 같은 값" 회귀를 못 잡는다).
    const full = makeSummary('풀 코트 드릴', 'full');
    const half = makeSummary('하프 코트 드릴', 'half');
    render(
      <>
        <DrillCard drill={full} {...noopHandlers()} />
        <DrillCard drill={half} {...noopHandlers()} />
      </>,
    );
    const boxOf = (label: string) => screen.getByRole('img', { name: label }).parentElement as HTMLElement;
    expect(boxOf('풀 코트 미리보기').style.aspectRatio).toBe('825 / 525');
    expect(boxOf('하프 코트 미리보기').style.aspectRatio).toBe('525 / 450');
    // 상자만 비율이고 svg 가 상자를 안 채우면(fill 미배선) 기본 크기(300×150)로 새어 나온다.
    const svg = screen.getByRole('img', { name: '풀 코트 미리보기' }) as unknown as SVGSVGElement;
    expect(svg.style.position).toBe('absolute');
    expect(svg.style.width).toBe('100%');
    expect(svg.style.height).toBe('100%');
  });

  it('더보기 메뉴에서 복제·파일로 내보내기·삭제를 각각 호출할 수 있다', async () => {
    const d = makeSummary();
    const onDuplicate = vi.fn();
    const onExport = vi.fn();
    const onDelete = vi.fn();
    render(<DrillCard drill={d} {...noopHandlers()} onDuplicate={onDuplicate} onDelete={onDelete} onExport={onExport} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: `${d.title} 더보기` }));
    await user.click(screen.getByRole('menuitem', { name: '복제' }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: `${d.title} 더보기` }));
    await user.click(screen.getByRole('menuitem', { name: '파일로 내보내기' }));
    expect(onExport).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: `${d.title} 더보기` }));
    await user.click(screen.getByRole('menuitem', { name: '삭제' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('Escape 를 누르면 메뉴가 닫힌다', async () => {
    const d = makeSummary();
    render(<DrillCard drill={d} {...noopHandlers()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: `${d.title} 더보기` }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // SUMMARY_BUILD 3 (2026-08-17) — 목록 카드 부제. summary.ts 가 이미 한 줄로 자른 값을
  // 그대로 그리는지만 본다(자르는 로직 자체는 summary.test.ts).
  it('부제(드릴 짧은 설명)가 있으면 제목 아래 렌더된다', () => {
    const d = { ...makeSummary(), description: '카드 부제 문구' };
    render(<DrillCard drill={d} {...noopHandlers()} />);
    expect(screen.getByText('카드 부제 문구')).toBeInTheDocument();
  });

  it('부제가 없으면 그 줄 자체가 없다 — 빈 줄로 카드 세로 리듬을 깨지 않는다', () => {
    const d = makeSummary(); // buildSummary 는 description 없는 드릴에 키를 안 만든다
    expect('description' in d).toBe(false);
    const { container } = render(<DrillCard drill={d} {...noopHandlers()} />);
    // 부제 자리는 title 과 아이콘 행 사이의 fontSize 0.78125rem 줄 하나뿐이라 그 존재 여부로 판정.
    expect(container.querySelector('[style*="0.78125rem"]')).toBeNull();
  });
});

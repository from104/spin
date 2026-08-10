// §6.10 판 가장자리 트레이 — 개체(끌어다 놓는 말) / 기능(모드) 두 구역, 공 상한 표시,
// 콘 재클릭 토글, 선수 칩 탭.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ToolRail, type UnplacedChair, type ToolRailProps } from './ToolRail.tsx';
import type { ChairId } from '../../core/ids.ts';
import type { ToolId } from '../../physics/index.ts';

const UNPLACED: UnplacedChair[] = [
  { id: 'ch_a' as ChairId, number: '2', color: '#d93a3a', ink: '#fff' },
  { id: 'ch_b' as ChairId, number: 'G', color: '#2f7de1', ink: '#fff' },
];

function ControlledRail(props: { unplacedChairs?: UnplacedChair[] }) {
  const [tool, setTool] = useState<ToolId>('select');
  const [coneSlot, setConeSlot] = useState<0 | 1>(0);
  const [pending, setPending] = useState<ChairId | null>(null);
  return (
    <ToolRail
      tool={tool}
      onSelectTool={setTool}
      coneSlot={coneSlot}
      onConeSlotChange={setConeSlot}
      ballCount={0}
      ballMax={10}
      unplacedChairs={props.unplacedChairs ?? []}
      pendingPlayerId={pending}
      onArmPlayer={setPending}
      courtLabel="풀 코트"
    />
  );
}

describe('ToolRail — 기능 구역', () => {
  it('모드 도구 5종을 렌더한다', () => {
    render(<ControlledRail />);
    for (const label of ['선택', '이동', '패스', '메모', '지우개']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    }
  });

  it("'선수' 는 모드 버튼이 아니라 칩으로 놓인다", () => {
    // 개체를 모드 버튼으로 두면 "고르고 → 찍는" 2단계가 되고, 그게 공개판 최대 불만이었다.
    render(<ControlledRail unplacedChairs={UNPLACED} />);
    expect(screen.queryByRole('button', { name: /^선수$/ })).toBeNull();
    expect(screen.getByRole('button', { name: '2번 선수 배치' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'G번 선수 배치' })).toBeInTheDocument();
  });
});

describe('ToolRail — 개체 구역', () => {
  it('공 10/10 이면 aria-disabled + 배지를 표시한다(§6.10)', () => {
    render(
      <ToolRail
        tool="ball"
        onSelectTool={() => {}}
        coneSlot={0}
        onConeSlotChange={() => {}}
        ballCount={10}
        ballMax={10}
        unplacedChairs={[]}
        pendingPlayerId={null}
        onArmPlayer={() => {}}
        courtLabel="풀 코트"
      />,
    );
    const ballBtn = screen.getByRole('button', { name: /^공/ });
    expect(ballBtn).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('10/10')).toBeInTheDocument();
  });

  it('콘을 활성 상태에서 다시 누르면 색이 토글된다(§6.10 "재클릭 토글")', async () => {
    const user = userEvent.setup();
    render(<ControlledRail />);
    const coneBtn = screen.getByRole('button', { name: /^콘/ });
    await user.click(coneBtn); // 1회: 도구 선택
    expect(screen.getByRole('radiogroup', { name: '콘 색상' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '주황 콘' })).toHaveAttribute('aria-checked', 'true');
    await user.click(coneBtn); // 2회: 활성 상태 재클릭 → 토글
    expect(screen.getByRole('radio', { name: '분홍 콘' })).toHaveAttribute('aria-checked', 'true');
  });

  it('선수 칩을 탭하면 그 선수를 배치 대기로 만든다(예전 2단계 경로 유지)', async () => {
    const user = userEvent.setup();
    render(<ControlledRail unplacedChairs={UNPLACED} />);
    await user.click(screen.getByRole('button', { name: '2번 선수 배치' }));
    expect(screen.getByRole('button', { name: '2번 선수 배치' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('미배치 선수가 없으면 그렇게 말해 준다', () => {
    render(<ControlledRail unplacedChairs={[]} />);
    expect(screen.getByText('선수 모두 배치됨')).toBeInTheDocument();
  });
});

describe('ToolRail — 끌어다 놓기 연결', () => {
  type ItemDown = NonNullable<ToolRailProps['onItemPointerDown']>;
  const renderWithDrag = (onItemPointerDown: ItemDown) =>
    render(
      <ToolRail
        tool="select"
        onSelectTool={() => {}}
        coneSlot={0}
        onConeSlotChange={() => {}}
        ballCount={0}
        ballMax={10}
        unplacedChairs={UNPLACED}
        pendingPlayerId={null}
        onArmPlayer={() => {}}
        courtLabel="풀 코트"
        onItemPointerDown={onItemPointerDown}
      />,
    );

  it('개체(선수 칩·공·콘)는 pointerdown 에서 드래그 세션을 연다', async () => {
    const onItem = vi.fn<ItemDown>();
    renderWithDrag(onItem);
    const user = userEvent.setup();

    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: '2번 선수 배치' }) });
    expect(onItem.mock.calls[0]![0]).toEqual({ kind: 'player', chairId: 'ch_a' });

    onItem.mockClear();
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: /^공/ }) });
    expect(onItem.mock.calls[0]![0]).toEqual({ kind: 'ball' });

    onItem.mockClear();
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: /^콘/ }) });
    expect(onItem.mock.calls[0]![0]).toEqual({ kind: 'cone' });
  });

  it('기능 도구는 끌 수 없다 — 모드라서 끌 것이 없다', async () => {
    const onItem = vi.fn<ItemDown>();
    renderWithDrag(onItem);
    const user = userEvent.setup();
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: /^지우개/ }) });
    expect(onItem).not.toHaveBeenCalled();
  });
});

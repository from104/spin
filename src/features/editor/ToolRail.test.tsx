// §6.10 판 가장자리 트레이 — 개체(끌어다 놓는 말) / 기능(모드) 두 구역, 선수 주차 슬롯,
// 공·콘 상자의 남은 개수, 색깔별 콘 상자, 선수 칩 탭.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ToolRail, type ChairSlot, type ToolRailProps } from './ToolRail.tsx';
import type { ChairId } from '../../core/ids.ts';
import type { ToolId } from '../../physics/index.ts';
import { BALL, CONE } from '../../core/constants.ts';

const SLOTS: ChairSlot[] = [
  { id: 'ch_a' as ChairId, number: '2', color: '#d93a3a', ink: '#fff', placed: false },
  { id: 'ch_b' as ChairId, number: 'G', color: '#2f7de1', ink: '#fff', placed: false },
];

/** 상자 기본값 — 재고가 가득한 상태. 개별 테스트가 필요한 것만 덮어쓴다. */
const FULL = {
  ballCount: 0,
  ballMax: BALL.maxCount,
  coneCounts: [0, 0] as [number, number],
  coneMax: CONE.maxCountPerColor,
};

function ControlledRail(props: { chairSlots?: ChairSlot[] }) {
  const [tool, setTool] = useState<ToolId>('select');
  const [coneSlot, setConeSlot] = useState<0 | 1>(0);
  const [pending, setPending] = useState<ChairId | null>(null);
  return (
    <ToolRail
      tool={tool}
      onSelectTool={setTool}
      coneSlot={coneSlot}
      onConeSlotChange={setConeSlot}
      {...FULL}
      chairSlots={props.chairSlots ?? []}
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
    render(<ControlledRail chairSlots={SLOTS} />);
    expect(screen.queryByRole('button', { name: /^선수$/ })).toBeNull();
    expect(screen.getByRole('button', { name: '2번 선수 배치' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'G번 선수 배치' })).toBeInTheDocument();
  });
});

describe('ToolRail — 선수 주차 슬롯', () => {
  it('코트에 나가 있는 선수는 빈 슬롯으로 남고 끌 수 없다', () => {
    // 자리가 사라지면 트레이 길이가 배치할 때마다 출렁이고, 무엇보다 코트에서 빼낸 말이
    // 어디로 돌아가는지가 안 보인다. 자리는 남기되 버튼이 아니게 만든다.
    render(<ControlledRail chairSlots={[{ ...SLOTS[0]!, placed: true }, SLOTS[1]!]} />);
    expect(screen.queryByRole('button', { name: '2번 선수 배치' })).toBeNull();
    expect(screen.getByRole('button', { name: 'G번 선수 배치' })).toBeInTheDocument();
  });
});

describe('ToolRail — 개체 상자', () => {
  it('공 상자는 놓은 수가 아니라 **남은** 수를 보여 준다', () => {
    // 손이 다음에 알고 싶은 것은 "몇 개 놓았나"가 아니라 "몇 개 더 꺼낼 수 있나"다.
    render(
      <ToolRail
        tool="select"
        onSelectTool={() => {}}
        coneSlot={0}
        onConeSlotChange={() => {}}
        {...FULL}
        ballCount={3}
        chairSlots={[]}
        pendingPlayerId={null}
        onArmPlayer={() => {}}
        courtLabel="풀 코트"
      />,
    );
    const ballBtn = screen.getByRole('button', { name: /^공/ });
    expect(ballBtn).toHaveTextContent(String(BALL.maxCount - 3));
    // 개수는 **이름**이 아니라 설명이다 — 이름이 흔들리면 같은 버튼이 매번 다르게 들린다.
    expect(ballBtn).toHaveAccessibleName('공');
    expect(ballBtn).toHaveAccessibleDescription(`${BALL.maxCount - 3}개 남음`);
  });

  it('공 상자가 비면 aria-disabled 가 되고 남은 수가 0 이다', () => {
    render(
      <ToolRail
        tool="ball"
        onSelectTool={() => {}}
        coneSlot={0}
        onConeSlotChange={() => {}}
        {...FULL}
        ballCount={BALL.maxCount}
        chairSlots={[]}
        pendingPlayerId={null}
        onArmPlayer={() => {}}
        courtLabel="풀 코트"
      />,
    );
    const ballBtn = screen.getByRole('button', { name: /^공/ });
    expect(ballBtn).toHaveAttribute('aria-disabled', 'true');
    expect(ballBtn).toHaveAccessibleDescription(`상자가 비었습니다 — 최대 ${BALL.maxCount}개`);
  });

  it('콘은 색마다 상자가 따로고 남은 수도 따로다', () => {
    // 배지 하나로 두 색의 재고를 나타낼 수 없다 — 그래서 재클릭 색 토글 팝오버를 버렸다.
    render(
      <ToolRail
        tool="select"
        onSelectTool={() => {}}
        coneSlot={0}
        onConeSlotChange={() => {}}
        {...FULL}
        coneCounts={[5, 1]}
        chairSlots={[]}
        pendingPlayerId={null}
        onArmPlayer={() => {}}
        courtLabel="풀 코트"
      />,
    );
    expect(screen.getByRole('button', { name: '주황 콘' })).toHaveAccessibleDescription(
      `${CONE.maxCountPerColor - 5}개 남음`,
    );
    expect(screen.getByRole('button', { name: '파랑 콘' })).toHaveAccessibleDescription(
      `${CONE.maxCountPerColor - 1}개 남음`,
    );
  });

  it('콘 상자를 누르면 그 색이 곧 선택된 색이 된다', async () => {
    const user = userEvent.setup();
    render(<ControlledRail />);
    await user.click(screen.getByRole('button', { name: '파랑 콘' }));
    expect(screen.getByRole('button', { name: '파랑 콘' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '주황 콘' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('선수 칩을 탭하면 그 선수를 배치 대기로 만든다(예전 2단계 경로 유지)', async () => {
    const user = userEvent.setup();
    render(<ControlledRail chairSlots={SLOTS} />);
    await user.click(screen.getByRole('button', { name: '2번 선수 배치' }));
    expect(screen.getByRole('button', { name: '2번 선수 배치' })).toHaveAttribute('aria-pressed', 'true');
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
        {...FULL}
        chairSlots={SLOTS}
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
  });

  it('콘은 어느 상자에서 꺼냈는지를 드래그가 들고 간다', async () => {
    // 도구 상태(coneSlot)와 어긋날 수 있다 — 파랑 상자를 끌었으면 파랑이어야 한다.
    const onItem = vi.fn<ItemDown>();
    renderWithDrag(onItem);
    const user = userEvent.setup();
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: '파랑 콘' }) });
    expect(onItem.mock.calls[0]![0]).toEqual({ kind: 'cone', coneSlot: 1 });
  });

  it('기능 도구는 끌 수 없다 — 모드라서 끌 것이 없다', async () => {
    const onItem = vi.fn<ItemDown>();
    renderWithDrag(onItem);
    const user = userEvent.setup();
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: /^지우개/ }) });
    expect(onItem).not.toHaveBeenCalled();
  });
});

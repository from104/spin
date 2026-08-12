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

/** 도구를 **밖에서** 쥔 렌더 — 단축키(R·P·T)로 도구가 바뀐 상황을 그대로 흉내낸다.
 *  ToolRail 은 단축키를 스스로 듣지 않는다(useEditorKeyboard 가 듣고 tool 을 내려준다). */
function renderWithTool(tool: ToolId, onSelectTool: (t: ToolId) => void = () => {}) {
  return render(
    <ToolRail
      tool={tool}
      onSelectTool={onSelectTool}
      coneSlot={0}
      onConeSlotChange={() => {}}
      {...FULL}
      chairSlots={SLOTS}
      pendingPlayerId={null}
      onArmPlayer={() => {}}
      courtLabel="풀 코트"
    />,
  );
}

/** 기능 구역 안의 표적만 센다 — 첫 화면 표적 예산(2.5)이 세는 것과 같은 단위다. */
const functionTargets = () =>
  [...document.querySelectorAll<HTMLElement>('[aria-label="기능"] button')].map(
    (b) => b.textContent?.trim() ?? '',
  );

describe('ToolRail — 기능 구역', () => {
  it('모드 도구는 3표적이다 — 선택 · 작도 손잡이 · 지우개 (3.-1)', () => {
    // 5종을 상시 노출하면 §3 의 미착수분(도움말·빈 판 채우기·둘째 서랍)이 들어올 때
    // 2.5 게이트(≤40)가 빨간불이 된다. 접는 것이지 없애는 게 아니다 — 아래 it 들이 그 증명.
    render(<ControlledRail />);
    expect(functionTargets()).toHaveLength(3);
    for (const label of ['선택', '작도', '지우개']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    }
  });

  it('접힌 3종(이동·패스·메모)은 닫힌 서랍 안이라 첫 화면 표적이 아니다', () => {
    // 숨기기(display:none)가 아니라 **DOM 에 없음**이라야 표적 수가 실제로 준다.
    render(<ControlledRail />);
    for (const label of ['이동', '패스', '메모']) {
      expect(screen.queryByRole('button', { name: new RegExp(`^${label}`) }), label).toBeNull();
    }
    expect(screen.getByRole('button', { name: /^작도/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('손잡이를 누르면 서랍이 열리고 접힌 3종이 나온다', async () => {
    render(<ControlledRail />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^작도/ }));
    expect(screen.getByRole('button', { name: /^작도/ })).toHaveAttribute('aria-expanded', 'true');
    for (const label of ['이동', '패스', '메모']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) }), label).toBeInTheDocument();
    }
    expect(screen.getByRole('group', { name: '작도 도구' })).toBeInTheDocument();
  });

  it('서랍이 열려도 위쪽 항목의 자리가 그대로다 — 조준 대상이 사용 중에 이동하지 않는다', async () => {
    // §3 불변식 1. jsdom 에는 레이아웃이 없으므로 **문서 순서**로 잰다: 서랍 이전 항목들의
    // 순서열이 개폐 전후로 한 칸도 안 밀리고, 새로 난 3칸은 전부 뒤에 붙는다.
    render(<ControlledRail chairSlots={SLOTS} />);
    // 손잡이 표식(▸/▾)은 여는 방향이라 개폐로 바뀐다 — 자리를 재는 데 쓰면 안 된다.
    const order = () =>
      [...document.querySelectorAll<HTMLElement>('nav button')].map(
        (b) => b.getAttribute('aria-label') ?? (b.textContent ?? '').replace(/[▸▾]/g, '').trim(),
      );
    const before = order();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^작도/ }));
    const after = order();
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.slice(before.length)).toEqual(['이동', '패스', '메모']);
  });

  it('단축키로 접힌 도구가 켜지면 서랍이 스스로 열린다 — 잠긴 기능 0개(§3 불변식 2)', () => {
    // R·P·T 는 접힌 상태에서도 살아 있다. 도구만 바뀌고 서랍이 닫혀 있으면 활성 도구가
    // 화면에 없는 상태가 되고, 그게 정확히 '잠긴 기능'이다.
    renderWithTool('pass');
    expect(screen.getByRole('button', { name: /^작도/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /^패스/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('한 번 열린 서랍은 도구가 선택으로 돌아가도 닫히지 않는다 — 배운 자리가 사라지지 않는다', () => {
    const { rerender } = renderWithTool('note');
    expect(screen.getByRole('button', { name: /^작도/ })).toHaveAttribute('aria-expanded', 'true');
    rerender(
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
      />,
    );
    expect(screen.getByRole('button', { name: /^작도/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /^메모/ })).toBeInTheDocument();
  });

  it('서랍 안 도구를 누르면 그 도구가 켜진다 — 접었지 없애지 않았다', async () => {
    const onSelectTool = vi.fn<(t: ToolId) => void>();
    renderWithTool('select', onSelectTool);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^작도/ }));
    await user.click(screen.getByRole('button', { name: /^이동/ }));
    expect(onSelectTool).toHaveBeenCalledWith('route');
    // 대조군: 손잡이 자체는 도구를 고르지 않는다(열고 닫기만 한다) — 위 1회가 전부다.
    expect(onSelectTool).toHaveBeenCalledTimes(1);
  });

  it('손잡이도 --hit 손잡이다 — 서랍을 여는 것이 44 미만이면 접은 값이 없다', () => {
    render(<ControlledRail />);
    const handle = screen.getByRole('button', { name: /^작도/ });
    expect(handle.style.minWidth).toBe('var(--hit)');
    expect(handle.style.minHeight).toBe('var(--hit)');
    expect(handle.style.width).toBe('52px');
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

  it('배선된 상태에서도 키보드 Enter 로 칩을 집을 수 있다(§5.6 복구)', async () => {
    // 주 사용자는 입에 문 젓가락으로 타이핑한다 — 키보드 경로가 죽으면 트레이가 통째로 닫힌다.
    // 키보드 활성화는 pointerdown 없이 click(detail=0)만 오므로, 드래그가 배선돼 있어도
    // onTap(=onArmPlayer)이 그대로 발화해야 한다.
    const onItem = vi.fn<ItemDown>();
    const onArm = vi.fn();
    render(
      <ToolRail
        tool="select"
        onSelectTool={() => {}}
        coneSlot={0}
        onConeSlotChange={() => {}}
        {...FULL}
        chairSlots={SLOTS}
        pendingPlayerId={null}
        onArmPlayer={onArm}
        courtLabel="풀 코트"
        onItemPointerDown={onItem}
      />,
    );
    const user = userEvent.setup();
    screen.getByRole('button', { name: '2번 선수 배치' }).focus();
    await user.keyboard('{Enter}');
    expect(onArm).toHaveBeenCalledTimes(1);
    expect(onArm).toHaveBeenCalledWith('ch_a');
    expect(onItem).not.toHaveBeenCalled();
  });

  it('배선된 상태의 마우스 탭은 한 번만 발화한다 — pointerdown 경로와 click 이 겹치지 않는다', async () => {
    // 실제 배선(useTrayDrag)은 문턱을 못 넘긴 탭에서 onTap 을 부른다. 그 뒤에 따라오는
    // click(detail=1)까지 onTap 을 부르면 이중 발화다 — 그게 §5.6 이 경계한 전형적 실패다.
    const onItem = vi.fn<ItemDown>((_item, _e, onTap) => onTap());
    const onArm = vi.fn();
    render(
      <ToolRail
        tool="select"
        onSelectTool={() => {}}
        coneSlot={0}
        onConeSlotChange={() => {}}
        {...FULL}
        chairSlots={SLOTS}
        pendingPlayerId={null}
        onArmPlayer={onArm}
        courtLabel="풀 코트"
        onItemPointerDown={onItem}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '2번 선수 배치' }));
    expect(onItem).toHaveBeenCalledTimes(1);
    expect(onArm).toHaveBeenCalledTimes(1);
  });

  it('기능 도구는 끌 수 없다 — 모드라서 끌 것이 없다', async () => {
    const onItem = vi.fn<ItemDown>();
    renderWithDrag(onItem);
    const user = userEvent.setup();
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: /^지우개/ }) });
    expect(onItem).not.toHaveBeenCalled();
  });
});

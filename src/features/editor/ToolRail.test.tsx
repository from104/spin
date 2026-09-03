// §6.10 판 가장자리 트레이 — 개체(끌어다 놓는 말) / 기능(모드) 두 구역, 선수 주차 슬롯,
// 공·콘 상자의 남은 개수, 색깔별 콘 상자, 선수 칩 탭.
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render as rtlRender, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ToolRail, type ChairSlot, type ToolRailProps } from './ToolRail.tsx';
import { FLYOUT_LEAVE_CLOSE_MS, FLYOUT_PICK_CLOSE_MS } from './useFlyout.ts';
import type { ChairId } from '../../core/ids.ts';
import type { ToolId } from '../../physics/index.ts';
import { BALL, CONE } from '../../core/constants.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

// ToolRail 이 useT()/useLocale()(→ SettingsProvider)을 쓴다(C7) — 이 파일 전체를 감싼다.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });

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

// 2026-08-14 — `tray`·`onTrayChange`·`drillUses` 가 사라졌다(서랍이 플라이아웃이 되면서
// "열린 채로 둔다" 라는 상태가 없어졌다). 남은 확장 지점은 방향 하나다.
type RailExtras = Pick<ToolRailProps, 'orientation'>;

function ControlledRail({ chairSlots, ...extras }: { chairSlots?: ChairSlot[] } & RailExtras) {
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
      chairSlots={chairSlots ?? []}
      pendingPlayerId={pending}
      onArmPlayer={setPending}
      courtLabel="풀 코트"
      {...extras}
    />
  );
}

/** 도구를 **밖에서** 쥔 렌더 — 단축키(R·P·T)로 도구가 바뀐 상황을 그대로 흉내낸다.
 *  ToolRail 은 단축키를 스스로 듣지 않는다(useEditorKeyboard 가 듣고 tool 을 내려준다). */
function renderWithTool(tool: ToolId, onSelectTool: (t: ToolId) => void = () => {}, extras: RailExtras = {}) {
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
      {...extras}
    />,
  );
}

const handle = (label: '작도' | '설명') => screen.getByRole('button', { name: new RegExp(`^${label}`) });
const expanded = (label: '작도' | '설명') => handle(label).getAttribute('aria-expanded');
// ⚠️ 접두 매칭이 아니라 **정확 매칭**이다(2026-08-16). 도구 이름이 '선' 이 되면서 '선택' 과
// 접두가 겹쳐, `^선` 으로는 선택 도구가 선 도구로 잡힌다 — 그 상태로는 "접혀 있다" 를 재는
// 단언이 언제나 거짓이 된다(실제로 그렇게 빨개졌다).
const hasTool = (label: string) => screen.queryByRole('button', { name: new RegExp(`^${label}$`) }) !== null;
describe('ToolRail — 기능 구역', () => {
  // 2026-09-03 — **[지우기]만 "같은 도구 한 번 더 = 고정" 관례를 비켜 간다**(기현 지시:
  // *"다시 지우기 버튼을 누르면 선택으로 복귀"*). 리듀서의 `TOOL_SET` 은 고정 허용 목록
  // (`LOCKABLE_TOOLS`)에 없는 도구를 한 번 더 받으면 **상태를 그대로 돌려준다** — 즉 레일이
  // 가로채지 않으면 재클릭이 조용히 죽고 세 출구 중 하나가 사라진다. 그 가로채기를 잰다.
  it('켜진 [지우기]를 다시 누르면 select 로 돌아간다 — 재클릭이 고정이 아니라 출구다', async () => {
    const onSelectTool = vi.fn<(t: ToolId) => void>();
    renderWithTool('eraser', onSelectTool);
    await userEvent.setup().click(screen.getByRole('button', { name: /^지우기$/ }));
    expect(onSelectTool).toHaveBeenCalledWith('select');
  });

  it('대조군 — 꺼진 [지우기]를 누르면 그 도구가 켜진다(출구가 입구까지 삼키지 않았다)', async () => {
    const onSelectTool = vi.fn<(t: ToolId) => void>();
    renderWithTool('select', onSelectTool);
    await userEvent.setup().click(screen.getByRole('button', { name: /^지우기$/ }));
    expect(onSelectTool).toHaveBeenCalledWith('eraser');
  });

  it('대조군 — [메모]는 관례 그대로다: 켜진 채 다시 눌러도 자기 id 를 보낸다(고정 토글)', async () => {
    const onSelectTool = vi.fn<(t: ToolId) => void>();
    renderWithTool('note', onSelectTool);
    await userEvent.setup().click(screen.getByRole('button', { name: /^메모$/ }));
    expect(onSelectTool).toHaveBeenCalledWith('note');
  });

  it('접힌 것은 선(작도 서랍)뿐이다 — 메모는 이제 상시 표적이다', () => {
    // 숨기기(display:none)가 아니라 **DOM 에 없음**이라야 표적 수가 실제로 준다.
    render(<ControlledRail />);
    // 2026-08-27 — 설명 손잡이는 폐기됐다(기현 지시: 서랍에 다른 기능 들어갈 가능성 없음) — 남아 있으면 회귀다.
    expect(screen.queryByRole('button', { name: /^설명/ }), '손잡이가 남아 있다').toBeNull();
    expect(hasTool('선'), '선은 작도 서랍 안이라 안 보인다').toBe(false);
    expect(hasTool('메모'), '메모는 서랍이 사라져 상시로 보인다').toBe(true);
    expect(expanded('작도')).toBe('false');
  });

  it('작도 손잡이를 누르면 선·자유 그리기가 나온다 — 메모는 그대로 접혀 있다(대조군)', async () => {
    render(<ControlledRail />);
    const user = userEvent.setup();
    await user.click(handle('작도'));
    expect(expanded('작도')).toBe('true');
    expect(screen.getByRole('group', { name: '작도 도구' })).toBeInTheDocument();
    // 🔁 2026-09-03 — `자유` 가 합류했다(기현 지시). **서랍 안**이라 첫 화면 표적은 안 늘고,
    //    서랍을 연 상태의 예산만 하나 오른다(boardTargetBudget 머리말의 그 셈).
    for (const label of ['선', '자유']) expect(hasTool(label), label).toBe(true);
    // 대조군: 서랍을 열어도 상시 도구는 그대로다(메모는 원래 보인다 — 서랍과 무관).
    expect(hasTool('메모')).toBe(true);
  });

  it('서랍 안 도구를 누르면 그 도구가 켜진다 — 접었지 없애지 않았다', async () => {
    const onSelectTool = vi.fn<(t: ToolId) => void>();
    renderWithTool('select', onSelectTool);
    const user = userEvent.setup();
    await user.click(handle('작도'));
    await user.click(screen.getByRole('button', { name: /^선$/ }));
    expect(onSelectTool).toHaveBeenCalledWith('line');
    // 대조군: 손잡이 자체는 도구를 고르지 않는다(열고 닫기만 한다) — 위 1회가 전부다.
    expect(onSelectTool).toHaveBeenCalledTimes(1);
  });
});

// ── 서랍 = 플라이아웃 (2026-08-14 기현님 재설계) ──────────────────────────────────────
//
// 옛 서랍은 흐름 안에서 펼쳐졌고, 그래서 이 파일에는 "열어도 앞쪽 좌표가 안 움직인다" 를
// 재는 좌표 모형 describe 가 셋 있었다(§3 불변식 1). 플라이아웃은 `position:absolute` 라
// **흐름을 한 픽셀도 안 먹으므로** 그 세 describe 가 재던 것이 원인째 사라졌다 — 지웠다.
// 대신 그 자리를 지키는 단언은 하나다: **패널이 흐름 밖에 있다.**
describe('ToolRail — 서랍 플라이아웃', () => {
  const handle = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

  it('열린 패널은 흐름 밖(fixed)이고 트레이 **밖**에 붙는다 — 자르는 조상을 피하는 유일한 길', async () => {
    // 2026-08-14 기현님 신고(*"서랍이 안 펼쳐진다"*)의 수리. 트레이의 `overflow` 가 패널을
    // 통째로 잘라내고 있었다 — 흐름에서 빼는 것만으로는 부족하고 **자르는 조상 밖**이라야 한다.
    const user = userEvent.setup();
    render(<ControlledRail />);
    await user.click(handle('작도'));
    const panel = screen.getByRole('group', { name: '작도 도구' });
    expect(panel.style.position, '흐름 안이면 앞쪽 표적이 밀린다(§3 불변식 1)').toBe('fixed');
    expect(document.querySelector('nav[data-tray]')!.contains(panel), '트레이 안이면 잘린다').toBe(false);
  });

  it('세로 기둥은 **왼쪽**(코트 쪽)으로, 가로 띠는 **위**로 편다 — 판 안쪽이라 안 잘린다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ControlledRail />);
    await user.click(handle('작도'));
    const side = screen.getByRole('group', { name: '작도 도구' });
    // 세로 기둥은 왼쪽으로 — `right` 를 잡고 `bottom` 은 안 잡는다(값은 잰 좌표라 안 못박는다).
    expect(side.style.right).not.toBe('');
    expect(side.style.top).not.toBe('');
    expect(side.style.bottom).toBe('');
    unmount();

    render(<ControlledRail orientation="horizontal" />);
    await user.click(handle('작도'));
    const band = screen.getByRole('group', { name: '작도 도구' });
    // 가로 띠는 위로 — `bottom` 을 잡고 `right` 는 안 잡는다.
    expect(band.style.bottom).not.toBe('');
    expect(band.style.left).not.toBe('');
    expect(band.style.right).toBe('');
  });

  it('마우스가 올라가면 열린다 — 누르지 않아도 된다', async () => {
    render(<ControlledRail />);
    expect(screen.queryByRole('group', { name: '작도 도구' })).toBeNull();
    expect(expanded('작도')).toBe('false');
    fireEvent.pointerEnter(handle('작도'), { pointerType: 'mouse' });
    expect(screen.getByRole('group', { name: '작도 도구' })).toBeInTheDocument();
    // 열린 동안 손잡이도 자기 상태를 말한다 — aria-expanded.
    expect(expanded('작도')).toBe('true');
  });

  it('터치의 pointerenter 로는 안 열린다 — 열자마자 click 이 도로 닫는 것을 막는다', () => {
    render(<ControlledRail />);
    fireEvent.pointerEnter(handle('작도'), { pointerType: 'touch' });
    expect(screen.queryByRole('group', { name: '작도 도구' })).toBeNull();
  });

  it('하위 도구를 고르면 **딜레이 뒤에** 닫힌다 — 즉시 닫으면 고른 것이 눈에 안 남는다', async () => {
    vi.useFakeTimers();
    try {
      render(<ControlledRail />);
      fireEvent.pointerEnter(handle('작도'), { pointerType: 'mouse' });
      const panel = screen.getByRole('group', { name: '작도 도구' });
      fireEvent.click(within(panel).getByRole('button', { name: /^선$/ }));

      // 아직 열려 있다 — 이 한 줄이 "딜레이" 를 못박는다(0 이면 여기서 이미 닫힌다).
      expect(screen.getByRole('group', { name: '작도 도구' })).toBeInTheDocument();
      act(() => void vi.advanceTimersByTime(FLYOUT_PICK_CLOSE_MS + 1));
      expect(screen.queryByRole('group', { name: '작도 도구' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('포인터가 나가면 닫힌다 — 손잡이와 패널 사이를 지나는 틈만큼 늦게', async () => {
    vi.useFakeTimers();
    try {
      render(<ControlledRail />);
      const btn = handle('작도');
      fireEvent.pointerEnter(btn, { pointerType: 'mouse' });
      expect(screen.getByRole('group', { name: '작도 도구' })).toBeInTheDocument();
      fireEvent.pointerLeave(btn, { pointerType: 'mouse' });
      act(() => void vi.advanceTimersByTime(FLYOUT_LEAVE_CLOSE_MS - 10));
      expect(screen.getByRole('group', { name: '작도 도구' }), '틈을 지나다 닫혔다').toBeInTheDocument();
      act(() => void vi.advanceTimersByTime(20));
      expect(screen.queryByRole('group', { name: '작도 도구' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  // ⚠️ '한 번에 하나만 열린다' 는 서랍이 하나가 되며 잴 대상이 없어졌다(2026-08-27).
  // `useFlyout` 의 그 규율 자체는 [보드 설정]과 무관하게 살아 있고, 서랍이 다시 둘이 되면
  // 이 자리에 되살릴 것 — 그때는 열린 것이 바뀌는지를 재면 된다.
  it('Esc 로 닫힌다', () => {
    render(<ControlledRail />);
    fireEvent.pointerEnter(handle('작도'), { pointerType: 'mouse' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: '작도 도구' })).toBeNull();
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
        coneCounts={[5, 1]}
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
    // 콘은 색마다 상자가 따로고 남은 수도 따로다 — 배지 하나로 두 색의 재고를 나타낼 수 없다.
    expect(screen.getByRole('button', { name: '주황 콘' })).toHaveAccessibleDescription(
      `${CONE.maxCountPerColor - 5}개 남음`,
    );
    expect(screen.getByRole('button', { name: '파랑 콘' })).toHaveAccessibleDescription(
      `${CONE.maxCountPerColor - 1}개 남음`,
    );
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
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: /^선택/ }) });
    expect(onItem).not.toHaveBeenCalled();
  });
});

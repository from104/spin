// §6.10 도구 레일 — 8종 렌더, 공 상한 시각/aria 표시, 콘 재클릭 토글, 선수 플라이아웃.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ToolRail, type UnplacedChair } from './ToolRail.tsx';
import type { ChairId } from '../../core/ids.ts';
import type { ToolId } from '../../physics/index.ts';

const UNPLACED: UnplacedChair[] = [{ id: 'ch_a' as ChairId, number: '2', color: '#d93a3a', ink: '#fff' }];

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

describe('ToolRail', () => {
  it('8개 도구 버튼을 전부 렌더한다', () => {
    render(<ControlledRail />);
    for (const label of ['선택', '이동', '패스', '공', '콘', '선수', '메모', '지우개']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    }
  });

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

  it('콘 도구를 활성 상태에서 다시 클릭하면 색이 토글된다(§6.10 "재클릭 토글")', async () => {
    const user = userEvent.setup();
    render(<ControlledRail />);
    const coneBtn = screen.getByRole('button', { name: /^콘/ });
    await user.click(coneBtn); // 1회: 도구 선택
    expect(screen.getByRole('radiogroup', { name: '콘 색상' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '주황 콘' })).toHaveAttribute('aria-checked', 'true');
    await user.click(coneBtn); // 2회: 활성 상태 재클릭 → 토글
    expect(screen.getByRole('radio', { name: '분홍 콘' })).toHaveAttribute('aria-checked', 'true');
  });

  it('선수 도구 활성 시 미배치 선수 플라이아웃을 보여주고 고르면 armPlayer 를 부른다', async () => {
    const onArm = vi.fn();
    render(
      <ToolRail
        tool="player"
        onSelectTool={() => {}}
        coneSlot={0}
        onConeSlotChange={() => {}}
        ballCount={0}
        ballMax={10}
        unplacedChairs={UNPLACED}
        pendingPlayerId={null}
        onArmPlayer={onArm}
        courtLabel="풀 코트"
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '코트에 배치' }));
    expect(onArm).toHaveBeenCalledWith('ch_a');
  });
});

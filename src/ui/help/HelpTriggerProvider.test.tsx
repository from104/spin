// 레일 [도움말] 일원화의 배선 계약 — docs/PLAN-HELP-TUTORIAL.md §A, Phase 5.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { HelpTriggerProvider, useHelpShow, usePublishHelpShow } from './HelpTriggerProvider.tsx';

function Screen({ label, onShow }: { label: string; onShow(): void }) {
  usePublishHelpShow(onShow);
  return <span>{label}</span>;
}

function RailButton() {
  const show = useHelpShow();
  return (
    <button type="button" onClick={show}>
      도움말
    </button>
  );
}

describe('HelpTriggerProvider', () => {
  it('등록된 화면의 show 함수를 부른다', async () => {
    const calls: string[] = [];
    render(
      <HelpTriggerProvider>
        <RailButton />
        <Screen label="A" onShow={() => calls.push('A')} />
      </HelpTriggerProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: '도움말' }));
    expect(calls).toEqual(['A']);
  });

  it('화면이 바뀌면(언마운트+마운트) 등록도 함께 갈린다 — 나중에 마운트된 쪽이 이긴다', async () => {
    const calls: string[] = [];
    function Switcher() {
      const [screenKey, setScreenKey] = useState<'A' | 'B'>('A');
      return (
        <HelpTriggerProvider>
          <RailButton />
          <button type="button" onClick={() => setScreenKey('B')}>
            화면 전환
          </button>
          {screenKey === 'A' ? <Screen label="A" onShow={() => calls.push('A')} /> : <Screen label="B" onShow={() => calls.push('B')} />}
        </HelpTriggerProvider>
      );
    }
    render(<Switcher />);
    await userEvent.click(screen.getByRole('button', { name: '도움말' }));
    await userEvent.click(screen.getByRole('button', { name: '화면 전환' }));
    await userEvent.click(screen.getByRole('button', { name: '도움말' }));
    expect(calls).toEqual(['A', 'B']);
  });

  it('언마운트된 화면은 더 등록돼 있지 않다 — 아무 화면도 없으면 조용히 아무 일도 안 한다', async () => {
    const calls: string[] = [];
    function Toggle() {
      const [mounted, setMounted] = useState(true);
      return (
        <HelpTriggerProvider>
          <RailButton />
          <button type="button" onClick={() => setMounted(false)}>
            화면 닫기
          </button>
          {mounted && <Screen label="A" onShow={() => calls.push('A')} />}
        </HelpTriggerProvider>
      );
    }
    render(<Toggle />);
    await userEvent.click(screen.getByRole('button', { name: '화면 닫기' }));
    await userEvent.click(screen.getByRole('button', { name: '도움말' })); // 등록된 화면이 없다
    expect(calls).toEqual([]);
  });

  it('Provider 밖에서 useHelpShow()/usePublishHelpShow() 를 불러도 안 죽는다', async () => {
    render(<RailButton />);
    await userEvent.click(screen.getByRole('button', { name: '도움말' })); // no-op, 안 던진다
    render(<Screen label="orphan" onShow={() => {}} />);
    expect(screen.getByText('orphan')).toBeInTheDocument();
  });
});

// 문서형 도움말(HelpCenter) — docs/PLAN-HELP-TUTORIAL.md §B 계약 확인: 열 때마다 현재 화면
// 섹션으로 돌아오는가, 목차로 다른 섹션을 고를 수 있는가, [투어 다시 보기]가 모달을 닫고
// 콜백을 그 화면 키로 부르는가.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { HelpCenter } from './HelpCenter.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import type { TutorialScreenKey } from '../../storage/prefs.ts';
import type { HelpSectionKey } from './helpSections.ts';

function Harness({ initialSection, onRestartTutorial }: { initialSection: HelpSectionKey; onRestartTutorial(screen: TutorialScreenKey): void }) {
  const [open, setOpen] = useState(true);
  return (
    <SettingsProvider>
      <button type="button" onClick={() => setOpen(true)}>
        열기
      </button>
      <HelpCenter open={open} onClose={() => setOpen(false)} initialSection={initialSection} onRestartTutorial={onRestartTutorial} />
    </SettingsProvider>
  );
}

describe('HelpCenter', () => {
  it('목차에서 다른 섹션을 고르면 본문이 바뀐다', async () => {
    const user = userEvent.setup();
    render(<Harness initialSection="editor" onRestartTutorial={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: '도움말' });
    await user.click(within(dialog).getByRole('button', { name: '자유 전술판' }));
    expect(within(dialog).getByText('작도')).toBeInTheDocument();
  });

  it('[투어 다시 보기]를 누르면 모달이 닫히고 그 화면 키로 콜백이 불린다', async () => {
    const onRestartTutorial = vi.fn();
    const user = userEvent.setup();
    render(<Harness initialSection="board" onRestartTutorial={onRestartTutorial} />);
    const dialog = screen.getByRole('dialog', { name: '도움말' });
    await user.click(within(dialog).getByRole('button', { name: '자유 전술판 투어 다시 보기' }));
    expect(onRestartTutorial).toHaveBeenCalledWith('board');
    expect(screen.queryByRole('dialog', { name: '도움말' })).toBeNull();

    // 세션 섹션도 같은 계약 — 세션 편집 투어 버튼은 sessionEditor 키로 콜백을 부른다.
    render(<Harness initialSection="sessions" onRestartTutorial={onRestartTutorial} />);
    const dialog2 = screen.getByRole('dialog', { name: '도움말' });
    await user.click(within(dialog2).getByRole('button', { name: '세션 편집 투어 다시 보기' }));
    expect(onRestartTutorial).toHaveBeenCalledWith('sessionEditor');
  });

  it('닫았다 다른 화면에서 다시 열면 그 화면의 섹션으로 되돌아온다', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness initialSection="editor" onRestartTutorial={() => {}} />);
    let dialog = screen.getByRole('dialog', { name: '도움말' });
    // 연 화면(editor)에 맞는 섹션이 열린 채로 뜬다.
    expect(within(dialog).getByText('스텝')).toBeInTheDocument();
    expect(within(dialog).queryByText('트레이')).toBeNull(); // 자유 전술판 섹션의 첫 항목 — 안 보여야 한다
    await user.click(within(dialog).getByRole('button', { name: '단축키' }));
    expect(within(screen.getByRole('dialog', { name: '도움말' })).getByRole('heading', { name: '드릴 편집' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '도움말' })).toBeNull();

    // 다른 화면(자유 전술판)에서 다시 여는 상황 — initialSection 을 바꾸고 [열기] 를 누른다.
    rerender(<Harness initialSection="board" onRestartTutorial={() => {}} />);
    await user.click(screen.getByRole('button', { name: '열기' }));
    dialog = screen.getByRole('dialog', { name: '도움말' });
    expect(within(dialog).getByText('트레이')).toBeInTheDocument();
    // 목차의 [드릴 편집] 항목은 항상 있다 — 없어야 하는 것은 단축키 섹션의 "드릴 편집" 표제다.
    expect(within(dialog).queryByRole('heading', { name: '드릴 편집' })).toBeNull();
  });
});

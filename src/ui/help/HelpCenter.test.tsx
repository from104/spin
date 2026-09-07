// 문서형 도움말(HelpCenter) 계약 — docs/PLAN-HELP-TUTORIAL.md §B + PLAN-HELP-OVERHAUL 결정 4·5.
//
// ⚠️ **콘텐츠를 가짜로 갈아 끼우고 잰다**(`vi.mock('./helpContent.ts')`). 진짜 본문
// (`helpContent.ko.ts`)의 문장으로 재면 이 파일은 렌더러 테스트가 아니라 **본문 변경 감지기**가
// 된다 — 문장을 다듬을 때마다 빨간불이 뜨고, 정작 렌더러가 망가진 것은 못 잡는다(AGENTS
// 「테스트 작성 규칙」). 진짜 본문의 무결성(3로케일 id 집합·빈 블록)은 `helpContent.test.ts` 가
// 따로 잰다. 여기서 재는 것은 화면 쪽 계약뿐이다: 섹션 전환 · 투어 재시작 · initialSection 복원
// · initialTopic 점프 · 찾기 · 인라인 서식 · [키 진단] 마운트.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { HelpCenter } from './HelpCenter.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import type { TutorialScreenKey } from '../../storage/prefs.ts';
import type { HelpSectionKey } from './helpSections.ts';

vi.mock('./helpContent.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./helpContent.ts')>();
  const empty = (key: HelpSectionKey) => ({ key, topics: [] });
  const content = {
    ...(Object.fromEntries((['start', 'library', 'present', 'export', 'rules', 'settings'] as const).map((k) => [k, empty(k)])) as Record<HelpSectionKey, { key: HelpSectionKey; topics: [] }>),
    board: { key: 'board' as const, topics: [{ id: 'board.court', title: '코트 형태', blocks: [{ kind: 'p' as const, text: '전술판의 코트를 고르는 이야기.' }] }] },
    editor: { key: 'editor' as const, topics: [{ id: 'editor.tools', title: '도구 고르기', blocks: [{ kind: 'p' as const, text: '도구는 `V` 로 고르고 **연속 배치**도 된다.' }] }] },
    sessions: { key: 'sessions' as const, topics: [{ id: 'sessions.what', title: '세션이란', blocks: [{ kind: 'p' as const, text: '구획으로 나눠 편성한다.' }] }] },
    shortcuts: { key: 'shortcuts' as const, topics: [{ id: 'shortcuts.diagnose', title: '안 먹을 때', blocks: [{ kind: 'p' as const, text: '눌러 보고 확인한다.' }] }] },
  };
  return { ...actual, helpContentFor: () => content };
});

function Harness({ initialSection, initialTopic, onRestartTutorial }: { initialSection: HelpSectionKey; initialTopic?: string; onRestartTutorial(screen: TutorialScreenKey): void }) {
  const [open, setOpen] = useState(true);
  return (
    <SettingsProvider>
      <button type="button" onClick={() => setOpen(true)}>
        열기
      </button>
      <HelpCenter open={open} onClose={() => setOpen(false)} initialSection={initialSection} initialTopic={initialTopic} onRestartTutorial={onRestartTutorial} />
    </SettingsProvider>
  );
}

function dialog() {
  return screen.getByRole('dialog', { name: '도움말' });
}

describe('HelpCenter', () => {
  it('목차에서 다른 섹션을 고르면 본문이 그 섹션의 주제로 바뀐다', async () => {
    const user = userEvent.setup();
    render(<Harness initialSection="editor" onRestartTutorial={() => {}} />);
    expect(within(dialog()).getByRole('heading', { name: '도구 고르기' })).toBeInTheDocument();
    await user.click(within(dialog()).getByRole('button', { name: '자유 전술판' }));
    expect(within(dialog()).getByRole('heading', { name: '코트 형태' })).toBeInTheDocument();
    expect(within(dialog()).queryByRole('heading', { name: '도구 고르기' })).toBeNull();
  });

  it('[투어 다시 보기]를 누르면 모달이 닫히고 그 화면 키로 콜백이 불린다', async () => {
    const onRestartTutorial = vi.fn();
    const user = userEvent.setup();
    render(<Harness initialSection="board" onRestartTutorial={onRestartTutorial} />);
    await user.click(within(dialog()).getByRole('button', { name: '자유 전술판 투어 다시 보기' }));
    expect(onRestartTutorial).toHaveBeenCalledWith('board');
    expect(screen.queryByRole('dialog', { name: '도움말' })).toBeNull();

    // 세션 섹션도 같은 계약 — 세션 편집 투어 버튼은 sessionEditor 키로 콜백을 부른다.
    render(<Harness initialSection="sessions" onRestartTutorial={onRestartTutorial} />);
    await user.click(within(dialog()).getByRole('button', { name: '세션 편집 투어 다시 보기' }));
    expect(onRestartTutorial).toHaveBeenCalledWith('sessionEditor');
  });

  it('닫았다 다른 화면에서 다시 열면 그 화면의 섹션으로 되돌아온다', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness initialSection="editor" onRestartTutorial={() => {}} />);
    await user.click(within(dialog()).getByRole('button', { name: '단축키' }));
    expect(within(dialog()).getByRole('heading', { name: '안 먹을 때' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '도움말' })).toBeNull();

    // 다른 화면(자유 전술판)에서 다시 여는 상황 — initialSection 을 바꾸고 [열기] 를 누른다.
    rerender(<Harness initialSection="board" onRestartTutorial={() => {}} />);
    await user.click(screen.getByRole('button', { name: '열기' }));
    expect(within(dialog()).getByRole('heading', { name: '코트 형태' })).toBeInTheDocument();
    expect(within(dialog()).queryByRole('heading', { name: '안 먹을 때' })).toBeNull();
  });

  it('initialTopic 을 주면 그 주제가 든 섹션이 열린다(다른 섹션을 initialSection 으로 줬어도)', () => {
    render(<Harness initialSection="editor" initialTopic="sessions.what" onRestartTutorial={() => {}} />);
    expect(within(dialog()).getByRole('heading', { name: '세션이란' })).toBeInTheDocument();
  });

  it('찾기는 지금 섹션 밖의 주제도 찾아내고, 없으면 없다고 말한다', async () => {
    const user = userEvent.setup();
    render(<Harness initialSection="editor" onRestartTutorial={() => {}} />);
    const search = within(dialog()).getByRole('searchbox', { name: '도움말에서 찾기' });

    // 'editor' 섹션이 열린 채로 다른 섹션(sessions)의 본문 낱말을 찾는다.
    await user.type(search, '구획');
    expect(within(dialog()).getByRole('heading', { name: '세션이란' })).toBeInTheDocument();
    expect(within(dialog()).queryByRole('heading', { name: '도구 고르기' })).toBeNull();

    await user.clear(search);
    await user.type(search, '없는낱말');
    expect(within(dialog()).getByText('그 말이 든 주제가 없습니다. 다른 낱말로 찾아보세요.')).toBeInTheDocument();
  });

  it('본문의 `키` 는 <kbd>, **굵게** 는 <strong> 으로 나오고 기호는 화면에 남지 않는다', () => {
    render(<Harness initialSection="editor" onRestartTutorial={() => {}} />);
    const body = dialog();
    expect(within(body).getByText('V').tagName).toBe('KBD');
    expect(within(body).getByText('연속 배치').tagName).toBe('STRONG');
    expect(body.textContent).not.toContain('**');
    expect(body.textContent).not.toContain('`');
  });

  it('단축키 섹션의 진단 주제 자리에 [키 진단] 관측 창이 선다', async () => {
    const user = userEvent.setup();
    render(<Harness initialSection="editor" onRestartTutorial={() => {}} />);
    expect(within(dialog()).queryByRole('region', { name: '키 진단' })).toBeNull();
    await user.click(within(dialog()).getByRole('button', { name: '단축키' }));
    expect(within(dialog()).getByRole('region', { name: '키 진단' })).toBeInTheDocument();
  });
});

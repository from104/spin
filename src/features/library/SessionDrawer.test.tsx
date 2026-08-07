// §6.11 세션 드로어. 기본 정보 수정, 드릴 추가/제거, 키보드 순서 변경(Alt+↑/↓), 시연 시작을 확인한다.
// fake-indexeddb 는 파일 단위로 테스트 사이에 리셋되지 않으므로(다른 storage 테스트들과 동일
// 전제), 매 테스트마다 고유한 드릴 제목을 써서 "드릴 목록 추가" select 옵션이 이전 테스트의
// 동명 드릴과 겹쳐 getByText 가 다중 매치되는 것을 막는다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SessionDrawer } from './SessionDrawer.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import { addDrillToSession, createSession, getSession } from '../../storage/sessionRepo.ts';
import type { SessionId } from '../../core/ids.ts';

const wrapper = ({ children }: { children: ReactNode }) => <LibraryProvider>{children}</LibraryProvider>;

let seq = 0;
async function setupSessionWithTwoDrills(): Promise<{ sessionId: SessionId; titleA: string; titleB: string }> {
  const tag = `#${++seq}`;
  const titleA = `드릴 A ${tag}`;
  const titleB = `드릴 B ${tag}`;
  const d1 = await idbDrillRepo.createDrill({ courtMode: 'full', title: titleA, durationMin: 10 });
  const d2 = await idbDrillRepo.createDrill({ courtMode: 'full', title: titleB, durationMin: 20 });
  const s = await createSession({ title: `테스트 세션 ${tag}` });
  await addDrillToSession(s.id, d1.id);
  await addDrillToSession(s.id, d2.id);
  return { sessionId: s.id, titleA, titleB };
}

describe('SessionDrawer', () => {
  it('열리면 제목에 포커스되고 드릴 목록·총 시간을 보여준다', async () => {
    const { sessionId, titleA, titleB } = await setupSessionWithTwoDrills();
    render(<SessionDrawer sessionId={sessionId} open onClose={() => {}} onPresent={() => {}} />, { wrapper });

    await waitFor(() => expect(screen.getByRole('heading', { name: `테스트 세션 #${seq}` })).toHaveFocus());
    expect(screen.getByText(titleA)).toBeInTheDocument();
    expect(screen.getByText(titleB)).toBeInTheDocument();
    expect(screen.getByText('총 30분')).toBeInTheDocument();
  });

  it('드릴을 추가하면 총 시간이 늘어난다', async () => {
    const title = `추가될 드릴 #${++seq}`;
    const d1 = await idbDrillRepo.createDrill({ courtMode: 'full', title, durationMin: 15 });
    const s = await createSession({ title: `빈 세션 #${seq}` });
    render(<SessionDrawer sessionId={s.id} open onClose={() => {}} onPresent={() => {}} />, { wrapper });
    await waitFor(() => expect(screen.getByText('총 0분')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('추가할 드릴'), d1.id);
    await user.click(screen.getByRole('button', { name: '추가' }));

    await waitFor(() => expect(screen.getByText(title, { selector: 'span' })).toBeInTheDocument());
    expect(screen.getByText('총 15분')).toBeInTheDocument();
  });

  it('[×] 로 드릴을 제거하면 목록과 총 시간에서 사라진다', async () => {
    const { sessionId, titleA } = await setupSessionWithTwoDrills();
    render(<SessionDrawer sessionId={sessionId} open onClose={() => {}} onPresent={() => {}} />, { wrapper });
    await waitFor(() => expect(screen.getByText(titleA)).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole('button', { name: `${titleA} 세션에서 제거` }));

    // 제거된 드릴은 "추가할 드릴" select 의 옵션으로는 다시 나타난다(재추가 가능) — 목록 행
    // 텍스트(<span>)에서만 사라졌는지를 본다.
    await waitFor(() => expect(screen.queryByText(titleA, { selector: 'span' })).not.toBeInTheDocument());
    expect(screen.getByRole('option', { name: titleA })).toBeInTheDocument();
    expect(screen.getByText('총 20분')).toBeInTheDocument();
  });

  it('핸들에 Alt+ArrowDown 을 누르면 순서가 바뀐다', async () => {
    const { sessionId, titleA, titleB } = await setupSessionWithTwoDrills();
    render(<SessionDrawer sessionId={sessionId} open onClose={() => {}} onPresent={() => {}} />, { wrapper });
    await waitFor(() => expect(screen.getByText(titleA)).toBeInTheDocument());

    const handle = screen.getByRole('button', { name: new RegExp(`${titleA} 순서 변경`) });
    handle.focus();
    await userEvent.setup().keyboard('{Alt>}{ArrowDown}{/Alt}');

    await waitFor(async () => {
      const saved = await getSession(sessionId);
      expect(saved?.session.items.map((it) => it.titleCache)).toEqual([titleB, titleA]);
    });
  });

  it('소요 시간 입력을 바꾸면 durationOverrideMin 이 저장된다', async () => {
    const { sessionId, titleA } = await setupSessionWithTwoDrills();
    render(<SessionDrawer sessionId={sessionId} open onClose={() => {}} onPresent={() => {}} />, { wrapper });
    await waitFor(() => expect(screen.getByText(titleA)).toBeInTheDocument());

    const input = screen.getByLabelText(`${titleA} 소요 시간(분)`);
    await userEvent.setup().clear(input);
    await userEvent.setup().type(input, '25');
    input.blur();

    await waitFor(() => expect(screen.getByText('총 45분')).toBeInTheDocument());
  });

  it('세션 시연 시작 버튼이 onPresent 를 호출한다', async () => {
    const { sessionId, titleA } = await setupSessionWithTwoDrills();
    const onPresent = vi.fn();
    render(<SessionDrawer sessionId={sessionId} open onClose={() => {}} onPresent={onPresent} />, { wrapper });
    await waitFor(() => expect(screen.getByText(titleA)).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole('button', { name: '세션 시연 시작' }));
    expect(onPresent).toHaveBeenCalledWith(sessionId);
  });
});

// C8 — 설정 화면의 선수 명단 섹션. 추가·수정·클래스·삭제가 실제 저장(meta 스토어)까지
// 왕복하는지, 미분류가 키 없음으로 저장되는지 확인한다.
// §설정 화면 감사(2026-08-21) A-2·C1 — 삭제 undo 토스트·빈 입력 되돌림이 늘어 ToastProvider 도
// 함께 마운트한다(LibraryScreen.test.tsx 의 ToastHostBridge 패턴과 동일).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { RosterSection } from './RosterSection.tsx';
import { getDB } from '../../storage/db.ts';
import { loadRoster, saveRoster } from '../../storage/rosterRepo.ts';
import { addPlayer, emptyRoster } from '../../model/roster.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider, useToast } from '../../store/toast/ToastProvider.tsx';
import { ToastHost } from '../../ui/ToastHost.tsx';

beforeEach(async () => {
  const db = await getDB();
  await db.clear('meta');
});

function ToastHostBridge() {
  const { toasts, dismiss } = useToast();
  return <ToastHost toasts={toasts} onDismiss={dismiss} />;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <ToastProvider>
      {children}
      <ToastHostBridge />
    </ToastProvider>
  </SettingsProvider>
);

describe('RosterSection', () => {
  it('선수를 추가하면 저장소에 실리고, 미분류는 키 없음이다', async () => {
    render(<RosterSection />, { wrapper });
    await waitFor(() => expect(screen.getByText(/아직 등록한 선수가 없습니다/)).toBeInTheDocument());
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('새 선수 이름'), '김선수');
    await user.selectOptions(screen.getByLabelText('새 선수 클래스'), 'PF1');
    await user.click(screen.getByRole('button', { name: '추가' }));
    await waitFor(async () => {
      const r = await loadRoster();
      expect(r.players.map((p) => p.name)).toEqual(['김선수']);
      expect(r.players[0]!.klass).toBe('PF1');
    });

    // 미분류로 추가 — klass 키가 아예 없다.
    await user.type(screen.getByLabelText('새 선수 이름'), '이선수');
    await user.click(screen.getByRole('button', { name: '추가' }));
    await waitFor(async () => {
      const r = await loadRoster();
      expect(r.players).toHaveLength(2);
      expect('klass' in r.players[1]!).toBe(false);
    });
  });

  it('이름 수정·클래스 변경·삭제가 저장까지 간다', async () => {
    await saveRoster(addPlayer(emptyRoster(), '박선수', 'PF2'));
    render(<RosterSection />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText('박선수 이름')).toBeInTheDocument());
    const user = userEvent.setup();

    const name = screen.getByLabelText('박선수 이름');
    await user.clear(name);
    await user.type(name, '박주장');
    fireEvent.blur(name);
    await waitFor(async () => expect((await loadRoster()).players[0]!.name).toBe('박주장'));

    // 이름이 바뀌면 접근 가능한 이름도 따라간다 — 새 이름으로 잡는다.
    await user.selectOptions(await screen.findByLabelText('박주장 클래스'), '');
    await waitFor(async () => expect('klass' in (await loadRoster()).players[0]!).toBe(false));

    await user.click(screen.getByRole('button', { name: /명단에서 삭제/ }));
    await waitFor(async () => expect((await loadRoster()).players).toHaveLength(0));
  });

  it('삭제하면 되돌리기 토스트가 뜨고, 누르면 선수가 되살아난다(A-2)', async () => {
    await saveRoster(addPlayer(emptyRoster(), '최선수', 'PF1'));
    render(<RosterSection />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText('최선수 이름')).toBeInTheDocument());
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /명단에서 삭제/ }));
    await waitFor(async () => expect((await loadRoster()).players).toHaveLength(0));
    expect(screen.queryByLabelText('최선수 이름')).toBeNull();

    await user.click(await screen.findByRole('button', { name: '되돌리기' }));
    await waitFor(async () => expect((await loadRoster()).players.map((p) => p.name)).toEqual(['최선수']));
    await waitFor(() => expect(screen.getByLabelText('최선수 이름')).toBeInTheDocument());
  });

  it('이름 칸을 비우고 blur 하면 저장하지 않고 화면을 원래 이름으로 되돌린다(C1)', async () => {
    await saveRoster(addPlayer(emptyRoster(), '오선수'));
    render(<RosterSection />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText('오선수 이름')).toBeInTheDocument());
    const user = userEvent.setup();

    const name = screen.getByLabelText('오선수 이름') as HTMLInputElement;
    await user.clear(name);
    fireEvent.blur(name);

    await waitFor(() => expect(name.value).toBe('오선수'));
    expect((await loadRoster()).players[0]!.name).toBe('오선수');
  });
});

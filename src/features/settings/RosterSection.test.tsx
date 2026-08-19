// C8 — 설정 화면의 선수 명단 섹션. 추가·수정·클래스·삭제가 실제 저장(meta 스토어)까지
// 왕복하는지, 미분류가 키 없음으로 저장되는지 확인한다.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RosterSection } from './RosterSection.tsx';
import { getDB } from '../../storage/db.ts';
import { loadRoster, saveRoster } from '../../storage/rosterRepo.ts';
import { addPlayer, emptyRoster } from '../../model/roster.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

beforeEach(async () => {
  const db = await getDB();
  await db.clear('meta');
});

describe('RosterSection', () => {
  it('선수를 추가하면 저장소에 실리고, 미분류는 키 없음이다', async () => {
    render(<RosterSection />, { wrapper: SettingsProvider });
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
    render(<RosterSection />, { wrapper: SettingsProvider });
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
});

// C6 — 세션 전용 편집 화면. 드로어(SessionDrawer.test)의 후계 스위트다: 세션 정보·구획
// 편집·드릴 편성·시간 배분·시연 진입을 실제 IDB(putSession 왕복)로 확인한다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SessionEditorScreen } from './SessionEditorScreen.tsx';
import type { HomeNav } from '../home/nav.ts';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import { createSession, deleteSession, getSession, listSessions, addDrillToSession } from '../../storage/sessionRepo.ts';
import { flattenSessionItems } from '../../model/session.ts';
import type { SessionId } from '../../core/ids.ts';

function makeNav(): HomeNav {
  return {
    newDrill: vi.fn(),
    openDrill: vi.fn(),
    goLibrary: vi.fn(),
    openSession: vi.fn(),
    presentDrill: vi.fn(),
    presentSession: vi.fn(),
  };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <LibraryProvider>
    <ToastProvider>{children}</ToastProvider>
  </LibraryProvider>
);

beforeEach(async () => {
  for (const d of await idbDrillRepo.listDrillSummaries()) await idbDrillRepo.deleteDrill(d.id);
  for (const s of await listSessions()) await deleteSession(s.session.id);
});

async function renderEditor(sessionId: SessionId) {
  const nav = makeNav();
  render(<SessionEditorScreen nav={nav} sessionId={sessionId} />, { wrapper });
  await waitFor(() => expect(screen.getByLabelText('세션명')).toBeInTheDocument());
  return nav;
}

describe('SessionEditorScreen', () => {
  it('세션명을 고치면 putSession 으로 저장된다 (드로어의 낙관 패턴 이식)', async () => {
    const s = await createSession({ title: '이름 전' });
    await renderEditor(s.id);

    const input = screen.getByLabelText('세션명');
    await userEvent.setup().clear(input);
    await userEvent.setup().type(input, '이름 후');
    (input as HTMLInputElement).blur();
    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect(saved?.session.title).toBe('이름 후');
    });
  });

  it('구획 추가 → 종류 셀렉트 → 목표 배분이 스키마 v2 로 저장된다', async () => {
    const s = await createSession({ title: '구획 세션' });
    await renderEditor(s.id);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '구획 추가' }));
    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect(saved?.session.phases).toHaveLength(1);
    });

    // 종류: custom → warm-up
    await user.selectOptions(screen.getByLabelText('종류'), 'warm-up');
    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect(saved?.session.phases[0]!.kind).toBe('warm-up');
    });

    // 목표 배분
    const planned = screen.getByLabelText('목표 배분(분)');
    await user.clear(planned);
    await user.type(planned, '15');
    (planned as HTMLInputElement).blur();
    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect(saved?.session.phases[0]!.plannedMin).toBe(15);
    });
  });

  it('구획에 드릴을 추가하면 소계·합계가 서고, 이미 편성된 드릴은 선택지에서 빠진다', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '편성 드릴', durationMin: 12 });
    const s = await createSession({ title: '편성 세션' });
    await renderEditor(s.id);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '구획 추가' }));
    await waitFor(() => expect(screen.getByText('드릴 선택…')).toBeInTheDocument());
    const select = screen.getByLabelText(/구획에 추가할 드릴/);
    await user.selectOptions(select, d.id);
    await user.click(screen.getByRole('button', { name: '추가' }));

    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect(flattenSessionItems(saved!.session).map((it) => it.drillId)).toEqual([d.id]);
    });
    // 소계·합계 12분.
    await waitFor(() => expect(screen.getByText(/소계 12분/)).toBeInTheDocument());
    expect(screen.getByText(/^12분/)).toBeInTheDocument();
    // 이미 편성된 드릴은 다시 고를 수 없다.
    expect(within(screen.getByLabelText(/구획에 추가할 드릴/)).queryByText('편성 드릴')).toBeNull();
  });

  it('목표 총 시간을 적으면 게이지가 서고 초과가 색으로 표시된다 (강제 없음 — 질문 ⑮)', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '긴 드릴', durationMin: 30 });
    let s = await createSession({ title: '게이지 세션' });
    s = await addDrillToSession(s.id, d.id);
    await renderEditor(s.id);
    const user = userEvent.setup();

    const goal = screen.getByLabelText('목표 총 시간(분)');
    await user.clear(goal);
    await user.type(goal, '20');
    (goal as HTMLInputElement).blur();

    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect(saved?.session.goalTotalMin).toBe(20);
    });
    // 30분 편성 / 목표 20분 → 초과 문구. 저장은 막지 않았다(위 단언이 그 증거).
    await waitFor(() => expect(screen.getByText(/30분 \/ 목표 20분 — 초과/)).toBeInTheDocument());
  });

  it('구획 삭제는 항목을 버리지 않는다 — 이웃 구획에 병합된다 (removePhase 규칙)', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '병합 드릴', durationMin: 10 });
    let s = await createSession({ title: '병합 세션' });
    s = await addDrillToSession(s.id, d.id); // 기본 구획('훈련')에 하나
    await renderEditor(s.id);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '구획 추가' })); // 두 번째 구획(자유)
    await waitFor(async () => expect((await getSession(s.id))?.session.phases).toHaveLength(2));

    // 항목을 가진 첫 구획을 지운다 → 항목이 남은 구획으로 병합.
    await user.click(screen.getByRole('button', { name: '구획 훈련 삭제' }));
    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect(saved?.session.phases).toHaveLength(1);
      expect(flattenSessionItems(saved!.session).map((it) => it.drillId)).toEqual([d.id]);
    });
  });

  it('항목 제거·시간 override 가 구획 안에서 동작한다', async () => {
    const d1 = await idbDrillRepo.createDrill({ courtMode: 'full', title: '드릴 하나', durationMin: 10 });
    const d2 = await idbDrillRepo.createDrill({ courtMode: 'full', title: '드릴 둘', durationMin: 10 });
    let s = await createSession({ title: '항목 세션' });
    s = await addDrillToSession(s.id, d1.id);
    s = await addDrillToSession(s.id, d2.id);
    await renderEditor(s.id);
    const user = userEvent.setup();

    const dur = screen.getByLabelText('드릴 하나 소요 시간(분)');
    await user.clear(dur);
    await user.type(dur, '25');
    (dur as HTMLInputElement).blur();
    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect(flattenSessionItems(saved!.session)[0]!.durationOverrideMin).toBe(25);
    });

    await user.click(screen.getByRole('button', { name: '드릴 둘 제거' }));
    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect(flattenSessionItems(saved!.session).map((it) => it.drillId)).toEqual([d1.id]);
    });
  });

  it('[세션 시연 시작]이 nav.presentSession 으로 나가고, 없는 세션 주소는 빈 상태를 그린다', async () => {
    const s = await createSession({ title: '시연 세션' });
    const nav = await renderEditor(s.id);
    await userEvent.setup().click(screen.getByRole('button', { name: '세션 시연 시작' }));
    expect(nav.presentSession).toHaveBeenCalledWith(s.id);

    // 없는 세션(삭제·남의 주소) — 던지지 않고 목록으로 돌아갈 길을 준다.
    render(<SessionEditorScreen nav={makeNav()} sessionId={'se_none' as SessionId} />, { wrapper });
    await waitFor(() => expect(screen.getByText(/세션을 찾을 수 없습니다/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '세션 목록으로' })).toBeInTheDocument();
  });
});

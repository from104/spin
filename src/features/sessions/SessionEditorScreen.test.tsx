// C6 — 세션 전용 편집 화면. 드로어(SessionDrawer.test)의 후계 스위트다: 세션 정보·구획
// 편집·드릴 편성·시간 배분·시연 진입을 실제 IDB(putSession 왕복)로 확인한다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SessionEditorScreen } from './SessionEditorScreen.tsx';
import type { HomeNav } from '../home/nav.ts';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider, useToast } from '../../store/toast/ToastProvider.tsx';
import { ToastHost } from '../../ui/ToastHost.tsx';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import { createSession, deleteSession, getSession, listSessions, addDrillToSession, putSession } from '../../storage/sessionRepo.ts';
import { flattenSessionItems } from '../../model/session.ts';
import type { SessionId } from '../../core/ids.ts';
import type { Player } from '../../model/roster.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';

function makeNav(): HomeNav {
  return {
    newDrill: vi.fn(),
    openDrill: vi.fn(),
    goLibrary: vi.fn(),
    openSession: vi.fn(),
    presentDrill: vi.fn(),
    presentSession: vi.fn(),
    openRuleTopic: vi.fn(),
  };
}

function ToastHostBridge() {
  const { toasts, dismiss } = useToast();
  return <ToastHost toasts={toasts} onDismiss={dismiss} />;
}

// §C-3(2026-08-20) 되돌리기 토스트를 실제로 검증하려면 ToastHost 도 함께 마운트해야 한다
// (LibraryScreen.test.tsx 와 같은 이유 — ToastProvider 는 상태만, 표시는 ToastHost 몫).
const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <LibraryProvider>
      <ToastProvider>
        {children}
        <ToastHostBridge />
      </ToastProvider>
    </LibraryProvider>
  </SettingsProvider>
);

beforeEach(async () => {
  for (const d of await idbDrillRepo.listDrillSummaries()) await idbDrillRepo.deleteDrill(d.id);
  for (const s of await listSessions()) await deleteSession(s.session.id);
  const { getDB } = await import('../../storage/db.ts');
  await (await getDB()).clear('meta'); // 로스터 위생 — 앞 테스트의 명단이 새어 들지 않게
  // 세션 편집 튜토리얼이 자동 시작하면(§0.5, tutorialsSeen 미지정) 스포트라이트가 떠서 아래
  // 배선 테스트들과 섞일 여지가 있다 — "이미 봤다" 상태로 시작한다.
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), tutorialsSeen: { sessionEditor: true } }));
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

  // PLAN-DELETE-SAFETY.md §C-3(2026-08-20) — 구획 삭제·항목 제거는 확인 없이 되돌리기
  // 토스트만 띄운다(원칙: 되돌아가니까 안 묻는다). 착수 전까지 이 화면엔 이 둘 다 확인도
  // undo 도 없는 "완전 무방비" 상태였다.
  describe('삭제 되돌리기 토스트(§C-3)', () => {
    it('항목을 제거하면 되돌리기 토스트가 뜨고, 누르면 원래대로 돌아온다', async () => {
      const d1 = await idbDrillRepo.createDrill({ courtMode: 'full', title: '남을 드릴', durationMin: 10 });
      const d2 = await idbDrillRepo.createDrill({ courtMode: 'full', title: '제거될 드릴', durationMin: 10 });
      let s = await createSession({ title: '항목 되돌리기 세션' });
      s = await addDrillToSession(s.id, d1.id);
      s = await addDrillToSession(s.id, d2.id);
      await renderEditor(s.id);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: '제거될 드릴 제거' }));
      await waitFor(async () => {
        const saved = await getSession(s.id);
        expect(flattenSessionItems(saved!.session).map((it) => it.drillId)).toEqual([d1.id]);
      });

      const toast = await screen.findByRole('status');
      expect(toast).toHaveTextContent('제거될 드릴');
      await user.click(within(toast).getByRole('button', { name: '되돌리기' }));
      await waitFor(async () => {
        const saved = await getSession(s.id);
        expect(flattenSessionItems(saved!.session).map((it) => it.drillId)).toEqual([d1.id, d2.id]);
      });
    });

    it('구획을 지우면 되돌리기 토스트가 뜨고, 누르면 지워진 구획이 되살아난다', async () => {
      const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '되돌릴 병합 드릴', durationMin: 10 });
      let s = await createSession({ title: '구획 되돌리기 세션' });
      s = await addDrillToSession(s.id, d.id); // 기본 구획('훈련')에 하나
      await renderEditor(s.id);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: '구획 추가' })); // 두 번째 구획(자유)
      await waitFor(async () => expect((await getSession(s.id))?.session.phases).toHaveLength(2));

      await user.click(screen.getByRole('button', { name: '구획 훈련 삭제' }));
      await waitFor(async () => expect((await getSession(s.id))?.session.phases).toHaveLength(1));

      const toast = await screen.findByRole('status');
      await user.click(within(toast).getByRole('button', { name: '되돌리기' }));
      await waitFor(async () => {
        const saved = await getSession(s.id);
        expect(saved?.session.phases).toHaveLength(2);
        expect(flattenSessionItems(saved!.session).map((it) => it.drillId)).toEqual([d.id]);
      });
    });

    it('되돌리기 토스트가 떠 있는 동안 다른 저장을 하면 그 토스트를 거둔다(§H-3 위험)', async () => {
      const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '거둘 토스트용 드릴', durationMin: 10 });
      let s = await createSession({ title: '토스트 거두기 세션' });
      s = await addDrillToSession(s.id, d.id);
      await renderEditor(s.id);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: '거둘 토스트용 드릴 제거' }));
      await screen.findByRole('status'); // undo 토스트가 떴다

      // 다른(비파괴적) 저장 — 세션명 편집.
      const input = screen.getByLabelText('세션명');
      await user.clear(input);
      await user.type(input, '이름 바뀜');
      (input as HTMLInputElement).blur();

      // 거둬졌으니 더 이상 없다 — 남아 있었다면 이 되돌리기가 방금 고친 이름까지 지웠을 것이다.
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    });
  });

  // ── 세션 메모·항목 메모·휴식 시간(§0.5 미배송 빚, 2026-08-20) ──────────────────────
  it('세션 메모를 적으면 저장되고, 지우면 키가 사라진다', async () => {
    const s = await createSession({ title: '메모 세션' });
    await renderEditor(s.id);
    const user = userEvent.setup();

    const note = screen.getByLabelText('세션 메모');
    await user.type(note, '체육관 조명이 어두우니 오전에');
    (note as HTMLTextAreaElement).blur();
    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect(saved?.session.note).toBe('체육관 조명이 어두우니 오전에');
    });

    await user.clear(note);
    (note as HTMLTextAreaElement).blur();
    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect('note' in saved!.session).toBe(false);
    });
  });

  it('항목 메모·휴식 시간을 펼쳐서 적으면 저장되고, PrintSessionPlan 이 읽을 값이 채워진다', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '메모 드릴', durationMin: 10 });
    let s = await createSession({ title: '항목 메모 세션' });
    s = await addDrillToSession(s.id, d.id);
    await renderEditor(s.id);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '메모 드릴 메모·휴식 시간 추가' }));
    const itemNote = screen.getByLabelText('메모');
    await user.type(itemNote, '물병 챙기기');
    (itemNote as HTMLInputElement).blur();
    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect(flattenSessionItems(saved!.session)[0]!.note).toBe('물병 챙기기');
    });

    const rest = screen.getByLabelText('휴식(분)');
    await user.clear(rest);
    await user.type(rest, '5');
    (rest as HTMLInputElement).blur();
    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect(flattenSessionItems(saved!.session)[0]!.restAfterMin).toBe(5);
    });

    // 값이 있으면 손잡이가 채워진 상태(◆)로 바뀌어 "편집" 문구가 된다.
    expect(screen.getByRole('button', { name: '메모 드릴 메모·휴식 시간 편집' })).toBeInTheDocument();

    await user.clear(itemNote);
    (itemNote as HTMLInputElement).blur();
    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect('note' in flattenSessionItems(saved!.session)[0]!).toBe(false);
    });
  });

  it('참가자 체크가 participantIds 로 저장되고, 전부 풀면 키가 지워진다 (C8)', async () => {
    const { saveRoster } = await import('../../storage/rosterRepo.ts');
    const { addPlayer, emptyRoster } = await import('../../model/roster.ts');
    const roster = await saveRoster(addPlayer(addPlayer(emptyRoster(), '참가 선수', 'PF2'), '벤치 선수'));
    const s = await createSession({ title: '참가자 세션' });
    await renderEditor(s.id);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByRole('checkbox', { name: /참가 선수/ })).toBeInTheDocument());
    await user.click(screen.getByRole('checkbox', { name: /참가 선수/ }));
    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect(saved?.session.participantIds).toEqual([roster.players[0]!.id]);
    });
    // PF2 셈이 표시된다(참가 제한은 없다 — 셈만).
    expect(screen.getByText(/PF2 1명/)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /참가 선수/ }));
    await waitFor(async () => {
      const saved = await getSession(s.id);
      expect('participantIds' in saved!.session).toBe(false); // 미지정 = 키 없음
    });
  });

  it('명단에서 지워진 참가자 id 는 인원수에서 빠진다 — 분자가 분모를 넘지 않는다(설정 화면 감사 회귀)', async () => {
    const { saveRoster } = await import('../../storage/rosterRepo.ts');
    const { addPlayer, emptyRoster } = await import('../../model/roster.ts');
    const roster = await saveRoster(addPlayer(emptyRoster(), '생존 선수'));
    const s = await createSession({ title: '참가자 세션' });
    // 과거에 체크됐다가 이후 명단에서 지워진 선수를 흉내낸다 — participantIds 에는 남지만
    // 현재 명단(roster.players)에는 없는 id.
    await putSession({ ...s, participantIds: [roster.players[0]!.id, 'pl_ghost' as Player['id']] });

    await renderEditor(s.id);
    expect(await screen.findByText('1/1명')).toBeInTheDocument();
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

describe('세션 편집 튜토리얼(§0.5)', () => {
  it('처음 여는 화면에서 자동으로 뜨고, 5단계가 계획서 순서대로 나온다', async () => {
    // 이 파일의 공용 beforeEach 가 seen=true 로 채워 둔 것을 되돌려 "처음 방문" 을 재현한다.
    localStorage.setItem(PREFS_KEY, JSON.stringify(makeDefaultPrefs()));
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '튜토리얼용 드릴' });
    let s = await createSession({ title: '튜토리얼용 세션' });
    s = await addDrillToSession(s.id, d.id); // 기본 구획에 항목 하나 — sessionEditor-adddrill 대상이 생긴다
    const nav = makeNav();
    render(<SessionEditorScreen nav={nav} sessionId={s.id} />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText('세션명')).toBeInTheDocument());

    const dialog = await screen.findByRole('dialog', { name: '화면 안내' });
    expect(within(dialog).getByText('1/5 단계')).toBeInTheDocument();
    expect(within(dialog).getByText('세션 정보')).toBeInTheDocument();

    const user = userEvent.setup();
    for (const [i, title] of ['구획 추가', '드릴 편성', '배분 게이지', '참가자 체크'].entries()) {
      await user.click(within(dialog).getByRole('button', { name: '다음' }));
      await waitFor(() => expect(within(dialog).getByText(`${i + 2}/5 단계`)).toBeInTheDocument());
      expect(within(dialog).getByText(title)).toBeInTheDocument();
    }
    await user.click(within(dialog).getByRole('button', { name: '완료' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '화면 안내' })).toBeNull());
  });
});

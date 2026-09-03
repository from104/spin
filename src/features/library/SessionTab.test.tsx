// §6.11 세션 탭 목록. 빈 상태, 행 클릭(편집), [시연], 더보기(내보내기/삭제)를 확인한다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionTab } from './SessionTab.tsx';
import { formatSessionWhen } from '../../model/session.ts';
import type { ResolvedItem, ResolvedSession } from '../../model/session.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

function makeItem(n: number): ResolvedItem {
  return {
    id: `it_${n}` as ResolvedItem['id'],
    drillId: `dr_${n}` as ResolvedItem['drillId'],
    titleCache: `드릴 ${n}`,
    durationMinCache: 10,
    categoryCache: '공격',
    missing: false,
  };
}

function makeResolved(over: Partial<ResolvedSession['session']> = {}, items: ResolvedItem[] = []): ResolvedSession {
  // v2 — 항목은 단일 custom 구획 안에 산다(마이그레이션이 만드는 모양 그대로).
  const phase = { id: 'ph_x' as never, kind: 'custom' as const, title: '훈련', items };
  const session: ResolvedSession['session'] = {
    schemaVersion: 2,
    id: 'se_x' as ResolvedSession['session']['id'],
    title: '금요 훈련',
    phases: items.length > 0 ? [phase] : [],
    drillIds: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
  const phases = items.length > 0 ? [{ phase, items, totalMin: items.length * 10 }] : [];
  return { session, phases, items, totalMin: items.length * 10, missingCount: 0 };
}

describe('SessionTab', () => {
  it('더보기 메뉴에서 내보내기·삭제를 호출한다', async () => {
    const resolved = makeResolved();
    const onExport = vi.fn();
    const onDelete = vi.fn();
    render(<SessionTab sessions={[resolved]} onOpen={() => {}} onPresent={() => {}} onDelete={onDelete} onExport={onExport} onCreate={() => {}} />, { wrapper: SettingsProvider });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '금요 훈련 더보기' }));
    await user.click(screen.getByRole('menuitem', { name: '내보내기' }));
    expect(onExport).toHaveBeenCalledWith(resolved.session.id);

    await user.click(screen.getByRole('button', { name: '금요 훈련 더보기' }));
    await user.click(screen.getByRole('menuitem', { name: '삭제' }));
    expect(onDelete).toHaveBeenCalledWith(resolved.session.id);
  });
});

describe("SessionTab — 머리의 '다음 세션' 스트립 (계획서 2.8)", () => {
  const soon = Date.now() + 3600_000;
  const strip = () => screen.getByRole('region', { name: '다음 세션' });

  function renderWith(sessions: ResolvedSession[], onOpen: (id: ResolvedSession['session']['id']) => void = () => {}) {
    render(<SessionTab sessions={sessions} onOpen={onOpen} onPresent={() => {}} onDelete={() => {}} onExport={() => {}} onCreate={() => {}} />, { wrapper: SettingsProvider });
  }

  it('행에 없는 것 — 편성된 드릴 이름 — 을 싣는다. 5개째부터는 "+N개 더" 로 접는다', () => {
    // 흡수의 근거가 이 줄이다. 스트립이 아래 행을 그대로 베끼기만 하면 지운 대시보드의
    // 자리만 다시 먹는 셈이라, "편성이 무엇인가" 를 보여주는 부분만 살렸다.
    renderWith([makeResolved({ scheduledAt: soon }, [1, 2, 3, 4, 5, 6].map(makeItem))]);
    const s = strip();
    for (const n of [1, 2, 3, 4]) expect(within(s).getByText(`드릴 ${n}`)).toBeInTheDocument();
    expect(within(s).queryByText('드릴 5')).toBeNull();
    expect(within(s).getByText('+2개 더')).toBeInTheDocument();
    // 시각·장소·총시간도 함께. 드릴 6개 × 10분 = 60분.
    expect(within(s).getByText(formatSessionWhen(soon))).toBeInTheDocument();
    expect(within(s).getByText(/60분 · 6개 드릴/)).toBeInTheDocument();
  });

  it('예정 시각이 지난 세션은 "다음" 이 아니다 — 스트립을 안 그린다', () => {
    // 대조군: 아래 행은 그대로 서 있다(세션이 통째로 사라져서 통과하는 것이 아니다).
    renderWith([makeResolved({ scheduledAt: Date.now() - 3600_000 })]);
    expect(screen.queryByRole('region', { name: '다음 세션' })).toBeNull();
    expect(screen.getByRole('button', { name: '금요 훈련 시연 시작' })).toBeInTheDocument();
  });
});

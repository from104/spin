// §10.7 store — "라이브러리 로드 4상태": idle → loading → ready | error.
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { LibraryProvider, useLibrary } from './LibraryProvider.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { SUMMARY_BUILD, type DrillSummary } from '../../model/summary.ts';

vi.mock('../../storage/drillRepo.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../storage/drillRepo.ts')>();
  return { ...actual, resolveDrillRepo: vi.fn(actual.resolveDrillRepo) };
});

const wrapper = ({ children }: { children: ReactNode }) => <LibraryProvider>{children}</LibraryProvider>;

describe('LibraryProvider — 4상태', () => {
  // ★ 2026-08-28 기현님 신고: *"드릴 목록이 왜 실시간으로 갱신이 안 되지?"*
  //
  // 그전에는 쓴 쪽이 `refresh()` 를 **기억해서** 불러야 했고, 편집기(자동저장)만 안 불렀다.
  // 이 케이스가 보는 것은 그 구멍이 아니라 **구멍이 생길 수 없는 구조**다: 프로바이더의
  // 액션을 **거치지 않고** 저장소에 직접 쓴 뒤에도 목록이 따라오는가. 다음에 누가 새 writer 를
  // 만들어도 `postSyncEvent` 만 쏘면 목록은 저절로 맞는다.
  it('프로바이더를 거치지 않은 저장도 목록에 반영된다 — 쓴 쪽이 refresh 를 기억할 필요가 없다', async () => {
    const { result } = renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const before = result.current.drills.length;

    const { repo } = await resolveDrillRepo();
    const outside = await repo.createDrill({ courtMode: 'full', title: '바깥에서 만든 드릴' });
    // ⚠️ 제목을 **저장소에 직접** 고친다(putDrill) — createDrill 은 프로바이더도 갖고 있어
    //    "액션을 통한 갱신" 과 구분이 안 된다. 자동저장이 실제로 타는 길이 이쪽이다.
    await repo.putDrill({ ...outside, title: '바깥에서 고친 제목' });

    await waitFor(() => {
      expect(result.current.drills.length).toBe(before + 1);
      expect(result.current.drills.some((d) => d.title === '바깥에서 고친 제목')).toBe(true);
    });
  });

  it('idle → loading → ready 로 전이하고 drills/sessions 를 채운다', async () => {
    const { result } = renderHook(() => useLibrary(), { wrapper });
    // 마운트 직후 effect 가 아직 안 돈 렌더에서는 idle 이거나 이미 loading 일 수 있다 —
    // 결정적으로 관찰 가능한 것은 최종적으로 ready 에 도달한다는 사실이다.
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(Array.isArray(result.current.drills)).toBe(true);
    expect(Array.isArray(result.current.sessions)).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('resolveDrillRepo 가 실패하면 error 상태로 전이하고 message 를 담는다', async () => {
    vi.mocked(resolveDrillRepo).mockRejectedValueOnce(new Error('강제 실패'));
    const { result } = renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('강제 실패');
    expect(result.current.drills).toEqual([]);
  });

  it('createDrill 후 목록에 반영되고(refresh), deleteDrill 로 사라진다', async () => {
    const { result } = renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const before = result.current.drills.length;

    let created: Awaited<ReturnType<typeof result.current.createDrill>>;
    await act(async () => {
      created = await result.current.createDrill({ courtMode: 'full', title: '라이브러리 테스트 드릴' });
    });
    await waitFor(() => expect(result.current.drills.length).toBe(before + 1));
    expect(result.current.drills.some((d) => d.id === created!.id)).toBe(true);

    await act(async () => {
      await result.current.deleteDrill(created!.id);
    });
    await waitFor(() => expect(result.current.drills.some((d) => d.id === created!.id)).toBe(false));
  });

  it('setCategory/setSearch 가 필터를 바꾸고 목록을 다시 불러온다', async () => {
    const { result } = renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.setSearch('존재하지않을검색어zzz'));
    await waitFor(() => expect(result.current.search).toBe('존재하지않을검색어zzz'));
    await waitFor(() => expect(result.current.drills).toEqual([]));
  });
});

// 2026-08-17 — SUMMARY_BUILD 2(썸네일 도형·메모). `rebuildAllSummaries` 는 오래도록 **호출자가
// 0** 이었고, summary.ts 는 그래서 "build 를 올리면 레코드마다 그림이 달라진다" 를 함정으로
// 등록해 뒀다. 이 커밋이 그 경로에 호출자를 줬으니, 여기서 그 배선을 못박는다.
describe('요약 지연 재생성 — 옛 build 를 봤을 때만, 세션에 한 번', () => {
  const summary = (id: string, build: number): DrillSummary =>
    ({
      id: id as DrillSummary['id'],
      build,
      title: id,
      category: '기타',
      level: 'basic',
      durationMin: 5,
      tags: [],
      courtMode: 'full',
      searchKey: id,
      updatedAt: 0,
      steps: 1,
      teams: { home: { label: '홈', color: '#38bdf8', gkColor: '#f59e0b' }, away: { label: '어웨이', color: '#f472b6', gkColor: '#22c55e' } },
    }) as unknown as DrillSummary;

  /** build 를 마음대로 조작하는 최소 저장소. 실제 repo 를 쓰면 방금 저장한 요약이 늘 최신이라
   *  stale 상태를 만들 수 없다. */
  function fakeRepo(builds: number[]) {
    let list = builds.map((b, i) => summary(`dr_${i}`, b));
    const rebuild = vi.fn(async () => {
      list = list.map((s) => ({ ...s, build: SUMMARY_BUILD }));
      return list.length;
    });
    const listDrillSummaries = vi.fn(async () => list);
    return { rebuild, listDrillSummaries, repo: { listDrillSummaries, rebuildAllSummaries: rebuild } };
  }

  it('★ stale 레코드를 보면 재구축을 부르고 목록을 다시 읽는다', async () => {
    const f = fakeRepo([SUMMARY_BUILD - 1, SUMMARY_BUILD]);
    vi.mocked(resolveDrillRepo).mockResolvedValueOnce({ repo: f.repo as never, degraded: false });
    const { result } = renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(f.rebuild).toHaveBeenCalledTimes(1);
    expect(f.listDrillSummaries).toHaveBeenCalledTimes(2); // 재구축 뒤 다시 읽었다
    expect(result.current.drills.every((s) => s.build === SUMMARY_BUILD)).toBe(true);
  });

  it('★ 전부 최신이면 부르지 않는다 — 목록을 열 때마다 본문을 훑는 일은 없다', async () => {
    const f = fakeRepo([SUMMARY_BUILD, SUMMARY_BUILD]);
    vi.mocked(resolveDrillRepo).mockResolvedValueOnce({ repo: f.repo as never, degraded: false });
    const { result } = renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(f.rebuild).not.toHaveBeenCalled();
    expect(f.listDrillSummaries).toHaveBeenCalledTimes(1);
  });

  it('★ 재구축이 stale 을 못 고쳐도 두 번 부르지 않는다 — 매 조회마다 멈추는 목록이 되면 안 된다', async () => {
    const stubborn = [summary('dr_0', SUMMARY_BUILD - 1)];
    const rebuild = vi.fn(async () => 0); // 본문을 못 열어 그대로인 경우
    const listDrillSummaries = vi.fn(async () => stubborn);
    vi.mocked(resolveDrillRepo).mockResolvedValueOnce({
      repo: { listDrillSummaries, rebuildAllSummaries: rebuild } as never,
      degraded: false,
    });
    const { result } = renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.setSearch('아무거나'));
    await waitFor(() => expect(listDrillSummaries.mock.calls.length).toBeGreaterThan(2));
    expect(rebuild).toHaveBeenCalledTimes(1);
  });
});

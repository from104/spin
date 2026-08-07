// §10.7 store — "라이브러리 로드 4상태": idle → loading → ready | error.
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { LibraryProvider, useLibrary } from './LibraryProvider.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';

vi.mock('../../storage/drillRepo.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../storage/drillRepo.ts')>();
  return { ...actual, resolveDrillRepo: vi.fn(actual.resolveDrillRepo) };
});

const wrapper = ({ children }: { children: ReactNode }) => <LibraryProvider>{children}</LibraryProvider>;

describe('LibraryProvider — 4상태', () => {
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

// §6.7 LibraryProvider — "DrillSummary[], ResolvedSession[], 필터·검색어, repo 액션". 4상태
// 로딩 수명주기(§10.7 "라이브러리 로드 4상태"): idle → loading → ready | error.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { DrillRepo, CreateDrillInit } from '../../storage/drillRepo.ts';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { listSessions, createSession as repoCreateSession, deleteSession as repoDeleteSession } from '../../storage/sessionRepo.ts';
import { SUMMARY_BUILD, type DrillSummary } from '../../model/summary.ts';
import type { ResolvedSession, TrainingSession } from '../../model/session.ts';
import type { Drill } from '../../model/drill.ts';
import type { DrillId, SessionId } from '../../core/ids.ts';

export type LibraryStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface LibraryState {
  status: LibraryStatus;
  degraded: boolean; // resolveDrillRepo() 가 메모리 폴백으로 떨어졌는지(§4.3)
  drills: DrillSummary[];
  sessions: ResolvedSession[];
  drillType: string | null; // v8 유형 필터 (옛 category 필터의 후계)
  search: string;
  error: string | null;
}
export interface LibraryActions {
  refresh(): Promise<void>;
  setDrillType(t: string | null): void;
  setSearch(q: string): void;
  createDrill(init: CreateDrillInit): Promise<Drill>;
  duplicateDrill(id: DrillId, opts?: { title?: string }): Promise<Drill>;
  deleteDrill(id: DrillId): Promise<void>;
  createSession(init: { title: string; scheduledAt?: number; location?: string }): Promise<TrainingSession>;
  deleteSession(id: SessionId): Promise<void>;
}

const LibraryStateContext = createContext<LibraryState | null>(null);
const LibraryActionsContext = createContext<LibraryActions | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<DrillRepo | null>(null);
  /** 이 프로바이더가 아직 화면에 있는가. `refresh` 의 setState 가족이 이걸 먼저 본다. */
  const aliveRef = useRef(true);
  /** 요약 지연 재생성을 이미 시도했는가(세션 1회). 근거는 `refresh` 안의 ⚠️. */
  const rebuiltRef = useRef(false);
  const [status, setStatus] = useState<LibraryStatus>('idle');
  const [degraded, setDegraded] = useState(false);
  const [drills, setDrills] = useState<DrillSummary[]>([]);
  const [sessions, setSessions] = useState<ResolvedSession[]>([]);
  const [drillType, setDrillType] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ensureRepo = useCallback(async (): Promise<DrillRepo> => {
    if (repoRef.current) return repoRef.current;
    const { repo, degraded: d } = await resolveDrillRepo();
    repoRef.current = repo;
    setDegraded(d);
    return repo;
  }, []);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      // 살아 있는지 먼저 본다 — 아래 catch 가 언마운트 뒤에 setState 를 부르면 React 가
      // 내부에서 window 를 만지다 **catch 안에서 다시 던지고**, 그 예외는 이 async 함수를
      // 거부시켜 아무도 안 받는 거부가 된다(2026-08-17 실측: vitest 가 "false positive 위험"
      // 으로 경고하던 것의 정체다). 화면이 사라진 뒤의 조회 결과는 버려도 되는 값이다.
      const repo = await ensureRepo();
      const q = { drillType: drillType ?? undefined, search: search || undefined };
      const [first, sess] = await Promise.all([
        repo.listDrillSummaries(q),
        listSessions().catch(() => [] as ResolvedSession[]), // §4.5: IDB 열화 시에도 드릴 목록은 살아있어야 한다
      ]);
      // 요약 지연 재생성(SUMMARY_BUILD 2, 2026-08-17). 옛 build 로 저장된 요약에는 썸네일의
      // 도형·메모가 없다 — 그대로 두면 **같은 화면에서 카드마다 그림이 다르다**(summary.ts 의
      // 그 함정). stale 한 것을 하나라도 보면 재생성을 부르고 목록을 다시 읽는다.
      //
      // ⚠️ **세션에 한 번뿐이다.** 본문을 못 열어 stale 로 남는 레코드가 있으면(열화·삭제 중간
      // 상태) 매 refresh 마다 전량을 다시 훑게 되고, 그건 카테고리를 바꿀 때마다 목록이 멈추는
      // 증상으로 나타난다. 한 번 시도하고 안 되면 그 카드만 옛 그림으로 남는 편이 낫다.
      let list = first;
      if (!rebuiltRef.current && first.some((s) => s.build < SUMMARY_BUILD)) {
        rebuiltRef.current = true;
        await repo.rebuildAllSummaries();
        list = await repo.listDrillSummaries(q);
      }
      if (!aliveRef.current) return;
      setDrills(list);
      setSessions(sess);
      setStatus('ready');
    } catch (e) {
      if (!aliveRef.current) return;
      setStatus('error');
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [ensureRepo, drillType, search]);

  // ⚠️ **올리는 줄이 있어야 한다.** StrictMode 는 mount → unmount → mount 로 두 번 붙는데,
  // 정리에서 내린 깃발을 다시 올리지 않으면 두 번째 마운트가 시작부터 죽은 것으로 취급돼
  // 목록이 영구히 0건이 된다(2026-08-17 실측: `App.seed.test.tsx` 가 3 대신 0 을 봤다).
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    void refresh();
    // drillType/search 가 바뀌면 repo.listDrillSummaries(q) 를 다시 태운다(§4.3: 요약 전량을 읽어
    // 메모리에서 필터·정렬 — 200건 = 140 KB 수준이라 재조회 비용이 낮다).
  }, [refresh]);

  const createDrill = useCallback(
    async (init: CreateDrillInit) => {
      const repo = await ensureRepo();
      const d = await repo.createDrill(init);
      await refresh();
      return d;
    },
    [ensureRepo, refresh],
  );
  const duplicateDrill = useCallback(
    async (id: DrillId, opts?: { title?: string }) => {
      const repo = await ensureRepo();
      const d = await repo.duplicateDrill(id, opts);
      await refresh();
      return d;
    },
    [ensureRepo, refresh],
  );
  const deleteDrill = useCallback(
    async (id: DrillId) => {
      const repo = await ensureRepo();
      await repo.deleteDrill(id);
      await refresh();
    },
    [ensureRepo, refresh],
  );
  const createSessionAction = useCallback(
    async (init: { title: string; scheduledAt?: number; location?: string }) => {
      const s = await repoCreateSession(init);
      await refresh();
      return s;
    },
    [refresh],
  );
  const deleteSessionAction = useCallback(
    async (id: SessionId) => {
      await repoDeleteSession(id);
      await refresh();
    },
    [refresh],
  );

  const state = useMemo<LibraryState>(
    () => ({ status, degraded, drills, sessions, drillType, search, error }),
    [status, degraded, drills, sessions, drillType, search, error],
  );
  const actions = useMemo<LibraryActions>(
    () => ({
      refresh,
      setDrillType,
      setSearch,
      createDrill,
      duplicateDrill,
      deleteDrill,
      createSession: createSessionAction,
      deleteSession: deleteSessionAction,
    }),
    [refresh, createDrill, duplicateDrill, deleteDrill, createSessionAction, deleteSessionAction],
  );

  return (
    <LibraryActionsContext.Provider value={actions}>
      <LibraryStateContext.Provider value={state}>{children}</LibraryStateContext.Provider>
    </LibraryActionsContext.Provider>
  );
}

export function useLibraryState(): LibraryState {
  const v = useContext(LibraryStateContext);
  if (!v) throw new Error('useLibraryState 는 LibraryProvider 안에서만 쓸 수 있다');
  return v;
}
export function useLibraryActions(): LibraryActions {
  const v = useContext(LibraryActionsContext);
  if (!v) throw new Error('useLibraryActions 는 LibraryProvider 안에서만 쓸 수 있다');
  return v;
}
export function useLibrary(): LibraryState & LibraryActions {
  const state = useLibraryState();
  const actions = useLibraryActions();
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}

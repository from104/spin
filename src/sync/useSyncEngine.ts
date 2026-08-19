// 0.6 Drive 동기화 — React 글루. App 루트에서 **한 번** 마운트되어(SyncEffects, 커밋 7)
// 트리거를 배선한다: 쓰기 방송 → 3s 디바운스 패스 · hidden 즉시 flush(useAutosave 전례) ·
// visible/focus/online → 패스 · 시작 시 1회. 폴링은 없다.
//
// 설정 화면(SyncSection)과의 연결은 Context 가 아니라 **모듈 관찰자**다 — 이 앱의
// "god-context 금지"(App.tsx 머리말) 원칙과, 엔진이 React 밖 존재라는 사실에 맞춘다.
// 섹션은 useSyncExternalStore(subscribeSyncStatus, syncStatusSnapshot) 로 상태를 읽고
// syncNow() 로 수동 패스를 부른다.
import { useEffect } from 'react';
import { useSettingsState } from '../store/settings/SettingsProvider.tsx';
import { useLibrary } from '../store/library/LibraryProvider.tsx';
import { subscribeSyncEvents } from '../storage/syncMeta.ts';
import { createSyncEngine, type SyncEngine, type SyncEngineStatus } from './engine.ts';
import { createIdbSyncStore } from './store.ts';
import { driveDelete, driveDownload, driveListAll, driveUpload } from './drive.ts';
import { getAccessToken, invalidateToken, isSyncConfigured } from './auth.ts';

// ── 모듈 관찰자 — 훅(발행)과 설정 섹션(구독)이 공유한다 ────────────────────────────────

const OFF_STATUS: SyncEngineStatus = { state: 'idle' };
let currentStatus: SyncEngineStatus = OFF_STATUS;
let currentEngine: SyncEngine | null = null;
const statusListeners = new Set<() => void>();

function publishStatus(s: SyncEngineStatus): void {
  currentStatus = s;
  for (const cb of statusListeners) {
    try {
      cb();
    } catch {
      /* 구독자 사정 */
    }
  }
}

/** useSyncExternalStore 용 — 참조 동일성이 곧 "안 바뀜" 신호다. */
export function syncStatusSnapshot(): SyncEngineStatus {
  return currentStatus;
}

export function subscribeSyncStatus(cb: () => void): () => void {
  statusListeners.add(cb);
  return () => {
    statusListeners.delete(cb);
  };
}

/** [지금 동기화] — 엔진이 없으면(꺼짐·미구성) 조용히 무시된다(버튼 자체가 그때는 안 보인다). */
export function syncNow(): void {
  void currentEngine?.flushNow();
}

// ── 훅 본체 ──────────────────────────────────────────────────────────────────────────

export function useSyncEngine(): void {
  const { prefs } = useSettingsState();
  const { refresh } = useLibrary();
  const enabled = prefs.sync.enabled && isSyncConfigured();

  useEffect(() => {
    if (!enabled) {
      publishStatus(OFF_STATUS);
      return;
    }
    const engine = createSyncEngine(
      createIdbSyncStore(),
      { listAll: driveListAll, download: driveDownload, upload: driveUpload, delete: driveDelete },
      { getToken: getAccessToken, invalidateToken },
    );
    currentEngine = engine;
    const offStatus = engine.subscribeStatus(publishStatus);
    const offEvents = subscribeSyncEvents((e) => {
      if (e.op === 'pass') {
        // 다른 탭(또는 이 탭)의 패스가 문서를 내렸다 — 목록을 다시 읽는다. refresh 는 수동
        // 호출 방식(LibraryProvider)이라 이 방송이 유일한 통지 경로다.
        if (e.pulled > 0) void refresh();
        return;
      }
      // 엔진이 도는 동안의 put/delete 는 우리 자신의 pull 이 만든 에코다(같은 탭 한정) —
      // 그걸로 또 패스를 예약하면 매 pull 마다 공회전 패스가 하나씩 붙는다.
      if (engine.getStatus().state === 'running') return;
      engine.requestPass();
    });
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // 숨는 순간이 마지막 기회일 수 있다(탭 종료) — 디바운스를 버리고 즉시.
        void engine.flushNow();
      } else {
        engine.requestPass();
      }
    };
    const onOnline = () => {
      engine.requestPass();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    window.addEventListener('online', onOnline);
    void engine.runOnce().catch(() => {
      /* 상태로 표면화 — 시작 패스 실패가 앱을 막으면 안 된다 */
    });
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
      window.removeEventListener('online', onOnline);
      offEvents();
      offStatus();
      engine.stop();
      currentEngine = null;
      publishStatus(OFF_STATUS);
    };
  }, [enabled, refresh]);
}

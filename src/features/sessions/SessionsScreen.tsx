// C5(2026-08-18 구조 개편) — 세션 목록의 **1급 화면**. §6.11 의 "드릴 목록의 2번째 탭" 이
// 여기로 승격했다(질문 20문 ①: 세션·드릴·전술판 동급). 본문(SessionTab)·드로어(SessionDrawer)
// 는 검증된 그 컴포넌트를 그대로 옮겨 왔다 — C6(세션 전용 편집 화면)에서 드로어가 은퇴한다.
//
// 내비게이션·헤더 계약은 LibraryScreen 과 같다(§8): app-shell 을 import 하지 않고 이동은
// HomeNav prop 하나로, 헤더는 app-shell 이 정적으로 꽂는다. `<main id="main" tabIndex={-1}>`
// 도 §7.5a 대로 이 화면이 직접 렌더한다.
//
// 드로어 열림은 **URL 이 저장소다**(`/sessions?open=<id>` — routes.ts). 로컬 state 로만 열면
// 새로고침·뒤로가기에서 드로어가 증발한다. 열기 = nav.openSession(주소 이동), 닫기 =
// nav.goLibrarySessions(주소에서 open 제거) — 두 방향 다 히스토리에 남아 뒤로가기가 정확하다.
import { useRef } from 'react';
import { useLibrary } from '../../store/library/LibraryProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { deleteSession as repoDeleteSession, getSession } from '../../storage/sessionRepo.ts';
import type { SessionId } from '../../core/ids.ts';
import { SessionTab } from '../library/SessionTab.tsx';
import { SessionDrawer } from '../library/SessionDrawer.tsx';
import { exportOneSession } from '../library/transfer.ts';
import type { HomeNav } from '../home/nav.ts';

export interface SessionsScreenProps {
  nav: HomeNav;
  /** 주소의 `?open=` — 있으면 그 세션의 드로어가 열린 채로 선다. */
  openSessionId?: SessionId;
}

export function SessionsScreen({ nav, openSessionId }: SessionsScreenProps) {
  const { sessions, createSession, refresh } = useLibrary();
  const toast = useToast();
  const drawerTriggerRef = useRef<HTMLElement | null>(null);

  const openSession = (id: SessionId) => {
    // §7.6 "세션 드로어 닫기 → 트리거로 포커스 복귀" — 클릭 시점의 포커스를 기록해 둔다.
    drawerTriggerRef.current = document.activeElement as HTMLElement | null;
    nav.openSession(id);
  };
  const closeDrawer = () => nav.goLibrary({ tab: 'sessions' }); // 주소에서 ?open 을 걷는다

  const handleCreateSession = async () => {
    const s = await createSession({ title: '새 세션' });
    openSession(s.id);
  };
  const handleDeleteSession = async (id: SessionId) => {
    await repoDeleteSession(id);
    await refresh();
    toast.show('세션을 삭제했습니다.');
  };
  const handleExportSession = async (id: SessionId) => {
    const resolved = await getSession(id);
    if (!resolved) return;
    await exportOneSession(resolved.session);
    toast.show(`"${resolved.session.title}" 을(를) 내보냈습니다.`);
  };

  return (
    <main id="main" tabIndex={-1} style={{ flex: 1, overflowY: 'auto', outline: 'none', padding: '22px 30px 46px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <SessionTab
          sessions={sessions}
          onOpen={openSession}
          onPresent={(id) => nav.presentSession(id)}
          onDelete={(id) => void handleDeleteSession(id)}
          onExport={(id) => void handleExportSession(id)}
          onCreate={() => void handleCreateSession()}
        />
      </div>

      <SessionDrawer
        sessionId={openSessionId ?? null}
        open={openSessionId !== undefined}
        onClose={closeDrawer}
        returnFocusRef={drawerTriggerRef}
        onPresent={(id) => nav.presentSession(id)}
      />
    </main>
  );
}

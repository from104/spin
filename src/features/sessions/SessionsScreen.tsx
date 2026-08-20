// C5(2026-08-18 구조 개편) — 세션 목록의 **1급 화면**. §6.11 의 "드릴 목록의 2번째 탭" 이
// 여기로 승격했다(질문 20문 ①: 세션·드릴·전술판 동급). 목록 본문(SessionTab)은 검증된 그
// 컴포넌트 그대로다. C6 — 드로어(SessionDrawer)는 **은퇴했다**: 세션을 열면 전용 편집 화면
// (`#/sessions/:id`, SessionEditorScreen)으로 간다. 드릴의 목록→편집 화면 꼴과 같다.
//
// 내비게이션·헤더 계약은 LibraryScreen 과 같다(§8): app-shell 을 import 하지 않고 이동은
// HomeNav prop 하나로, 헤더는 app-shell 이 정적으로 꽂는다. `<main id="main" tabIndex={-1}>`
// 도 §7.5a 대로 이 화면이 직접 렌더한다.
import { useLibrary } from '../../store/library/LibraryProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { deleteSession as repoDeleteSession, getSession } from '../../storage/sessionRepo.ts';
import type { SessionId } from '../../core/ids.ts';
import { SessionTab } from '../library/SessionTab.tsx';
import { exportOneSession } from '../library/transfer.ts';
import type { HomeNav } from '../home/nav.ts';
import { useT } from '../../i18n/useT.ts';
import { useTutorial } from '../../ui/tutorial/useTutorial.ts';
import { TutorialOverlay } from '../../ui/tutorial/TutorialOverlay.tsx';
import { SESSIONS_TUTORIAL_STEPS } from './tutorialSteps.ts';

export interface SessionsScreenProps {
  nav: HomeNav;
}

export function SessionsScreen({ nav }: SessionsScreenProps) {
  const { status, sessions, createSession, refresh } = useLibrary();
  const toast = useToast();
  const t = useT();
  // status가 'ready'가 되기 전에는 세션 카드가 아직 안 실려 있다(§10.7) — 목록이 실제로
  // 그려진 뒤로 자동 시작을 미룬다.
  const tutorial = useTutorial('sessions', SESSIONS_TUTORIAL_STEPS, status === 'ready');

  const openSession = (id: SessionId) => nav.openSession(id);

  const handleCreateSession = async () => {
    // 새 세션 기본 제목도 지금 UI 언어를 따른다 — AppShell 헤더의 [새 세션]과 같은 규칙
    // (app.header.newSession 키 공유, i18n C2).
    const s = await createSession({ title: t('app.header.newSession') });
    openSession(s.id);
  };
  const handleDeleteSession = async (id: SessionId) => {
    await repoDeleteSession(id);
    await refresh();
    toast.show(t('sessionsScreen.deleteToast'));
  };
  const handleExportSession = async (id: SessionId) => {
    const resolved = await getSession(id);
    if (!resolved) return;
    await exportOneSession(resolved.session);
    toast.show(t('sessionsScreen.exportToast', { title: resolved.session.title }));
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

      {tutorial.step && (
        <TutorialOverlay
          step={tutorial.step}
          stepIndex={tutorial.stepIndex}
          totalSteps={tutorial.totalSteps}
          onNext={tutorial.next}
          onPrev={tutorial.prev}
          onSkip={tutorial.skip}
        />
      )}
    </main>
  );
}

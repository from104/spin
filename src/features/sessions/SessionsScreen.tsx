// C5(2026-08-18 구조 개편) — 세션 목록의 **1급 화면**. §6.11 의 "드릴 목록의 2번째 탭" 이
// 여기로 승격했다(질문 20문 ①: 세션·드릴·전술판 동급). 목록 본문(SessionTab)은 검증된 그
// 컴포넌트 그대로다. C6 — 드로어(SessionDrawer)는 **은퇴했다**: 세션을 열면 전용 편집 화면
// (`#/sessions/:id`, SessionEditorScreen)으로 간다. 드릴의 목록→편집 화면 꼴과 같다.
//
// 내비게이션·헤더 계약은 LibraryScreen 과 같다(§8): app-shell 을 import 하지 않고 이동은
// HomeNav prop 하나로, 헤더는 app-shell 이 정적으로 꽂는다. `<main id="main" tabIndex={-1}>`
// 도 §7.5a 대로 이 화면이 직접 렌더한다.
import { useCallback, useState } from 'react';
import { useLibrary } from '../../store/library/LibraryProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { useSettingsActions, useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { deleteSession as repoDeleteSession, restoreSession, getSession } from '../../storage/sessionRepo.ts';
import type { TrainingSession } from '../../model/session.ts';
import type { SessionId } from '../../core/ids.ts';
import type { TutorialScreenKey } from '../../storage/prefs.ts';
import { SessionTab } from '../library/SessionTab.tsx';
import { ShareLinkModal } from '../library/ShareLinkModal.tsx';
import type { SharedDoc } from '../../share/index.ts';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import type { Drill } from '../../model/drill.ts';
import { exportOneSession } from '../library/transfer.ts';
import type { HomeNav } from '../home/nav.ts';
import { useT } from '../../i18n/useT.ts';
import { useTutorial } from '../../ui/tutorial/useTutorial.ts';
import { TutorialOverlay } from '../../ui/tutorial/TutorialOverlay.tsx';
import { withTutorialUnseen } from '../../ui/tutorial/resetTutorialSeen.ts';
import { SESSIONS_TUTORIAL_STEPS } from './tutorialSteps.ts';
import { HelpCenter } from '../../ui/help/HelpCenter.tsx';
import { usePublishHelpShow } from '../../ui/help/HelpTriggerProvider.tsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx';
import { DELETE_UNDO_TOAST_MS } from '../../ui/Toast.tsx';

export interface SessionsScreenProps {
  nav: HomeNav;
}

export function SessionsScreen({ nav }: SessionsScreenProps) {
  const { status, sessions, createSession, refresh } = useLibrary();
  const toast = useToast();
  const t = useT();
  const { prefs } = useSettingsState();
  const { setPrefs } = useSettingsActions();
  // status가 'ready'가 되기 전에는 세션 카드가 아직 안 실려 있다(§10.7) — 목록이 실제로
  // 그려진 뒤로 자동 시작을 미룬다.
  // §0.5 Phase 5 — LibraryScreen 과 같은 이유(§8 이라 옛 도움말 진입점이 없던 화면).
  // ★ 투어보다 **먼저** 선다 — 투어의 마지막 말풍선이 [자세한 도움말] 로 이 문을 쓴다.
  const [helpOpen, setHelpOpen] = useState(false);
  const showHelp = useCallback(() => setHelpOpen(true), []);
  usePublishHelpShow(showHelp);
  const tutorial = useTutorial('sessions', SESSIONS_TUTORIAL_STEPS, status === 'ready', { onOpenHelp: showHelp });
  // 도움말 "세션" 섹션은 이 화면과 세션 편집 둘 다를 위한 [투어 다시 보기]를 낸다(helpSections.ts).
  // 세션 편집은 지금 마운트돼 있지 않으므로 그 투어는 직접 못 열고, 다음에 그 화면을 열 때
  // 자동으로 뜨도록 "안 봤음" 으로 되돌린다.
  const onRestartTutorial = (screen: TutorialScreenKey) => {
    if (screen === 'sessions') {
      tutorial.start();
      return;
    }
    setPrefs({ tutorialsSeen: withTutorialUnseen(prefs.tutorialsSeen, screen) });
  };

  const openSession = (id: SessionId) => nav.openSession(id);

  const handleCreateSession = async () => {
    // 새 세션 기본 제목도 지금 UI 언어를 따른다 — AppShell 헤더의 [새 세션]과 같은 규칙
    // (app.header.newSession 키 공유, i18n C2).
    const s = await createSession({ title: t('app.header.newSession') });
    openSession(s.id);
  };
  // §C-4(2026-08-20, PLAN-DELETE-SAFETY.md) — 세션엔 앱 되돌리기 스택이 없고 여러 구획·편성을
  // 통째로 가져간다. 드릴(§C-2)과 같은 급이라 무조건 확인 + 8초 undo 토스트로 대칭을 맞춘다.
  // 세션은 참조 대상이 없어(아무도 세션을 가리키지 않는다) 드릴처럼 문구를 가를 필요가 없다.
  const [pendingDeleteSession, setPendingDeleteSession] = useState<TrainingSession | null>(null);
  const requestDeleteSession = (id: SessionId) => {
    // sessions(useLibrary)가 이미 원본 TrainingSession 을 들고 있다(드릴과 달리 요약/본문
    // 분리가 없다) — 되돌리기용 원본을 얻으려 따로 fetch 할 필요가 없다.
    const target = sessions.find((r) => r.session.id === id)?.session;
    if (target) setPendingDeleteSession(target);
  };
  const confirmDeleteSession = async () => {
    if (!pendingDeleteSession) return;
    const full = pendingDeleteSession;
    setPendingDeleteSession(null);
    await repoDeleteSession(full.id);
    await refresh();
    toast.show(t('sessionsScreen.deleteToast', { title: full.title }), {
      durationMs: DELETE_UNDO_TOAST_MS,
      action: {
        label: t('sessionsScreen.undoAction'),
        onAction: async () => {
          // putSession({touch:false}) 이 아니라 restoreSession — 톰스톤도 같이 지워야 다음
          // 동기화가 되살린 세션을 다시 안 지운다(§E, 드릴과 같은 이유).
          await restoreSession(full);
          await refresh();
        },
      },
    });
  };
  // ── 링크로 공유 (PLAN-SHARE-LINK §6 S4) ───────────────────────────────────────────────
  // 세션 봉투는 세션 **혼자 오지 않는다** — 편성된 드릴 본문을 데리고 간다(S1). 목록이 들고 있는
  // ResolvedSession 은 제목·시간 캐시뿐이라, 여기서 저장소를 한 번 읽어 본문을 채운다.
  // 링크를 만드는 순서(접기·잠그기·올리기)는 이 화면이 알지 않는다 — ShareLinkModal 이 `doc`
  // 하나를 받아 `createShareLink` 에 넘긴다(그 파일 머리말).
  const [shareDoc, setShareDoc] = useState<SharedDoc | null>(null);
  const requestShareLink = async (id: SessionId) => {
    const resolved = await getSession(id);
    if (!resolved) return;
    const { repo } = await resolveDrillRepo();
    const map = await repo.getDrills(resolved.session.drillIds);
    // ⚠️ 없는 드릴은 **조용히 빠진다**(exportOneSession 과 같은 규칙). 편성이 가리키는 드릴이
    //    지워졌어도 세션은 보낼 수 있어야 하고, 받는 쪽에서 그 항목은 '삭제됨' 으로 뜬다 —
    //    보내는 사람을 여기서 막으면 세션 하나가 통째로 공유 불가가 된다.
    const drills = resolved.session.drillIds.map((d) => map.get(d)).filter((d): d is Drill => d !== undefined);
    setShareDoc({ kind: 'session', session: resolved.session, drills });
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
          onDelete={requestDeleteSession}
          onExport={(id) => void handleExportSession(id)}
          onShareLink={(id) => void requestShareLink(id)}
          onCreate={() => void handleCreateSession()}
        />
      </div>

      <ShareLinkModal open={shareDoc !== null} doc={shareDoc} onClose={() => setShareDoc(null)} />

      {tutorial.step && (
        <TutorialOverlay
          step={tutorial.step}
          stepIndex={tutorial.stepIndex}
          totalSteps={tutorial.totalSteps}
          onNext={tutorial.next}
          onPrev={tutorial.prev}
          onSkip={tutorial.skip}
          onOpenHelp={tutorial.openHelp}
        />
      )}

      <HelpCenter open={helpOpen} onClose={() => setHelpOpen(false)} initialSection="sessions" onRestartTutorial={onRestartTutorial} />

      {pendingDeleteSession && (
        <ConfirmDialog
          open
          onCancel={() => setPendingDeleteSession(null)}
          onConfirm={() => void confirmDeleteSession()}
          title={t('sessionsScreen.deleteConfirm.title')}
          body={t('sessionsScreen.deleteConfirm.body', { title: pendingDeleteSession.title })}
          confirmLabel={t('sessionsScreen.deleteConfirm.confirm')}
          cancelLabel={t('sessionsScreen.deleteConfirm.cancel')}
        />
      )}
    </main>
  );
}

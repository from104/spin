// [팀] 화면 — 목록과 상세를 **한 컨테이너**가 안고 있다 (PLAN-TEAM 결정 16·17).
//
// 왜 AppShell 이 목록/상세 둘을 갈라 렌더하지 않는가: 팀 투어가 목록(step1·2)에서 상세(step3~5)로
// 가로지르기 때문이다(features/team/tutorialSteps.ts 머리말). 목록 컴포넌트에만 `useTutorial` 을
// 걸면 상세로 넘어가는 순간 투어 상태가 언마운트와 함께 사라진다. 세션이 목록·편집을 두 화면으로
// 가른 것과 다른 판단인데, 다른 이유는 이것 하나다 — 팀은 상세도 같은 화면 키 안의 대상이다.
//
// 내비게이션·헤더 계약은 SessionsScreen 과 같다(§8): app-shell 을 import 하지 않고 이동은
// HomeNav prop 하나로, 헤더는 app-shell 이 정적으로 꽂는다. `<main id="main" tabIndex={-1}>`
// 도 §7.5a 대로 이 화면이 직접 렌더한다.
//
// ⚠️ **공유 콜백을 만들지 않는다**(결정 12, 기현 지시: *"공유 링크 없음"*). 카드 케밥에도, 상세
//    헤더에도 [링크로 공유]가 없다. SessionsScreen 을 본떠 온 파일이라 그 자리가 비어 보이지만
//    비어 있는 것이 계약이다 — `share/codec.ts` 의 닫힌 유니온이 컴파일 타임 방어선이고, 이
//    주석이 사람 쪽 방어선이다.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Team } from '../../model/team.ts';
import type { TeamId } from '../../core/ids.ts';
import { LIMITS } from '../../model/validate.ts';
import { createTeam, deleteTeam, duplicateTeam, listTeams, restoreTeam } from '../../storage/teamRepo.ts';
import { ACCEPT_TEAM } from '../../storage/files.ts';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { useSettingsActions, useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import type { TutorialScreenKey } from '../../storage/prefs.ts';
import { Button } from '../../ui/Button.tsx';
import { IconPlus } from '../../ui/icons.tsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx';
import { DELETE_UNDO_TOAST_MS } from '../../ui/Toast.tsx';
import { HelpCenter } from '../../ui/help/HelpCenter.tsx';
import { usePublishHelpShow } from '../../ui/help/HelpTriggerProvider.tsx';
import { TutorialOverlay } from '../../ui/tutorial/TutorialOverlay.tsx';
import { useTutorial } from '../../ui/tutorial/useTutorial.ts';
import { withTutorialUnseen } from '../../ui/tutorial/resetTutorialSeen.ts';
import { PrintRoot, printWhenReady } from '../print/index.ts';
import type { PrintDoc } from '../print/index.ts';
import type { HomeNav } from '../home/nav.ts';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { storageErrorText } from '../../i18n/storageError.ts';
import { TEAM_TUTORIAL_STEPS } from './tutorialSteps.ts';
import { TeamCard } from './TeamCard.tsx';
import { TeamDetail } from './TeamDetail.tsx';
import { TeamExportSheet } from './TeamExportSheet.tsx';
import { exportOneTeam, importTeamFile } from './transfer.ts';

export interface TeamScreenProps {
  nav: HomeNav;
  /** URL 이 진실이다 — 있으면 상세, 없으면 목록(routes.ts `/team/:id`). */
  teamId?: TeamId;
}

export function TeamScreen({ nav, teamId }: TeamScreenProps) {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const { prefs } = useSettingsState();
  const { setPrefs } = useSettingsActions();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setTeams(await listTeams());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // §0.5 Phase 5 — 레일 [도움말]이 이 화면의 도움말 섹션을 연다. ★ 투어보다 **먼저** 선다:
  // 투어의 마지막 말풍선이 [자세한 도움말] 로 이 문을 쓴다.
  const [helpOpen, setHelpOpen] = useState(false);
  const showHelp = useCallback(() => setHelpOpen(true), []);
  usePublishHelpShow(showHelp);
  const tutorial = useTutorial('team', TEAM_TUTORIAL_STEPS, teams !== null, { onOpenHelp: showHelp });
  const onRestartTutorial = (screen: TutorialScreenKey) => {
    if (screen === 'team') {
      tutorial.start();
      return;
    }
    setPrefs({ tutorialsSeen: withTutorialUnseen(prefs.tutorialsSeen, screen) });
  };

  // ── 삭제(결정 15) — 확인 모달 + 8초 undo + 톰스톤 ─────────────────────────────────
  // 팀은 선수·스태프를 **통째로** 데려간다. 세션 삭제(§C-4)와 같은 급이라 무조건 한 번 묻고,
  // 문구에 몇 명이 함께 지워지는지 숫자로 적는다 — "팀을 지운다" 만으로는 명단이 같이 간다는
  // 사실이 안 읽힌다.
  const [pendingDelete, setPendingDelete] = useState<Team | null>(null);
  const confirmDelete = async () => {
    const victim = pendingDelete;
    if (!victim) return;
    setPendingDelete(null);
    if (teamId === victim.id) nav.openTeam(); // 지운 팀의 상세에 서 있으면 목록으로 되접는다
    await deleteTeam(victim.id);
    await refresh();
    toast.show(t('team.deleteToast', { name: victim.name }), {
      durationMs: DELETE_UNDO_TOAST_MS,
      action: {
        label: t('team.undoAction'),
        onAction: async () => {
          // putTeam({touch:false}) 이 아니라 restoreTeam — 톰스톤도 같이 지워야 다음 동기화가
          // 되살린 팀을 다시 지운다(드릴·세션과 같은 이유).
          await restoreTeam(victim);
          await refresh();
        },
      },
    });
  };

  // ── 내보내기·인쇄(결정 13·18) — **둘 다** 시트에서 [등급 정보 제외]를 물은 뒤에 나간다 ──
  //
  // ── ⚠️ 2026-09-09: 인쇄가 시트를 건너뛰던 것을 고친다 ───────────────────────────────
  // 첫 배송에서 [인쇄]는 `{kind:'team', team}` 만 실어 곧장 종이로 갔다 — `printDoc.stripClass`
  // 는 선언만 되고 **값을 넣는 호출자가 0곳**이라 팀시트가 언제나 등급 열을 찍었다. 그런데
  // 도움말 세 벌·CHANGELOG 세 벌은 «내보내기와 인쇄에는 [등급 정보 제외]가 있습니다» 라고
  // 이미 약속하고 있었다(문서가 코드보다 앞선 상태). 등급은 분류 심사 결과라(조사 §3.2)
  // «뺐다» 고 안내한 정보가 종이로 나가는 것은 개인정보 사고다. 그래서 두 길이 **같은 시트**를
  // 지난다 — 어느 쪽이 목적지인지는 `mode` 하나로 갈린다.
  const [sheetTarget, setSheetTarget] = useState<{ team: Team; mode: 'export' | 'print' } | null>(null);
  const runExport = (team: Team, stripClass: boolean) => {
    void exportOneTeam(team.id, { stripClass }, locale)
      .then(() => toast.show(t('team.exportToast', { name: team.name })))
      .catch((e: unknown) => toast.show(storageErrorText(e, locale, t('team.detail.saveFailToast'))));
  };

  // ⚠️ `PrintRoot` 는 **항상 마운트**돼 있어야 한다: doc 을 넣는 순간 카드 메뉴는 닫히고, 조건부
  //    렌더였다면 그 프레임에 트리가 사라져 백지가 인쇄된다(ExportSheet.tsx 머리말의 그 사고).
  const [printDoc, setPrintDoc] = useState<PrintDoc | null>(null);

  const handleDuplicate = (team: Team) => {
    if ((teams?.length ?? 0) >= LIMITS.teamMax) {
      toast.show(t('team.limitToast', { max: LIMITS.teamMax }));
      return;
    }
    // 사본 이름은 **여기서** 정한다 — 리포(`duplicateTeam`)는 i18n 을 모른다(teamRepo 머리말).
    void duplicateTeam(team.id, { name: t('team.copySuffix', { name: team.name }) })
      .then(async (copy) => {
        await refresh();
        toast.show(t('team.duplicateToast', { name: copy.name }));
      })
      .catch((e: unknown) => toast.show(storageErrorText(e, locale, t('team.detail.saveFailToast'))));
  };

  const handleNew = () => {
    if ((teams?.length ?? 0) >= LIMITS.teamMax) {
      toast.show(t('team.limitToast', { max: LIMITS.teamMax }));
      return;
    }
    void createTeam({ locale })
      .then(async (team) => {
        await refresh();
        nav.openTeam(team.id); // 만들자마자 상세로 — 이름부터 고치는 흐름(새 세션과 같다)
      })
      .catch((e: unknown) => toast.show(storageErrorText(e, locale, t('team.detail.saveFailToast'))));
  };

  const handleImportFile = (file: File) => {
    void importTeamFile(file, locale)
      .then(async (report) => {
        await refresh();
        const fresh = await listTeams();
        const newest = fresh[0];
        if (report.imported > 0 && newest) toast.show(t('team.importToast', { name: newest.name }));
        else toast.show(t('team.importFailToast'));
      })
      .catch((e: unknown) => toast.show(storageErrorText(e, locale, t('team.detail.saveFailToast'))));
  };

  const detail = teamId !== undefined;

  return (
    <main ref={mainRef} id="main" tabIndex={-1} style={{ flex: 1, overflowY: 'auto', outline: 'none', padding: '22px 30px 46px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {detail ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <Button variant="secondary" onClick={() => nav.openTeam()}>
                ← {t('team.detail.back')}
              </Button>
            </div>
            <TeamDetail
              teamId={teamId}
              onSaved={(saved) => setTeams((cur) => (cur ? cur.map((x) => (x.id === saved.id ? saved : x)) : cur))}
              onExport={(team) => setSheetTarget({ team, mode: 'export' })}
              onPrint={(team) => setSheetTarget({ team, mode: 'print' })}
            />
          </>
        ) : teams === null ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--faint-text)' }}>{t('team.loading')}</p>
        ) : teams.length === 0 ? (
          <div
            data-tut="team-list"
            style={{ border: '1px dashed var(--border-strong)', borderRadius: 16, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}
          >
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{t('team.empty.title')}</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--faint-text)', margin: 0, maxWidth: 460 }}>{t('team.empty.body')}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button data-tut="team-new" variant="primary" icon={<IconPlus size={14} />} onClick={handleNew}>
                {t('team.newButton')}
              </Button>
              <Button data-tut="team-import" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                {t('team.importButton')}
              </Button>
            </div>
          </div>
        ) : (
          <div data-tut="team-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* 툴바 — 목록이 있을 때만 선다. 비었을 때는 위 빈 상태가 같은 이름의 버튼 둘을 내므로
                둘 다 서면 보조기술에 똑같이 읽히는 표적이 두 개가 된다(SessionsScreen 의 그 판단). */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10 }}>
              <Button data-tut="team-new" variant="primary" icon={<IconPlus size={14} />} onClick={handleNew}>
                {t('team.newButton')}
              </Button>
              <Button data-tut="team-import" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                {t('team.importButton')}
              </Button>
            </div>
            {teams.map((team, i) => (
              <TeamCard
                key={team.id}
                team={team}
                first={i === 0}
                onOpen={() => nav.openTeam(team.id)}
                onDuplicate={() => handleDuplicate(team)}
                onExport={() => setSheetTarget({ team, mode: 'export' })}
                onPrint={() => setSheetTarget({ team, mode: 'print' })}
                onDelete={() => setPendingDelete(team)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 파일 고르기 입력은 화면 어디에도 안 보인다 — 표적은 위 [가져오기] 버튼 하나다. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_TEAM}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // 같은 파일을 두 번 고를 수 있게(change 가 안 나는 그 함정)
          if (file) handleImportFile(file);
        }}
      />

      <TeamExportSheet
        open={sheetTarget !== null}
        teamName={sheetTarget?.team.name ?? ''}
        mode={sheetTarget?.mode ?? 'export'}
        onCancel={() => setSheetTarget(null)}
        onConfirm={(stripClass) => {
          const target = sheetTarget;
          setSheetTarget(null);
          if (!target) return;
          if (target.mode === 'export') runExport(target.team, stripClass);
          // 토글을 **종이까지 그대로** 내린다 — 여기가 `printDoc.stripClass` 의 유일한 생산자다.
          else setPrintDoc({ kind: 'team', team: target.team, stripClass });
        }}
        // 시트를 여는 표적이 넷이다(카드 ⋮ 의 [내보내기]·[인쇄], 상세의 같은 둘) — 어느 쪽에서 왔든 초점이 갈 곳은
        // 이 화면의 본문이다. 여는 버튼마다 ref 를 들고 다니면 카드가 지워진 뒤 죽은 ref 가 남는다
        // (SessionsScreen 이 ShareImportSheet 에 mainRef 를 준 것과 같은 판단).
        returnFocusRef={mainRef}
      />

      <PrintRoot
        doc={printDoc}
        onReady={() => {
          printWhenReady();
          setPrintDoc(null);
        }}
        view={{ showGrid: prefs.showGrid, showGridLabels: prefs.showGridLabels, showRuleZones: prefs.showRuleZones }}
      />

      {pendingDelete && (
        <ConfirmDialog
          open
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
          title={t('team.deleteConfirm.title')}
          body={t('team.deleteConfirm.body', { name: pendingDelete.name, players: pendingDelete.players.length, staff: pendingDelete.staff.length })}
          confirmLabel={t('team.deleteConfirm.confirm')}
          cancelLabel={t('team.deleteConfirm.cancel')}
        />
      )}

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

      <HelpCenter open={helpOpen} onClose={() => setHelpOpen(false)} initialSection="team" onRestartTutorial={onRestartTutorial} />
    </main>
  );
}

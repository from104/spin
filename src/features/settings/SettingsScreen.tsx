// §4.6(설정)·§6.8(화면 골격)·§7.4(uiScale) — 설정 화면. 마크업은 docs/prototype/template.html
// 512–595행("설정 / SETTINGS")을 뼈대로 삼되, 정적 sc-for 목데이터 대신 SettingsProvider 의
// 실제 prefs 로 채우고, 프로토타입에 없던 물리 파라미터·UI 배율·접근성 3종·상대 팀 색상 행을
// DESIGN.md §4.6/§7.3/§7.4/§7.5/§7.8 요구대로 추가한다.
//
// 이 화면은 §8 표대로 app-shell 을 import 하지 않는다 — 헤더(제목·부제)는 app-shell 의
// useStaticHeaderConfig 가 정적으로 채운다(AppShell.tsx "settings 도... 마찬가지로 정적 헤더를
// 받는다"). `<main id="main" tabIndex={-1}>` 는 §7.5a 대로 이 화면이 직접 렌더한다.
//
// 부트 스크립트(index.html)가 심어 둔 테마와 App.tsx 의 ThemeEffects 가 uiScale·큰 터치 타깃
// 부작용을 이미 처리하므로(§4.6/§7.4), 이 화면은 prefs 를 쓰기만 하면 된다 — 별도로
// document.documentElement 를 건드리지 않는다.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSettings } from '../../store/settings/SettingsProvider.tsx';
import { useLibrary } from '../../store/library/LibraryProvider.tsx';
import { loadPrefs } from '../../storage/prefs.ts';
import { Modal } from '../../ui/Modal.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { bumperKmhMax, prunePhysics } from '../../storage/prefs.ts';
import { INTERACT } from '../../core/constants.ts';
import { TEAM_COLOR_CHOICES, TEAM_COLOR_NAMES, inkFor } from '../../core/colors.ts';
import { RosterSection } from './RosterSection.tsx';
import { SyncSection } from './SyncSection.tsx';
import { FORMATIONS } from '../../model/defaults.ts';
import { COURT_MODES, COURT_MODE_SHORT_LABELS, type CourtMode } from '../../model/court.ts';
import { Segmented } from '../../ui/Segmented.tsx';
import { Toggle } from '../../ui/Toggle.tsx';
import { Button } from '../../ui/Button.tsx';
import { IconCheck } from '../../ui/icons.tsx';
import { backupReportLine, restoreBackupFromFile } from './dataExport.ts';
import { collectBackup, exportBackupFile } from '../../storage/transfer.ts';
import { downloadBlob } from '../../storage/files.ts';
import { backupFileName } from '../export/exportNames.ts';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { storageErrorText } from '../../i18n/storageError.ts';
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '../../i18n/locale.ts';
import { HelpCenter } from '../../ui/help/HelpCenter.tsx';
import { usePublishHelpShow } from '../../ui/help/HelpTriggerProvider.tsx';

// ⚠️ 2026-08-14 7차 검증 — 여기 있던 로컬 `COLOR_NAMES` 를 지우고 `core/colors.ts` 의
// `TEAM_COLOR_NAMES` 를 쓴다. 두 벌이던 시절의 함정: 로컬 맵은 `Record<string, string>` 이라
// **어떤 색이 빠져도 tsc 가 아무 말을 안 했다.** 반면 `TEAM_COLOR_NAMES` 의 키는
// `(typeof TEAM_COLOR_CHOICES)[number]` 유니언이라 선택지에 색을 하나 추가하면 tsc 가 이름을
// **먼저 요구한다.** 즉 옛 구조에서는 색을 추가하는 순간 팔레트·개체 라벨은 새 이름을 얻는데
// 설정 화면의 스와치만 조용히 `#c8102e` 를 낱글자로 읽는 상태가 됐다(값이 같아 눈으로는
// 안 보이고, 5차·6차 라운드에서 두 번 보고됐지만 "내 소유가 아니라" 는 이유로 남아 있었다).
// 되돌리면 SettingsScreen.colorName.test.tsx 의 '단일 출처' it 이 빨간불이 된다.

export function SettingsScreen() {
  const { prefs, physics, persistFailed, setPrefs } = useSettings();
  const { refresh } = useLibrary();
  const toast = useToast();
  const t = useT();
  const locale = useLocale();
  // §0.5 Phase 5 — 설정 화면에는 튜토리얼이 없다(TutorialScreenKey 밖) 그래도 레일 [도움말]
  // 은 "설정·데이터" 참고 섹션을 열어 준다.
  const [helpOpen, setHelpOpen] = useState(false);
  const showHelp = useCallback(() => setHelpOpen(true), []);
  usePublishHelpShow(showHelp);

  // ── §6.1b 기기 이사 파일 읽기 ────────────────────────────────────────────────────────────
  // 고른 파일을 곧바로 복원하지 않는다. 복원은 남의 기기 내용을 이 기기에 섞는 일이고, 그중
  // **설정 복원은 되돌릴 수 없는 접근성 사고**가 될 수 있어서(largeTargets·uiScale 이 말없이
  // 바뀐다) 반드시 한 번 묻는다. 그 물음이 곧 체크박스 하나짜리 모달이다.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [withPrefs, setWithPrefs] = useState(false);
  // 5.0 ②b(2026-08-13) — 편집 중인 자유 전술판을 백업에서 되살리는 **유일한 길**. 기본 'auto' 는
  // pristine 이 아닌 로컬 판을 절대 덮지 않으므로(storage/transfer.ts restoreBoardFrom),
  // 이 체크박스가 없으면 board:'replace' 를 여는 UI 가 0곳이라 회피책([코트 비우기] 후 재시도)을
  // 아는 사람만 복원할 수 있었다. 파괴적 동작이라 기본값은 반드시 꺼짐 — withPrefs 와 같은 규율.
  const [withBoard, setWithBoard] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // 복원이 명단을 되살려도(report.roster === 'restored') RosterSection 은 마운트 시 1회만
  // loadRoster 를 한다 — 그대로 두면 화면은 복원 전 명단을 계속 보여주고, 그 상태에서 선수
  // 하나만 고쳐도 saveRoster(문서 통째 저장)가 stale 명단으로 방금 복원한 명단을 덮는다.
  // key 를 바꿔 강제 재마운트시키는 것이 가장 단순한 재적재다 — prefs 재적재(위 setPrefs
  // (loadPrefs()))와 같은 문제, 같은 해법이다.
  const [rosterReloadToken, setRosterReloadToken] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const restoreBtnRef = useRef<HTMLButtonElement | null>(null);
  const restoreDialogId = useId();

  // ── 6.1 물리 6종은 닫힌 서랍 ────────────────────────────────────────────────────────────
  // 물리 슬라이더는 대부분의 코치가 평생 안 만지는 값인데 펼쳐져 있으면 정말 필요한 접근성
  // 설정을 화면 아래로 밀어낸다. 그래서 기본 **닫힘**이다. prefs 필드가 아니라 지역 상태인
  // 이유: 개폐는 기기 따라다닐 취향이 아니고, 규칙 8(validatePrefs 화이트리스트) 대상만 는다.
  // ⚠️ 닫혀 있어도 저장된 오버라이드는 resolvePhysics(§5.11)를 그대로 지난다 — "안 보이면
  // 기본값으로 돌아간다" 가 되는 순간 재앙이다. SettingsScreen.test.tsx '서랍이 닫혀 있어도
  // 저장값은 살아 있다' 가 그 가드다.
  const [physicsOpen, setPhysicsOpen] = useState(false);
  const physicsDrawerId = useId();

  // savePrefs 가 처음 실패한 순간(Safari 프라이빗 모드 등)에만 1회 안내한다(§4.6).
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (persistFailed && !notifiedRef.current) {
      notifiedRef.current = true;
      toast.show(t('settings.data.persistFailedToast'));
    }
  }, [persistFailed, toast, t]);

  const patchZone = (key: 'sTowRearMax' | 'sSpinMin' | 'sTowFrontMin', value: number) => {
    const zones = { ...(prefs.physics.zones ?? {}), [key]: value };
    setPrefs({ physics: prunePhysics({ ...prefs.physics, zones }) });
  };
  const patchSpeed = (key: 'linearKmh' | 'bumperKmh' | 'editorSpeedMultiplier', value: number) => {
    setPrefs({ physics: prunePhysics({ ...prefs.physics, [key]: value }) });
  };
  // speedLimit 은 슬라이더 6종과 다른 층이다(편집 화면 FunctionBar 의 속도 제한 해제 토글) —
  // 이 서랍이 안 보여 주는 값까지 되돌리면 편집 중 속도 제한을 꺼둔 코치가 여기서 슬라이더만
  // 되돌려도 제한이 말없이 다시 켜진다. 현재값을 그대로 들고 가 prunePhysics 로 접는다.
  const restorePhysicsDefaults = () => setPrefs({ physics: prunePhysics({ speedLimit: physics.speedLimit }) });

  const runRestore = async () => {
    const file = pendingFile;
    if (!file || restoring) return;
    setRestoring(true);
    try {
      const report = await restoreBackupFromFile(file, { prefs: withPrefs ? 'replace' : 'skip', board: withBoard ? 'replace' : 'auto' }, locale);
      // ★ 목록을 다시 읽는다. LibraryProvider 는 앱 최상단에서 한 번만 로드하므로(App.tsx),
      //   빼면 IDB 에는 들어왔는데 목록에는 새로고침 전까지 안 뜬다 = "복원이 안 된 것" 으로 보인다.
      await refresh();
      // ★ 설정을 덮었다면 React 상태도 저장소에서 다시 읽어야 한다. 안 그러면 화면은 옛 값을
      //   보여주고, 그 상태에서 스위치 하나만 건드려도 **방금 복원한 설정이 통째로 되돌아간다**
      //   (setPrefs 가 화면의 옛 prefs 위에 패치를 얹어 저장하기 때문).
      if (report.prefs === 'restored') setPrefs(loadPrefs());
      if (report.roster === 'restored') setRosterReloadToken((n) => n + 1);
      toast.show(backupReportLine(report, locale));
    } catch (e) {
      toast.show(storageErrorText(e, locale, t('settings.data.readErrorFallback')));
    } finally {
      setRestoring(false);
      setPendingFile(null);
      setWithPrefs(false);
      setWithBoard(false);
    }
  };

  // ── 데이터 내보내기(2026-08-20 기현님 지시) ─────────────────────────────────────────────
  // 드릴 편집의 [내보내기] 시트에 있던 [기기 이사 파일 (JSON)] 항목을 이리 옮겼다 — 근거는
  // 아래 [데이터] Section 의 머리말 주석. exportingRef 는 ExportSheet.exportBackup 이 쓰던
  // busyRef 와 같은 이유(래스터·직렬화가 수백 ms 걸려 연타하면 파일이 두 벌 떨어진다).
  const exportingRef = useRef(false);
  const runExport = async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    try {
      const payload = await collectBackup();
      downloadBlob(exportBackupFile(payload), backupFileName(Date.now()));
      toast.show(t('settings.data.exportSaved', { drills: payload.drills.length, sessions: payload.sessions.length }));
    } catch (e) {
      toast.show(storageErrorText(e, locale, t('settings.data.exportFailed')));
    } finally {
      exportingRef.current = false;
    }
  };

  return (
    <main id="main" tabIndex={-1} style={{ flex: 1, overflowY: 'auto', outline: 'none', padding: '26px 30px 46px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Section title={t('settings.language.title')}>
          <Row title={t('settings.language.rowTitle')} desc={t('settings.language.desc')}>
            <Segmented
              ariaLabel={t('settings.language.title')}
              value={prefs.language}
              onChange={(v) => setPrefs({ language: v })}
              options={[
                { value: 'auto', label: t('settings.language.auto') },
                ...SUPPORTED_LOCALES.map((loc) => ({ value: loc, label: LOCALE_NAMES[loc] })),
              ]}
            />
          </Row>
        </Section>
        <Section title={t('settings.screen.title')}>
          <Row title={t('settings.screen.themeTitle')} desc={t('settings.screen.themeDesc')}>
            <Segmented
              ariaLabel={t('settings.screen.themeTitle')}
              value={prefs.theme}
              onChange={(v) => setPrefs({ theme: v })}
              options={[
                { value: 'dark', label: t('settings.screen.themeDark') },
                { value: 'light', label: t('settings.screen.themeLight') },
              ]}
            />
          </Row>
          <Row title={t('settings.screen.gridTitle')} desc={t('settings.screen.gridDesc')}>
            <Toggle checked={prefs.showGrid} onChange={(v) => setPrefs({ showGrid: v })} ariaLabel={t('settings.screen.gridTitle')} />
          </Row>
          <Row title={t('settings.screen.gridLabelsTitle')} desc={t('settings.screen.gridLabelsDesc')}>
            <Toggle checked={prefs.showGridLabels} onChange={(v) => setPrefs({ showGridLabels: v })} ariaLabel={t('settings.screen.gridLabelsTitle')} />
          </Row>
          <Row title={t('settings.screen.ruleZonesTitle')} desc={t('settings.screen.ruleZonesDesc')}>
            <Toggle checked={prefs.showRuleZones} onChange={(v) => setPrefs({ showRuleZones: v })} ariaLabel={t('settings.screen.ruleZonesTitle')} />
          </Row>
          <Row title={t('settings.screen.uiScaleTitle')} desc={t('settings.screen.uiScaleDesc')} borderBottom={false}>
            <Segmented
              ariaLabel={t('settings.screen.uiScaleTitle')}
              value={String(prefs.a11y.uiScale) as '1' | '1.15' | '1.3'}
              onChange={(v) => setPrefs({ a11y: { ...prefs.a11y, uiScale: Number(v) as 1 | 1.15 | 1.3 } })}
              options={[
                { value: '1', label: '100%' },
                { value: '1.15', label: '115%' },
                { value: '1.3', label: '130%' },
              ]}
            />
          </Row>
        </Section>

        <Section title={t('settings.playback.title')}>
          <Row title={t('settings.playback.speedTitle')} desc={t('settings.playback.speedDesc')}>
            <Segmented
              ariaLabel={t('settings.playback.speedTitle')}
              value={String(prefs.playbackSpeed) as '0.5' | '1' | '2'}
              onChange={(v) => setPrefs({ playbackSpeed: Number(v) as 0.5 | 1 | 2 })}
              options={[
                { value: '0.5', label: '0.5×' },
                { value: '1', label: '1.0×' },
                { value: '2', label: '2.0×' },
              ]}
            />
          </Row>
          <Row title={t('settings.playback.loopTitle')} desc={t('settings.playback.loopDesc')} borderBottom={false}>
            <Toggle checked={prefs.loop} onChange={(v) => setPrefs({ loop: v })} ariaLabel={t('settings.playback.loopTitle')} />
          </Row>
        </Section>

        <Section title={t('settings.team.title')}>
          <Row title={t('settings.team.homeColorTitle')} desc={t('settings.team.homeColorDesc')}>
            <TeamColorSwatches ariaLabel={t('settings.team.homeColorTitle')} value={prefs.teams.home.color} otherValue={prefs.teams.away.color} onChange={(c) => setPrefs({ teams: { ...prefs.teams, home: { ...prefs.teams.home, color: c } } })} />
          </Row>
          <Row title={t('settings.team.awayColorTitle')} desc={t('settings.team.awayColorDesc')}>
            <TeamColorSwatches ariaLabel={t('settings.team.awayColorTitle')} value={prefs.teams.away.color} otherValue={prefs.teams.home.color} onChange={(c) => setPrefs({ teams: { ...prefs.teams, away: { ...prefs.teams.away, color: c } } })} />
          </Row>
          <Row title={t('settings.team.formationTitle')} desc={t('settings.team.formationDesc')}>
            <Segmented
              ariaLabel={t('settings.team.formationTitle')}
              value={prefs.defaultFormation}
              onChange={(v) => setPrefs({ defaultFormation: v })}
              options={FORMATIONS.map((f) => ({ value: f, label: f }))}
            />
          </Row>
          {/* ⚠️ 2026-08-13(6차 검증) 정정, 2026-08-21(설정 화면 감사) 재정정. 옛 문구는 *"새
              드릴을 만들 때 코트 선택 화면에서 미리 강조 표시됩니다(선택은 매번 확인)"* 였는데
              **두 조각 다 거짓**이었다:
                ① '코트 선택 화면'(CourtPicker)은 2026-08-09 재편에서 은퇴했다
                   (BoardScreen.tsx:28 · EditorScreen.tsx:4 가 그 은퇴를 기록한다).
                ② '새 드릴' 과도 무관하다 — 이 값의 **유일한** 프로덕션 소비처는
                   BoardScreen.tsx:37 `mode ?? prefs.defaultCourtMode ?? 'full'`, 즉 전술판이
                   뜰 때의 코트다(rg 실측: 설정 화면 자신 말고는 그 한 줄뿐).
              6차 검증은 문구를 사실로 고쳤지만 '항상 묻기'(=null) 선택지는 남겨 뒀다 — 그런데
              그 선택지도 **아무것도 묻지 않는다**, 위 `?? 'full'` 이 조용히 풀 코트로 접을
              뿐이다. 이름 붙은 동작이 실재하지 않는 선택지를 보여주는 것 자체가 거짓이라
              이번에 지운다. 저장 모델의 null(=미설정)은 그대로 둔다 — 이 화면에서 더는 만들
              수 없을 뿐, 옛 저장본·최초 실행 기본값은 여전히 null 이고 BoardScreen 이 여전히
              'full' 로 접는다. 되돌리면 settingsDescTruth.test.tsx 가 빨개진다. */}
          <Row title={t('settings.team.courtModeTitle')} desc={t('settings.team.courtModeDesc')} borderBottom={false}>
            <Segmented
              ariaLabel={t('settings.team.courtModeTitle')}
              value={prefs.defaultCourtMode ?? 'full'}
              onChange={(v) => setPrefs({ defaultCourtMode: v as CourtMode })}
              options={COURT_MODES.map((m) => ({ value: m, label: COURT_MODE_SHORT_LABELS[locale][m] }))}
            />
          </Row>
        </Section>

        <Section title={t('settings.roster.sectionTitle')} desc={t('settings.roster.sectionDesc')}>
          <RosterSection key={rosterReloadToken} />
        </Section>

        <Section title={t('settings.present.title')}>
          <Row title={t('settings.present.wakeLockTitle')} desc={t('settings.present.wakeLockDesc')}>
            <Toggle
              checked={prefs.present.wakeLock}
              onChange={(v) => setPrefs({ present: { ...prefs.present, wakeLock: v } })}
              ariaLabel={t('settings.present.wakeLockTitle')}
            />
          </Row>
          <Row title={t('settings.present.autoFullscreenTitle')} desc={t('settings.present.autoFullscreenDesc')} borderBottom={false}>
            <Toggle
              checked={prefs.present.autoFullscreen}
              onChange={(v) => setPrefs({ present: { ...prefs.present, autoFullscreen: v } })}
              ariaLabel={t('settings.present.autoFullscreenTitle')}
            />
          </Row>
        </Section>

        {/* 6.2 — 2.11(소리·햅틱)·5.5(2존)·5.6(고대비)이 각자 다른 차수에 붙으며 흩어진 것을
            한 섹션으로 정렬한다. 배열 순서는 "판을 만지는 손(타깃·2존) → 손끝·귀(소리·진동) →
            눈(고대비·모션) → 키보드(단축키)". 각 설명문은 코드를 따라가 실측한 사실만 말한다 —
            a11yAlignment.test.tsx 가 문장마다 실제 동작(INTERACT 상수·applyTwoZone·cueSpec·
            stepTransitionMs·contrast.css)을 짝지어 못박는다. */}
        <Section title={t('settings.a11y.title')}>
          {/* 44→56 을 리터럴로 적지 않는다 — INTERACT 상수가 바뀌면 설명문이 거짓이 되는 자리라
              숫자를 상수에서 직접 읽는다(tokens.css --hit 44/56px 와의 일치는 계약 테스트가 잰다). */}
          <Row
            title={t('settings.a11y.largeTargetsTitle')}
            desc={t('settings.a11y.largeTargetsDesc', { small: INTERACT.hitTargetCssPx, large: INTERACT.hitTargetLargeCssPx })}
          >
            <Toggle checked={prefs.a11y.largeTargets} onChange={(v) => setPrefs({ a11y: { ...prefs.a11y, largeTargets: v } })} ariaLabel={t('settings.a11y.largeTargetsTitle')} />
          </Row>
          {/* §9 결정 ④ · 5.5 — 기본 OFF. 자동(배율) 게이트를 쓰지 않는 이유는
              physics/hitTest.ts 의 handlesVisible 머리말에 실측 배율 분포와 함께 적어 뒀다.
              설명문의 두 문장 = applyTwoZone(차체→translate) + zoneHandle 은 안 덮음, 그대로다. */}
          <Row title={t('settings.a11y.twoZoneTitle')} desc={t('settings.a11y.twoZoneDesc')}>
            <Toggle checked={prefs.a11y.twoZone} onChange={(v) => setPrefs({ a11y: { ...prefs.a11y, twoZone: v } })} ariaLabel={t('settings.a11y.twoZoneTitle')} />
          </Row>
          {/* 세 사건(놓기·막힘·트레이 복귀)은 cueSpec 의 CueKind 전부와 1:1 이다 — 사건을
              더하거나 빼면 이 문장도 같은 커밋에서 고쳐라(a11yAlignment.test.tsx 가 잰다). */}
          <Row title={t('settings.a11y.soundTitle')} desc={t('settings.a11y.soundDesc')}>
            <Toggle checked={prefs.a11y.sound} onChange={(v) => setPrefs({ a11y: { ...prefs.a11y, sound: v } })} ariaLabel={t('settings.a11y.soundTitle')} />
          </Row>
          {/* 5.6 고대비는 **스위치가 없다** — prefers-contrast/forced-colors 미디어쿼리
              (styles/contrast.css, 소유는 6.5·6.6)가 기기 설정을 자동으로 따르기 때문이다.
              앱 안에 별도 토글을 만들면 시스템 설정과 싸우는 두 번째 스위치가 된다. 그래도
              행이 있는 이유: 저시력 사용자가 "이 앱은 고대비를 아느냐" 를 설정 화면에서 찾기
              때문이다 — 없으면 지원하면서도 지원 안 하는 앱으로 보인다. */}
          <Row title={t('settings.a11y.contrastTitle')} desc={t('settings.a11y.contrastDesc')}>
            <span style={{ flex: 'none', fontSize: '0.75rem', fontWeight: 600, color: 'var(--faint-text)' }}>{t('settings.a11y.systemFollow')}</span>
          </Row>
          {/* '줄입니다' 가 아니라 '끕니다' — 실효값이 켜지면 stepTransitionMs 가 0 을 돌려줘
              (store/editor/tween.ts) 트윈·페이드가 생기지도 않는다. 옛 문구는 절반만 사실이었다. */}
          <Row title={t('settings.a11y.reduceMotionTitle')} desc={t('settings.a11y.reduceMotionDesc')}>
            <Segmented
              ariaLabel={t('settings.a11y.reduceMotionTitle')}
              value={prefs.a11y.reduceMotion}
              onChange={(v) => setPrefs({ a11y: { ...prefs.a11y, reduceMotion: v } })}
              options={[
                { value: 'system', label: t('settings.a11y.systemFollow') },
                { value: 'always', label: t('settings.a11y.reduceMotionAlways') },
              ]}
            />
          </Row>
          <Row title={t('settings.a11y.shortcutsTitle')} desc={t('settings.a11y.shortcutsDesc')} borderBottom={false}>
            <Segmented
              ariaLabel={t('settings.a11y.shortcutsTitle')}
              value={prefs.a11y.singleKeyShortcuts}
              onChange={(v) => setPrefs({ a11y: { ...prefs.a11y, singleKeyShortcuts: v } })}
              options={[
                { value: 'on', label: t('settings.a11y.shortcutsSingle') },
                { value: 'modifier', label: t('settings.a11y.shortcutsModifier') },
                { value: 'off', label: t('settings.a11y.shortcutsOff') },
              ]}
            />
          </Row>
        </Section>

        {/* 6.1 — 슬라이더 6종 + [기본값으로 복원]은 physicsOpen 일 때만 DOM 에 있다.
            ⚠️ 저장값·클램프는 이 서랍과 무관하다: patchZone/patchSpeed 는 prefs.physics 에
            쓰기만 하고, 읽는 쪽(resolvePhysics, prefs.ts)은 화면이 닫혀 있든 아예 안 열렸든
            같은 값을 받는다 — 6.1 완료 판정이 "prefs.ts 는 한 줄도 안 바뀐다" 인 이유다. */}
        <Section title={t('settings.physics.title')} desc={t('settings.physics.desc')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 0', borderBottom: physicsOpen ? '1px solid var(--border)' : undefined, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px', minWidth: 180 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 650 }}>{t('settings.physics.advancedTitle')}</div>
              <div style={{ fontSize: '0.71875rem', color: 'var(--faint-text)', marginTop: 2 }}>{t('settings.physics.advancedDesc')}</div>
            </div>
            {/* 이름은 '세부 조정' 으로 고정하고 상태는 aria-expanded 로만 말한다(disclosure 패턴) —
                이름이 '펼치기/접기' 로 바뀌면 스크린리더 사용자가 같은 버튼을 두 개로 배운다. */}
            <Button variant="secondary" aria-expanded={physicsOpen} aria-controls={physicsDrawerId} onClick={() => setPhysicsOpen((o) => !o)}>
              {t('settings.physics.expandButton')}
              <span aria-hidden style={{ fontSize: '0.625rem' }}>
                {physicsOpen ? '▲' : '▼'}
              </span>
            </Button>
          </div>
          {physicsOpen && (
            <div id={physicsDrawerId} style={{ display: 'flex', flexDirection: 'column' }}>
              <SliderRow
                label={t('settings.physics.towRearTitle')}
                desc={t('settings.physics.towRearDesc')}
                ariaLabel={t('settings.physics.towRearTitle')}
                value={physics.zones.sTowRearMax}
                min={0}
                max={0.18}
                step={0.01}
                format={(v) => v.toFixed(2)}
                onChange={(v) => patchZone('sTowRearMax', v)}
              />
              <SliderRow
                label={t('settings.physics.spinTitle')}
                desc={t('settings.physics.spinDesc')}
                ariaLabel={t('settings.physics.spinTitle')}
                value={physics.zones.sSpinMin}
                min={0.22}
                max={0.45}
                step={0.01}
                format={(v) => v.toFixed(2)}
                onChange={(v) => patchZone('sSpinMin', v)}
              />
              <SliderRow
                label={t('settings.physics.towFrontTitle')}
                desc={t('settings.physics.towFrontDesc')}
                ariaLabel={t('settings.physics.towFrontTitle')}
                value={physics.zones.sTowFrontMin}
                min={0.6}
                max={1}
                step={0.01}
                format={(v) => v.toFixed(2)}
                onChange={(v) => patchZone('sTowFrontMin', v)}
              />
              <SliderRow
                label={t('settings.physics.linearSpeedTitle')}
                desc={t('settings.physics.linearSpeedDesc')}
                ariaLabel={t('settings.physics.linearSpeedTitle')}
                value={physics.linearKmh}
                min={4}
                max={16}
                step={0.5}
                format={(v) => `${v.toFixed(1)} km/h`}
                onChange={(v) => patchSpeed('linearKmh', v)}
              />
              <SliderRow
                label={t('settings.physics.bumperSpeedTitle')}
                desc={t('settings.physics.bumperSpeedDesc')}
                ariaLabel={t('settings.physics.bumperSpeedAria')}
                value={physics.bumperKmh}
                min={10}
                max={bumperKmhMax(physics.linearKmh)}
                step={1}
                format={(v) => `${Math.round(v)} km/h`}
                onChange={(v) => patchSpeed('bumperKmh', v)}
              />
              <SliderRow
                label={t('settings.physics.editorSpeedTitle')}
                desc={t('settings.physics.editorSpeedDesc')}
                ariaLabel={t('settings.physics.editorSpeedTitle')}
                value={physics.editorSpeedMultiplier}
                min={1}
                max={4}
                step={0.5}
                format={(v) => t('settings.physics.multiplierFormat', { v: v.toFixed(1) })}
                onChange={(v) => patchSpeed('editorSpeedMultiplier', v)}
                borderBottom={false}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, marginTop: 4, borderTop: '1px solid var(--border)' }}>
                <Button variant="secondary" onClick={restorePhysicsDefaults}>
                  {t('settings.physics.restoreDefaults')}
                </Button>
              </div>
            </div>
          )}
        </Section>

        {/* 옛 기록(지우지 않는다, 2026-08-12 4.7): *"내보내기는 여기 없다. [보드] 하단
            [내보내기] 하나로 모았다 — 옛 '드릴 내보내기'는 목록 화면에도 같은 버튼이 있던
            중복이었고, 담기는 것이 드릴뿐이라 세션·설정·전술판이 어떤 파일에도 안 들어가는
            거짓 백업이었다. 남은 것은 그 파일을 다시 여는 길이다."*
            ⚠️ 2026-08-20 (기현님 지시 — "드릴 편집에서 json 내보내기 삭제하고 설정 밑 부분에
            데이터 내보내기로 넣기") — **그 결정을 다시 뒤집는다.** 4.7 이 지목한 문제(거짓
            백업)는 이미 안 겹친다: 여기 내보내기는 드릴 편집의 [내보내기]가 만들던 것과
            **같은 backup 봉투**(collectBackup/exportBackupFile, storage/transfer.ts) —
            드릴·세션·설정·전술판을 전부 담는다. [설정] 화면에 가져오기·내보내기가 짝으로
            서 있는 편이 "내 데이터를 여기서 다룬다" 는 심성 모형에 맞다는 것이 이번 지시의
            요지다. */}
        <Section title={t('settings.data.title')}>
          <Row title={t('settings.data.importTitle')} desc={t('settings.data.importDesc')}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = ''; // 같은 파일을 다시 골라도 change 가 오게 한다
                if (f) setPendingFile(f);
              }}
            />
            <Button ref={restoreBtnRef} variant="secondary" onClick={() => fileInputRef.current?.click()}>
              {t('settings.data.chooseFile')}
            </Button>
          </Row>
          <Row title={t('settings.data.exportTitle')} desc={t('settings.data.exportDesc')} borderBottom={false}>
            <Button variant="secondary" onClick={() => void runExport()}>
              {t('settings.data.exportButton')}
            </Button>
          </Row>
        </Section>

        {/* 0.6 — 기기 이사 파일(위 [데이터]) 바로 아래가 자리다: 같은 "내 데이터를 밖으로" 축이되,
            저쪽은 손으로 한 번, 이쪽은 자동으로 계속. 자세한 상태·동의 흐름은 SyncSection 몫. */}
        <Section title={t('settings.sync.sectionTitle')} desc={t('settings.sync.sectionDesc')}>
          <SyncSection />
        </Section>

        {/* §0.5 Phase 6(계획서 §C) — [튜토리얼 다시 보기] = tutorialsSeen 플래그 전체 삭제.
            화면별로 하나씩 지우는 길은 HelpCenter 의 [이 화면 투어 다시 보기]가 이미 맡고
            있다 — 여기는 "전부 처음부터" 한 번에 끄는 자리다. */}
        <Section title={t('settings.tutorial.title')}>
          <Row title={t('settings.tutorial.resetTitle')} desc={t('settings.tutorial.resetDesc')} borderBottom={false}>
            <Button
              variant="secondary"
              onClick={() => {
                setPrefs({ tutorialsSeen: {} });
                toast.show(t('settings.tutorial.resetToast'));
              }}
            >
              {t('settings.tutorial.resetButton')}
            </Button>
          </Row>
        </Section>

        <div style={{ textAlign: 'center', fontSize: '0.71875rem', color: 'var(--faint-text)', paddingTop: 4, lineHeight: 1.6 }}>
          {/* 이 줄은 번역하지 않는다 — "SPIN" 이라는 두문자어 자체를 풀어 쓴 영문 태그라인이다. */}
          SPIN · Strategy Planner for INclusive football
        </div>
      </div>

      <Modal
        open={pendingFile !== null}
        onClose={() => {
          setPendingFile(null);
          setWithPrefs(false);
          setWithBoard(false);
        }}
        titleId={restoreDialogId}
        title={t('settings.restoreModal.title')}
        closeLabel={t('common.close')}
        returnFocusRef={restoreBtnRef}
      >
        <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          <strong>{pendingFile?.name}</strong>
          <br />
          {t('settings.restoreModal.copyNotice')}
        </p>
        {/* ⚠️ 기본값은 **꺼짐**이다(storage/transfer.ts RestoreBackupOptions 의 근거). 백업 파일은
            드릴을 얻으려고 남에게서 받는 경우가 기기 이사만큼 흔한데, 그때 설정을 통째로 덮으면
            큰 표적·UI 배율·단일키 단축키가 말없이 바뀐다 — 이 앱 주 사용자에게는 접근성 사고다.
            그래서 그 사실을 체크박스 옆 문구로 **화면에 드러낸다**(4.1 이 4.7 에 넘긴 요구). */}
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={withPrefs}
            onChange={(e) => setWithPrefs(e.target.checked)}
            style={{ marginTop: 3, width: 18, height: 18, flex: 'none' }}
          />
          <span style={{ fontSize: '0.78125rem', lineHeight: 1.6 }}>
            {t('settings.restoreModal.withPrefsLabel')}
            <span style={{ display: 'block', color: 'var(--faint-text)', fontSize: '0.71875rem' }}>{t('settings.restoreModal.withPrefsHint')}</span>
          </span>
        </label>
        {/* ⚠️ 5.0 ②b — 기본값 **꺼짐**. 켜면 편집 중인 자유 전술판까지 백업 속 판으로 덮는다 —
            그 판은 목록에 뜨지 않고 되돌릴 수도 없는 단 한 장이라(board.ts), 파괴적 동작을
            기본으로 켤 수 없다. 끈 채로 읽으면 'auto': 로컬 판이 기본 배치 그대로일 때만 복원. */}
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={withBoard}
            onChange={(e) => setWithBoard(e.target.checked)}
            style={{ marginTop: 3, width: 18, height: 18, flex: 'none' }}
          />
          <span style={{ fontSize: '0.78125rem', lineHeight: 1.6 }}>
            {t('settings.restoreModal.withBoardLabel')}
            <span style={{ display: 'block', color: 'var(--faint-text)', fontSize: '0.71875rem' }}>{t('settings.restoreModal.withBoardHint')}</span>
          </span>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button
            variant="secondary"
            onClick={() => {
              setPendingFile(null);
              setWithPrefs(false);
              setWithBoard(false);
            }}
          >
            {t('settings.restoreModal.cancel')}
          </Button>
          <Button variant="primary" aria-disabled={restoring} onClick={() => void runRestore()}>
            {restoring ? t('settings.restoreModal.reading') : t('settings.restoreModal.read')}
          </Button>
        </div>
      </Modal>

      <HelpCenter open={helpOpen} onClose={() => setHelpOpen(false)} initialSection="settings" onRestartTutorial={() => {}} />
    </main>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 15, background: 'var(--panel)', overflow: 'hidden' }}>
      <div style={{ padding: '15px 18px 13px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.84375rem', fontWeight: 700 }}>{title}</div>
        {desc && <div style={{ fontSize: '0.71875rem', color: 'var(--faint-text)', marginTop: 4, lineHeight: 1.5 }}>{desc}</div>}
      </div>
      <div style={{ padding: '6px 18px 16px', display: 'flex', flexDirection: 'column' }}>{children}</div>
    </section>
  );
}

function Row({ title, desc, children, borderBottom = true }: { title: string; desc?: string; children: ReactNode; borderBottom?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 0', borderBottom: borderBottom ? '1px solid var(--border)' : undefined, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 220px', minWidth: 180 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 650 }}>{title}</div>
        {desc && <div style={{ fontSize: '0.71875rem', color: 'var(--faint-text)', marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

interface SliderRowProps {
  label: string;
  desc?: string;
  ariaLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  borderBottom?: boolean;
}

function SliderRow({ label, desc, ariaLabel, value, min, max, step, format, onChange, borderBottom = true }: SliderRowProps) {
  return (
    <Row title={label} desc={desc} borderBottom={borderBottom}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 220px', minWidth: 200 }}>
        <input
          type="range"
          aria-label={ariaLabel}
          aria-valuetext={format(value)}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, height: 'var(--hit)', accentColor: 'var(--accent)' }}
        />
        <span
          style={{
            flex: 'none',
            width: 76,
            textAlign: 'right',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.75rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {format(value)}
        </span>
      </div>
    </Row>
  );
}

interface TeamColorSwatchesProps {
  ariaLabel: string;
  value: string;
  otherValue: string;
  onChange: (c: string) => void;
}

/** §7.7 "팀 색 스와치 role=radio aria-checked... 선택 표시는 링 + 안쪽 체크 마크" ·
 *  §7.8 "상대가 이미 쓰는 색은 aria-disabled 처리". */
function TeamColorSwatches({ ariaLabel, value, otherValue, onChange }: TeamColorSwatchesProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const toast = useToast();
  const t = useT();
  const locale = useLocale();
  const n = TEAM_COLOR_CHOICES.length;

  const moveFocus = (from: number, delta: number) => {
    let i = from;
    for (let step = 0; step < n; step++) {
      i = ((i + delta) % n + n) % n;
      if (TEAM_COLOR_CHOICES[i] !== otherValue) break;
    }
    refs.current[i]?.focus();
  };

  const pick = (c: string) => {
    if (c === otherValue) {
      toast.show(t('settings.team.colorConflictToast'));
      return;
    }
    onChange(c);
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} style={{ display: 'flex', gap: 7, flex: 'none' }}>
      {TEAM_COLOR_CHOICES.map((c, i) => {
        const active = c === value;
        const disabled = c === otherValue;
        return (
          <button
            key={c}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={disabled || undefined}
            aria-label={t('settings.team.colorSwatchAriaLabel', { name: TEAM_COLOR_NAMES[locale][c] })}
            tabIndex={active ? 0 : -1}
            onClick={() => pick(c)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                moveFocus(i, 1);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                moveFocus(i, -1);
              }
            }}
            style={{
              flex: 'none',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: disabled ? 0.4 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: c,
                border: active ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {active && <IconCheck size={14} style={{ color: inkFor(c) }} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

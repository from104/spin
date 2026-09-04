// §6.10/§7.5a 편집기 3영역 골격 — 이미 만들어진 드릴(EditorProvider 로 세팅 완료)을 실제로
// 그리는 조립부. `<nav aria-label="도구">` `<div role="application">`(CourtStage 가 직접 렌더)
// `<aside aria-label="드릴 속성">` 세 영역과 하단 트랜스포트로 프로토타입 236–400행 레이아웃을
// 그대로 이식한다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isId, newId } from '../../core/ids.ts';
import type { ChairId, NoteId, StepId } from '../../core/ids.ts';
import { COURT_DEFS, courtDefFor, DEFAULT_COURT_SIZE, type CourtMode, type CourtSize } from '../../model/court.ts';
import { BALL, CONE, INTERACT } from '../../core/constants.ts';
import { inkFor } from '../../core/colors.ts';
import { IconPlay, IconPlus } from '../../ui/icons.tsx';
import { PlaybackControls } from '../../ui/PlaybackControls.tsx';
import { defaultDefense } from '../../model/rules.ts';
import { LIMITS } from '../../model/validate.ts';
import { isStepEmpty } from '../../model/drill.ts';
import { useAutosave } from '../../app/useAutosave.ts';
import { useAppHeader } from '../../app/AppHeader.tsx';
import { useAppNav } from '../../app/useAppHistory.ts';
import { useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { selectStepIndex } from '../../store/editor/reducer.ts';
import { effectiveReduceMotion, stepTransitionMs } from '../../store/editor/tween.ts';
import { usePlaybackActions, usePlaybackState } from '../../store/playback/PlaybackProvider.tsx';
import { useSettingsActions, useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { cues } from '../../ui/cues.ts';
import { useIsPortrait } from '../../ui/useIsPortrait.ts';
import { useIsNarrow } from '../../ui/useIsNarrow.ts';
import { courtPadCss } from '../../app/chromeBudget.ts';
import { useStageRot } from '../../app/useStageRot.ts';
import type { CourtStageHandle } from '../../render/CourtStage.tsx';
import { createRuleOverlay } from '../../render/ruleOverlay.ts';
import { ToolRail, type ChairSlot } from './ToolRail.tsx';
import { courtCellAspectRatioCss } from './boardLayout.ts';
import { useTrayDrag } from './useTrayDrag.ts';
import { placeObject } from './placement.ts';
import { removalToast, returnsToTray } from './removal.ts';
import { canDuplicate } from './ObjectMenu.tsx';
import { nudgeArrow } from '../../model/arrow.ts';
import { nudgeStroke } from '../../model/stroke.ts';
import { PX_PER_M } from '../../core/units.ts';
import { TrayGhost } from './TrayGhost.tsx';
import { EditorStage } from './EditorStage.tsx';
import { StepSidebar } from './StepSidebar.tsx';
import { NotePanel } from './NotePanel.tsx';
import { FunctionBar } from './FunctionBar.tsx';
import { useContainerWidth } from './useContainerWidth.ts';
import { HelpCenter } from '../../ui/help/HelpCenter.tsx';
import { usePublishHelpShow } from '../../ui/help/HelpTriggerProvider.tsx';
import { useTutorial } from '../../ui/tutorial/useTutorial.ts';
import { TutorialOverlay } from '../../ui/tutorial/TutorialOverlay.tsx';
import { BOARD_TUTORIAL_STEPS, EDITOR_TUTORIAL_STEPS } from './tutorialSteps.ts';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { SCREEN_SUBTITLES, SCREEN_TITLES } from '../../app/screens.ts';
import { NoteEditModal } from './NoteEditModal.tsx';
import { NOTE_DEFAULT_SIZE_PX } from '../../render/objects/noteChip.ts';
import { useEditorKeyboard } from './useEditorKeyboard.ts';
import { useStepPlayback } from './useStepPlayback.ts';
import { usePhysicsRenderLoop } from './usePhysicsRenderLoop.ts';

/** 자유 전술판일 때만 내려오는 조작부. 판을 갈아끼우는 일(코트 전환·초기화)과 정식 드릴로의
 *  승격은 저장소를 만지므로 화면(screen-board) 책임이고, 여기서는 호출만 한다. */
export interface BoardControls {
  // ⚠️ `pristine` 은 은퇴했다(2026-08-28). 게이트가 저장본 기준선 대신 **판 자체**를 보게 되면서
  //    저장·재로딩을 건너 다닐 값이 없어졌다 — 아래 boardPristine 주석 참고.
  onCourtChange(mode: CourtMode): void;
  /** §6.4 코트 크기 3단. 코트 형태 전환과 **같은 문**(판이 비었는가)을 지난다 — 그래야 판 위에
   *  개체가 하나도 없을 때만 규격이 바뀌어 "코트를 줄였더니 선수가 밖에 서 있다" 가 없다. */
  onCourtSizeChange(size: CourtSize): void;
  // ⚠️ `onReset` 은 여기 없다(2026-08-28). [비우기]가 드릴 편집에도 생기면서 두 모드가 같은
  //    액션(STEP_CLEAR)을 쓰게 됐고, 구현이 이 파일 안(clearStep)으로 올라왔다.
  onSaveAsDrill(): void;
  /** Ctrl/⌘+S — 디바운스를 건너뛰고 스냅샷을 지금 저장한다(2026-08-15 보드 단축키 정리).
   *  드릴의 `autosave.flush()` 자리를 전술판에서 대신 채우는 것이다. */
  onSave(): void;
}

export interface EditorWorkspaceProps {
  /** 'board' = 대문의 자유 전술판(1장짜리·스텝 없음·자동저장 없음·코트 전환 가능),
   *  'drill' = 정식 드릴 편집(스텝·자동저장 있음·코트 불변). 판을 그리는 부분은 완전히 같다. */
  mode?: 'board' | 'drill';
  board?: BoardControls;
  /** C11(2026-08-19 기현님) — [드릴 정보] 모달 열기. 드릴 모드 전용이다. 콜백만 받고 모달
   *  자체는 EditorScreen 소유다 — 워크스페이스는 메타 편집을 모른다.
   *
   *  버튼 자리는 세 번 옮겼다: 스테이지 우상단 오버레이(판 조작과 겹쳐 은퇴) → 하단 노트 패널
   *  왼쪽 → 헤더 제목 옆 ⓘ(2026-08-20) → **오른쪽 기능 바**(2026-08-28 기현 지시). 마지막
   *  이사의 이유는 자리가 아니라 **아이콘**이다 — 헤더에서는 편집과 시연이 같은 ⓘ 하나를
   *  나눠 써서 눌러 보기 전에는 고칠 수 있는지 알 수 없었다. */
  onDrillInfo?(): void;
}

export function EditorWorkspace({ mode = 'drill', board, onDrillInfo }: EditorWorkspaceProps = {}) {
  const isBoard = mode === 'board';
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const worldRef = useEditorWorld();
  const writer = useEditorWriter();
  const { prefs, physics } = useSettingsState();
  const { setPrefs } = useSettingsActions();
  const nav = useAppNav();
  const toast = useToast();
  const t = useT();
  const locale = useLocale();
  // 전술판은 drillRepo 에 자동저장하지 않는다 — 목록에 뜨지 않는 임시 판이다(스냅샷 1장은
  // 화면 쪽이 storage/board.ts 로 따로 들고 있다). 훅 자체는 조건 없이 부른다(훅 규칙).
  const autosave = useAutosave(!isBoard);
  const { playing, speed, loop } = usePlaybackState();
  const playbackActions = usePlaybackActions();

  const drill = state.present;
  const stepIndex = selectStepIndex(state);
  // 사이드바에서 체크한 스텝의 **사본**. 원본은 StepSidebar 로컬이고(그 파일 머리말: 리듀서·
  // undo 에 넣지 않는다) 여기는 내보내기 시트에 넘겨 주기 위한 미러다 — 단방향이라 안전하다.
  const [checkedSteps, setCheckedSteps] = useState<ReadonlySet<StepId>>(new Set());
  const step = drill.steps[stepIndex] ?? drill.steps[0]!;

  const stageRef = useRef<CourtStageHandle | null>(null);
  const [pendingPlayerId, setPendingPlayerId] = useState<ChairId | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // §0.5 Phase 5 — 도움말 트리거가 이제 이 컴포넌트 밖(레일 AppRail·AppNavAside)에도 있다.
  // helpOpen 을 여는 함수를 HelpTriggerProvider 에 등록해 두면 레일 버튼이 "지금 이 화면"의
  // 도움말을 연다. 옛 "문이 둘이라 돌아갈 곳도 둘" 복잡함(helpTriggerRef/helpButtonRef)은
  // FunctionBar 자기 [도움말] 칸이 사라지며 함께 없어졌다 — CenterModal 의 openedBy 폴백
  // (열던 순간의 포커스로 돌아간다)이 레일 버튼 문·Shift+? 문 양쪽 다 이미 맞는 답이다.
  const showHelp = useCallback(() => setHelpOpen(true), []);
  usePublishHelpShow(showHelp);
  // 드릴 편집·자유 전술판 튜토리얼(Phase 2·3) — 화면 키가 다르므로(§0.5, 'editor'/'board')
  // tutorialsSeen 도 따로 찍힌다. 데이터는 이 컴포넌트가 그려질 때 이미 `state.present` 로
  // 와 있으므로(로딩 state 없음) 첫 렌더가 곧 "화면이 실제로 그려진 시점"이다.
  const tutorial = useTutorial(isBoard ? 'board' : 'editor', isBoard ? BOARD_TUTORIAL_STEPS : EDITOR_TUTORIAL_STEPS, true);
  /** 글을 고치는 중인 메모(기현 지시 2026-08-17). `fresh` 는 "방금 놓은 쪽지" 라는 뜻이고,
   *  그때만 취소가 쪽지를 도로 치운다 — 자세한 근거는 `NoteEditModal` 의 같은 이름 prop.
   *  무대(EditorStage)가 아니라 여기 있는 이유: 트레이 드래그 배치가 이 파일에 있어서,
   *  무대가 갖고 있으면 그 경로만 문이 안 열린다. */
  const [editingNote, setEditingNote] = useState<{ id: NoteId; fresh: boolean } | null>(null);
  // 세로 화면(§6.4 태블릿): 도구·속성을 아래로 내려 코트가 폭을 다 쓰게 한다.
  const portrait = useIsPortrait();
  // 좁은 창(§5.1): 크롬 예산을 줄인다. 여기서 걷어내는 것은 코트 래퍼 패딩 한 행이고,
  // 나머지 행(레일·헤더·하단 바·트레이)은 각자 담당 항목이 같은 boolean 으로 줄인다.
  const narrow = useIsNarrow();
  // ★ 트레이(칩·작도·메모)를 판의 어느 변에 붙일지 — **코트의 긴 변**이다(기현 지시 2026-08-14:
  //   *"코트 길이 긴쪽(세로가 길면 오른쪽, 가로가 길면 아래쪽) 사이드에 부착"*).
  //   실제 경기의 사이드라인 = 벤치가 서는 자리와 같은 은유다.
  //
  //   ⚠️ **2026-08-14 이전과 정반대다.** 옛 규칙은 "가로 화면이면 오른쪽, 세로면 아래" 였다.
  //   코트 셋(30×18 · 18×15 · 라인없음)은 viewBox 가 전부 **가로로 길다**. 그래서 판이 안 돌면
  //   (rot 0) 긴 변이 아래고, 세로 화면에서 판이 서면(rot 90) 긴 변이 오른쪽이다.
  //
  //   ⚠️ **rot 을 읽어서 정하지 않는다.** rot 은 크롬 예산(courtBoxPx)에서 나오고 그 예산은
  //   트레이가 어느 축을 먹는지를 입력으로 받는다 — 서로를 참조하면 P1 이 끊어 놓은 그
  //   쌍안정 고리가 되살아난다(useStageRot.ts 머리말). 창 방향에서 **한 번에** 정한다:
  //   창이 가로면 코트가 눕고(트레이는 아래 띠), 창이 세로면 코트가 선다(트레이는 오른쪽 기둥).
  //   둘은 rot 과 사실상 같은 답이면서 **입력이 창 크기뿐**이라 고리가 없다.
  const trayAxis = portrait ? ('row' as const) : ('column' as const);
  /** 트레이가 판 아래 **가로 띠**인가(= 높이를 먹는가). 예산표의 `trayBand` 행과 같은 뜻이다. */
  const trayBand = trayAxis === 'column';
  // ★ 인스펙터(결정 ③A) — **기본 접힘 오버레이**. 핀 취향만 prefs 에 남고 여닫힘은 로컬이다:
  //   여닫힘까지 저장하면 태블릿에서 열어 둔 채 앱을 닫은 사람이 다음에 PC 에서 판을 가린
  //   채로 만나게 된다. 대신 **핀을 켜 둔 사람은 열린 채로 시작한다** — 붙박이를 골라 놓고
  //   매번 다시 열어야 하면 핀이 아니다.
  const [workspaceRef] = useContainerWidth<HTMLElement>();
  // ⚠️ 2026-08-18 기현님 지시 — **인스펙터가 두 화면 모두에서 폐기됐다**(*"속성 버튼 및 그 안의
  // 내용 폐기"*). 2026-08-14 재설계가 전술판에서 해체한 것(*"속성 탭은 정말 무용지물이다 …
  // 대부분 삭제하는게 맞다"*)을 드릴 편집까지 넓힌 것이다: 드릴 제목은 헤더 인라인, 스텝
  // 조작은 왼쪽 사이드바, 코트 크기·골대 원위치는 기능 바가 이미 맡고 있었다. 판 회전
  // (useStageRot)에는 상수 'hidden' 이 간다 — 있지도 않은 패널 폭을 빼고 세면 안 된다.
  // ★ 표시 회전(§4.2, 2026-08-14 재설계) — **창 크기에서 정해 판으로 내려보낸다.**
  //
  // 무대가 자기 rect 를 재서 정하던 것을 뒤집었다. P3 가 코트 칸을 rot 에 맞춰 자기 종횡비로
  // 줄이면 "rect → rot → rect" 고리가 닫히는데, 그 고리는 **쌍안정**이라 0 과 90 이 둘 다
  // 자기모순 없이 안정하다 — 7인치 세로 456×592 에서 축척이 0.5527 이 되기도 0.7176 이 되기도
  // 하고(23% 차이) 창을 어떤 순서로 줄였는지에 따라 갈려 재현이 안 된다. 근거·숫자·회귀
  // 테스트는 app/useStageRot.ts 와 그 테스트에 있다.
  //
  // ⚠️ 여기 넘기는 것은 **측정값이 아니다**: narrow 는 matchMedia, 인스펙터 모드는 `<main>` 폭
  // (인스펙터가 어느 모드든 안 변한다 — useContainerWidth.ts 머리말)에서 온다. 코트 상자를
  // 재서 넣으면 되먹임이 되살아난다.
  //
  // ⚠️ 2026-08-14 P5 — `portrait` 를 **반드시 함께 넘겨야 한다.** 세로에서 트레이는 폭이 아니라
  // 판 아래 **띠**(132px)라, 이 boolean 이 빠지면 예산이 폭에서 93 을 잘못 빼고 높이에서 132 를
  // 안 빼서 코트 상자를 딴 모양으로 답한다. P4 까지는 그 오차가 rot 을 못 뒤집었지만 띠가
  // 76 → 132 로 커지면서 뒤집는 창이 생겼다 — 실측: **768×1024 세로(아이패드)에서 올바른 답은
  // 0 인데 안 넘기면 90 이 나온다**(현실 세로 창 22191칸 중 35%가 갈린다. 전수 대조는
  // useStageRot.portrait.test.ts). 새 boolean 이 아니라 §5.1 이 이미 못박은 둘 중 하나다.
  const stageRot = useStageRot(drill.courtMode, drill.courtSize, { narrow, trayBand, board: isBoard, inspector: 'hidden' });
  // ★ 코트 칸의 종횡비(§4.1, 2026-08-14 P3) — 판 덩어리 안에서 코트가 **자기 비율만큼만**
  // 차지하게 하는 한 줄이다. 남는 폭은 트레이가 먹는다 = 옛 레터박스 86px 이 그대로 벤치가 된다.
  // 입력은 `def`(courtMode·courtSize)와 `rot` 뿐이다 — 줌도 측정값도 안 들어간다(그 이유는
  // boardLayout.ts 의 courtCellAspectRatio ⚠️).
  const courtAspect = courtCellAspectRatioCss(drill.courtMode, drill.courtSize, stageRot);
  // 격자·규칙존 토글은 로컬 state 가 아니라 prefs 를 직접 신뢰값으로 쓴다 — 로컬 state 였을 때는
  // 화면을 벗어났다 돌아오면(EditorWorkspace 재마운트) 항상 prefs 값으로 리셋됐다(감사 지적).
  const showGrid = prefs.showGrid;
  const showRuleZones = prefs.showRuleZones;
  const toggleGrid = useCallback(() => setPrefs({ showGrid: !prefs.showGrid }), [prefs.showGrid, setPrefs]);
  const toggleRuleZones = useCallback(() => setPrefs({ showRuleZones: !prefs.showRuleZones }), [prefs.showRuleZones, setPrefs]);

  // §4.4 P2-4 규칙 오버레이. writer 와 달리 store 가 아니라 여기서 만든다 — 화면을 벗어나면
  // 링·존 노드도 함께 사라지므로 판정 상태를 판 밖까지 들고 다닐 이유가 없다.
  const rules = useMemo(() => createRuleOverlay(), []);
  usePhysicsRenderLoop(worldRef, writer, rules);
  useStepPlayback(drill, state.stepId, dispatch);

  // ★ 코트 자유 전환 게이트(§6.8 재편, 기현 결정) — **판 위에 잃을 것이 없을 때만** 연다.
  //
  // D12 는 full↔half 전환이 배치를 보존할 수 없다고 못박았다(30×18m 와 18×15m 는 어떤 아핀
  // 변환으로도 같은 전술이 안 된다). 경고를 띄우고 날리는 대신, 잃을 배치가 없을 때로 전환을
  // 한정해 손실 자체를 만들지 않는다.
  //
  // ⚠️ **2026-08-28 — 묻는 질문을 바꿨다.** 옛 게이트는 `board.pristine && past.length === 0`,
  // 즉 *"되돌릴 편집이 없는가"* 였다. 그 대용(proxy)이 값을 두 개 치르고 있었다:
  //   ① [비우기]가 **되돌리기를 죽였다.** 비우기가 히스토리에 쌓이면 past.length > 0 이 되어
  //      게이트가 스스로 닫히므로, 비우기는 히스토리를 **비우는** BOARD_SET 으로 갈 수밖에
  //      없었다. 기술적 제약이 아니라 대용을 지키려던 대가였다(기현님 지적).
  //   ② 저장본을 다시 열면 past 가 비어 dirty 한 판이 clean 으로 보였고, 그 거짓말을 막으려고
  //      `pristine` 을 스냅샷·세션 캐시까지 끌고 다녀야 했다(storage/board.ts 옛 주석).
  // 판을 직접 보면 둘 다 사라진다 — 개체가 0이면 잃을 것이 없다는 것이 **저장·재로딩·되돌리기와
  // 무관하게** 참이기 때문이다. 그래서 `pristine` 배선은 통째로 은퇴했다.
  const boardPristine = isBoard && state.present.steps.every(isStepEmpty);

  // 되돌리기·다시하기. **2026-08-14 기현님 지시로 헤더에서 트레이(줌 바로 아래)로 옮겼다** —
  // 아래 ToolRail 의 `history` 로 간다. useAppHeader 에는 더 이상 안 넘긴다.
  const history = {
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    onUndo: () => dispatch({ type: 'UNDO' }),
    onRedo: () => dispatch({ type: 'REDO' }),
  };

  useAppHeader(
    isBoard
      ? {
          // 🔁 2026-09-03 기현 지시(*"보드에도 다른 화면들처럼 헤더 넣고 가운데 정렬로 제목 크게, 짧은
          // 설명 부제목으로. 맨 오른쪽에 [+ 드릴로 편집] 버튼 추가. 오른쪽 기능바의 [저장] 버튼 삭제"*)
          // 로 **헤더가 다시 내용을 진다.** 2026-08-14 의 "헤더 삭제, 공간 확보" 는 헤더가 빈 줄뿐일 때의
          // 결정이었다(그때 코트 전환·되돌리기는 기능 바로 갔고 그건 그대로다). [드릴로 저장]만 기능 바
          // 맨 끝에서 여기 주 액션으로 돌아왔다 — 뜻은 같고(이름을 물어 드릴로 남기고 그 편집 화면을
          // 연다) 이름만 "편집"이다. 같은 이름의 표적이 둘이 되지 않게 기능 바 칸은 지웠다.
          title: SCREEN_TITLES[locale].board,
          subtitle: SCREEN_SUBTITLES[locale].board,
          align: 'center',
          primary: { label: t('board.editAsDrill'), icon: <IconPlus size={15} />, onAction: () => board?.onSaveAsDrill() },
        }
      : {
          // ⚠️ 2026-08-15 (재설계 ②) — 헤더에서 **[저장]과 코트 세그먼트가 빠졌다.**
          //  · [저장]  → 기능 바 맨 끝(전술판의 [드릴로 저장]과 **같은 자리**). 자동저장
          //    상태도 그 칸이 말한다.
          //  · 코트 세그먼트 → 기능 바 [코트](잠긴 채로 값만 보여 준다). 옛 계약
          //    (`onLockedAttempt` 로 이유를 말한다)은 그대로 옮겨 갔다.
          //
          //  ⚠️ 2026-08-20 (기현님 지시, §A) — 헤더가 **컴팩트로 돌아온다.** 시연과 같은 뼈대를
          //  쓰기 위해서다: 제목·ⓘ·[시연으로] 한 줄뿐이고 부제·설명 인라인은 없다(description
          //  필드를 아예 안 준다 — ⓘ(DrillMetaSheet)에 같은 필드가 이미 있어 편집 경로를 안
          //  잃는다). [시연]은 옛 `presentButton`(고정 보조 버튼) 대신 **`primary`**(최우측)로
          //  간다 — presentButton 필드 자체가 이번에 폐기됐다(§A, 편집 화면이 유일한 사용처였다).
          title: drill.title,
          // 2026-08-18 (기현님: *"드릴 이름 정도만 왼쪽 상단에 배치하고 동적으로 수정 가능"*) —
          // 인스펙터 [제목] 필드의 후계. 저장 통로는 설명과 같은 META_SET, 상한은 validate.ts
          // LIMITS.titleLen 과 같은 값(설명 필드 주석과 같은 이유 — 화면이 먼저 막지 않으면
          // 저장할 때 조용히 잘린다).
          titleField: {
            value: drill.title,
            maxLength: LIMITS.titleLen,
            onChange: (v) => dispatch({ type: 'META_SET', patch: { title: v } }),
          },
          badge: t('editor.workspace.editingBadge'),
          compact: true,
          // ⚠️ 2026-08-28 (기현 지시) — ⓘ 가 **오른쪽 기능 바로** 갔다. 헤더에 있던 동안 편집과
          //    시연이 **같은 글리프 하나**를 나눠 써서, 눌러 보기 전에는 고칠 수 있는지 볼 수만
          //    있는지 알 수 없었다. 기능 바에서는 아이콘이 갈린다(IconDrillInfoEdit /
          //    IconDrillInfoRead). `HeaderConfig.infoButton` 자체가 이번에 폐기됐다 —
          //    편집·시연이 유일한 사용처였다(§A 의 presentButton 이 간 길과 같다).
          primary: {
            label: t('editor.workspace.presentLabel'),
            icon: <IconPlay size={15} />,
            onAction: () => nav.go('present', { kind: 'drill', id: drill.id }),
          },
        },
  );

  /** [비우기] — **지금 스텝을 비운다.** 2026-08-28 기현 지시로 드릴 편집에도 생기면서 화면 쪽
   *  구현(BoardScreen.onReset)에서 여기로 올라왔다: 하는 일이 리듀서 액션 하나뿐이라
   *  저장소를 아는 화면이 쥘 이유가 없고, 두 모드가 같은 코드를 쓰는 것이 "뜻이 하나다" 를
   *  코드로도 지키는 길이다.
   *
   *  ⚠️ 개체를 하나씩 지우는 `eraseIds` 로 대신하지 않는다 — 되돌리기가 개체 수만큼 조각난다
   *     (STEP_CLEAR 는 한 칸, actions.ts 그 주석). */
  const clearStep = useCallback(() => {
    dispatch({ type: 'STEP_CLEAR', id: state.stepId });
    // 알리는 내용이 모드마다 다르다. 전술판은 **비우기가 코트 전환을 여는 열쇠**라 그 사실이
    // 다음 행동이고, 드릴은 코트가 언제나 잠겨 있으므로(courtLocked) 같은 말을 하면 거짓말이다
    // — 대신 "다른 스텝은 그대로" 가 그 자리에서 궁금한 것이다.
    toast.show(isBoard ? t('board.clearedToast') : t('editor.workspace.clearedStepToast'));
  }, [dispatch, state.stepId, toast, t, isBoard]);

  const eraseIds = useCallback(
    (ids: string[], scope: 'onward' | 'thisStep') => {
      // 실제로 치운 것만 모은다 — 리듀서가 안 받는 id 까지 세면 토스트가 부풀고, 되돌리기
      // 횟수도 어긋난다.
      const done: string[] = [];
      for (const id of ids) {
        if (isId(id, 'ch') || isId(id, 'bl') || isId(id, 'cn')) {
          dispatch({ type: 'OBJECT_REMOVE', id, scope });
          done.push(id);
        } else if (isId(id, 'nt')) {
          dispatch({ type: 'NOTE_REMOVE', id });
          done.push(id);
        } else if (isId(id, 'ar')) {
          dispatch({ type: 'ARROW_REMOVE', id });
          done.push(id);
        } else if (isId(id, 'sh')) {
          // 2026-08-16 — 이 갈래가 **없었다**. 그래서 도형을 고르고 Delete 를
          // 누르면 아무 일도 안 나고 토스트도 안 떴다(count===0 으로 조용히 return) — 키가
          // 고장난 것처럼 보였다. 지우는 길이 여기 하나로 모이면서 그 구멍이 닫힌다.
          dispatch({ type: 'SHAPE_REMOVE', id });
          done.push(id);
        } else if (isId(id, 'fh')) {
          // 2026-09-03 획. 위 'sh' 갈래가 2026-08-16 에 없어서 겪은 그 고장(누르면 조용히
          // 아무 일도 안 남)이 여기 없으면 그대로 재현된다 — 이 함수가 **지우는 유일한 문**이라
          // ([지우기] 도구 · Delete · 개체 메뉴 · 트레이 드롭이 전부 여기로 온다) 갈래 하나가
          // 비면 그 개체는 어느 문으로도 안 지워진다.
          dispatch({ type: 'STROKE_REMOVE', id });
          done.push(id);
        }
      }
      const count = done.length;
      if (count === 0) return;
      // §4.3 P1-4 · §6.10c — 치우는 세 입구(트레이로 끌기 · 개체 메뉴 · Delete)가 전부 이
      // 함수로 들어오므로, 소리 규칙도 **여기 한 줄**이다. 예전에는 끌기 경로가 자기 소리를
      // 따로 울려 규칙이 두 곳에 있었다.
      //
      // 소리는 **가장 무거운 결과**를 말한다: 하나라도 돌아갈 상자가 없으면 'erase' 다.
      // 섞였을 때 'trayReturn' 을 울리면 "다 상자에 있다" 로 들리고, 그 오해는 트레이를
      // 열어 보기 전까지 안 풀린다. 글자(removalToast)는 여전히 양쪽을 다 적는다.
      if (done.some((id) => !returnsToTray(id))) cues.play('erase');
      else cues.play('trayReturn');
      dispatch({ type: 'SELECT_CLEAR' });
      // 개체 메뉴가 '빼기'/'삭제'로 말을 가르므로(removal.ts) 토스트도 같은 술어를 본다 —
      // 메뉴에서 '빼기'를 눌렀는데 "삭제했습니다" 가 뜨면 방금 읽은 글자를 뒤집는 셈이다.
      toast.show(removalToast(done, locale), {
        action: {
          label: t('editor.workspace.undoAction'),
          onAction: () => {
            for (let i = 0; i < count; i++) dispatch({ type: 'UNDO' });
          },
        },
      });
    },
    [dispatch, toast, locale, t],
  );

  // 스텝 삭제 undo 토스트(PLAN-DELETE-SAFETY.md §C-1) — eraseIds 와 같은 관용구. STEP_DELETE·
  // STEPS_DELETE 는 이미 COMMIT_TYPES 라 Ctrl+Z 로 완전히 돌아가는데(actions.ts), 그 사실을
  // 아무도 안 알려줘서 없는 것과 같았다(실기 신고 2026-08-20) — 여기서 토스트로 알린다.
  // 일괄도 액션 하나뿐이라 UNDO 1회면 전부 원복된다(단일과 같다 — eraseIds 처럼 개수만큼
  // 반복할 필요가 없다).
  const deleteStep = useCallback(
    (id: StepId) => {
      dispatch({ type: 'STEP_DELETE', id });
      toast.show(t('editor.stepSidebar.announce.deleted', { n: 1 }), {
        action: { label: t('editor.workspace.undoAction'), onAction: () => dispatch({ type: 'UNDO' }) },
      });
    },
    [dispatch, toast, t],
  );
  const deleteSteps = useCallback(
    (ids: StepId[]) => {
      dispatch({ type: 'STEPS_DELETE', ids });
      toast.show(t('editor.stepSidebar.announce.deleted', { n: ids.length }), {
        action: { label: t('editor.workspace.undoAction'), onAction: () => dispatch({ type: 'UNDO' }) },
      });
    },
    [dispatch, toast, t],
  );

  /** [복제](기현 지시 2026-08-18: *"복제하여 오른쪽 아래 1m 위치에 놓는거다"*, 같은 날 정정
   *  0.5 m) — 도형·메모·화살표(`canDuplicate`). 입구가 둘이다: 개체 메뉴 [복제] 와
   *  Ctrl/⌘+D(같은 날 지시 "복제 단축키 ctrl-d") — `eraseIds` 처럼 여기 한 함수로 모여야
   *  오프셋·클램프·상한·사본 선택 규칙이 입구마다 안 갈린다.
   *
   *  - **새 액션이 없다**: setShape/setNote/setArrow 가 업서트라 새 id 로 SET 을 쏘면 그대로
   *    추가다 — eraseIds 가 종류별 REMOVE 를 낱개로 쏘는 것과 같은 결이고, 되돌리기도 같은
   *    규칙(사본 하나에 한 칸)이다.
   *  - **클램프는 viewBox**(validate 의 로드 클램프와 같은 기준 — 갈리면 저장-로드에서 자리가
   *    튄다). 화살표만은 세 점짜리 강체라 점마다 자르지 않고 **이동량 자체를** 줄인다.
   *  - **상한은 놓기와 같은 문**: 도형 40 은 placement 와 같은 토스트. 메모 20·화살표 40 은
   *    놓기에 검사가 없지만 validate 가 로드에서 자르므로, 여기서 만들면 다음 로드 때 조용히
   *    사라질 개체가 된다 — 막는다.
   *  - 사본이 잠기지 않는 것은 공짜다 — locked 목록은 id 명단이고 새 id 는 거기 없다.
   *  - 끝나면 **사본을 고른다**(원본 대신): 다음 조작(끌어 자리 잡기)이 향하는 곳이 방금 만든
   *    쪽이다 — 스텝 복제가 사본으로 손을 옮기는 것과 같은 이유. */
  const duplicateObjIds = useCallback(
    (ids: string[]) => {
      const off = PX_PER_M / 2; // 0.5 m
      const court = courtDefFor(drill.courtMode, drill.courtSize);
      const made: string[] = [];
      let nShapes = step.shapes.length;
      let nNotes = step.notes.length;
      let nArrows = step.arrows.length;
      let nStrokes = step.strokes?.length ?? 0;
      let shapeCap = false;
      let noteCap = false;
      let arrowCap = false;
      let strokeCap = false;
      for (const id of ids) {
        if (isId(id, 'sh')) {
          const sh = step.shapes.find((x) => x.id === id);
          if (!sh) continue;
          if (nShapes >= LIMITS.maxShapesPerStep) {
            shapeCap = true;
            continue;
          }
          const nid = newId('sh');
          dispatch({ type: 'SHAPE_SET', shape: { ...sh, id: nid, x: Math.min(sh.x + off, court.vbW), y: Math.min(sh.y + off, court.vbH) } });
          made.push(nid);
          nShapes++;
        } else if (isId(id, 'nt')) {
          const nt = step.notes.find((x) => x.id === id);
          if (!nt) continue;
          if (nNotes >= LIMITS.maxNotesPerStep) {
            noteCap = true;
            continue;
          }
          const nid = newId('nt');
          dispatch({ type: 'NOTE_SET', note: { ...nt, id: nid, x: Math.min(nt.x + off, court.vbW), y: Math.min(nt.y + off, court.vbH) } });
          made.push(nid);
          nNotes++;
        } else if (isId(id, 'ar')) {
          const ar = step.arrows.find((x) => x.id === id);
          if (!ar) continue;
          if (nArrows >= LIMITS.maxArrowsPerStep) {
            arrowCap = true;
            continue;
          }
          const nid = newId('ar');
          const dx = Math.max(0, Math.min(off, court.vbW - Math.max(ar.from.x, ar.ctrl.x, ar.to.x)));
          const dy = Math.max(0, Math.min(off, court.vbH - Math.max(ar.from.y, ar.ctrl.y, ar.to.y)));
          dispatch({ type: 'ARROW_SET', arrow: { ...nudgeArrow(ar, 'whole', { x: dx, y: dy }), id: nid } });
          made.push(nid);
          nArrows++;
        } else if (isId(id, 'fh')) {
          const fh = step.strokes?.find((x) => x.id === id);
          if (!fh) continue;
          if (nStrokes >= LIMITS.strokesPerStep) {
            strokeCap = true;
            continue;
          }
          const nid = newId('fh');
          // 화살표와 **같은 방식**으로 자른다: 점마다 클램프하면 사본의 모양이 원본과 달라진다
          // (손으로 그은 곡선이 판 가장자리에서 납작해진다). 이동량 자체를 줄여 강체로 옮긴다.
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (const p of fh.points) {
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
          }
          const dx = Math.max(0, Math.min(off, court.vbW - maxX));
          const dy = Math.max(0, Math.min(off, court.vbH - maxY));
          dispatch({ type: 'STROKE_SET', stroke: { ...nudgeStroke(fh, { x: dx, y: dy }), id: nid } });
          made.push(nid);
          nStrokes++;
        }
      }
      // 토스트는 종류당 한 번이다 — 정원에서 여럿을 복제하면 같은 문장이 개수만큼 쌓인다.
      if (shapeCap) toast.show(t('editor.workspace.shapeCapToast', { max: LIMITS.maxShapesPerStep }));
      if (noteCap) toast.show(t('editor.workspace.noteCapToast', { max: LIMITS.maxNotesPerStep }));
      if (arrowCap) toast.show(t('editor.workspace.arrowCapToast', { max: LIMITS.maxArrowsPerStep }));
      if (strokeCap) toast.show(t('editor.workspace.strokeCapToast', { max: LIMITS.strokesPerStep }));
      if (made.length > 0) dispatch({ type: 'SELECT_SET', ids: made });
    },
    [drill.courtMode, drill.courtSize, step.shapes, step.notes, step.arrows, step.strokes, dispatch, toast, t],
  );

  const gotoStep = useCallback(
    (delta: 1 | -1) => {
      const idx = selectStepIndex(state);
      const next = drill.steps[idx + delta];
      if (next) dispatch({ type: 'STEP_SELECT', id: next.id });
    },
    [dispatch, drill.steps, state],
  );

  // 끝 스텝에서 [재생] = 처음으로 되감고 재생(2026-08-20 기현님 지시, §F) — loop 설정과
  // **무관**하다(loop 는 "재생 중 끝에 닿았을 때" 만 맡는다, useStepPlayback.ts 참고 — 둘이
  // 안 겹친다). 버튼(PlaybackControls)과 단축키(useEditorKeyboard onTogglePlay)가 **같은
  // 함수**를 써야 자리마다 동작이 갈리지 않는다. STEP_SELECT 로 스텝을 먼저 옮기면
  // useStepPlayback 이 stepId 변화를 보고 resetMs 를 스스로 부른다(그 훅의 첫 effect).
  const togglePlay = useCallback(() => {
    const last = drill.steps.length - 1;
    if (!playing && last >= 1 && stepIndex === last) {
      dispatch({ type: 'STEP_SELECT', id: drill.steps[0]!.id });
    }
    playbackActions.toggle();
  }, [playing, stepIndex, drill.steps, dispatch, playbackActions]);

  // ⚠️ **[한 장 더 찍기] 가 없어졌다**(기현 지시 2026-08-30: *"그 버튼 지워"*). 여기 있던
  //    `addStepHere`(+ 커밋 뒤 새 스텝을 고르는 `addedAfter` 이펙트)도 함께 사라졌다.
  //    옛 근거를 기록으로 남긴다: *"찍기는 한 번의 조작이어야 한다 — 찍고 나면 방금 찍은
  //    장이 손에 들려 있어야지, 옛 장을 든 채 새 장이 옆에 쌓이면 다음 동작이 엉뚱한 판에
  //    들어간다."* **그 근거는 그대로 살아 있다** — 스텝을 늘리는 길이 이제 틈의 [+]
  //    (STEP_DUPLICATE) 뿐인데, 바로 아래 `duplicateStepAt` 이 같은 뒷정리를 이미 하고 있다
  //    (삽입 자리를 미리 계산해 두고 다음 렌더에서 그 스텝을 고른다). 즉 없어진 것은 버튼
  //    하나이고, "찍으면 그 장이 손에 들린다" 는 계약은 한 곳으로 합쳐졌다.
  //    ⚠️ 그래서 호출자를 잃은 `STEP_ADD` 액션과 `edits.addStepAfter` 는 2026-08-31 에 지웠다
  //       (기현 지시). 한동안 "STEP_DUPLICATE 와 의미가 다르니 되살릴 자리로 남긴다" 고 두었으나,
  //       그 차이(새 스텝의 이름을 비운다)는 과제⑦ 이후 이름을 가진 스텝 자체가 없어 이미
  //       사라진 뒤였다 — 자세한 것은 `edits.ts duplicateStep` 주석의 🪦 문단.

  // [스텝 복제](§복제, 기현님 확정 2026-08-17) — 위 [한 장 더 찍기] 와 같은 이유로 같은
  // 패턴이다: 복제한 장이 손에 들려야 다음 조작(도형 그리기 등)이 그 장에 들어간다.
  // STEP_DUPLICATE 도 순수 리듀서라 새 id 를 안 돌려주므로, 삽입 자리를 dispatch 전에
  // 미리 계산해 두고 다음 렌더의 drill 에서 그 자리의 스텝을 골라 선택한다. StepSidebar 의
  // 카드 복제 버튼·틈(gap)의 + 버튼이 함께 이 경로를 쓴다(카드마다 onDuplicateStep 을 새로
  // 만들지 않도록 EditorWorkspace 에 하나만 둔다).
  const [duplicatedTo, setDuplicatedTo] = useState<number | null>(null);
  const duplicateStepAt = useCallback(
    (id: StepId, toIndex?: number) => {
      const idx = drill.steps.findIndex((s) => s.id === id);
      if (idx < 0) return;
      setDuplicatedTo(toIndex ?? idx + 1);
      dispatch({ type: 'STEP_DUPLICATE', id, toIndex });
    },
    [dispatch, drill.steps],
  );
  useEffect(() => {
    if (duplicatedTo === null) return;
    setDuplicatedTo(null);
    const added = drill.steps[duplicatedTo];
    if (added) dispatch({ type: 'STEP_SELECT', id: added.id });
  }, [duplicatedTo, drill.steps, dispatch]);

  const armPlayer = useCallback(
    (id: ChairId) => {
      setPendingPlayerId(id);
      dispatch({ type: 'TOOL_SET', tool: 'player' });
    },
    [dispatch],
  );

  // 트레이에서 코트로 끌어다 놓기(§6.10). 놓는 규칙은 placement.ts 가 갖는다 — 탭 경로와
  // 같은 함수를 써야 "탭으로는 10개에서 막히는데 드래그로는 11개째가 놓인다" 가 안 생긴다.
  const tray = useTrayDrag({
    stageRef,
    onDrop: (item, world) => {
      placeObject(item.kind, world, {
        drill,
        // 끌고 있는 상자가 곧 색이다. 트레이에서 미리 고른 색(state.coneSlot)과
        // 다를 수 있으므로 **드래그가 이긴다** — pendingPlayerId 와 같은 규칙.
        coneSlot: item.coneSlot ?? state.coneSlot,
        ballMax: BALL.maxCount,
        // 끌고 있는 칩이 곧 배치 대상이다. 트레이에서 미리 고른 선수(pendingPlayerId)와
        // 다를 수 있으므로 **드래그가 이긴다**.
        pendingPlayerId: item.chairId ?? pendingPlayerId,
        stepIndex,
        dispatch,
        showToast: (m) => toast.show(m),
        onPlayerPlaced: () => setPendingPlayerId(null),
        // 트레이에서 끌어다 놓은 메모도 탭으로 놓은 것과 **같은 문**이 열린다 — 경로마다
        // 다르면 "탭으로는 글 칸이 뜨는데 끌어다 놓으면 안 뜬다" 가 조용히 생긴다.
        onNotePlaced: (id) => setEditingNote({ id, fresh: true }),
        locale,
      });
    },
  });

  useEditorKeyboard({
    tool: state.tool,
    singleKeyMode: prefs.a11y.singleKeyShortcuts,
    onSelectTool: (t) => dispatch({ type: 'TOOL_SET', tool: t }),
    onConeToggle: () => dispatch({ type: 'CONE_SLOT_SET', slot: state.coneSlot === 0 ? 1 : 0 }),
    onUndo: () => dispatch({ type: 'UNDO' }),
    onRedo: () => dispatch({ type: 'REDO' }),
    // 전술판은 자동저장이 꺼져 있어(useAutosave(!isBoard)) flush 가 아무것도 안 한다 —
    // 그쪽은 스냅샷을 지금 저장한다(BoardScreen.saveNow).
    onSave: () => (board ? board.onSave() : void autosave.flush()),
    // 전술판은 1장짜리다 — 스텝 복제 단축키가 살아 있으면 화면에 없는 2번째 스텝이 생겨
    // 판이 조용히 두 장이 된다(하단 바에 스텝 UI 가 없어 눈으로는 알 수 없다).
    onDuplicateStep: isBoard ? () => {} : () => dispatch({ type: 'STEP_DUPLICATE', id: state.stepId }),
    // Ctrl/⌘+D 의 1층(기현 지시 2026-08-18) — 복제 가능한 선택이 있으면 개체 복제가 이긴다.
    // 판정은 메뉴와 같은 canDuplicate 하나다. 전술판에서는 2층(스텝)이 no-op 이라 이 층만 산다.
    onDuplicateObjects: () => {
      const ids = Array.from(state.selection);
      if (ids.length === 0 || !canDuplicate(ids)) return false;
      duplicateObjIds(ids);
      return true;
    },
    onPrevStep: () => gotoStep(-1),
    onNextStep: () => gotoStep(1),
    onTogglePlay: togglePlay,
    onToggleGrid: toggleGrid,
    onToggleRuleZones: toggleRuleZones,
    onZoomIn: () => stageRef.current?.zoomBy(INTERACT.zoomStep),
    onZoomOut: () => stageRef.current?.zoomBy(1 / INTERACT.zoomStep),
    onZoomReset: () => stageRef.current?.resetZoom(),
    // §4.4 P2-1 — 판 이동. 화면 델타를 그대로 넘긴다: 회전(rot)·배율 환산은 무대가 자기
    // 실측으로 해야 맞다(여기서 미리 곱하면 인스펙터가 열려 판이 돌아간 순간 어긋난다).
    onPanView: (dx, dy) => stageRef.current?.panByScreen(dx, dy),
    // 2026-08-16 — 삭제 범위를 수식키로 가르던 Alt+Delete 가 사라졌다. Alt 는 이제 **보기
    // 토글 전용 채널**(Alt+G·Alt+Z)이라 같은 수식키에 "이 스텝만" 이라는 다른 뜻을 겹칠 수
    // 없다. 범위 개념 자체는 2단계에서 모델에서도 걷어낸다(기현 지시).
    onEraseSelection: () => eraseIds(Array.from(state.selection), 'onward'),
    onShowHelp: showHelp,
    // [A-3] Esc = 선택 해제. 2단 히트(1.6) 이후 붐비는 코트에서 "빈 곳 탭" 이 사라져도
    // 해제가 가능해야 한다. 재탭 해제(useEditorPointer)와 함께 대체 경로 한 쌍이다.
    onSelectionClear: () => dispatch({ type: 'SELECT_CLEAR' }),
    // Ctrl/⌘+A — **이 스텝에 판 위에 있는 것**만이다(§6.10b). 트레이에 주차된 칩은 고를
    // 대상이 아니고, 잠긴 것은 덩어리로 집는 모든 길이 그렇듯 안 담는다(selectSame.ts 주석).
    onSelectAll: () => {
      const locked = new Set(step.locked ?? []);
      const ids = [
        ...drill.cast.chairs.filter((c) => step.chairs[c.id] !== undefined).map((c) => c.id as string),
        ...drill.cast.balls.filter((b) => step.balls[b.id] !== undefined).map((b) => b.id as string),
        ...drill.cast.cones.filter((c) => step.cones[c.id] !== undefined).map((c) => c.id as string),
        ...step.notes.map((n) => n.id as string),
        ...step.arrows.map((a) => a.id as string),
        ...(step.shapes ?? []).map((s) => s.id as string),
      ].filter((id) => !locked.has(id));
      dispatch({ type: 'SELECT_SET', ids });
    },
  });

  // 주차 슬롯 은유(기현 지시 2026-08-11): 배치된 선수도 자리를 비워 두고 남긴다.
  // 예전에는 배치되면 목록에서 사라져 트레이가 들쭉날쭉했고, 코트에서 빼냈을 때 어디로
  // 돌아가는지도 보이지 않았다.
  // 색깔별 재고. 상자가 색마다 따로라 합계로는 어느 쪽이 찼는지 알 수 없다.
  const coneCounts: [number, number] = [0, 0];
  for (const c of drill.cast.cones) coneCounts[c.colorIndex] += 1;

  const chairSlots: ChairSlot[] = drill.cast.chairs.map((c) => {
    const teamStyle = drill.teams[c.team];
    const color = c.color ?? (c.isGk ? teamStyle.gkColor : teamStyle.color);
    return { id: c.id, number: c.number, name: c.name, color, ink: inkFor(color), placed: step.chairs[c.id] !== undefined };
  });

  // ⚠️ 2026-08-14 — §3 불변식 2·3 의 배선(`drillUses` · `setTrayDrawers`)이 여기서 **사라졌다.**
  // 서랍이 플라이아웃이 되면서 "열린 채로 둔다" 라는 상태가 없어졌기 때문이다. 두 불변식이
  // 답하던 물음("접힌 것을 어떻게 다시 펴는가")은 이제 손이 닿기만 하면 풀린다 — 근거는
  // ToolRail.tsx 의 플라이아웃 머리말에 옛 결정과 함께 남겨 뒀다.

  /** 편집 중인 메모의 **지금** 값. id 만 들고 있다가 여기서 다시 찾는 이유: 되돌리기·스텝
   *  이동으로 그 쪽지가 사라질 수 있고, 그러면 모달이 없는 개체를 붙들고 남는다.
   *  못 찾으면 `null` 이라 모달이 그냥 닫힌다. */
  const editingNoteObj = editingNote ? (step.notes.find((n) => n.id === editingNote.id) ?? null) : null;

  // 두 배치가 **같은 컴포넌트 인스턴스**를 쓰도록 조각으로 뽑는다. 가로/세로에서 각각 따로
  // 렌더하면 방향이 바뀔 때 언마운트–재마운트가 일어나 인스펙터의 펼침 상태 같은 것이 날아간다.
  const toolRail = (
    <ToolRail
      tool={state.tool}
      toolLock={state.toolLock}
      onSelectTool={(t) => dispatch({ type: 'TOOL_SET', tool: t })}
      coneSlot={state.coneSlot}
      onConeSlotChange={(slot) => dispatch({ type: 'CONE_SLOT_SET', slot })}
      ballCount={drill.cast.balls.length}
      coneCounts={coneCounts}
      coneMax={CONE.maxCountPerColor}
      ballMax={BALL.maxCount}
      chairSlots={chairSlots}
      pendingPlayerId={pendingPlayerId}
      onArmPlayer={armPlayer}
      courtLabel={COURT_DEFS[drill.courtMode].label[locale]}
      orientation={trayBand ? 'horizontal' : 'vertical'}
      onItemPointerDown={tray.start}
    />
  );

  // 2026-08-18 — 하단 바(TransportBar)가 통째로 사라지며 마지막 승객 [속성](ViewControls)도
  // 함께 폐기됐다(기현님: *"결과적으로 하단에는 노트 빼고 다 삭제"*). 재생 토글·배속은 왼쪽
  // 사이드바 하단으로(StepSidebar 의 playback prop), [보기]·[속도]는 기능 바에 이미 있었다.

  // §5.4 [골대 원위치] — 손잡이는 **기능 바 한 곳**이다(인스펙터 폐기로 ①이 사라졌다).
  // [코트 비우기] 확인 모달의 [골대만 원위치]도 앞서 지워졌으므로(EditorWorkspace.resetGoals
  // .test.tsx 주석) 이 핸들러를 받는 곳은 FunctionBar 하나다.
  // 진영 뒤집기(2026-08-15). 되돌리기에 남아야 하므로 다른 드릴 메타와 같은 통로(META_SET)로
  // 간다 — 골 지역 반칙이 어느 팀에 걸리는지를 바꾸는 값이라 "실수로 눌렀다" 가 실재한다.
  const toggleDefense = useCallback(() => {
    const cur = drill.defense ?? defaultDefense(drill.courtMode);
    dispatch({ type: 'META_SET', patch: { defense: cur === 'home' ? 'away' : 'home' } });
  }, [dispatch, drill.defense, drill.courtMode]);

  const resetGoals = useCallback(() => {
    // 막혀 있으면 반드시 말해 준다. 조용히 실패하면 "버튼이 고장났나" 하며 계속
    // 누르게 된다(실제 신고). 휠체어는 static 이라 골대가 밀어낼 수 없다.
    const r = worldRef.current?.resetGoals();
    if (r && r.blocked > 0) toast.show(t('editor.workspace.goalsBlockedToast'));
  }, [worldRef, toast, t]);

  // 오른쪽 기능 바 — **두 화면 다 선다**(2026-08-15 드릴 편집 재설계 ②).
  //
  // 옛 기록(지우지 않는다): *"자유 전술판 전용이다. 드릴 편집은 아직 옛 배치(하단 TransportBar
  // + 인스펙터)를 쓴다"*. 그 배치에서는 줌·되돌리기가 트레이에, [보기]가 하단 바에, [골대
  // 원위치]가 인스펙터 시트 안에 있었다 — 즉 **같은 조작이 화면마다 다른 자리**였고, 두 화면을
  // 오가는 코치의 공간 기억이 매번 뒤집혔다(§3 불변식 1 이 지키려던 바로 그것).
  //
  // 다른 점은 둘이다(2026-08-20, 옛 기록: 셋이었다 — [저장]이 여기 있었다): [비우기]가 없고
  // (FUNCTION_BAR_ITEMS_DRILL), [코트]가 언제나 잠겨 있다(드릴의 코트는 불변이다 — 옛 헤더
  // 세그먼트의 계약을 그대로 물려받는다). [저장]은 자동저장이 이미 도는 마당에 "지금 밀어넣기"
  // 뿐인 칸이 뜻이 없어 드릴 편집에서는 아예 안 그렸다. 2026-09-03 부터는 보드의 [드릴로 저장]도
  // 기능 바에 없다 — 헤더 주 액션 [+ 드릴로 편집](위 useAppHeader 의 board 분기)이 그 일을 한다.
  const functionBar = (
    <FunctionBar
      mode={board ? 'board' : 'drill'}
      onZoomIn={() => stageRef.current?.zoomBy(INTERACT.zoomStep)}
      onZoomOut={() => stageRef.current?.zoomBy(1 / INTERACT.zoomStep)}
      onZoomReset={() => stageRef.current?.resetZoom()}
      canUndo={history.canUndo}
      canRedo={history.canRedo}
      onUndo={history.onUndo}
      onRedo={history.onRedo}
      courtMode={drill.courtMode}
      courtSize={drill.courtSize ?? DEFAULT_COURT_SIZE}
      // 드릴의 코트는 **만든 뒤에 못 바꾼다**(D12 — 규격이 달라 배치를 옮겨 담을 수 없다).
      // 값은 계속 보인다 — 못 바꾸는 것과 안 보이는 것은 다르다(FunctionBar 의 코트 팝오버 ⚠️).
      courtLocked={board ? !boardPristine : true}
      onCourtModeChange={(m) => board?.onCourtChange(m)}
      onCourtSizeChange={(s) => board?.onCourtSizeChange(s)}
      onLockedAttempt={() =>
        toast.show(board ? t('editor.workspace.courtLockedBoardToast') : t('editor.workspace.courtLockedDrillToast'))
      }
      onResetGoals={resetGoals}
      defense={drill.defense ?? defaultDefense(drill.courtMode)}
      teams={drill.teams}
      onToggleDefense={toggleDefense}
      onReset={clearStep}
      stepEmpty={isStepEmpty(step)}
      onDrillInfo={onDrillInfo}
      drill={drill}
      stepIndex={stepIndex}
      checkedStepIds={checkedSteps}
      showGrid={showGrid}
      showGridLabels={prefs.showGridLabels}
      onToggleGrid={toggleGrid}
      showRuleZones={showRuleZones}
      onToggleRuleZones={toggleRuleZones}
    />
  );

  return (
    <main
      id="main"
      ref={workspaceRef}
      tabIndex={-1}
      // ⚠️ 2026-08-15 (재설계 ②) — **언제나 가로다.** 옛 규칙은 *"세로 화면은 위→아래로 쌓는다
      // (§6.4): 코트가 폭을 다 쓰고, 도구·속성이 아래로 간다"* 였는데, 그 문장이 가리키던 둘이
      // 지금은 여기 없다: 도구(ToolRail)는 판 덩어리 안으로 들어갔고(2026-08-14 P3), 속성은
      // 오버레이 시트라 흐름 밖이다. 그래서 세로에서 이 값은 **아무것도 안 바꾸고 있었다.**
      //
      // 그런데 오른쪽 기능 바가 드릴에도 서면서 사정이 달라졌다 — 흐름에 남은 것이 코트 칸과
      // 기둥 둘이라, column 이면 **기둥이 판 아래에 가로로 눕는다.** 옛 조건을 그대로 두면
      // 드릴 편집을 세로로 보는 순간 기둥이 무너진다.
      // position:relative 는 오버레이 시트의 기준 상자다 — 이것이 없으면 시트가 화면 전체를
      // 기준으로 떠서 레일·헤더 위까지 덮는다.
      // ⚠️ 아래 style 객체는 **한 줄**이어야 한다 — appShell.contract.test.ts 가 방향 전환이 적힌
      // 그 줄에서 minHeight:0 을 함께 찾는다(세로 축 플렉스 사슬은 jsdom 이 못 잡아 소스로 지킨다).
      style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0, outline: 'none', position: 'relative' }}
    >
      <span id="court-help" className="sr-only">
        {t('editor.workspace.courtHelp')}
      </span>

      {/* ★ 왼쪽 세로 스텝 바(PLAN-STEP-EDITING.md 구현 순서 ②, 기현님 확정 2026-08-17) —
          자유 전술판(isBoard)에는 스텝이 없으니 완전히 안 그린다(전술판 무변, board 테스트가
          그것을 지킨다). **flex 형제**로 넣는 이유는 코트가 자연히 줄어야 하기 때문이다 —
          이 자리에서 폭을 계산해 넘기면 §4.1 이 경계한 되먹임 고리가 되살아난다.
          접힘(narrow·portrait)이면 이 컴포넌트는 고정 폭을 안 차지한다 — 여는 버튼 하나만
          `<main>` 의 position:relative 위에 뜬다(StepSidebar.tsx 머리말). */}
      {isBoard ? null : (
        <StepSidebar
          drill={drill}
          onCheckedStepsChange={setCheckedSteps}
          stepId={state.stepId}
          onSelectStep={(id) => dispatch({ type: 'STEP_SELECT', id })}
          onReorderStep={(id, toIndex) => dispatch({ type: 'STEP_REORDER', id, toIndex })}
          onDuplicateStep={duplicateStepAt}
          // ④ 사슬 토글(기현님 확정 2026-08-17) — cut:false 는 STEP_META 리듀서가 키 삭제로
          // 해석한다(reducer.ts STEP_META 주석). 복제와 달리 선택 이동이 없어 여기서는
          // dispatch 만 얇게 감싼다(addStepHere/duplicateStepAt 같은 뒷정리가 필요 없다).
          onToggleCut={(id, cut) => dispatch({ type: 'STEP_META', id, patch: { cut } })}
          collapsed={narrow || portrait}
          // ⑤ 다중 선택(기현님 확정 2026-08-17) — 선택 상태 자체(어떤 카드가 체크됐나)는
          // StepSidebar 로컬(ephemeral)이라 여기서는 "결과" 셋만 받아 그대로 dispatch 한다.
          // duplicateStepAt/addStepHere 같은 뒷정리(방금 만든 스텝 선택)가 없는 이유: 일괄
          // 조작 뒤에는 stepId 를 어디로 옮길지가 한 곳으로 안 정해진다(방금 복제한 묶음 중
          // 어느 것? 이동한 묶음 중 어느 것?) — 그래서 지금 스텝은 그대로 둔다. 다만 일괄
          // 삭제로 지금 스텝 자체가 사라지는 경우만은 reducer.ts uiReducer(STEPS_DELETE)가
          // 남는 스텝으로 옮긴다(기존 STEP_DELETE 의 이웃 선택 로직과 같은 자리).
          onMoveSteps={(ids, toIndex) => dispatch({ type: 'STEPS_MOVE', ids, toIndex })}
          onDuplicateSteps={(ids) => dispatch({ type: 'STEPS_DUPLICATE', ids })}
          onDeleteSteps={deleteSteps}
          // 우클릭 메뉴 [삭제](2026-08-18) — 옛 인스펙터 [스텝 삭제]와 같은 STEP_DELETE.
          // 현재 스텝 삭제 시 이웃 선택은 uiReducer 의 기존 규칙이 맡는다.
          onDeleteStep={deleteStep}
        />
      )}

      {/* ★ minHeight:0 이 반드시 있어야 한다(§6.4). 세로 배치에서 이 div 는 수직 주축의 플렉스
          항목이 되는데, 기본값 min-height:auto 는 "내용만큼은 줄어들지 않는다" 는 뜻이다.
          그러면 안쪽 <svg> 가 viewBox 의 **고유 종횡비**로 자기 높이를 정해버리고 — 회전하면
          500×800 이라 세로로 길다 — 코트가 아래 도구·속성을 화면 밖으로 밀어낸다.
          minWidth:0 은 가로 배치용이라 이걸 대신해 주지 못한다(축이 다르다). */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: 'var(--panel-2)' }}>
        {/* 정렬 상자 — 판 덩어리를 가운데 세우고 크롬 예산의 패딩 한 행을 먹는다.
            패딩은 예산의 한 행이다(§5.2 '코트 래퍼 좌우 48 → 24 · 상하 40 → 16'). 숫자를 여기
            직접 적지 않는다 — 예산표와 화면이 갈라지면 표가 거짓말을 한다.
            ⚠️ 이 div 는 **center + center + 비어 있지 않은 padding 을 가진 유일한 div** 로 남는다
            (narrow.test.tsx:207-213 의 courtWrapper 가 그 선택자로 이 상자를 찾고, 개수까지 1 로 단언한다). 판 덩어리에는 padding 을
            주지 않는다 — 주는 순간 저 테스트가 두 개를 찾아 빨간불이 난다. */}
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: courtPadCss(narrow) }}>
          {/* ★ 판 덩어리 [data-board] — **코트 + 벤치가 한 물건이다**(기현 지시 2026-08-14).
              2026-08-11 결정("판 본체 = 코트 + 트레이. 둘은 한 장의 판이다")은 DOM 과 배경색에는
              이미 있었는데 **레터박스가 무효로 만들고 있었다**: 1024×600 에서 남는 폭 172px 이
              좌우 각 86px 로 갈려 칩과 코트 사이에 86px 죽은 띠를 만들었다. 그 폭을 트레이에
              흘려보내는 것이 이 상자다(근거·숫자는 boardLayout.ts 머리말).

              · flexDirection={trayAxis} — 가로 화면이면 트레이가 오른쪽, 세로면 아래.
              · 가로는 height:'100%' 로 세로를 다 쓰고 폭은 shrink-to-fit + maxWidth:'100%';
                세로는 width:'100%' 로 폭을 다 쓰고 높이를 maxHeight:'100%' 로 가둔다.
                이 한 줄이 §4.1 의 두 국면(세로 제약/폭 제약)을 함께 처리한다.
              · minWidth/minHeight 0 — 없으면 min-*:auto 가 shrink 를 막아 폭 제약 기기에서
                판이 정렬 상자를 넘친다(§4.1 함정 2).
              · **gap·padding 을 주지 않는다.** 코트 칸과 트레이가 맞닿는 인접축 빈틈이 정확히
                0 이라는 것이 이 설계가 보증하는 유일한 것이고, 그 보증의 실체가 이 '없음' 이다.

              ── P4 "한 물건" 시각화 (설계서 §4.4, 2026-08-14) ────────────────────────────
              · boxShadow — 옛 그림자 전용 div(`filter: drop-shadow(0 18px 30px …)`)를 여기로
                옮기고 **그 div 를 삭제했다.** 근거 셋:
                  ① 코트만 감싸던 그림자가 코트+벤치를 **함께** 감싸야 비로소 한 물건이 된다.
                     그림자가 코트에서 끊기면 벤치는 판에 얹힌 다른 패널로 읽힌다.
                  ② `filter` 는 후손의 `position:fixed` **기준 상자를 만든다.** 지금 판 안에
                     fixed 는 없지만(TrayGhost 는 `<main>` 직계다), 판 덩어리 안에 트레이가
                     들어온 이상 그 함정이 트레이 쪽으로 옮겨 온다 — 원인째 없앤다.
                  ③ 싸다. filter 는 알파 실루엣을 추적하고 box-shadow 는 상자 하나를 그린다.
              · border 1px + borderRadius 16 + overflow:hidden — "테두리 하나로 묶기".
                overflow 가 없으면 트레이만 직각으로 삐져나와 모서리가 어긋난다.
              · **배경은 양쪽 다 var(--panel-2) 그대로 둔다**(ToolRail.tsx:111-113 의 원래 의도).
                경계는 이제 색이 아니라 **테두리+그림자**가 만든다. 트레이의 inset 홈도 한 줄도
                안 바꿨다 — 여태 그 홈은 86px 빈 배경 옆이라 "떠 있는 패널 가장자리" 로 읽혔고,
                코트 그림이 홈에 **닿는 순간** 비로소 의도대로 "판에 파인 얕은 홈" 이 된다.
              · ⚠️ 테두리는 판 덩어리의 **바깥** 변이라 코트 칸과 트레이 사이에 끼지 않는다.
                인접축 빈틈 0 은 그대로다(EditorWorkspace.board.test.tsx 가 매번 확인한다). */}
          <div
            data-board=""
            style={{
              display: 'flex',
              flexDirection: trayAxis,
              // **양쪽 다 세로를 다 쓴다.** 띠(column)일 때 폭도 함께 다 쓰는 이유는 트레이가
              // 가로 띠라 카드 폭을 따라가기 때문이다 — 카드를 shrink-to-fit 로 두면 칩 줄의
              // 요구 폭이 카드 폭을 정하고, 코트가 그 폭에 끌려간다.
              //
              // ⚠️ `height:'100%'` 가 **띠에도** 붙는 것이 2026-08-27 수리의 핵심이다. 없으면
              // 카드 높이가 내용 기반(auto)이 되고, 그러면 코트 칸의 `height:'100%'` 가 참조할
              // 높이가 없어 무시된다 → 코트가 다시 폭 기준으로 커진다(아래 코트 칸 주석 참고).
              ...(trayBand ? { width: '100%', height: '100%' } : { height: '100%' }),
              maxWidth: '100%',
              maxHeight: '100%',
              minWidth: 0,
              minHeight: 0,
              border: '1px solid var(--border)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 18px 30px rgba(0,0,0,.45)',
            }}
          >
            {/* 코트 칸 — 자기 **종횡비만큼만** 차지한다. 남는 폭은 전부 트레이로 흘러간다.
                aspectRatio 는 반드시 `def`(courtDefFor)에서 뽑는다 — `view` 나 측정된 rect 로
                만들면 각각 §3 불변식 1 위반과 쌍안정 되먹임이 된다(boardLayout.ts 의 그 함수 ⚠️). */}
            <div
              data-tut="editor-court"
              style={{
                flex: '0 1 auto',
                minWidth: 0,
                minHeight: 0,
                position: 'relative',
                aspectRatio: courtAspect,
                // **높이가 기준이다. 두 배치 모두.** (2026-08-27 기현님 지시로 수리)
                //
                // ⚠️ 이 두 줄이 지키는 계약: **무대의 히트면이 코트 밖으로 새지 않는다.**
                // 옛 코드는 띠(column)일 때 `width:'100%'` 였다. 카드가 코트보다 넓으면 코트
                // 칸이 카드 폭을 통째로 먹고, 그 안에서 `<svg>` 가 'meet' 으로 레터박스된다 —
                // 그러면 **코트 그림 좌우의 빈 띠까지 히트면**이 되고, 거기를 누르면
                // client→world 가 viewBox 밖 좌표를 내놓는다. 배치 경로에는 코트 안으로
                // 되당기는 clamp 가 한 줄도 없으므로(placement.ts) 공·콘·메모가 그대로 코트
                // 밖에 놓였다(2026-09-05 감사가 CDP 실클릭으로 재현,
                // docs/AUDIT-DESKTOP-MERGE-2026-09-05.md §③ [하 7]).
                //
                // 높이를 기준으로 삼으면 칸 자체가 코트 모양이 되어 그 빈 띠가 사라진다: 주축
                // (세로) 크기를 flex 가 정하고 — `flex:'0 1 auto'` + `height:'100%'` 라 트레이와
                // 합쳐 넘칠 때 **코트가 줄어든다** — 그 높이에서 aspectRatio 가 폭을 만든다.
                // 남는 폭은 히트면이 아닌 좌우 여백이다.
                //
                // `alignSelf:'center'` 가 없으면 교차축(가로) 기본 stretch 가 폭을 100% 로
                // 늘려 aspectRatio 를 무효로 만든다. 이 한 줄이 빠지면 수리 전으로 돌아간다.
                // 행동으로 지키는 곳은 EditorWorkspace.board.test.tsx 의 「무대 히트면」 절이다.
                //
                // ── ⚠️ 2026-09-05: 이 수리의 **옛 근거는 미재현이다** ──────────────────────
                // 원문(2026-08-27): *"aspectRatio 가 폭에서 높이를 만들어 내는데 상자가 가로로
                // 넓을수록 그 높이가 상자를 넘고, 넘친 만큼을 판 덩어리의 overflow:hidden 이
                // 잘라내 코트 아래가 트레이 밑으로 사라진다(2560×1440 최대화에서 발견)."*
                // 2026-09-05 감사가 크로미움 13개 뷰포트에서 그 잘림을 **한 번도 재현하지
                // 못했다.** 지우지 않고 남긴다 — 최초 보고가 AppImage(WebKitGTK)였고 이 감사에
                // WebKit 엔진이 없었다(실기 확인 항목, docs/FIELD-TEST.md). 코드는 그대로 둔다:
                // 근거가 틀렸을 뿐 위의 히트면 계약은 실증됐다.
                ...(trayBand ? { height: '100%', alignSelf: 'center', maxWidth: '100%' } : { height: '100%' }),
              }}
            >
              <EditorStage
                ref={stageRef}
                drill={drill}
                rot={stageRot}
                step={step}
                stepIndex={stepIndex}
                tool={state.tool}
                toolLock={state.toolLock}
                coneSlot={state.coneSlot}
                selection={state.selection}
                dispatch={dispatch}
                worldRef={worldRef}
                writer={writer}
                rules={rules}
                zones={physics.zones}
                ballMax={BALL.maxCount}
                pendingPlayerId={pendingPlayerId}
                onPlayerPlaced={() => setPendingPlayerId(null)}
                showToast={(m, a) => toast.show(m, a ? { action: a } : undefined)}
                showGrid={showGrid}
                showGridLabels={prefs.showGridLabels}
                showRuleZones={showRuleZones}
                largeTargets={prefs.a11y.largeTargets}
                twoZone={prefs.a11y.twoZone}
                onEraseIds={eraseIds}
                onDuplicateIds={duplicateObjIds}
                onEditNote={(id, fresh) => setEditingNote({ id, fresh })}
                // 밀린 골대를 눌렀을 때(2026-08-29) — [보드 설정] 안 [골대 원위치]와 **같은
                // 함수**다. 두 손잡이가 다른 함수를 타면 언젠가 규칙이 갈린다(막힘 토스트 등).
                onResetGoals={resetGoals}
                epoch={state.epoch}
                // 3.10 — 트윈(frameSync)과 같은 식(stepTransitionMs)으로 계산해야 페이드와
                // 위치 이동이 한 시계로 끝난다. immediate(시점 점프)는 EditorStage 가 epoch 로
                // 스스로 가려낸다.
                transitionMs={stepTransitionMs(step, { immediate: false, reduceMotion: effectiveReduceMotion(prefs.a11y.reduceMotion) })}
              />
            </div>
            {/* 2026-08-14: 여기 있던 StageControls(코트 위 position:absolute 7개 묶음)를 해체했다.
                줌 3개는 {toolRail} 맨 위로, 격자·골 지역 가이드·도움말은 [보기] 팝오버 안으로,
                [속성]은 하단 바로 갔다(StageControls.tsx 머리말이 근거와 실측을 갖는다).
                이제 판 덩어리 안에 흐름 밖 요소가 하나도 없다 — §4.5 의 가장자리 56px 고무줄 띠가
                네 변 모두 비었고, EditorWorkspace.board.test.tsx 의 edge-pan 게이트가 그것을 못박는다. */}
            {toolRail}
          </div>
        </div>

        {/* 2026-08-18 — 두 화면 다 하단 바가 없다(기현님: *"결과적으로 하단에는 노트 빼고 다
            삭제"*). 전술판은 2026-08-14 에 먼저 사라졌고([코트 비우기]·[내보내기]·속도 제한·
            [보기]·[속성] 전부 기능 바로), 드릴 편집의 TransportBar 는 오늘 마지막 승객(재생
            토글·배속)을 왼쪽 사이드바 하단에 내려 주고 폐차됐다 — StepSidebar 의 playback
            prop 이 그 좌석이다. */}

        {/* ⑥ 텍스트의 소속(기현님 확정 2026-08-17, PLAN-STEP-EDITING.md §텍스트의 소속) —
            스텝 노트 = PPT 발표자 노트 자리. 보드 아래 가장 조용한 자리에 접힌 채로 있다가,
            손이 닿으면 펼쳐진다. 자유 전술판(isBoard)에는 스텝이 없으니 완전히 안 그린다
            (StepSidebar 와 같은 게이트). */}
        {/* 2026-08-20 (기현님 지시, §A·D) — ⓘ와 [시연]이 헤더로 옮겨 갔다(ⓘ는 제목 옆,
            [시연]은 최우측 primary). 이 줄에 남는 것은 노트와 **공용 재생 묶음**(최우·최하단)
            뿐이다 — 시연 화면과 같은 모양의 PlaybackControls 를 그대로 세운다. */}
        {isBoard ? null : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div data-tut="editor-note" style={{ flex: 1, minWidth: 0 }}>
              <NotePanel
                stepId={step.id}
                note={step.note}
                onNoteChange={(note) => dispatch({ type: 'STEP_META', id: step.id, patch: { note } })}
              />
            </div>
            <div data-tut="editor-playback">
            <PlaybackControls
              playing={playing}
              canPlay={drill.steps.length >= 2}
              onTogglePlay={togglePlay}
              loop={loop}
              onToggleLoop={() => playbackActions.setLoop(!loop)}
              onPrev={() => gotoStep(-1)}
              onNext={() => gotoStep(1)}
              speed={speed}
              onCycleSpeed={() => playbackActions.setSpeed(speed === 0.5 ? 1 : speed === 1 ? 2 : 0.5)}
            />
            </div>
          </div>
        )}
      </div>

      {functionBar}

      {/* 끌고 있는 말의 고스트. 코트 축척(pxPerUnit)에 맞춰 **실제 놓일 크기**로 그린다 —
          고정 크기로 그리면 손을 뗀 순간 개체가 갑자기 커지거나 작아져 어긋나 보인다.
          위치는 리렌더 없이 transform 으로 직접 쓴다(useTrayDrag). */}
      {tray.dragging && (
        <div
          ref={tray.ghostRef}
          aria-hidden
          style={{ position: 'fixed', left: 0, top: 0, zIndex: 60, pointerEvents: 'none', willChange: 'transform' }}
        >
          <TrayGhost item={tray.dragging} pxPerUnit={tray.pxPerUnit} drill={drill} coneSlot={state.coneSlot} />
        </div>
      )}

      <HelpCenter
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        initialSection={isBoard ? 'board' : 'editor'}
        onRestartTutorial={() => tutorial.start()}
      />

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

      {/* 메모 글 칸. `key` 로 갈아끼우는 이유: 모달이 초깃값을 **열릴 때 한 번만** 읽으므로
          (편집 중인 글을 바깥이 덮으면 방금 친 것이 사라진다), 다른 메모를 열 때는 컴포넌트를
          새로 세워야 그 메모의 글이 들어온다. */}
      {editingNoteObj && (
        <NoteEditModal
          key={editingNoteObj.id}
          open
          initialText={editingNoteObj.text}
          initialSize={editingNoteObj.size ?? NOTE_DEFAULT_SIZE_PX}
          initialColor={editingNoteObj.color ?? '#ffffff'}
          fresh={editingNote?.fresh ?? false}
          onSave={(text, size, color) => {
            dispatch({ type: 'NOTE_SET', note: { ...editingNoteObj, text, size, color } });
            setEditingNote(null);
          }}
          onCancel={() => {
            // 방금 놓은 쪽지를 취소하면 **도로 치운다** — 아니면 취소했는데 빈 쪽지가 남아,
            // 치우는 일이 하나 더 생긴다. 치우는 길은 지우기와 같은 함수다(소리·토스트·
            // 되돌리기가 한 벌이어야 한다는 §6.10b 의 규율).
            if (editingNote?.fresh) eraseIds([editingNoteObj.id], 'thisStep');
            setEditingNote(null);
          }}
        />
      )}
    </main>
  );
}

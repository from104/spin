// §6.10/§7.5a 편집기 3영역 골격 — 이미 만들어진 드릴(EditorProvider 로 세팅 완료)을 실제로
// 그리는 조립부. `<nav aria-label="도구">` `<div role="application">`(CourtStage 가 직접 렌더)
// `<aside aria-label="드릴 속성">` 세 영역과 하단 트랜스포트로 프로토타입 236–400행 레이아웃을
// 그대로 이식한다.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { isId } from '../../core/ids.ts';
import type { ChairId, NoteId } from '../../core/ids.ts';
import { DEFAULT_COURT_SIZE, type CourtMode, type CourtSize } from '../../model/court.ts';
import { BALL, CONE, INTERACT } from '../../core/constants.ts';
import { inkFor } from '../../core/colors.ts';
import { defaultDefense } from '../../model/rules.ts';
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
import { TrayGhost } from './TrayGhost.tsx';
import { EditorStage } from './EditorStage.tsx';
import { ViewControls } from './StageControls.tsx';
import { TransportBar } from './TransportBar.tsx';
import { FunctionBar } from './FunctionBar.tsx';
import { InspectorHost } from './InspectorHost.tsx';
import { inspectorMode } from './inspectorLayout.ts';
import { useContainerWidth } from './useContainerWidth.ts';
import { useKnownTags } from './useKnownTags.ts';
import { InspectorPanel } from './InspectorPanel.tsx';
import { HelpModal } from './HelpModal.tsx';
import { NoteEditModal } from './NoteEditModal.tsx';
import { useEditorKeyboard } from './useEditorKeyboard.ts';
import { useStepPlayback } from './useStepPlayback.ts';
import { usePhysicsRenderLoop } from './usePhysicsRenderLoop.ts';

/** 자유 전술판일 때만 내려오는 조작부. 판을 갈아끼우는 일(코트 전환·초기화)과 정식 드릴로의
 *  승격은 저장소를 만지므로 화면(screen-board) 책임이고, 여기서는 호출만 한다. */
export interface BoardControls {
  /** 저장본이 리셋 상태였는가. 런타임의 `past.length === 0` 와 **AND** 로 코트 전환 게이트를
   *  만든다 — 저장본까지 봐야 하는 이유는 storage/board.ts 의 pristine 주석 참고. */
  pristine: boolean;
  onCourtChange(mode: CourtMode): void;
  /** §6.4 코트 크기 3단. 코트 형태 전환과 **같은 문**(pristine)을 지난다 — 그래야 판 위에
   *  개체가 하나도 없을 때만 규격이 바뀌어 "코트를 줄였더니 선수가 밖에 서 있다" 가 없다. */
  onCourtSizeChange(size: CourtSize): void;
  onReset(): void;
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
}

export function EditorWorkspace({ mode = 'drill', board }: EditorWorkspaceProps = {}) {
  const isBoard = mode === 'board';
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const worldRef = useEditorWorld();
  const writer = useEditorWriter();
  const { prefs, physics } = useSettingsState();
  const { setPrefs } = useSettingsActions();
  const nav = useAppNav();
  const toast = useToast();
  // 전술판은 drillRepo 에 자동저장하지 않는다 — 목록에 뜨지 않는 임시 판이다(스냅샷 1장은
  // 화면 쪽이 storage/board.ts 로 따로 들고 있다). 훅 자체는 조건 없이 부른다(훅 규칙).
  const autosave = useAutosave(!isBoard);
  const { playing, speed } = usePlaybackState();
  const playbackActions = usePlaybackActions();

  const drill = state.present;
  const stepIndex = selectStepIndex(state);
  const step = drill.steps[stepIndex] ?? drill.steps[0]!;

  const stageRef = useRef<CourtStageHandle | null>(null);
  // 3.9 — 도움말은 문이 둘이라 돌아갈 곳도 둘이다. **버튼**으로 열면 그 버튼으로 돌아간다
  // (Safari 는 클릭이 버튼에 포커스를 주지 않아 Modal 의 openedBy 폴백이 body 가 된다 —
  // ref 로 못박는다). **Shift+?** 로 열면 ref 를 비워 폴백이 이기게 한다 — 열던 순간의
  // 포커스(코트·개체)로 돌아가야지, 쓴 적도 없는 버튼으로 끌려가면 안 된다.
  const helpTriggerRef = useRef<HTMLElement | null>(null);
  // 옛 기록(2026-08-14): 도움말이 [보기] 팝오버 **안**에 있던 시절에는 이 ref 가 [도움말]
  // 항목이 아니라 **[보기] 버튼**을 가리켜야 했다 — 팝오버는 도움말이 열리기 직전에 닫히므로
  // 항목 자신이 이미 DOM 에서 떨어져 나갔고, Modal 의 복귀는 isConnected 를 검사하기
  // 때문이다(ui/Modal.tsx:70). 2026-08-16 에 [도움말]이 기둥 상시 칸으로 나오면서 그 우회가
  // 없어졌다 — 트리거가 열리는 동안에도 제자리에 있다.
  const helpButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pendingPlayerId, setPendingPlayerId] = useState<ChairId | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
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
  const pinned = prefs.inspectorPinned;
  const [inspectorOpen, setInspectorOpen] = useState(pinned);
  // §3.5 — 기존 태그는 인스펙터가 **열린 뒤에** 읽는다. 열지도 않은 사람에게 목록 IDB 읽기를
  // 시킬 이유가 없고(오버레이가 기본 접힘이다), 전술판에서는 아예 읽지 않는다.
  const knownTags = useKnownTags(!isBoard && inspectorOpen);
  const inspectorPanelId = useId();
  const inspectorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [workspaceRef, workspaceWidth] = useContainerWidth<HTMLElement>();
  // ⚠️ 2026-08-14 기현님 재설계 — **자유 전술판에는 인스펙터가 없다.** 남길 둘(코트 크기·골대
  // 원위치)은 오른쪽 기능 바로 갔고 나머지(드릴 정보·배치 프리셋·선수 명단·선택 개체)는
  // 지웠다(*"속성 탭은 정말 무용지물이다 … 대부분 삭제하는게 맞다"*). 그래서 크롬 예산에도
  // 'hidden' 이 가야 한다 — 안 그러면 판 회전(useStageRot)이 있지도 않은 패널 폭을 빼고 센다.
  const inspectorLayout = isBoard ? ('hidden' as const) : inspectorMode({ open: inspectorOpen, pinned, containerWidthPx: workspaceWidth });
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
  const stageRot = useStageRot(drill.courtMode, drill.courtSize, { narrow, trayBand, board: isBoard, inspector: inspectorLayout });
  // ★ 코트 칸의 종횡비(§4.1, 2026-08-14 P3) — 판 덩어리 안에서 코트가 **자기 비율만큼만**
  // 차지하게 하는 한 줄이다. 남는 폭은 트레이가 먹는다 = 옛 레터박스 86px 이 그대로 벤치가 된다.
  // 입력은 `def`(courtMode·courtSize)와 `rot` 뿐이다 — 줌도 측정값도 안 들어간다(그 이유는
  // boardLayout.ts 의 courtCellAspectRatio ⚠️).
  const courtAspect = courtCellAspectRatioCss(drill.courtMode, drill.courtSize, stageRot);
  // 격자·규칙존 토글은 로컬 state 가 아니라 prefs 를 직접 신뢰값으로 쓴다 — 로컬 state 였을 때는
  // 화면을 벗어났다 돌아오면(EditorWorkspace 재마운트) 항상 prefs 값으로 리셋됐다(감사 지적).
  const showGrid = prefs.showGrid;
  const showRuleZones = prefs.showRuleZones;
  // 시트의 포커스 이펙트가 이 함수의 identity 에 걸려 있다 — 렌더마다 새로 만들면 제목으로
  // 포커스를 계속 빼앗는다(InspectorHost 의 이펙트 주석).
  const closeInspector = useCallback(() => setInspectorOpen(false), []);
  const toggleGrid = useCallback(() => setPrefs({ showGrid: !prefs.showGrid }), [prefs.showGrid, setPrefs]);
  const toggleRuleZones = useCallback(() => setPrefs({ showRuleZones: !prefs.showRuleZones }), [prefs.showRuleZones, setPrefs]);

  // §4.4 P2-4 규칙 오버레이. writer 와 달리 store 가 아니라 여기서 만든다 — 화면을 벗어나면
  // 링·존 노드도 함께 사라지므로 판정 상태를 판 밖까지 들고 다닐 이유가 없다.
  const rules = useMemo(() => createRuleOverlay(), []);
  usePhysicsRenderLoop(worldRef, writer, rules);
  useStepPlayback(drill, state.stepId, dispatch);

  // ★ 코트 자유 전환 게이트(§6.8 재편, 기현 결정) — **판이 리셋 상태일 때만** 연다.
  //
  // D12 는 full↔half 전환이 배치를 보존할 수 없다고 못박았다(30×18m 와 18×15m 는 어떤 아핀
  // 변환으로도 같은 전술이 안 된다). 경고를 띄우고 날리는 대신, 잃을 배치가 없을 때로 전환을
  // 한정해 손실 자체를 만들지 않는다.
  //
  // 두 조건을 **모두** 봐야 한다. past.length 만 보면 편집된 판을 저장하고 다시 열었을 때
  // 그 판이 새 기준선이 되어 past 가 비므로 dirty 인데도 열린다(storage/board.ts pristine 주석).
  const boardPristine = isBoard && (board?.pristine ?? false) && state.past.length === 0;

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
          // ⚠️ **자유 전술판의 헤더는 비어 있다**(기현 지시 2026-08-14: *"레이블, 문구 삭제하고
          // 드릴로 저장 버튼 오른쪽 도구모음으로 옮기고 상단 헤더 삭제. 공간 확보"*).
          //  · 코트 전환 세그먼트 → 기능 바 [코트]
          //  · 되돌리기·다시하기 → 기능 바
          //  · [드릴로 저장]    → 기능 바 맨 끝(주 액션)
          //  · 제목 '자유 전술판' · 부제 → **삭제**. 판이 화면을 다 쓰는데 그 위에 "지금
          //    전술판을 보고 있습니다" 를 적어 두는 것은 자리만 먹는다.
          // 넓은 창에서는 AppShell 이 헤더 자체를 **안 세운다**(레일이 이동을 진다).
          // 좁은 창에서는 남는다 — 거기서는 헤더의 3칸 세그먼트가 유일한 이동 수단이다
          // (기현님 확인: *"좁은창 이동에서의 헤더는 유지"*). 그때도 내용은 세그먼트뿐이다.
          title: '',
        }
      : {
          // ⚠️ 2026-08-15 (재설계 ②) — 헤더에서 **[저장]과 코트 세그먼트가 빠졌다.**
          //  · [저장]  → 기능 바 맨 끝(전술판의 [드릴로 저장]과 **같은 자리**). 자동저장
          //    상태도 그 칸이 말한다.
          //  · 코트 세그먼트 → 기능 바 [코트](잠긴 채로 값만 보여 준다). 옛 계약
          //    (`onLockedAttempt` 로 이유를 말한다)은 그대로 옮겨 갔다.
          // 남는 것은 **이 드릴이 무엇인가**(제목·편집중)와 시연으로 가는 문뿐이다.
          title: drill.title,
          badge: '편집중',
          presentButton: { onAction: () => nav.go('present', { kind: 'drill', id: drill.id }) },
        },
  );

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
      toast.show(removalToast(done), {
        action: {
          label: '되돌리기',
          onAction: () => {
            for (let i = 0; i < count; i++) dispatch({ type: 'UNDO' });
          },
        },
      });
    },
    [dispatch, toast],
  );

  const gotoStep = useCallback(
    (delta: 1 | -1) => {
      const idx = selectStepIndex(state);
      const next = drill.steps[idx + delta];
      if (next) dispatch({ type: 'STEP_SELECT', id: next.id });
    },
    [dispatch, drill.steps, state],
  );

  // [한 장 더 찍기](§4.4 P2-3)는 **한 번**의 조작이어야 한다 — 찍고 나면 방금 찍은 장이
  // 손에 들려 있어야지, 옛 장을 든 채 새 장이 옆에 쌓이면 다음 동작이 엉뚱한 판에 들어간다.
  // STEP_ADD 는 새 스텝의 id 를 돌려주지 않으므로(리듀서는 순수하다) 커밋된 뒤 **바로 뒤**
  // 스텝을 고른다 — addStepAfter 가 i+1 에 꽂는 것이 그 함수의 계약이다(edits.ts).
  // 인스펙터의 [스텝 추가]는 이 경로를 타지 않는다(거기서는 목록이 통째로 보인다).
  const [addedAfter, setAddedAfter] = useState<number | null>(null);
  const addStepHere = useCallback(() => {
    const i = selectStepIndex(state);
    setAddedAfter(i);
    dispatch({ type: 'STEP_ADD', afterIndex: i });
  }, [dispatch, state]);
  useEffect(() => {
    if (addedAfter === null) return;
    setAddedAfter(null);
    const added = drill.steps[addedAfter + 1];
    if (added) dispatch({ type: 'STEP_SELECT', id: added.id });
  }, [addedAfter, drill.steps, dispatch]);

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
    onPrevStep: () => gotoStep(-1),
    onNextStep: () => gotoStep(1),
    onTogglePlay: () => playbackActions.toggle(),
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
    onShowHelp: () => {
      helpTriggerRef.current = null; // 키보드 문 — openedBy 폴백(열던 순간의 포커스)이 이긴다
      setHelpOpen(true);
    },
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
      courtLabel={{ full: '풀 코트', half: '하프 코트', flat: '플랫 코트' }[drill.courtMode]}
      orientation={trayBand ? 'horizontal' : 'vertical'}
      onItemPointerDown={tray.start}
    />
  );

  // 하단 바에 남는 조작 — **[속성] 하나뿐**이다(2026-08-15 재설계 ②).
  //
  // [보기▾]는 기능 바로 갔다. [속성]이 아직 여기 남는 이유는 인스펙터가 아직 살아 있기
  // 때문이고(재설계 ③이 그것을 해체한다), 그때 이 컴포넌트도 함께 사라진다.
  const viewControls = (
    <ViewControls
      showViewMenu={false}
      showGrid={showGrid}
      onToggleGrid={toggleGrid}
      showRuleZones={showRuleZones}
      onToggleRuleZones={toggleRuleZones}
      onShowHelp={() => {
        // ⚠️ `showViewMenu={false}` 라 이 화면에서 이 문은 **안 열린다**(도움말은 기능 바의
        // 상시 칸이 연다). 배선을 남기는 이유는 컴포넌트가 아직 그 메뉴를 그릴 수 있기
        // 때문이다 — 살아 있는 경로가 아니라 컴포넌트 계약을 채우는 줄이다.
        helpTriggerRef.current = helpButtonRef.current;
        setHelpOpen(true);
      }}
      viewButtonRef={helpButtonRef}
      inspectorOpen={inspectorOpen}
      onToggleInspector={() => setInspectorOpen((v) => !v)}
      inspectorPanelId={inspectorPanelId}
      inspectorButtonRef={inspectorTriggerRef}
    />
  );

  // §5.4 [골대 원위치] — **두 손잡이가 부르는 하나의 핸들러**다.
  //   ① 인스펙터 [드릴 정보] 맨 끝(2026-08-13 기현님 신고로 생긴 주 자리)
  //   ② [코트 비우기] 확인 모달 안의 [골대만 원위치](4.7 이 만든 자리 — 남겨 둔다)
  // 두 곳이 각자 world 를 부르면 "막혔을 때 알린다" 같은 규칙이 한쪽에서만 사라진다.
  // 같은 참조를 넘기는 것을 EditorWorkspace.resetGoals.test.tsx 의 소스 계약이 못박는다.
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
    if (r && r.blocked > 0) toast.show('골대 자리에 휠체어가 있어 되돌리지 못했습니다. 휠체어를 옮긴 뒤 다시 눌러 주세요.');
  }, [worldRef, toast]);

  // 오른쪽 기능 바 — **두 화면 다 선다**(2026-08-15 드릴 편집 재설계 ②).
  //
  // 옛 기록(지우지 않는다): *"자유 전술판 전용이다. 드릴 편집은 아직 옛 배치(하단 TransportBar
  // + 인스펙터)를 쓴다"*. 그 배치에서는 줌·되돌리기가 트레이에, [보기]가 하단 바에, [골대
  // 원위치]가 인스펙터 시트 안에 있었다 — 즉 **같은 조작이 화면마다 다른 자리**였고, 두 화면을
  // 오가는 코치의 공간 기억이 매번 뒤집혔다(§3 불변식 1 이 지키려던 바로 그것).
  //
  // 다른 점은 딱 셋이다: [비우기]가 없고(FUNCTION_BAR_ITEMS_DRILL), [코트]가 언제나 잠겨
  // 있으며(드릴의 코트는 불변이다 — 옛 헤더 세그먼트의 계약을 그대로 물려받는다), [저장]이
  // '드릴로 저장' 이 아니라 '자동저장 지금 밀어넣기' 다.
  const functionBar = (
    <FunctionBar
      mode={board ? 'board' : 'drill'}
      saveStatus={isBoard ? undefined : autosave.status === 'saving' ? 'saving' : 'idle'}
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
        toast.show(board ? '전술판을 초기화하면 코트 형태와 크기를 바꿀 수 있습니다.' : '코트 형태는 드릴을 만든 뒤에는 바꿀 수 없습니다.')
      }
      onResetGoals={resetGoals}
      defense={drill.defense ?? defaultDefense(drill.courtMode)}
      teams={drill.teams}
      onToggleDefense={toggleDefense}
      onReset={() => board?.onReset()}
      drill={drill}
      showGrid={showGrid}
      onToggleGrid={toggleGrid}
      showRuleZones={showRuleZones}
      onToggleRuleZones={toggleRuleZones}
      onShowHelp={() => {
        // 버튼 문 — 닫히면 [도움말] 버튼으로 돌아온다. ⚠️ **이중 보증의 둘째 벨트다**:
        // 이 줄을 지워도 Modal 의 openedBy 폴백(열던 순간의 포커스 = 방금 누른 그 버튼)이
        // 같은 곳을 집는다. 남기는 이유는 반대 문(Shift+?)이 이 ref 를 **비워** 폴백에
        // 맡기기 때문이다 — 두 문이 같은 자리를 명시적으로 갈라 놔야 한쪽이 바뀔 때 조용히
        // 어긋나지 않는다.
        helpTriggerRef.current = helpButtonRef.current;
        setHelpOpen(true);
      }}
      helpButtonRef={helpButtonRef}
      onSaveAsDrill={() => (board ? board.onSaveAsDrill() : void autosave.flush())}
    />
  );

  const inspector = (
    <InspectorPanel
      drill={drill}
      // §6.4 크기 선택은 **인스펙터(오버레이 시트)** 안이다 — 첫 화면 표적 예산(≤40, 여유 0)을
      // 한 칸도 쓰지 않기 위해서다(계획서 §3 · boardTargetBudget.test.tsx). 시트는 닫혀 있으면
      // DOM 에 아예 없다(InspectorHost 의 mode==='hidden' → null).
      courtSizeSwitch={
        board
          ? {
              value: drill.courtSize ?? DEFAULT_COURT_SIZE,
              locked: !boardPristine,
              onChange: (s: CourtSize) => board.onCourtSizeChange(s),
            }
          : undefined
      }
      step={step}
      stepIndex={stepIndex}
      dispatch={dispatch}
      selection={state.selection}
      pendingPlayerId={pendingPlayerId}
      onArmPlayer={armPlayer}
      onEraseIds={eraseIds}
      // ⚠️ 드릴 편집기에도 **똑같이** 내려간다. 골대는 두 모드 다 물리 바디이고(EditorStage 의
      //    goals 는 courtDefFor 에서 오지 mode 를 안 본다), 휠체어에 밀리는 사고도 두 모드 다
      //    난다 — 그런데 4.7 이후 되돌릴 손잡이는 **전술판 하단 바의 모달 안에만** 있어서 드릴
      //    편집 중에 밀린 골대는 되돌릴 길이 아예 없었다(2026-08-13 확인).
      onResetGoals={resetGoals}
      knownTags={knownTags}
      showSteps={!isBoard}
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
        방향키로 커서 이동, Enter로 배치, Alt+←/→로 개체 순회
      </span>

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
              // 띠(column)면 폭을 다 쓰고 높이를 가둔다. 기둥(row)이면 그 반대다.
              ...(trayBand ? { width: '100%' } : { height: '100%' }),
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
              style={{
                flex: '0 1 auto',
                minWidth: 0,
                minHeight: 0,
                position: 'relative',
                aspectRatio: courtAspect,
                ...(trayBand ? { width: '100%' } : { height: '100%' }),
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
                onEditNote={(id, fresh) => setEditingNote({ id, fresh })}
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

        {/* 2026-08-14 — 전술판의 **하단 바가 통째로 사라졌다.** [코트 비우기]·[내보내기]·
            속도 제한·[보기]·[속성]이 전부 오른쪽 기능 바로 갔다. BoardBar.tsx 는 아직 지우지
            않는다: 드릴 편집이 같은 바(TransportBar)를 쓰고, 그쪽 재설계가 아직 남아 있다. */}
        {isBoard ? null : (
          <TransportBar
            drill={drill}
            stepId={state.stepId}
            onSelectStep={(id) => dispatch({ type: 'STEP_SELECT', id })}
            onReorderStep={(id, toIndex) => dispatch({ type: 'STEP_REORDER', id, toIndex })}
            onAddStep={addStepHere}
            playing={playing}
            onTogglePlay={() => playbackActions.toggle()}
            speed={speed}
            onCycleSpeed={() => playbackActions.setSpeed(speed === 0.5 ? 1 : speed === 1 ? 2 : 0.5)}
            viewControls={viewControls}
          />
        )}
      </div>

      {functionBar}

      {isBoard ? null : (
      <InspectorHost
        id={inspectorPanelId}
        open={inspectorOpen}
        pinned={pinned}
        containerWidthPx={workspaceWidth}
        edge={portrait ? 'bottom' : 'side'}
        onClose={closeInspector}
        // 핀은 **모양만** 바꾼다. 여닫힘을 함께 건드리면 붙박이로 바꾼 순간 패널이 사라졌다
        // 다시 나타나며 인스펙터가 재마운트된다(완료 판정 (b) 가 막는 것이 정확히 이것이다).
        onTogglePin={() => setPrefs({ inspectorPinned: !pinned })}
        returnFocusRef={inspectorTriggerRef}
      >
        {inspector}
      </InspectorHost>
      )}

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

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} returnFocusRef={helpTriggerRef} mode={mode} />

      {/* 메모 글 칸. `key` 로 갈아끼우는 이유: 모달이 초깃값을 **열릴 때 한 번만** 읽으므로
          (편집 중인 글을 바깥이 덮으면 방금 친 것이 사라진다), 다른 메모를 열 때는 컴포넌트를
          새로 세워야 그 메모의 글이 들어온다. */}
      {editingNoteObj && (
        <NoteEditModal
          key={editingNoteObj.id}
          open
          initialText={editingNoteObj.text}
          fresh={editingNote?.fresh ?? false}
          onSave={(text) => {
            dispatch({ type: 'NOTE_SET', note: { ...editingNoteObj, text } });
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

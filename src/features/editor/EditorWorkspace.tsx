// §6.10/§7.5a 편집기 3영역 골격 — 이미 만들어진 드릴(EditorProvider 로 세팅 완료)을 실제로
// 그리는 조립부. `<nav aria-label="도구">` `<div role="application">`(CourtStage 가 직접 렌더)
// `<aside aria-label="드릴 속성">` 세 영역과 하단 트랜스포트로 프로토타입 236–400행 레이아웃을
// 그대로 이식한다.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { isId } from '../../core/ids.ts';
import type { ChairId } from '../../core/ids.ts';
import { DEFAULT_COURT_SIZE, type CourtMode, type CourtSize } from '../../model/court.ts';
import { BALL, CONE, INTERACT } from '../../core/constants.ts';
import { inkFor } from '../../core/colors.ts';
import { useAutosave } from '../../app/useAutosave.ts';
import { useAppHeader } from '../../app/AppHeader.tsx';
import { useAppNav } from '../../app/useAppHistory.ts';
import { useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { selectStepIndex } from '../../store/editor/reducer.ts';
import { effectiveReduceMotion, stepTransitionMs } from '../../store/editor/tween.ts';
import { usePlaybackActions, usePlaybackState } from '../../store/playback/PlaybackProvider.tsx';
import { useSettingsActions, useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { useIsPortrait } from '../../ui/useIsPortrait.ts';
import { useIsNarrow } from '../../ui/useIsNarrow.ts';
import { courtPadCss } from '../../app/chromeBudget.ts';
import { useStageRot } from '../../app/useStageRot.ts';
import type { CourtStageHandle } from '../../render/CourtStage.tsx';
import { createRuleOverlay } from '../../render/ruleOverlay.ts';
import { ToolRail, type ChairSlot, type TrayDrawers } from './ToolRail.tsx';
import { courtCellAspectRatioCss } from './boardLayout.ts';
import { drillUsesOf } from './drillUses.ts';
import { useTrayDrag } from './useTrayDrag.ts';
import { placeObject } from './placement.ts';
import { TrayGhost } from './TrayGhost.tsx';
import { EditorStage } from './EditorStage.tsx';
import { ViewControls } from './StageControls.tsx';
import { TransportBar } from './TransportBar.tsx';
import { BoardBar } from './BoardBar.tsx';
import { InspectorHost } from './InspectorHost.tsx';
import { inspectorMode } from './inspectorLayout.ts';
import { useContainerWidth } from './useContainerWidth.ts';
import { useKnownTags } from './useKnownTags.ts';
import { InspectorPanel } from './InspectorPanel.tsx';
import { HelpModal } from './HelpModal.tsx';
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
  // 2026-08-14: 이 ref 가 가리키는 것은 이제 [도움말] 항목이 아니라 **[보기] 버튼**이다.
  // 도움말은 [보기] 팝오버 **안**에서 열리고 그 팝오버는 열리기 직전에 닫히므로, 항목 자신은
  // 도움말이 닫힐 때 이미 DOM 에 없다 — Modal 의 복귀는 isConnected 를 검사하므로(ui/Modal.tsx:70)
  // 떼어진 노드를 주면 포커스가 아무 데도 안 간다. 남아 있는 조상 손잡이가 [보기] 다.
  const viewButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pendingPlayerId, setPendingPlayerId] = useState<ChairId | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // 세로 화면(§6.4 태블릿): 도구·속성을 아래로 내려 코트가 폭을 다 쓰게 한다.
  const portrait = useIsPortrait();
  // 좁은 창(§5.1): 크롬 예산을 줄인다. 여기서 걷어내는 것은 코트 래퍼 패딩 한 행이고,
  // 나머지 행(레일·헤더·하단 바·트레이)은 각자 담당 항목이 같은 boolean 으로 줄인다.
  const narrow = useIsNarrow();
  // 트레이(도구·개체)를 판의 어느 변에 붙일지. 가로 화면이면 판 **오른쪽**, 세로면 판 아래.
  const trayAxis = portrait ? ('column' as const) : ('row' as const);
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
  const inspectorLayout = inspectorMode({ open: inspectorOpen, pinned, containerWidthPx: workspaceWidth });
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
  const stageRot = useStageRot(drill.courtMode, drill.courtSize, { narrow, inspector: inspectorLayout });
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

  const history = {
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    onUndo: () => dispatch({ type: 'UNDO' }),
    onRedo: () => dispatch({ type: 'REDO' }),
  };

  useAppHeader(
    isBoard
      ? {
          title: '자유 전술판',
          subtitle: '코트를 자유롭게 바꿔가며 그려 보세요. 마음에 들면 드릴로 저장합니다.',
          primary: { label: '드릴로 저장', onAction: () => board?.onSaveAsDrill() },
          history,
          courtSwitch: {
            value: drill.courtMode,
            locked: !boardPristine,
            onChange: (m) => board?.onCourtChange(m),
            onLockedAttempt: () => toast.show('전술판을 초기화하면 코트 형태를 바꿀 수 있습니다.'),
          },
        }
      : {
          title: drill.title,
          badge: '편집중',
          primary: { label: autosave.status === 'saving' ? '저장 중…' : '저장', onAction: () => void autosave.flush() },
          presentButton: { onAction: () => nav.go('present', { kind: 'drill', id: drill.id }) },
          history,
          courtSwitch: {
            value: drill.courtMode,
            locked: true,
            onLockedAttempt: () => toast.show('코트 형태는 드릴을 만든 뒤에는 바꿀 수 없습니다.'),
          },
        },
  );

  const eraseIds = useCallback(
    (ids: string[], scope: 'onward' | 'thisStep') => {
      let count = 0;
      for (const id of ids) {
        if (isId(id, 'ch') || isId(id, 'bl') || isId(id, 'cn')) {
          dispatch({ type: 'OBJECT_REMOVE', id, scope });
          count++;
        } else if (isId(id, 'nt')) {
          dispatch({ type: 'NOTE_REMOVE', id });
          count++;
        } else if (isId(id, 'ar')) {
          dispatch({ type: 'ARROW_REMOVE', id });
          count++;
        }
      }
      if (count === 0) return;
      dispatch({ type: 'SELECT_CLEAR' });
      toast.show(`${count}개 삭제했습니다.`, {
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
        dispatch,
        showToast: (m) => toast.show(m),
        onPlayerPlaced: () => setPendingPlayerId(null),
      });
    },
  });

  useEditorKeyboard({
    tool: state.tool,
    singleKeyMode: prefs.a11y.singleKeyShortcuts,
    selectionSize: state.selection.size,
    onSelectTool: (t) => dispatch({ type: 'TOOL_SET', tool: t }),
    onConeToggle: () => dispatch({ type: 'CONE_SLOT_SET', slot: state.coneSlot === 0 ? 1 : 0 }),
    onUndo: () => dispatch({ type: 'UNDO' }),
    onRedo: () => dispatch({ type: 'REDO' }),
    onSave: () => void autosave.flush(),
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
    onEraseSelection: (scope) => eraseIds(Array.from(state.selection), scope),
    onShowHelp: () => {
      helpTriggerRef.current = null; // 키보드 문 — openedBy 폴백(열던 순간의 포커스)이 이긴다
      setHelpOpen(true);
    },
    // [A-3] Esc = 선택 해제. 2단 히트(1.6) 이후 붐비는 코트에서 "빈 곳 탭" 이 사라져도
    // 해제가 가능해야 한다. 재탭 해제(useEditorPointer)와 함께 대체 경로 한 쌍이다.
    onSelectionClear: () => dispatch({ type: 'SELECT_CLEAR' }),
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

  // §3 불변식 3 — 이 드릴이 **실제로 쓰는** 말. 스텝 전체를 본다: 3번 스텝에만 화살표가 있어도
  // 그 드릴은 화살표를 쓰는 드릴이고, 1번 스텝을 보고 있는 사람에게도 서랍이 준비돼 있어야 한다.
  // 고급자가 만든 것을 초보자가 받아 열었을 때 *"이 드릴에 있는 것을 나는 왜 못 만드나"* 가
  // 생기지 않게 하는 것이 목적이라, 판단 기준은 현재 스텝이 아니라 드릴이다.
  const drillUses = useMemo(() => drillUsesOf(drill), [drill]);
  // 서랍 개폐를 prefs 에 남긴다 — §3 불변식 2 의 *'영구히'* 를 기기 재시작 너머로 들고 가는
  // 자리가 3.0 이 세워 둔 `prefs.tray` 다(판이 아니라 prefs 인 이유: 판마다 서랍이 다르면
  // 표적 좌표가 판마다 달라진다).
  const setTrayDrawers = useCallback((next: TrayDrawers) => void setPrefs({ tray: next }), [setPrefs]);

  // 두 배치가 **같은 컴포넌트 인스턴스**를 쓰도록 조각으로 뽑는다. 가로/세로에서 각각 따로
  // 렌더하면 방향이 바뀔 때 언마운트–재마운트가 일어나 인스펙터의 펼침 상태 같은 것이 날아간다.
  const toolRail = (
    <ToolRail
      tool={state.tool}
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
      tray={prefs.tray}
      onTrayChange={setTrayDrawers}
      drillUses={drillUses}
      orientation={portrait ? 'horizontal' : 'vertical'}
      // 줌 3개는 판 위가 아니라 **기둥 맨 위**다(2026-08-14, 설계서 §3-ㄱ). 부르는 대상은
      // 예전 StageControls 와 **같은 무대 핸들**이라 단축키(Ctrl +/−/0)와 한 경로다.
      zoom={{
        onZoomIn: () => stageRef.current?.zoomBy(INTERACT.zoomStep),
        onZoomOut: () => stageRef.current?.zoomBy(1 / INTERACT.zoomStep),
        onZoomReset: () => stageRef.current?.resetZoom(),
      }}
      onItemPointerDown={tray.start}
    />
  );

  // 뷰 컨트롤([보기▾] · [속성]) — 하단 바 둘이 **같은 인스턴스**를 쓴다(§5.1 "컨테이너만 바꾼다").
  // 두 바에 각자 렌더하면 전술판↔드릴 사이를 오갈 때 팝오버 개폐 state 가 날아간다.
  const viewControls = (
    <ViewControls
      showGrid={showGrid}
      onToggleGrid={toggleGrid}
      showRuleZones={showRuleZones}
      onToggleRuleZones={toggleRuleZones}
      onShowHelp={() => {
        // 버튼 문 — 닫히면 [보기] 버튼으로. ⚠️ **지금 이 줄은 이중 보증의 둘째 벨트다**:
        // 팝오버 자신이 닫히면서 returnFocusRef 로 [보기] 에 포커스를 되돌려 놓기 때문에,
        // 이 줄을 지워도 도움말 Modal 의 openedBy 폴백이 같은 버튼을 집는다(2026-08-14 반증
        // 실험으로 확인 — 지우고 돌려도 15개 전건 초록이었다. 그래서 '이 줄이 없으면 깨진다'
        // 고 적지 않는다). 남기는 이유: 도움말을 여는 문이 이 팝오버 하나가 아니게 되는 순간
        // (직행 버튼이 다시 생기거나 메뉴가 안 닫히게 바뀌면) 폴백이 곧바로 어긋나는데,
        // 그때는 조용히 깨진다 — Shift+? 문이 폴백에 기대는 것과 대칭으로 못박아 둔다.
        helpTriggerRef.current = viewButtonRef.current;
        setHelpOpen(true);
      }}
      viewButtonRef={viewButtonRef}
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
  const resetGoals = useCallback(() => {
    // 막혀 있으면 반드시 말해 준다. 조용히 실패하면 "버튼이 고장났나" 하며 계속
    // 누르게 된다(실제 신고). 휠체어는 static 이라 골대가 밀어낼 수 없다.
    const r = worldRef.current?.resetGoals();
    if (r && r.blocked > 0) toast.show('골대 자리에 휠체어가 있어 되돌리지 못했습니다. 휠체어를 옮긴 뒤 다시 눌러 주세요.');
  }, [worldRef, toast]);

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
      // 세로 화면은 위→아래로 쌓는다(§6.4): 코트가 폭을 다 쓰고, 도구·속성이 아래로 간다.
      // 다만 **붙박이 인스펙터가 서면 가로로 돌린다** — 세로 배치에서 width:312 는 교차축
      // 크기가 되어 패널이 판 아래에 납작하게 눕는다. 붙박이는 컨테이너 폭 ≥1100 에서만
      // 성립하므로(inspectorLayout) 그때는 오른쪽에 세울 폭이 반드시 있다.
      // position:relative 는 오버레이 시트의 기준 상자다 — 이것이 없으면 시트가 화면 전체를
      // 기준으로 떠서 레일·헤더 위까지 덮는다.
      // ⚠️ 아래 style 객체는 **한 줄**이어야 한다 — appShell.contract.test.ts 가 방향 전환이 적힌
      // 그 줄에서 minHeight:0 을 함께 찾는다(세로 축 플렉스 사슬은 jsdom 이 못 잡아 소스로 지킨다).
      style={{ flex: 1, display: 'flex', flexDirection: portrait && inspectorLayout !== 'pinned' ? 'column' : 'row', minHeight: 0, outline: 'none', position: 'relative' }}
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
              ...(portrait ? { width: '100%' } : { height: '100%' }),
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
                ...(portrait ? { width: '100%' } : { height: '100%' }),
              }}
            >
              <EditorStage
                ref={stageRef}
                drill={drill}
                rot={stageRot}
                step={step}
                tool={state.tool}
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

        {isBoard ? (
          <BoardBar
            courtMode={drill.courtMode}
            courtSize={drill.courtSize}
            courtLocked={!boardPristine}
            // 내보내기 시트(§6.4)가 굽는 것은 **지금 리듀서가 들고 있는 판**이다 — 물리 세계가
            // 아니라 모델이다. 드래그는 커밋 스냅에서 모델로 들어오므로(§4.3) 손을 뗀 뒤의
            // 배치가 그림·인쇄에 그대로 나온다.
            drill={drill}
            showGrid={showGrid}
            showRuleZones={showRuleZones}
            onReset={() => board?.onReset()}
            onResetGoals={resetGoals}
            viewControls={viewControls}
          />
        ) : (
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

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} returnFocusRef={helpTriggerRef} />
    </main>
  );
}

// §6.10/§7.5a 편집기 3영역 골격 — 이미 만들어진 드릴(EditorProvider 로 세팅 완료)을 실제로
// 그리는 조립부. `<nav aria-label="도구">` `<div role="application">`(CourtStage 가 직접 렌더)
// `<aside aria-label="드릴 속성">` 세 영역과 하단 트랜스포트로 프로토타입 236–400행 레이아웃을
// 그대로 이식한다.
import { useCallback, useId, useRef, useState } from 'react';
import { isId } from '../../core/ids.ts';
import type { ChairId } from '../../core/ids.ts';
import type { CourtMode } from '../../model/court.ts';
import { BALL, CONE, INTERACT } from '../../core/constants.ts';
import { inkFor } from '../../core/colors.ts';
import { useAutosave } from '../../app/useAutosave.ts';
import { useAppHeader } from '../../app/AppHeader.tsx';
import { useAppNav } from '../../app/useAppHistory.ts';
import { useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { selectStepIndex } from '../../store/editor/reducer.ts';
import { usePlaybackActions, usePlaybackState } from '../../store/playback/PlaybackProvider.tsx';
import { useSettingsActions, useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { useIsPortrait } from '../../ui/useIsPortrait.ts';
import type { CourtStageHandle } from '../../render/CourtStage.tsx';
import { ToolRail, type ChairSlot } from './ToolRail.tsx';
import { useTrayDrag } from './useTrayDrag.ts';
import { placeObject } from './placement.ts';
import { TrayGhost } from './TrayGhost.tsx';
import { EditorStage } from './EditorStage.tsx';
import { StageControls } from './StageControls.tsx';
import { TransportBar } from './TransportBar.tsx';
import { BoardBar } from './BoardBar.tsx';
import { InspectorHost } from './InspectorHost.tsx';
import { inspectorMode } from './inspectorLayout.ts';
import { useContainerWidth } from './useContainerWidth.ts';
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
  const helpTriggerRef = useRef<HTMLElement | null>(null);
  const [pendingPlayerId, setPendingPlayerId] = useState<ChairId | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // 세로 화면(§6.4 태블릿): 도구·속성을 아래로 내려 코트가 폭을 다 쓰게 한다.
  const portrait = useIsPortrait();
  // 트레이(도구·개체)를 판의 어느 변에 붙일지. 가로 화면이면 판 **오른쪽**, 세로면 판 아래.
  const trayAxis = portrait ? ('column' as const) : ('row' as const);
  // ★ 인스펙터(결정 ③A) — **기본 접힘 오버레이**. 핀 취향만 prefs 에 남고 여닫힘은 로컬이다:
  //   여닫힘까지 저장하면 태블릿에서 열어 둔 채 앱을 닫은 사람이 다음에 PC 에서 판을 가린
  //   채로 만나게 된다. 대신 **핀을 켜 둔 사람은 열린 채로 시작한다** — 붙박이를 골라 놓고
  //   매번 다시 열어야 하면 핀이 아니다.
  const pinned = prefs.inspectorPinned;
  const [inspectorOpen, setInspectorOpen] = useState(pinned);
  const inspectorPanelId = useId();
  const inspectorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [workspaceRef, workspaceWidth] = useContainerWidth<HTMLElement>();
  // 격자·규칙존 토글은 로컬 state 가 아니라 prefs 를 직접 신뢰값으로 쓴다 — 로컬 state 였을 때는
  // 화면을 벗어났다 돌아오면(EditorWorkspace 재마운트) 항상 prefs 값으로 리셋됐다(감사 지적).
  const showGrid = prefs.showGrid;
  const showRuleZones = prefs.showRuleZones;
  // 시트의 포커스 이펙트가 이 함수의 identity 에 걸려 있다 — 렌더마다 새로 만들면 제목으로
  // 포커스를 계속 빼앗는다(InspectorHost 의 이펙트 주석).
  const closeInspector = useCallback(() => setInspectorOpen(false), []);
  const toggleGrid = useCallback(() => setPrefs({ showGrid: !prefs.showGrid }), [prefs.showGrid, setPrefs]);
  const toggleRuleZones = useCallback(() => setPrefs({ showRuleZones: !prefs.showRuleZones }), [prefs.showRuleZones, setPrefs]);

  usePhysicsRenderLoop(worldRef, writer);
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
    onEraseSelection: (scope) => eraseIds(Array.from(state.selection), scope),
    onShowHelp: () => setHelpOpen(true),
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
    return { id: c.id, number: c.number, color, ink: inkFor(color), placed: step.chairs[c.id] !== undefined };
  });

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
      orientation={portrait ? 'horizontal' : 'vertical'}
      onItemPointerDown={tray.start}
    />
  );

  const inspector = (
    <InspectorPanel
      drill={drill}
      step={step}
      stepIndex={stepIndex}
      dispatch={dispatch}
      selection={state.selection}
      pendingPlayerId={pendingPlayerId}
      onArmPlayer={armPlayer}
      onEraseIds={eraseIds}
      showSteps={!isBoard}
    />
  );

  const inspectorLayout = inspectorMode({ open: inspectorOpen, pinned, containerWidthPx: workspaceWidth });

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
        {/* 판 본체 = 코트 + 트레이. 둘은 **한 장의 판**이다(기현 결정 2026-08-11): 개체를 별도
            패널에 두면 UI 서랍처럼 보이지만, 판에 붙여 두면 실제 전술판에서 말이 놓여 있는
            가장자리처럼 읽힌다. 그래서 트레이는 이 안에 들어오고 배경도 판과 같은 색을 쓴다. */}
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: trayAxis }}>
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 24px' }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', filter: 'drop-shadow(0 18px 30px rgba(0,0,0,.45))' }}>
              <EditorStage
                ref={stageRef}
                drill={drill}
                step={step}
                tool={state.tool}
                coneSlot={state.coneSlot}
                selection={state.selection}
                dispatch={dispatch}
                worldRef={worldRef}
                writer={writer}
                zones={physics.zones}
                ballMax={BALL.maxCount}
                pendingPlayerId={pendingPlayerId}
                onPlayerPlaced={() => setPendingPlayerId(null)}
                showToast={(m, a) => toast.show(m, a ? { action: a } : undefined)}
                showGrid={showGrid}
                showGridLabels={prefs.showGridLabels}
                showRuleZones={showRuleZones}
                largeTargets={prefs.a11y.largeTargets}
                onEraseIds={eraseIds}
              />
            </div>
            <StageControls
              onZoomIn={() => stageRef.current?.zoomBy(INTERACT.zoomStep)}
              onZoomOut={() => stageRef.current?.zoomBy(1 / INTERACT.zoomStep)}
              onZoomReset={() => stageRef.current?.resetZoom()}
              showGrid={showGrid}
              onToggleGrid={toggleGrid}
              showRuleZones={showRuleZones}
              onToggleRuleZones={toggleRuleZones}
              inspectorOpen={inspectorOpen}
              onToggleInspector={() => setInspectorOpen((v) => !v)}
              inspectorPanelId={inspectorPanelId}
              inspectorButtonRef={inspectorTriggerRef}
            />
          </div>
          {toolRail}
        </div>

        {isBoard ? (
          <BoardBar
            courtLocked={!boardPristine}
            onReset={() => board?.onReset()}
            onResetGoals={() => {
              // 막혀 있으면 반드시 말해 준다. 조용히 실패하면 "버튼이 고장났나" 하며 계속
              // 누르게 된다(실제 신고). 휠체어는 static 이라 골대가 밀어낼 수 없다.
              const r = worldRef.current?.resetGoals();
              if (r && r.blocked > 0) toast.show('골대 자리에 휠체어가 있어 되돌리지 못했습니다. 휠체어를 옮긴 뒤 다시 눌러 주세요.');
            }}
          />
        ) : (
          <TransportBar
            steps={drill.steps}
            stepId={state.stepId}
            onSelectStep={(id) => dispatch({ type: 'STEP_SELECT', id })}
            playing={playing}
            onTogglePlay={() => playbackActions.toggle()}
            speed={speed}
            onCycleSpeed={() => playbackActions.setSpeed(speed === 0.5 ? 1 : speed === 1 ? 2 : 0.5)}
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

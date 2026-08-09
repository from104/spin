// §6.10/§7.5a 편집기 3영역 골격 — 이미 만들어진 드릴(EditorProvider 로 세팅 완료)을 실제로
// 그리는 조립부. `<nav aria-label="도구">` `<div role="application">`(CourtStage 가 직접 렌더)
// `<aside aria-label="드릴 속성">` 세 영역과 하단 트랜스포트로 프로토타입 236–400행 레이아웃을
// 그대로 이식한다.
import { useCallback, useRef, useState } from 'react';
import { isId } from '../../core/ids.ts';
import type { ChairId } from '../../core/ids.ts';
import type { CourtMode } from '../../model/court.ts';
import { BALL, INTERACT } from '../../core/constants.ts';
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
import { ToolRail, type UnplacedChair } from './ToolRail.tsx';
import { EditorStage } from './EditorStage.tsx';
import { StageControls } from './StageControls.tsx';
import { TransportBar } from './TransportBar.tsx';
import { BoardBar } from './BoardBar.tsx';
import { BottomSheet } from './BottomSheet.tsx';
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
  const [sheetOpen, setSheetOpen] = useState(false);
  // 격자·규칙존 토글은 로컬 state 가 아니라 prefs 를 직접 신뢰값으로 쓴다 — 로컬 state 였을 때는
  // 화면을 벗어났다 돌아오면(EditorWorkspace 재마운트) 항상 prefs 값으로 리셋됐다(감사 지적).
  const showGrid = prefs.showGrid;
  const showRuleZones = prefs.showRuleZones;
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
          presentButton: { onAction: () => nav.go('present') },
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
  });

  const unplacedChairs: UnplacedChair[] = drill.cast.chairs
    .filter((c) => step.chairs[c.id] === undefined)
    .map((c) => {
      const teamStyle = drill.teams[c.team];
      const color = c.color ?? (c.isGk ? teamStyle.gkColor : teamStyle.color);
      return { id: c.id, number: c.number, color, ink: inkFor(color) };
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
      ballMax={BALL.maxCount}
      unplacedChairs={unplacedChairs}
      pendingPlayerId={pendingPlayerId}
      onArmPlayer={armPlayer}
      courtLabel={{ full: '풀 코트', half: '하프 코트', flat: '플랫 코트' }[drill.courtMode]}
      orientation={portrait ? 'horizontal' : 'vertical'}
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
      layout={portrait ? 'sheet' : 'side'}
    />
  );

  return (
    <main
      id="main"
      tabIndex={-1}
      // 세로 화면은 위→아래로 쌓는다(§6.4): 코트가 폭을 다 쓰고, 도구·속성이 아래로 간다.
      style={{ flex: 1, display: 'flex', flexDirection: portrait ? 'column' : 'row', minHeight: 0, outline: 'none' }}
    >
      <span id="court-help" className="sr-only">
        방향키로 커서 이동, Enter로 배치, Alt+←/→로 개체 순회
      </span>

      {!portrait && toolRail}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--panel-2)' }}>
        <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 24px' }}>
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
          />
        </div>

        {isBoard ? (
          <BoardBar
            courtLocked={!boardPristine}
            onReset={() => board?.onReset()}
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

      {portrait ? (
        <>
          {toolRail}
          <BottomSheet label="속성" open={sheetOpen} onToggle={() => setSheetOpen((v) => !v)}>
            {inspector}
          </BottomSheet>
        </>
      ) : (
        inspector
      )}

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} returnFocusRef={helpTriggerRef} />
    </main>
  );
}

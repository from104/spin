// §6.10/§7.5a 편집기 3영역 골격 — 이미 만들어진 드릴(EditorProvider 로 세팅 완료)을 실제로
// 그리는 조립부. `<nav aria-label="도구">` `<div role="application">`(CourtStage 가 직접 렌더)
// `<aside aria-label="드릴 속성">` 세 영역과 하단 트랜스포트로 프로토타입 236–400행 레이아웃을
// 그대로 이식한다.
import { useCallback, useRef, useState } from 'react';
import { isId } from '../../core/ids.ts';
import type { ChairId } from '../../core/ids.ts';
import { BALL, INTERACT } from '../../core/constants.ts';
import { inkFor } from '../../core/colors.ts';
import { useAutosave } from '../../app/useAutosave.ts';
import { useAppHeader } from '../../app/AppHeader.tsx';
import { useAppNav } from '../../app/useAppHistory.ts';
import { useEditorDispatch, useEditorState, useEditorWorld, useEditorWriter } from '../../store/editor/EditorProvider.tsx';
import { selectStepIndex } from '../../store/editor/reducer.ts';
import { usePlaybackActions, usePlaybackState } from '../../store/playback/PlaybackProvider.tsx';
import { useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import type { CourtStageHandle } from '../../render/CourtStage.tsx';
import { ToolRail, type UnplacedChair } from './ToolRail.tsx';
import { EditorStage } from './EditorStage.tsx';
import { StageControls } from './StageControls.tsx';
import { TransportBar } from './TransportBar.tsx';
import { InspectorPanel } from './InspectorPanel.tsx';
import { HelpModal } from './HelpModal.tsx';
import { useEditorKeyboard } from './useEditorKeyboard.ts';
import { useStepPlayback } from './useStepPlayback.ts';
import { usePhysicsRenderLoop } from './usePhysicsRenderLoop.ts';

export function EditorWorkspace() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const worldRef = useEditorWorld();
  const writer = useEditorWriter();
  const { prefs, physics } = useSettingsState();
  const nav = useAppNav();
  const toast = useToast();
  const autosave = useAutosave();
  const { playing, speed } = usePlaybackState();
  const playbackActions = usePlaybackActions();

  const drill = state.present;
  const stepIndex = selectStepIndex(state);
  const step = drill.steps[stepIndex] ?? drill.steps[0]!;

  const stageRef = useRef<CourtStageHandle | null>(null);
  const helpTriggerRef = useRef<HTMLElement | null>(null);
  const [pendingPlayerId, setPendingPlayerId] = useState<ChairId | null>(null);
  const [showGrid, setShowGrid] = useState(prefs.showGrid);
  const [showRuleZones, setShowRuleZones] = useState(prefs.showRuleZones);
  const [helpOpen, setHelpOpen] = useState(false);

  usePhysicsRenderLoop(worldRef, writer);
  useStepPlayback(drill, state.stepId, dispatch);

  useAppHeader({
    title: drill.title,
    badge: '편집중',
    primary: { label: autosave.status === 'saving' ? '저장 중…' : '저장', onAction: () => void autosave.flush() },
    presentButton: { onAction: () => nav.go('present') },
    courtSwitch: {
      value: drill.courtMode,
      locked: true,
      onLockedAttempt: () => toast.show('코트 형태는 드릴을 만든 뒤에는 바꿀 수 없습니다.'),
    },
  });

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
    onDuplicateStep: () => dispatch({ type: 'STEP_DUPLICATE', id: state.stepId }),
    onPrevStep: () => gotoStep(-1),
    onNextStep: () => gotoStep(1),
    onTogglePlay: () => playbackActions.toggle(),
    onToggleGrid: () => setShowGrid((v) => !v),
    onToggleRuleZones: () => setShowRuleZones((v) => !v),
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

  return (
    <main id="main" tabIndex={-1} style={{ flex: 1, display: 'flex', minHeight: 0, outline: 'none' }}>
      <span id="court-help" className="sr-only">
        방향키로 커서 이동, Enter로 배치, Alt+←/→로 개체 순회
      </span>

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
      />

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
              showRuleZones={showRuleZones}
              onEraseIds={eraseIds}
            />
          </div>
          <StageControls
            onZoomIn={() => stageRef.current?.zoomBy(INTERACT.zoomStep)}
            onZoomOut={() => stageRef.current?.zoomBy(1 / INTERACT.zoomStep)}
            onZoomReset={() => stageRef.current?.resetZoom()}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid((v) => !v)}
            showRuleZones={showRuleZones}
            onToggleRuleZones={() => setShowRuleZones((v) => !v)}
          />
        </div>

        <TransportBar
          steps={drill.steps}
          stepId={state.stepId}
          onSelectStep={(id) => dispatch({ type: 'STEP_SELECT', id })}
          playing={playing}
          onTogglePlay={() => playbackActions.toggle()}
          speed={speed}
          onCycleSpeed={() => playbackActions.setSpeed(speed === 0.5 ? 1 : speed === 1 ? 2 : 0.5)}
        />
      </div>

      <InspectorPanel
        drill={drill}
        step={step}
        stepIndex={stepIndex}
        dispatch={dispatch}
        selection={state.selection}
        pendingPlayerId={pendingPlayerId}
        onArmPlayer={armPlayer}
        onEraseIds={eraseIds}
      />

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} returnFocusRef={helpTriggerRef} />
    </main>
  );
}

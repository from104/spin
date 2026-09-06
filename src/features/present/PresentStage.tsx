// §6.9/§3.6/§6.6 — 시연 코트. 재생은 물리가 아니라 sampleDrill 결정론적 보간이다(§5.10) —
// 이 컴포넌트는 CourtStage(render-stage, 편집기용 줌·팬·포인터 위젯)를 재사용하지 않는다.
// 여기 필요한 건 "coordinates → SVG" 뿐이고 CourtStage 의 `controller`(§8 render-stage
// 의존표: physics-world 를 store 가 주입)는 드래그 편집을 위한 것이라 시연에는 대상이 없다.
//
// 60fps 갱신 경로(§6.1 규칙 3 "React → 물리는 명령형 호출, 물리 → React 는 커밋 1회"와 동일한
// 정신을 재생에도 적용): 휠체어·공·콘은 캐스트 전량을 마운트 시 1회 그리고, 매 rAF 틱마다
// TransformWriter(위치)+OpacityWriter(§8 위반 없는 이유는 PresentObjects.tsx 헤더 참고)로
// DOM 을 직접 갱신한다. 화살표·메모만 React state 로 다시 그린다(그 파일 헤더 주석 근거).
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { COURT_BG } from '../../core/colors.ts';
import { courtDefFor, type CourtMode } from '../../model/court.ts';
import type { BallRing, Drill, DrillStep, TeamSide } from '../../model/drill.ts';
import type { BallId } from '../../core/ids.ts';

import { arrowColor } from '../../model/arrow.ts';
import { strokeColor, strokeWidthOf } from '../../model/stroke.ts';
import { sampleDrill, drillTotalMs, type RenderFrame } from '../../model/playback.ts';
import { DEFAULT_TIERS, sceneOrder, type SceneRef } from '../../model/zOrder.ts';
import { COURT_SURFACE_RX, PLAYBACK } from '../../core/constants.ts';
import { COURT_LINE_WEIGHTS, CourtSurface } from '../../render/CourtSurface.tsx';
import { GoalPostMarks } from '../../render/courtLines/GoalPostMarks.tsx';
import { GridOverlay } from '../../render/GridOverlay.tsx';
import { RuleZones } from '../../render/RuleZones.tsx';
import { SideMarks } from '../../render/SideMarks.tsx';
import { ShapeMark } from '../../render/objects/ShapeMark.tsx';
import { RuleOverlay } from '../../render/RuleOverlay.tsx';
import { createRuleOverlay, type RuleRosterEntry } from '../../render/ruleOverlay.ts';
import { ArrowMarkers } from '../../render/ArrowMarkers.tsx';
import { createTransformWriter } from '../../render/transformWriter.ts';
import { raf } from '../../render/rafLoop.ts';
import { usePlaybackState, usePlaybackActions } from '../../store/playback/PlaybackProvider.tsx';
import { createOpacityWriter } from './opacityWriter.ts';
import { PresentChairMark, PresentBallMark, PresentConeMark, PresentArrowMark, PresentNoteMark, PresentStrokeMark } from './PresentObjects.tsx';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';

/** 골대 기둥의 굵기·크기. 코트 라인과 **같은 행**을 읽는다(§6.6 굵기표의 present). */
const GOAL_W = COURT_LINE_WEIGHTS.present;

export interface PresentStageProps {
  drill: Drill;
  showRuleZones: boolean;
  /** C11(2026-08-19 기현님) — 격자. 편집기와 같은 저장값(prefs.showGrid)을 따른다:
   *  코치가 편집에서 격자를 켜 뒀으면 팀에게 보여 주는 화면에도 같은 격자가 선다. */
  showGrid?: boolean;
  showGridLabels?: boolean;
  reduceMotion: boolean;
  /** 값이 바뀔 때마다(참조가 아니라 값) 일시정지 중이어도 즉시 1프레임 다시 그린다 — 스텝
   *  점프·스크럽 직후 화면이 이전 위치에 멈춰 있는 것을 막는다. */
  seekToken?: number;
  onStepChange?(index: number, step: DrillStep): void;
  /** 비반복 재생이 끝에 도달하면 정확히 1회 호출한다. */
  onEnded?(): void;
}

const emptyFrame = (): RenderFrame => ({ stepIndex: 0, t: 0, chairs: [], balls: [], cones: [], arrows: [], notes: [], strokes: [] });

export function PresentStage({ drill, showRuleZones, showGrid = false, showGridLabels = false, reduceMotion, seekToken, onStepChange, onEnded }: PresentStageProps) {
  const t = useT();
  const locale = useLocale();
  const mode: CourtMode = drill.courtMode;
  // §6.4 — 시연 화면도 드릴의 코트 크기를 따라간다. 여기가 빠지면 28×15 드릴을 시연할 때만
  // 판이 30×18 로 커져, 편집 화면과 시연 화면이 서로 다른 코트를 보여 준다.
  const def = courtDefFor(mode, drill.courtSize);
  const markerUid = useId();

  const playback = usePlaybackState();
  const playbackActions = usePlaybackActions();

  // 캐스트(휠체어·공·콘)는 드릴 전체에 걸친 고정 로스터다(§3.5) — 마운트 시 1회만 순회하면 되고,
  // 이 드릴이 살아있는 동안 바뀌지 않는다(§3.2 courtMode 처럼 드릴 레벨 불변은 아니지만, 시연은
  // 읽기 전용이라 이 화면 안에서 cast 가 바뀔 일이 없다).
  const writer = useMemo(() => createTransformWriter(), []);
  const opacityWriter = useMemo(() => createOpacityWriter(), []);
  // §4.4 P2-4 — 편집기와 **같은 오버레이**를 시연에도 건다. 여기는 물리가 아니라 sampleDrill
  // 보간 경로라(파일 머리말) 한쪽만 배선하면 시연에서 링이 공을 따라오지 않는다.
  const rules = useMemo(() => createRuleOverlay(), []);
  useEffect(() => () => {
    writer.clear();
    opacityWriter.clear();
    rules.clear();
  }, [writer, opacityWriter, rules]);

  const [arrows, setArrows] = useState<RenderFrame['arrows']>([]);
  const [notes, setNotes] = useState<RenderFrame['notes']>([]);
  const [strokes, setStrokes] = useState<RenderFrame['strokes']>([]);
  // 링을 그릴 공을 고르는 데만 쓴다 — 스텝이 바뀔 때만 갱신되므로 60fps 리렌더가 아니다
  // (화살표·메모는 원래 매 프레임 state 로 다시 그린다 — 파일 머리말).
  const [stepIdx, setStepIdx] = useState(0);
  const stepIndexRef = useRef(-1);
  const endedRef = useRef(false);

  const ruleRoster = useMemo<RuleRosterEntry[]>(
    () => drill.cast.chairs.map((c) => ({ id: c.id, team: c.team, isGk: c.isGk })),
    [drill.cast.chairs],
  );
  // §7 5.2 — 시연도 **같은 표**를 본다. 여기가 빠지면 편집 화면에서 켠 5 m 원이 시연에서만
  // 사라진다(5차의 "시연 화면만 팀 구분을 잃었다" 와 같은 형태의 축 누락이다).
  // v9 — 링은 스텝 소유라 `stepIdx` 를 따라 갈린다(편집 화면 EditorStage 와 같은 규약).
  const ballRings = useMemo(() => {
    const m: Record<string, BallRing> = {};
    for (const [id, r] of Object.entries(drill.steps[stepIdx]?.ballRings ?? {})) {
      if (r !== undefined) m[id] = r;
    }
    return m;
  }, [drill.steps, stepIdx]);
  // 세트피스 소유 — 편집 화면과 같은 규약(스텝별). 시연에도 화살표가 나가야 보는 사람이
  // "지금 누구 공인지" 를 안다(기현 지시 2026-08-27).
  const ballOwners = useMemo(() => {
    const m: Record<string, TeamSide> = {};
    for (const [id, t] of Object.entries(drill.steps[stepIdx]?.ballOwner ?? {})) {
      if (t !== undefined) m[id] = t;
    }
    return m;
  }, [drill.steps, stepIdx]);
  const ruleBallIds = useMemo(() => {
    const s = drill.steps[stepIdx];
    if (!s) return [];
    return drill.cast.balls.filter((b) => s.balls[b.id] !== undefined).map((b) => b.id as string);
  }, [drill.cast.balls, drill.steps, stepIdx]);

  // 화살표에 실제로 쓰인 색만 마커로 만든다(§6.6) — 프레임마다 바뀌는 `arrows` 배열이 아니라
  // 드릴 전체를 한 번 훑어 계산한다. 그래야 재생 중 매 프레임 <marker> DOM 이 재생성되지 않는다.
  const usedColors = useMemo(() => {
    const set = new Set<string>();
    for (const step of drill.steps) {
      for (const a of step.arrows) set.add(arrowColor(a));
      // 획도 같은 팔레트를 쓰고 같은 마커를 참조한다 — 여기서 빠뜨리면 화살촉을 켠 획만
      // 촉이 안 보인다(없는 id 를 가리키는 url(#…) 을 SVG 는 조용히 무시한다).
      for (const s of step.strokes ?? []) set.add(strokeColor(s));
    }
    return Array.from(set);
  }, [drill]);
  /** 마커는 (색 × 굵기)마다 하나다 — 굵기 축은 획만 갖는다(arrowHeadGeom.ts). 색과 같은
   *  이유로 드릴 전체를 한 번만 훑는다. */
  const usedWidths = useMemo(() => {
    const set = new Set<number>();
    for (const step of drill.steps) for (const s of step.strokes ?? []) set.add(strokeWidthOf(s));
    return Array.from(set);
  }, [drill]);

  const applyFrame = useCallback(
    (frame: RenderFrame) => {
      for (const c of frame.chairs) {
        writer.write(c.id, c.x, c.y, c.theta);
        opacityWriter.write(c.id, c.opacity);
      }
      const visibleChairs = new Set(frame.chairs.map((c) => c.id));
      for (const def2 of drill.cast.chairs) if (!visibleChairs.has(def2.id)) opacityWriter.write(def2.id, 0);

      for (const b of frame.balls) {
        writer.write(b.id, b.x, b.y, 0);
        opacityWriter.write(b.id, b.opacity);
      }
      const visibleBalls = new Set(frame.balls.map((b) => b.id));
      for (const def2 of drill.cast.balls) if (!visibleBalls.has(def2.id)) opacityWriter.write(def2.id, 0);

      for (const c of frame.cones) {
        writer.write(c.id, c.x, c.y, 0);
        opacityWriter.write(c.id, c.opacity);
      }
      const visibleCones = new Set(frame.cones.map((c) => c.id));
      for (const def2 of drill.cast.cones) if (!visibleCones.has(def2.id)) opacityWriter.write(def2.id, 0);

      // §4.4 P2-4 규칙 판정 — **이 프레임의 좌표**로 한다(스텝 사이 보간 중간값 포함).
      // 프레임이 만든 객체를 그대로 다시 쓰므로 프레임당 새로 만드는 것은 이 얕은 표 하나다.
      const rulePoses: Record<string, { x: number; y: number }> = {};
      for (const c of frame.chairs) rulePoses[c.id] = c;
      for (const b of frame.balls) rulePoses[b.id] = b;
      rules.write(rulePoses);

      setArrows(frame.arrows);
      setStrokes(frame.strokes);
      setNotes(frame.notes);

      if (frame.stepIndex !== stepIndexRef.current) {
        stepIndexRef.current = frame.stepIndex;
        setStepIdx(frame.stepIndex);
        const step = drill.steps[frame.stepIndex];
        if (step) onStepChange?.(frame.stepIndex, step);
      }
    },
    [drill, writer, opacityWriter, rules, onStepChange],
  );

  const sampleNow = useCallback((): RenderFrame => {
    if (drill.steps.length === 0) return emptyFrame();
    const baseMs = PLAYBACK.stepIntervalMs[playback.speed];
    const transitionMs = reduceMotion ? 0 : PLAYBACK.transitionMsFor(baseMs);
    return sampleDrill(drill, playbackActions.getElapsedMs(), { baseMs, transitionMs, loop: playback.loop });
  }, [drill, playback.speed, playback.loop, reduceMotion, playbackActions]);

  // 일시정지 상태에서도(마운트 직후·스텝 점프·속도/반복 토글) 최소 1프레임은 다시 그린다.
  // useLayoutEffect — §6.2 요건 2 와 같은 이유로 페인트 전에 frame/opacity 맵을 확정한다.
  useLayoutEffect(() => {
    endedRef.current = false;
    applyFrame(sampleNow());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyFrame, sampleNow, seekToken]);

  // 재생 중일 때만 rAF 를 구독한다 — §6.3 주석 그대로("Wake Lock 을 켠 90분 시연에서 배터리를
  // 그대로 태운다") 정신을 재생 루프에도 적용해, 멈춰 있는 동안은 아무 것도 돌리지 않는다.
  useEffect(() => {
    if (!playback.playing) return;
    const baseMs = PLAYBACK.stepIntervalMs[playback.speed];
    const total = drillTotalMs(drill, baseMs);
    const unsub = raf.add((dt) => {
      playbackActions.advanceMs(dt);
      const frame = sampleNow();
      applyFrame(frame);
      if (!playback.loop && !endedRef.current && playbackActions.getElapsedMs() >= total) {
        endedRef.current = true;
        onEnded?.();
      }
    });
    return unsub;
  }, [playback.playing, playback.speed, playback.loop, drill, sampleNow, applyFrame, playbackActions, onEnded]);

  // ── 개체 표시 순서(z-order, 2026-09-06 · PLAN-Z-ORDER 결정 12) ────────────────────────
  // 판·시연·인쇄·PNG 가 **같은 함수**(`sceneOrder`)를 읽는다. 여기서 정렬을 다시 짜면 그것이
  // 곧 "코치가 판에서 본 그림과 관객이 보는 그림이 다르다" 가 된다.
  //
  // ⚠️ 트윈 중에는 **목표 스텝**의 순서를 쓴다 — `sampleDrill` 의 `stepIndex` 가 이미 to-스텝
  //    이라(그 함수의 `return { ...frame, stepIndex: i }`) `stepIdx` 를 그대로 쓰면 된다.
  //    보간 중 순서가 두 스텝 사이에서 흔들리는 것보다, 도착할 그림의 순서로 미리 서는 편이
  //    깜빡임이 없다.
  const curStep = drill.steps[stepIdx];
  // (키 없는 옛 스텝 객체의 방어는 `sceneOrder` 자신이 한다 — 2026-09-06 검수에서 모델로 옮겼다.)
  const order = useMemo<readonly SceneRef[]>(() => (curStep ? sceneOrder(curStep, drill.cast) : []), [curStep, drill.cast]);
  const shapes = curStep?.shapes ?? [];

  const chairDefById = useMemo(() => new Map(drill.cast.chairs.map((c) => [c.id as string, c])), [drill.cast.chairs]);
  const ballIds = useMemo(() => new Set(drill.cast.balls.map((b) => b.id as string)), [drill.cast.balls]);
  const coneDefById = useMemo(() => new Map(drill.cast.cones.map((c) => [c.id as string, c])), [drill.cast.cones]);
  const shapeById = new Map(shapes.map((sh) => [sh.id as string, sh]));
  const arrowById = new Map(arrows.map((a) => [a.id as string, a]));
  const strokeById = new Map(strokes.map((st) => [st.id as string, st]));
  const noteById = new Map(notes.map((n) => [n.id as string, n]));

  const nodeFor = (r: SceneRef): ReactNode => {
    switch (r.kind) {
      case 'shape': {
        const sh = shapeById.get(r.id);
        // 도형은 움직이는 개체가 아니라 **표시**라 보간이 없다 — 지금 스텝의 것을 그대로 그린다.
        return sh ? <ShapeMark key={sh.id} shape={sh} /> : null;
      }
      case 'cone': {
        const c = coneDefById.get(r.id);
        return c ? <PresentConeMark key={c.id} def={c} writer={writer} opacityWriter={opacityWriter} /> : null;
      }
      case 'stroke': {
        const st = strokeById.get(r.id);
        return st ? <PresentStrokeMark key={st.id} stroke={st} markerUid={markerUid} /> : null;
      }
      case 'arrow': {
        const a = arrowById.get(r.id);
        return a ? <PresentArrowMark key={a.id} arrow={a} markerUid={markerUid} /> : null;
      }
      case 'chair': {
        const c = chairDefById.get(r.id);
        return c ? <PresentChairMark key={c.id} def={c} teams={drill.teams} writer={writer} opacityWriter={opacityWriter} /> : null;
      }
      case 'ball':
        return ballIds.has(r.id) ? <PresentBallMark key={r.id} id={r.id as BallId} writer={writer} opacityWriter={opacityWriter} rules={rules} /> : null;
      case 'note': {
        const n = noteById.get(r.id);
        return n ? <PresentNoteMark key={n.id} note={n} /> : null;
      }
    }
  };

  // ⚠️ **캐스트 전량이 마운트된 채로 남아야 한다**(파일 머리말): 휠체어·공·콘은 스텝마다
  //    지웠다 다시 만드는 것이 아니라 `opacityWriter` 가 0 을 써서 숨긴다. 그래서 이 스텝의
  //    순서에 없는 캐스트 개체도 목록 끝에 붙인다 — 안 붙이면 스텝을 넘길 때마다 재마운트가
  //    일어나 writer 등록이 흔들리고, 다시 등장할 때 한 프레임 동안 원점에 찍힌다.
  //    전환 중 **이전 스텝의** 화살표·획·메모도 같은 이유로 여기서 건진다(프레임이 실어 보낸
  //    것을 순서가 모른다고 떨어뜨리면 퇴장 페이드가 통째로 사라진다).
  const placed = new Set<string>();
  const nodes: ReactNode[] = [];
  const push = (r: SceneRef): void => {
    if (placed.has(r.id)) return;
    const node = nodeFor(r);
    if (node === null) return;
    placed.add(r.id);
    nodes.push(node);
  };
  for (const r of order) push(r);
  for (const kind of DEFAULT_TIERS) {
    switch (kind) {
      case 'shape':
        for (const sh of shapes) push({ kind, id: sh.id });
        break;
      case 'cone':
        for (const c of drill.cast.cones) push({ kind, id: c.id });
        break;
      case 'stroke':
        for (const st of strokes) push({ kind, id: st.id });
        break;
      case 'arrow':
        for (const a of arrows) push({ kind, id: a.id });
        break;
      case 'chair':
        for (const c of drill.cast.chairs) push({ kind, id: c.id });
        break;
      case 'ball':
        for (const b of drill.cast.balls) push({ kind, id: b.id });
        break;
      case 'note':
        for (const n of notes) push({ kind, id: n.id });
        break;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${def.vbW} ${def.vbH}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={t('present.stageAriaLabel', { court: def.label[locale] })}
      // ⚠️ 강제색(Windows 고대비) 제외 갈고리다 — 장식이 아니다. `.stage-svg` 는
      // styles/contrast.css 의 `forced-color-adjust: none` 이 부르는 이름이고, 이 줄이 없으면
      // **시연 화면에서만** 팀 색·등번호·골키퍼 표시·§3.5 개별 색이 전부 같은 전경색으로
      // 치환된다(2026-08-13 5차 검증 실측: 편집기 ✓ · 인쇄 ✓ · 시연 ✗ 였다). 시연은 코치가
      // 선수에게 보여 주는 화면이라, 편집기에서는 구분되던 두 팀이 여기서만 뭉개진다.
      // 같은 판·같은 ChairChip·같은 teamMarkFor 를 쓰므로 제외 근거도 편집기와 글자 그대로 같다.
      // styles/contrast.test.tsx 의 '코트를 그리는 SVG 루트 전량' 이 이 줄을 붙잡고 있다.
      className="stage-svg"
      style={{ display: 'block', width: '100%', height: '100%', filter: 'drop-shadow(0 22px 40px rgba(0,0,0,.5))' }}
    >
      <defs>
        <ArrowMarkers uid={markerUid} colors={usedColors} widths={usedWidths} />
      </defs>
      <rect width={def.vbW} height={def.vbH} rx={COURT_SURFACE_RX} fill={COURT_BG} />
      <CourtSurface mode={mode} size={drill.courtSize} variant="present" />
      {/* C11 — 격자는 편집기(CourtStage)와 같은 층·같은 컴포넌트다: 코트면 위, 존 아래. */}
      {showGrid && <GridOverlay mode={mode} size={drill.courtSize} showLabels={showGridLabels} />}
      <RuleZones mode={mode} size={drill.courtSize} visible={showRuleZones} />
      {/* 진영 표시 — 편집 화면과 **같은 컴포넌트**다. 시연에서 빠지면 코치가 팀에 보여 주는
          화면만 진영을 안 알려 주게 된다(골 지역 붉은 표시는 진영을 따라 나오는데도). */}
      <SideMarks mode={mode} size={drill.courtSize} teams={drill.teams} defense={drill.defense} />
      <RuleOverlay mode={mode} size={drill.courtSize} visible={showRuleZones} writer={writer} rules={rules} ballIds={ruleBallIds} ballRings={ballRings} ballOwners={ballOwners} roster={ruleRoster} teams={drill.teams} defense={drill.defense} />
      {/* 골대(받침판+기둥) — 규칙 표시 **뒤**, 개체 **앞**. 편집 화면이 골대를 `ObjectLayer`
          맨 아래에서 그리는 그 자리다(2026-09-06 기현 지시: *"골대 밑판 위에 코트 라인이
          보임"*). 그 전에는 `CourtSurface` 안(코트 라인 그룹의 끝)이라 격자·존·깃발보다
          아래였고, 규칙 존의 흰 파선이 받침판 위를 가로질렀다.
          굵기는 §6.6 표의 present 행 — `CourtSurface` 에 넘긴 variant 와 같은 행이다. */}
      <GoalPostMarks def={def} spotR={GOAL_W.spotR!} spotSw={GOAL_W.spotSw} />
      {/* 개체 자체는 접근성 트리에서 뺀다 — 실제 서술은 아래 스텝 이름·메모(텍스트)와
          §7.5e 라이브 리전(스텝 전환 발표)이 맡는다. render-stage 리프가 강제하는
          role="button" 은 시연에서 실제로 클릭 가능하지 않아 노출하면 오히려 오도한다. */}
      {/* ★ 7종을 **한 목록**으로 그린다(아래→위). 도형도 여기 있다 — 편집기와 같은 층이고
          같은 컴포넌트다. 시연에는 선택이 없으므로 `selected`·`onPointerDown` 을 안 넘긴다.
          ⚠️ 순서는 `sceneOrder` 가 정한다(위 블록). 여기서 다시 짜지 마라 — 그것이 판과
             관객 화면이 갈리는 자리다. */}
      <g aria-hidden="true">{nodes}</g>
    </svg>
  );
}

// physics-world 공개 진입점. §5.13 "UI 가 의존하는 최소 계약"(PhysicsWorldApi)을 조립해서 만든다.
// UI(store 이상)는 이 파일에서만 import 한다 — matter-js 를 직접 보지 않는다.
import * as Matter from 'matter-js';
import type { Vec2 } from '../core/units.ts';
import { kmhToPxPerS } from '../core/units.ts';
import { BALL, CHAIR, CHAIR_SEP_PX, CONE, DEFAULT_LIMITS, DEFAULT_ZONES, DRIVE, GOAL, PHYS, RESOLVE_ITERS } from '../core/constants.ts';
import type { ChairId, CastId } from '../core/ids.ts';
import { isId } from '../core/ids.ts';
import type { ChairPose, DragZone, ZoneConfig } from '../model/chair.ts';
import { classifyZone, poseFromStored, projectGrab } from '../model/chair.ts';
import type { DrillCast, DrillStep } from '../model/drill.ts';
// ★ §8 의 physics-world 의존 목록에는 court 가 없지만, PhysicsWorldApi.load() 시그니처(§5.13)가
// CourtMode 를 요구한다 — physics-kin 이 이미 "core, (타입만) court" 로 같은 예외를 인정받았다(§8).
// 런타임 값은 **골포스트 좌표 하나뿐**이다(§5.4 GOAL: 골대는 드릴이 아니라 코트 정의에서 온다).
// 코트 픽셀 크기(벽)는 여전히 createPhysicsWorld(courtW, courtH) 생성 시점에 호출자가 넘긴다.
// 조회는 반드시 `courtDefFor(mode, size)` 로 한다 — `COURT_DEFS[mode]` 는 풀 코트를 언제나
// 30×18 로 읽으므로 25×14 판에서 골대가 경기면 밖에 선다(§6.4).
import type { CourtMode, CourtSize } from '../model/court.ts';
import { courtDefFor } from '../model/court.ts';

import type { DragLimits, Bounds } from './types.ts';
import { createWorld, escapePinnedAll } from './world.ts';
import { boundsExtent, clampPointToBounds, escapePinned, groupDeltaWithin, pushChairIntoBounds, resolveMotion, satOverlap, separateOverlaps } from './obb.ts';
import type { CircleObstacle } from './obb.ts';
import type { WorldHandles } from './world.ts';
import { createLoop } from './loop.ts';
import type { PhysicsLoop } from './loop.ts';
import {
  beginDrag as beginDragSession,
  beginRelease,
  endDrag,
  releaseDone,
  stepDrag,
  updateDragTarget,
} from './drag.ts';
import type { DragBlockers, DragSession } from './drag.ts';
import type { HitContext, HitResult } from './hitTest.ts';
import { grabPoint as grabPointOf } from './kinematics.ts';

export { CAT, applyStaticSurface, createChairBody, createBallBody, createConeBody, createWalls } from './bodies.ts';
export { ENGINE_OPTS, createWorld, freezeKinematic, clampBodySpeed, applyRollingDecel, escapePinnedAll } from './world.ts';
export type { WorldHandles } from './world.ts';
export { createLoop } from './loop.ts';
export type { PhysicsLoop } from './loop.ts';
export {
  beginDrag,
  updateDragTarget,
  stepDrag,
  beginRelease,
  releaseDone,
  endDrag,
} from './drag.ts';
export type { DragSession } from './drag.ts';
export { hitTest, forgivingRadius, zoneHandles } from './hitTest.ts';
export type { HitResult, HitContext, SceneSnapshot, ToolId } from './hitTest.ts';
export { applyTwoZone, twoZoneViewConfig, TWO_ZONE_BODY } from './twoZone.ts';

/** §2.6 유도값과 정확히 일치(검산): kmhToPxPerS(10) = 69.4444444,
 *  kmhToPxPerS(30)/CHAIR.pivotToFrontPx(=30) = 6.9444444. bumperKmh 는 "앞범퍼 선속도" 이므로
 *  ω = v_bumper / r_bumper 로 유도한다. PhysicsWorldApi 는 사용자별 vLin/ω 설정을 받는 인자가
 *  없으므로(§5.13 계약 그대로) 기본 한도를 여기 상수로 둔다 — store(Wave 3)가 설정을 반영하려면
 *  createPhysicsWorld 의 세 번째 인자로 오버라이드하면 된다. */
export const DEFAULT_DRAG_LIMITS: DragLimits = {
  vLinPxPerS: kmhToPxPerS(DEFAULT_LIMITS.linearKmh),
  omegaRadPerS: kmhToPxPerS(DEFAULT_LIMITS.bumperKmh) / CHAIR.pivotToFrontPx,
};

/** 골대 포스트 id 접두사. cast 가 아니므로 CastId 체계(ch_/bl_/cn_)와 섞이지 않게 따로 둔다. */
export const GOAL_ID_PREFIX = 'gp_';
/** 골대가 "제자리에 없다" 고 볼 최소 거리(px). 물리의 `goalsDisplaced()` 와 화면의 복귀
 *  손잡이(GoalPost 의 hover)가 **같은 문턱**을 봐야 한다 — 다르면 커서는 뜨는데 눌러도
 *  아무 일이 없거나(화면이 더 관대), 밀렸는데 커서가 안 뜬다(물리가 더 관대). */
export const GOAL_DISPLACED_EPS_PX = 0.5;

export interface PhysicsSnapshot {
  [id: string]: { x: number; y: number; theta: number };
}
/** 정착 완료 통지의 수신자. 인자는 **정착이 끝난 그 순간의** 스냅샷이다(§4.2 P0-2). */
export type SettleListener = (snapshot: PhysicsSnapshot) => void;
/** sweepTo 한 걸음의 **상한** — 가장 작은 바디(콘 반지름 3.1 px·공 4.1 px)를 건너뛰지 않는 크기. 걸음은 driven 이라
 *  변위/substep 이 곧 접촉 속도이므로 이 상한은 속도 상한이기도 하다(2 px × 120 = 240 px/s ≈ 35 km/h). */
const SWEEP_STEP_PX = 2;
/** 회전 한 걸음의 상한(3°) — 피벗에서 앞범퍼까지 30 px 이라 끝이 한 걸음에 1.6 px 남짓 간다. */
const SWEEP_STEP_RAD = (3 * Math.PI) / 180;
/** 한 번에 도는 걸음 상한 — 한 번 누름은 0.5 초(60 걸음), 애니메이션 한 프레임은 몇 걸음이다. 큰 이동이 와도 한 프레임을 붙잡지 않게. */
const SWEEP_MAX_STEPS = 600;

export interface DragHandle {
  readonly zone: DragZone | null;
  /** 지금 잡고 있는 지점(앵커)의 월드 좌표. 리시(연결선)는 피벗이 아니라 여기서 나가야 한다 —
   *  로프는 실제로 이 점에 묶여 있고(§5.5 C), 피벗에서 그리면 어느 존을 잡았든 똑같아 보인다. */
  readonly grabPoint: Vec2 | null;
  move(worldPt: Vec2, nowMs: number): void;
  end(): void;
}
export interface PhysicsWorldApi {
  /** §6.4 — `size` 는 **골대를 어디에 세우는가**를 정한다(§5.1 코트 크기 3단).
   *  ⚠️ 빼먹으면 25×14 판에서도 골포스트가 30×18 자리(y=187.5/337.5)에 서서, 공이
   *  **경기면 밖 허공의 골대**에 맞고 튄다. 생략하면 30×18 — `courtDefFor` 와 같은 규약이다. */
  load(cast: DrillCast, step: DrillStep, mode: CourtMode, size?: CourtSize): void;
  step(dtS: number): void;
  read(out?: PhysicsSnapshot): PhysicsSnapshot;
  /** 물리를 거치지 않은 권위 있는 재배치(키보드 이동 등)를 바디에 밀어 넣는다.
   *  이걸 안 하면 상태와 물리가 어긋나 다음 드래그가 개체를 옛 자리로 되돌린다.
   *  순간이동이지 던지기가 아니므로 잔여 속도는 지운다. */
  setPose(id: CastId, pose: { x: number; y: number; theta?: number }): void;
  /** 순간이동(setPose)으로 놓인 개체를 **끌기와 같은 벽 경계**로 판 안에 넣는다 — 휠체어는 심플 모드면 원(2026-11-19 — 옛 원 ∪ 차체), 평소면
   *  차체(각도는 그대로, 피벗만 민다), 공·콘은 반지름 원. 옮겼으면 true — 부르는 쪽이 그 자세를 상태에 덧쓴다. 골대는 false.
   *  안전망(escapePinnedAll)과 달리 **사용자가 방금 옮긴 개체에만** 부른다 — 표시 설정이 손대지 않은 칩을 옮기면 안 된다. */
  fitToBounds(id: CastId): boolean;
  /** 무리(ids)를 한 덩어리로 d 만큼 옮길 때 판 안에 머무는 이동량 — 가장 먼저 벽에 닿는 개체가 무리 전체를 세운다
   *  (obb `groupDeltaWithin`). 키보드 무리 이동과 덩어리 끌기가 같은 규칙을 쓴다. 골대·모르는 id 는 무시. */
  groupDelta(ids: readonly string[], d: Vec2): Vec2;
  /** 키보드·[미세 조정]의 이동·회전을 이웃과 **상호작용하며** 한다(2026-11-16 기현님 지시 *"물리 상호 작용이 켜졌을 때
   *  키보드나 미세조정 패드로 휠체어를 움직여도 상호작용하게 … 휠체어,공,콘 다. 물론 잠기거나 숨긴거 빼고"*).
   *
   *  상호작용이 꺼져 있거나 손이 판 위에 있으면(드래그·릴리스 체이스 중) **false** — 아무것도 안 옮긴다. 부르는 쪽이
   *  지금처럼 setPose 로 순간이동한다. 켜져 있으면 목표 자세까지 **쓸고 가며** 옮기고(true) 정착 구간을 연다:
   *  · 순간이동 뒤 겹침만 풀면 25 px 큰 걸음이 공(반지름 4 px)을 건너뛰어, 공이 "가까운 출구" — 흔히 **뒤쪽** — 으로
   *    튕기고 휠체어는 그 너머로 지나갔다(2026-11-16 e2e S17b 실측). 그래서 SWEEP_STEP_PX·SWEEP_STEP_RAD 보다 작은
   *    걸음으로 나눠, 걸음마다 한 substep 씩 충돌을 푼다 — 미는 방향으로 민다.
   *  · 옮기는 휠체어는 정착이 끝날 때까지 **손의 권위**(static — 끄는 칩과 같다)라 밀려 되돌아오지 않는다. 다 서면
   *    풀어 준 뒤 onSettled 가 온다. 공·콘은 마지막에 목표 자리에 세운다.
   *  · 잠긴 개체는 옮기지 않고(static 이라 밀리지도 않는다), 무시한 개체는 바디가 없어 끼지 않는다.
   *  · `durationS` = 이 이동이 **실제로 걸린 시간**(부르는 쪽이 잰다 — 키 반복 간격, 애니메이션 프레임). 걸음이 driven 이라
   *    거리/시간이 곧 부딪는 속도다(2026-11-16 기현님 "실제 속도 계산 후 적용"). 건너뛰기 상한(SWEEP_STEP_*)보다 빠르면
   *    걸음을 더 잘게 나눠 그 상한 속도로 묶는다. */
  sweepTo(moves: ReadonlyArray<{ id: CastId; pose: { x: number; y: number; theta?: number } }>, durationS: number): boolean;
  /** **휠체어 조정 모드 한 프레임**(docs/PLAN-SIMPLE-DRIVE.md 결정 B6·B9) — 휠체어들을 목표 자세까지 쓸고 가며, 월드를 **정확히 dtS 만큼**
   *  걷게 한다. sweepTo 와 같은 걸음(벽 경계 → 잠긴 개체 막기 → driven 으로 놓기 → substep)이되 둘이 다르다:
   *  · **시간의 주인이 이 함수 하나다.** 정착 루프가 돌고 있으면 세운다 — sweepTo 를 매 프레임 부르면 자기 substep 에 더해
   *    정착 루프(rAF)가 같은 프레임에 또 걸어 밀린 공이 두 배 빨리 달아났다(구현 전 확인 1). 걸음 수는 고정 dt 누산기
   *    (`step()` 과 같은 산수)로만 정한다 — 회전이 빨라도 걸음을 늘리지 않는다(늘리면 그만큼 시간이 빨리 간다). 최고 단계 회전
   *    (≈ 430 °/s)에서도 앞 모서리가 한 substep 에 ≈ 1.7 px 라 콘(반지름 3.1)을 건너뛰지 않는다(drive.test).
   *  · 누산이 한 걸음에 못 미친 프레임(주사율 > 120 Hz)에도 자세는 목표로 옮긴다(걷지 않고) — 부르는 쪽이 매 프레임 바디 자세를
   *    되읽으므로, 여기서 버리면 그 프레임의 움직임이 사라진다.
   *  · 정착 구간을 열지 않는다 — 끝은 `driveEnd`. 쥔 휠체어는 끝날 때까지 손의 권위(static)다.
   *  상호작용이 꺼져 있거나 손이 판 위에 있으면(드래그·릴리스 체이스) false — 아무것도 안 한다. 잠긴 휠체어는 건너뛴다. */
  driveStep(moves: ReadonlyArray<{ id: ChairId; pose: ChairPose }>, dtS: number): boolean;
  /** 조정 모드를 끝낸다 — 쥔 휠체어를 놓고(dynamic) 정착 구간을 연다. 다 서면 onSettled 가 온다. */
  driveEnd(): void;
  /** 속도 상한을 살아 있는 월드에 즉시 반영한다(설정 토글용).
   *  드래그 도중에 바꿔도 안전하다 — stepDrag 는 매 substep 이 값을 새로 읽고, 세션 상태에는
   *  vLin/ω 가 저장돼 있지 않다. 다만 §5.11 릴리스 체이스가 진행 중이면 남은 거리를 새 속도로
   *  마저 달린다(이전 속도로 계산된 목표점은 그대로다). */
  setLimits(next: DragLimits): void;
  /** 휠체어 드래그 **존 경계**를 살아 있는 월드에 즉시 반영한다(설정 → 물리 슬라이더 3종).
   *
   *  ⚠️ 2026-08-13 5차 검증에서 고친 결함이다. 이 통로가 없던 동안 `internalHitContext()` 가
   *  `DEFAULT_ZONES` 를 **하드코딩**해서, 설정의 '후방 견인 경계 / 제자리 회전 시작 / 전방 견인
   *  시작' 을 옮겨도 실제 드래그 판정은 언제나 기본값으로 갈렸다. 음영·커서만
   *  `prefs.physics.zones` 를 따라 움직였으므로 **판이 "여기는 제자리 회전" 이라고 칠해 놓은
   *  곳을 잡으면 평행 이동이 되는** 상태였다(2존 모드와 정확히 같은 종류의 거짓말이다).
   *  되돌리면 physics/zonesWiring.test.ts 가 빨개진다. */
  setZones(next: ZoneConfig): void;
  /** 개체 사이 **물리·상호작용**을 켜고 끈다([보드 설정], 2026-11-13 기현님 지시 — 앱 기본은 끔).
   *
   *  끄면 끄는 손이 만드는 것 말고는 판 위에서 아무것도 움직이지 않는다:
   *   · 충돌 없음 — 잡은 칩이 이웃 칩·공·콘·골대를 밀지 않고 겹쳐 지나간다(world.setInteract)
   *   · 잠긴 개체도 막지 않는다 — 막는 것 역시 상호작용이다(lockedBlockers)
   *   · 겹침을 풀지 않는다 — 정착 술어의 겹침 감시·기하 분리 폴백이 쉰다(settleReady)
   *   · 안전망은 경계만 지킨다 — 칩과 겹친 공을 빼내지 않는다(escapePinnedAll)
   *  경계(코트 밖)와 속도 상한은 그대로다 — 그건 상호작용이 아니라 판의 규칙이다.
   *  ⚠️ 이 월드 자신의 기본값은 **켬**이다. 물리 골든 테스트 전부가 켬을 전제로 쓰였고,
   *     앱의 기본(끔)은 설정을 읽는 쪽(EditorProvider)이 생성 직후 밀어 넣는다. */
  setInteract(on: boolean): void;
  /** 심플 모드 — 벽 경계를 원(피벗 중심, 반지름 12.5 px)으로 잰다. 끄면 실물 차체 기준(기본). 판 데이터는 안 건드린다. */
  setDiscBounds(on: boolean): void;
  beginDrag(hit: HitResult, grabWorld: Vec2): DragHandle | null;
  zoneAt(id: ChairId, worldPt: Vec2): DragZone | null;
  isSettled(): boolean;
  /** **정착 완료 통지**(§4.2 P0-2). requestSettle 로 열린 정착 구간이 스스로 닫히는 순간 —
   *  릴리스 체이스가 끝나고 판 위의 모든 것이 멎은 그 프레임 — 에 한 번 불린다. 반환값은 구독
   *  해제 함수다.
   *
   *  왜 필요한가: `handle.end()` 는 릴리스 체이스(최대 4초)를 **시작만** 한다. 그 직후에 읽은
   *  스냅샷은 "손 떼던 순간의 자리" 이지 "칩이 실제로 선 자리" 가 아니다 — 속도 제한이 켜져
   *  있으면 선속 69.4 px/s 라 코트 횡단에 10초가 걸린다. 이 통지가 없으면 화면과 모델이
   *  영구히 어긋나고, 스텝을 넘겼다 돌아오는 순간(world.load) 칩이 옛 자리로 되돌아간다.
   *
   *  ⚠️ 통지는 **드래그 전용이 아니다**. `resetGoals()` 도 정착을 요청하므로 그쪽 정착에도
   *  불린다 — "이번 통지가 내 드래그의 것인가" 는 구독자가 판단한다(한 번 쓰고 바로 해제하는
   *  일회성 구독이 가장 안전하다). */
  onSettled(cb: SettleListener): () => void;
  /** `골대 원위치`. 순간이동이 아니라 **0.5초 동안 구동해 밀고 들어간다** — 그 자리에 개체가
   *  있으면 물리로 비켜내고, 상한을 넘으면 정확한 좌표로 스냅한다(남은 겹침은 escapePinned).
   *  순간이동으로 하면 낀 개체가 튀어나가듯 빠져 버그처럼 보이고, 거부하면 버튼이 안 듣는
   *  막다른 길이 된다(기현과 합의, 2026-08-10).
   *
   *  ⚠️ 밀어낼 수 있는 것은 **dynamic 인 것뿐**이다(공·콘). 휠체어는 `isStatic` 이라 무한
   *  질량이어서 골대가 밀 수 없다 — 벽을 미는 것과 같다. 그 경우 원위치로 못 가므로
   *  `blocked` 로 알린다. 조용히 실패하면 사용자는 버튼이 고장난 줄 알고 계속 누른다
   *  (실제로 그렇게 신고됐다). 휠체어를 dynamic 으로 바꾸면 이 제약은 사라진다. */
  resetGoals(): { blocked: number };
  /** 골대가 원위치에서 벗어나 있는가.
   *
   *  ⚠️ **"버튼 활성 판단용" 이라고 적혀 있었지만 production 호출부가 0 이다**(2026-08-13
   *  6차 검증관 실측 — 호출부는 index.test.ts·loopLifecycle.test.ts 뿐이다). 약속한 용도가
   *  한 번도 배선된 적이 없으므로 문장을 사실로 고친다. **일부러 안 쓰는 것**이기도 하다:
   *  이것으로 [골대 원위치] 를 켜고 끄면 (a) React 가 모르는 물리 상태를 프레임마다 폴링해야
   *  하고(§6.1 규칙 1) (b) 표적이 사용 중에 상태를 바꿔 §8 점진 공개 금지에 걸린다. 실제
   *  버튼(InspectorPanel.GoalResetField)은 판 상태가 아니라 **코트 종류**로 판정한다.
   *  즉 지금 이 함수는 **테스트 전용 관측구**다 — 지우려면 그 두 테스트가 골대 이동을 다른
   *  방법으로 관측할 수 있어야 한다. */
  goalsDisplaced(): boolean;
  dispose(): void;
}

const DRAGGABLE_KINDS: ReadonlySet<HitResult['kind']> = new Set(['chair', 'zoneHandle', 'ball', 'cone']);

/** beginDrag 내부에서 쓰는 최소 HitContext. 여기서 필요한 건 zones(존 경계) 뿐이다 —
 *  drag.beginDrag 는 hit.kind==='chair' 일 때만 ctx.zones 로 classifyZone 을 다시 계산하고,
 *  나머지 필드(pxPerUnit·pointerType·…)는 UI 히트테스트 우선순위 판단에만 쓰여 여기서는
 *  읽히지 않는다(hitTest() 자체는 render-stage 가 별도로 호출한다).
 *
 *  ⚠️ `zones` 를 인자로 받는다 — 예전에는 `DEFAULT_ZONES` 리터럴이었고, 그것이 설정 슬라이더를
 *  통째로 무효화하던 자리다(setZones 주석의 실측 참고). 기본값을 남겨 둔 이유는 이 함수를
 *  부르는 자리가 월드 안뿐이라 항상 실제 값이 넘어오지만, 인자 없이 부르면 예전과 같은
 *  동작이 되도록 해 호출부를 하나라도 빠뜨렸을 때 **조용히 다른 값**이 되지 않게 하기 위해서다. */
function internalHitContext(zones: ZoneConfig = DEFAULT_ZONES): HitContext {
  return {
    zones,
    pxPerUnit: 1,
    pointerType: 'mouse',
    selectedChairId: null,
    selectedArrowId: null,
    handlesVisible: false,
    tool: 'select',
  };
}

export function createPhysicsWorld(
  courtW: number,
  courtH: number,
  initialLimits: DragLimits = DEFAULT_DRAG_LIMITS,
  initialZones: ZoneConfig = DEFAULT_ZONES,
): PhysicsWorldApi {
  // 상수가 아니라 가변 홀더다 — setLimits 로 살아 있는 월드의 상한을 바꾼다.
  let limits: DragLimits = initialLimits;
  // 존 경계도 같은 이유로 가변 홀더다 — setZones 로 살아 있는 월드의 판정 경계를 바꾼다.
  // ⚠️ 이 변수가 없으면 설정의 물리 슬라이더 3종이 화면(음영)만 바꾸고 판정은 못 바꾼다.
  let zones: ZoneConfig = initialZones;
  /** setInteract 의 현재 값. 월드 기본은 켬이다(api.setInteract 주석). */
  let interact = true;
  const bounds: Bounds = { w: courtW, h: courtH };
  const world: WorldHandles = createWorld(courtW, courtH);
  const kindOf = new Map<CastId, 'chair' | 'ball' | 'cone' | 'goal'>();
  /** 지금 스텝에서 **잠긴** 개체. reload 가 채우고 그때마다 통째로 갈린다.
   *
   *  왜 `world` 의 `isStatic` 을 믿지 않고 따로 드는가 — `isStatic` 은 잠김 말고 **끌고 있는
   *  중**(setChairDragging)에도 켜진다. 둘을 구별하지 못하면 "잠긴 것은 안 움직인다" 를
   *  물으려던 자리에서 "지금 손에 쥔 칩" 까지 함께 걸려든다. */
  const lockedIds = new Set<CastId>();
  /** 골대 포스트의 **원위치**. 코트 정의에서 오고 드릴에는 저장되지 않는다(§5.4 GOAL). */
  const goalHome: Array<{ id: string; p: Vec2 }> = [];
  /** 0 이 아니면 복귀 구동 중. 이 시각을 넘기면 스냅한다. */
  let goalReturnUntilMs = 0;
  /** 이번 복귀에서 휠체어에 막힌 골대들. */
  const blockedHomes = new Set<string>();
  let session: DragSession | null = null;
  /** 정착 구간의 상한 **시각**(§4.2 P0-1). 0 이면 구간이 열려 있지 않다. loop 안의
   *  settleDeadline 과 같은 값이지만 그쪽은 밖에서 읽을 수 없고, 겹침 감시가 "상한에 닿았나"
   *  를 스스로 알아야 기하 분리 폴백을 그 프레임에 끼워 넣을 수 있다. */
  let settleUntilMs = 0;
  /** sweepTo 가 정착 동안 static 으로 쥐고 있는 휠체어. 정착 통지·새 드래그·재로드에서 풀린다. */
  const nudgeHeld = new Set<ChairId>();
  function releaseNudgeHeld(): void {
    for (const id of nudgeHeld) if (!lockedIds.has(id)) world.setChairDragging(id, false);
    nudgeHeld.clear();
  }
  /** 정착 완료 통지 구독자(§4.2 P0-2). 통지 중에 해제해도 안전하도록 복사해서 순회한다. */
  const settleListeners = new Set<SettleListener>();
  // major 회귀(§5.8): 공개 step(dtS) 에 넘어온 가변 dt 를 Engine.update 에 그대로 넣지 않기
  // 위한 고정-timestep 누산기(loop.ts 의 프레임 누산 로직과 동일한 패턴). substep() 자신은
  // 인자를 무시하고 항상 PHYS.dtS/dtMs 만 쓴다 — 내부 루프(loop.start())는 이미 항상 고정 dt 로
  // 호출하지만, 공개 계약(§5.13 step(dtS))에는 그 보장이 없었다(50ms 를 넣으면 그 프레임에
  // 모든 속도가 3배가 되는 실측 버그).
  let stepAccMs = 0;
  /** driveStep 의 고정-dt 누산기 — step() 의 stepAccMs 와 **따로** 둔다(둘이 같은 프레임에 섞이면 그 자체가 이중 걸음이다). */
  let driveAccMs = 0;

  /** 원위치가 휠체어에 막혀 있는가. 휠체어는 static 이라 골대가 밀어낼 수 없으므로, 막혀
   *  있으면 아무리 밀어도 못 들어간다 — 강제로 스냅하면 리졸버가 즉시 도로 뱉어내고 골대는
   *  다시 "벗어난" 상태가 된다(그래서 버튼을 여러 번 눌러야 하는 것처럼 보였다). */
  function homeBlockedByChair(home: Vec2): boolean {
    const chairs: ChairPose[] = [];
    for (const [id, kind] of kindOf) if (kind === 'chair') chairs.push(world.chairPose(id as ChairId));
    const out = escapePinned(home, GOAL.radiusPx, chairs, bounds);
    return out.x !== home.x || out.y !== home.y;
  }

  /** 원위치 복귀를 한 substep 만큼 진행한다. 구동(driven=true)이라 접촉면 속도가 물리적으로
   *  전달되어 길에 있는 개체를 자연스럽게 밀어낸다 — 순간이동에는 없는 성질이다. */
  function driveGoalsHome(): void {
    if (goalReturnUntilMs === 0) return;
    const stepPx = (GOAL.returnPxPerS * PHYS.dtMs) / 1000;
    let allHome = true;
    for (const g of goalHome) {
      if (blockedHomes.has(g.id)) continue; // 못 들어갈 곳으로 계속 밀면 제자리걸음만 한다
      const cur = world.pointOf(g.id as CastId);
      const dx = g.p.x - cur.x;
      const dy = g.p.y - cur.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= stepPx) {
        world.setPoint(g.id as CastId, g.p, true);
        continue;
      }
      allHome = false;
      world.setPoint(g.id as CastId, { x: cur.x + (dx / dist) * stepPx, y: cur.y + (dy / dist) * stepPx }, true);
    }
    // 상한을 넘기면 스냅한다 — 벽에 낀 휠체어 때문에 영원히 미는 상태에 갇히지 않게.
    if (allHome || performance.now() >= goalReturnUntilMs) {
      for (const g of goalHome) {
        // 막힌 곳에는 스냅하지 않는다 — 넣어도 리졸버가 즉시 뱉어내고, 그 튐이 버그로 보인다.
        if (!blockedHomes.has(g.id)) world.setPoint(g.id as CastId, g.p, false);
        world.freeze(g.id as CastId);
      }
      blockedHomes.clear();
      goalReturnUntilMs = 0;
    }
  }

  /** 끄는 칩이 기하로 넘지 못할 것들 — **잠긴 개체 전부**(drag.ts `DragBlockers`).
   *
   *  휠체어는 OBB, 공·콘은 원으로 나눠 담는다. 셋 다 같은 이유로 여기 있다: 잠기면 static 이
   *  되는데 끄는 칩도 static 이라 matter 가 그 쌍을 아예 안 만든다.
   *
   *  ⚠️ 끌고 있는 칩 자신은 안 걸러도 된다 — 잠긴 개체는 애초에 끌 수 없다(화면 쪽
   *  `useEditorPointer` 가 막는다, lockedDrag.test). 여기서 한 번 더 거르면 그 계약이 깨졌을 때
   *  조용히 덮이므로, 걸러지지 않은 채로 두어 드러나게 한다. */
  function lockedBlockers(): DragBlockers {
    if (!interact || lockedIds.size === 0) return { chairs: [], circles: [] };
    const chairs: ChairPose[] = [];
    const circles: CircleObstacle[] = [];
    for (const id of lockedIds) {
      const kind = kindOf.get(id);
      if (kind === 'chair') chairs.push(world.chairPose(id as ChairId));
      else if (kind === 'ball') circles.push({ p: world.pointOf(id), r: BALL.radiusPx });
      else if (kind === 'cone') circles.push({ p: world.pointOf(id), r: CONE.radiusPx });
    }
    return { chairs, circles };
  }

  /** 쓸고 가는 휠체어 한 걸음(sweepTo·driveStep 공용). ★ 순서가 계약이다:
   *  ① 벽 경계(`pushChairIntoBounds` — 8038332, 끌기·순간이동과 같은 경계. 벽 앞에서 돌면 피벗을 민다)
   *  ② **잠긴 개체**(lockedBlockers) — 지금 자리에서 목표까지 `resolveMotion` 으로 막는다(닿기 직전에 서고 접선으로 미끄러진다).
   *     쥔 칩도 잠긴 개체도 static 이라 matter 가 그 쌍을 아예 안 만든다(drag.ts DragBlockers 머리말) — 끌기는 이것으로 막았고
   *     2026-11-17 까지 sweepTo(키보드 밀기)에는 없어 잠긴 휠체어·공·콘을 뚫고 지나갔다(drive.test 첫 묶음).
   *  ③ driven 으로 놓는다 — 걸음의 변위가 접촉 속도가 되어 밀린 쪽이 그 방향·빠르기로 굴러간다.
   *  ⚠️ 받는 것은 목표 자세가 아니라 **이 걸음의 증분**이다(지금 바디 자세 + d). 걸음마다 미리 나눠 둔 절대 자세를 쫓으면, 막혀 선
   *     칩의 목표가 장애물 너머로 달아난 뒤 `resolveMotion` 이 끝점만 보고 "안 막혔다" 며 건너뛴다(첫 판 실측: 잠긴 휠체어 뒤 420 에 섰다). */
  function placeSweptChair(id: ChairId, d: ChairPose, velScale = 1): void {
    const cur = world.chairPose(id);
    const target: ChairPose = { x: cur.x + d.x, y: cur.y + d.y, theta: cur.theta + d.theta };
    const c = pushChairIntoBounds(target, bounds);
    const inBounds: ChairPose = { x: c.x, y: c.y, theta: target.theta };
    const blk = lockedBlockers();
    const fin =
      blk.chairs.length > 0 || blk.circles.length > 0
        ? resolveMotion(cur, inBounds, blk.chairs, bounds, CHAIR_SEP_PX, RESOLVE_ITERS, blk.circles)
        : inBounds;
    world.setChairPose(id, fin, true, velScale);
  }

  /** 쓸기 걸음 `d` 가운데 이 휠체어가 **잠긴 개체에 안 막히고 갈 수 있는 비율**(0…1, 가려던 방향으로 잰다). 무리 쓸기가 쓴다. */
  function sweptProgress(id: ChairId, d: ChairPose, blk: ReturnType<typeof lockedBlockers>): number {
    const len2 = d.x * d.x + d.y * d.y;
    if (len2 === 0) return 1;
    const cur = world.chairPose(id);
    const c = pushChairIntoBounds({ x: cur.x + d.x, y: cur.y + d.y, theta: cur.theta + d.theta }, bounds);
    const fin = resolveMotion(cur, { x: c.x, y: c.y, theta: cur.theta + d.theta }, blk.chairs, bounds, CHAIR_SEP_PX, RESOLVE_ITERS, blk.circles);
    const r = ((fin.x - cur.x) * d.x + (fin.y - cur.y) * d.y) / len2;
    return r > 1 - 1e-6 ? 1 : Math.max(0, r);
  }

  function substep(_dtS: number): void {
    if (session) stepDrag(session, world, limits, bounds, PHYS.dtS, lockedBlockers());
    driveGoalsHome();
    Matter.Engine.update(world.engine, PHYS.dtMs);
    world.applySpeedClamps();
    world.applyRollingDecel(PHYS.dtS);
    if (session?.releasing && releaseDone(session, world, performance.now())) {
      const done = session;
      session = null;
      endDrag(done, world);
      openSettle();
    }
    // ★ 안전망은 endDrag **뒤에** 돈다(§4.2 P0-3). 이 순서가 아니면 손을 뗀 그 프레임에
    // dynamic 으로 돌아온 칩이 안전망을 한 번도 못 받는다 — escapePinnedAll 은 static(=쥔)
    // 칩을 건너뛰고, 정착 술어는 그 프레임에 루프를 끌 수 있기 때문이다. 판 밖에 있던 칩을
    // 잡았다 그 자리에 놓으면 판 밖에 그대로 굳는다(1.3 이 Engine.update 와 endDrag 사이에서
    // 겪은 것과 정확히 같은 종류의 프레임 경계 문제다).
    // ⚠️ 안전망은 **실물 차체** 경계만 본다(bounds.disc 를 빼고). 심플 모드의 원 규칙(A4)은 손이 옮기는 칩에만 걸린다
    // (stepDrag → resolveMotion 이 bounds 그대로 받는다). 여기서 원 규칙을 쓰면 심플 모드에서 **다른** 개체를 끌기만 해도
    // 평소 모드에서 뒤를 벽에 붙인 칩(피벗 6.5 < 반지름 12.5)이 밀리고, 정착 커밋이 그 자세를 드릴에 쓴다 —
    // 표시 설정이 저장 데이터를 바꾼다(simpleBounds.test.ts).
    // ── ⚠️ 2026-11-19: 「실물 차체만」은 「상호작용이 꺼져 있으면 원·차체 중 하나라도 판 안이면 둔다」로 넓어졌다 ──
    // 심플의 원 규칙이 원 하나가 되면서(obb.ts boundsHull) 심플에서 앞을 벽에 댄 칩은 실물로 13.5 px 판 밖이다 — 차체 규칙만
    // 쓰면 심플 모드에서 그 칩을 놓는 순간 13.5 px 밀려 원이 벽에서 떨어지고, 평소 모드로 돌아가 다른 칩을 끌면 또 밀려 커밋된다.
    // 판정은 escapePinnedAll 안(lenientChairs)에 있다. 평소 모드에서 상호작용이 켜져 있으면 옛 규칙(실물 차체) 그대로다.
    // 이 모드에서 손이 잡아 옮긴 칩은 지금 모드의 규칙(bounds 그대로 — 심플이면 원)으로 잰다(handMovedBody).
    escapePinnedAll(world, bounds, interact, handMovedBody);
  }

  /** 이 모드(심플/평소)에서 **손이 잡은** 휠체어의 잡을 때 자세 — 거기서 움직였으면 안전망이 지금 모드의 규칙으로 잰다
   *  (escapePinnedAll `handMoved`). 잡았다 그 자리에 놓은(선택 탭) 칩은 관대한 규칙 그대로라 안 튄다(simpleBounds.test.ts).
   *  모드가 바뀌면(setDiscBounds) 비운다 — 바뀐 뒤 손대지 않은 칩은 다시 "손대지 않은 칩"이다. */
  const grabbedAt = new Map<Matter.Body, { x: number; y: number }>();
  function handMovedBody(b: Matter.Body): boolean {
    const p = grabbedAt.get(b);
    return p !== undefined && Math.hypot(b.position.x - p.x, b.position.y - p.y) > 0.5;
  }

  /** api.read() 의 알맹이. 정착 통지가 `api` 객체 리터럴보다 먼저 만들어지는 loop 안에서
   *  스냅샷을 떠야 해서 따로 뺐다. */
  function readSnapshot(out?: PhysicsSnapshot): PhysicsSnapshot {
    const snap: PhysicsSnapshot = out ?? {};
    for (const [id, kind] of kindOf) {
      if (kind === 'chair') {
        const p = world.chairPose(id as ChairId);
        snap[id] = { x: p.x, y: p.y, theta: p.theta };
      } else {
        const p = world.pointOf(id);
        snap[id] = { x: p.x, y: p.y, theta: 0 };
      }
    }
    return snap;
  }

  function notifySettled(): void {
    if (settleListeners.size === 0) return;
    const snap = readSnapshot();
    for (const cb of [...settleListeners]) cb(snap);
  }

  /** 정착 구간을 연다. loop 의 데드라인과 겹침 감시의 상한을 **같은 값**으로 맞추는 것이
   *  이 함수의 전부다 — `loop.requestSettle` 을 직접 부르면 상한이 어긋나 기하 분리 폴백이
   *  영영 안 돌거나(내 상한이 더 늦다) 물리에 기회를 덜 준다(더 이르다).
   *
   *  ★ 손이 아직 판 위에 있으면(잡고 있든 릴리스 체이스 중이든) **구간을 열지 않고 루프만
   *  살린다**(§4.2 알려진 이슈 #2, 1.5 재현). 정착 술어는 "속도 0" 이면 참이 되는데 드래그
   *  중에는 손이 멈춘 순간이 곧 속도 0 이라, 구간이 열려 있으면 그 프레임에 루프가 죽고
   *  칩이 손 밑에서 얼어붙는다 — 그 뒤로는 손을 아무리 움직여도 substep 이 안 돌고, 손을
   *  떼도 `releaseDone` 이 평가되지 않아 `endDrag` 가 영영 안 온다(칩이 static 으로 남아
   *  이웃도 못 민다). loop.ts 의 `cancelSettle` 주석이 적어 둔 바로 그 사고인데, 그쪽 방어는
   *  "새 드래그가 **옛** 구간을 닫는다" 만 막았고 "드래그 도중 **새** 구간이 열리는" 쪽은
   *  비어 있었다. 실제 경로: 한 손가락으로 칩을 잡은 채 다른 손가락으로 [골대 원위치] 를
   *  누르는 것(스테이지의 포인터 캡처는 SVG 밖 버튼을 막지 않는다).
   *
   *  이 가지로 새는 것은 없다: 이 함수를 부르는 두 곳 중 substep 의 릴리스 종료 경로는
   *  `session = null` 을 먼저 하고 부르므로 늘 아래로 내려가고, `resetGoals` 쪽은 드래그가
   *  끝나는 그 프레임에 어차피 정착 구간이 열려 골대 복귀까지 함께 덮는다. */
  function openSettle(): void {
    if (session) {
      loop.start();
      return;
    }
    settleUntilMs = performance.now() + PHYS.settleMaxMs;
    loop.requestSettle(PHYS.settleMaxMs);
  }

  /** 정착 구간을 닫는다(새 드래그가 시작될 때). §5.8 blocker 회귀 참조. */
  function closeSettle(): void {
    settleUntilMs = 0;
    loop.cancelSettle();
  }

  /** 손이 쥐고 있지 않은 휠체어들의 현재 포즈.
   *
   *  드래그 중인 칩을 빼는 이유: 그 칩은 static 이라 물리가 밀어낼 수 없고, 그 겹침은
   *  사용자가 지금 손으로 만들고 있는 것이다(손을 떼면 endDrag 가 dynamic 으로 되돌려 그때
   *  물리가 푼다). 빼지 않으면 칩을 이웃에 붙여 쥐고 있는 동안 판이 영영 안 서고(resetGoals
   *  가 정착 구간을 여는 경우), 상한이 지나면 **사용자가 쥐고 있는 칩을 기하로 옮겨 버린다.** */
  function unheldChairs(): Array<{ id: ChairId; pose: ChairPose }> {
    const out: Array<{ id: ChairId; pose: ChairPose }> = [];
    for (const [id, kind] of kindOf) {
      if (kind !== 'chair' || session?.id === id) continue;
      out.push({ id: id as ChairId, pose: world.chairPose(id as ChairId) });
    }
    return out;
  }

  /** 서로 겹친 쌍이 하나라도 있는가. margin 0 — 순수 겹침만 본다(CHAIR_SEP_PX 를 넣으면
   *  나란히 선 두 칩이 영영 "겹침" 이 된다). 문턱이 왜 0 이 아닌지는 PHYS.overlapRestPx 참조. */
  function anyOverlap(chairs: ReadonlyArray<{ pose: ChairPose }>): boolean {
    for (let i = 0; i < chairs.length; i++) {
      for (let j = i + 1; j < chairs.length; j++) {
        if (satOverlap(chairs[i]!.pose, chairs[j]!.pose, 0).depth > PHYS.overlapRestPx) return true;
      }
    }
    return false;
  }

  /** 기하 분리 1회 — 상한에 닿았을 때만 부른다. 물리에도 되먹여야 곧바로 뜨는 정착 통지의
   *  스냅샷과 화면이 같아진다(driven=false — 밀어낸 것이지 던진 것이 아니다). */
  function separateNow(chairs: ReadonlyArray<{ id: ChairId; pose: ChairPose }>): void {
    const fixed = separateOverlaps(
      chairs.map((c) => c.pose),
      bounds,
    );
    chairs.forEach((c, i) => {
      const p = fixed[i]!;
      if (p.x === c.pose.x && p.y === c.pose.y) return;
      // ★ 잠긴 칩은 **결과를 안 받아 쓴다.** 입력에서 빼지 않는 이유: 빼면 이웃이 잠긴 칩과
      //   겹친 채로 "분리 완료" 가 되어, 잠김이 자리를 지키는 대신 자리를 내주게 된다.
      //   넣어 두고 쓰기만 건너뛰면 이웃만 밀려나고 잠긴 칩은 한 픽셀도 안 움직인다 —
      //   물리(static)와 기하가 같은 말을 하게 하는 유일한 조합이다.
      if (lockedIds.has(c.id)) return;
      world.setChairPose(c.id, p, false);
      world.freeze(c.id);
    });
  }

  /** loop 에 넘기는 정착 술어(§4.2 P0-1 겹친 휠체어 자가 분리).
   *
   *  `world.allAtRest()` 의 뜻은 **그대로 둔다** — 그건 "속도가 0 인가" 이고 §5.9 조기 종료
   *  골든이 정확히 그 뜻에 기대고 있다. 문제는 그 판정이 겹침을 **원리적으로 볼 수 없다**는
   *  것이다: matter 의 위치 해결(Resolver.postSolvePosition)은 positionPrev 까지 같이 옮겨
   *  속도를 만들지 않으므로, 12.5 px 겹친 두 칩도 속도로는 완벽한 정지다. 그래서 endDrag 가
   *  칩을 dynamic 으로 되돌린 그 프레임 끝에서 곧바로 stop() 이 걸려 **위치 해결이 한 번도
   *  못 돌았다**(실측: 한 substep 만 더 돌면 12.50 → 2.728, 두 번이면 0).
   *
   *  그래서 겹침이 남아 있는 동안 루프를 붙잡는다. 상한은 정착 구간과 같은 PHYS.settleMaxMs
   *  이고, 상한에 닿으면 기하 분리를 1회 강제하고 끝낸다 — 해가 없는 배치(칩 두 대가 안
   *  들어가는 좁은 판)에서 무릎 위 태블릿의 배터리를 태우지 않는다.
   *
   *  ※ 공개 `isSettled()` 는 여기 얽히지 않는다. 그건 §5.13 계약 그대로 "속도가 0 인가" 이고,
   *    "판이 다 섰다" 를 밖에 알리는 신호는 onSettled 통지다. */
  function settleReady(): boolean {
    // ★ 골대가 돌아오는 중이면 판은 **아직 안 섰다**(2026-08-28 기현님 신고: *"골대 위치 복귀가
    //   실시간으로 반영 안 됨"*).
    //
    //   이 한 줄이 없으면 [골대 원위치]가 **첫 프레임에서 죽는다.** `resetGoals()` 는 아무
    //   바디도 깨우지 않고 `goalReturnUntilMs` 만 세운 뒤 루프를 켠다 — 골대를 실제로 미는 것은
    //   substep 안의 `driveGoalsHome()` 이다. 그런데 `loop.start()` 는 누산기를 0 으로 두고
    //   시작하므로 **첫 rAF 프레임에서는 substep 이 한 번도 안 돌 수 있고**(첫 델타 ~8~16ms <
    //   dtMs 16.667), 그 프레임 말미의 정지 판정이 "아무도 안 움직인다" 를 보고 즉시 stop() 한다.
    //   골대는 한 픽셀도 못 움직이고 버튼은 고장난 것처럼 보인다.
    //
    //   `docs/PLAN-2026-08.md` P0-1 이 endDrag 에서 적어 둔 것과 **같은 사고**다: *"칩이 dynamic
    //   이 된 뒤의 Engine.update 가 단 한 번도 실행되지 않는다."* 그쪽은 속도가 생겨 스스로
    //   풀렸지만(리졸버가 깨운다), 골대 복귀는 구동(driven) 이동이라 **substep 이 돌기 전에는
    //   깨울 속도 자체가 없다** — 그래서 "아직 할 일이 남았다" 를 술어가 직접 말해야 한다.
    //
    //   종료는 보장된다: `driveGoalsHome` 이 다 왔거나 `GOAL.returnMaxMs`(500ms)를 넘기면
    //   `goalReturnUntilMs = 0` 으로 스스로 닫고, 그 값은 `PHYS.settleMaxMs`(8000ms)보다 한참
    //   짧아 루프의 데드라인이 먼저 걸릴 일도 없다.
    if (goalReturnUntilMs !== 0) return false;
    // 상호작용이 꺼져 있으면 겹침은 사용자가 놓은 그대로다 — 풀 대상이 아니다.
    if (!interact) return world.allAtRest();
    if (performance.now() < settleUntilMs) {
      // 정상 경로: 속도가 0 이고(기존 판정 그대로) 겹침도 없어야 판이 다 선 것이다.
      return world.allAtRest() && !anyOverlap(unheldChairs());
    }
    // 상한 도달. 루프는 어차피 이 프레임에 멎는다(loop 의 데드라인이 같은 값이다) — 나가기
    // 전에 남은 겹침을 기하로 한 번 푼다. 안 그러면 8 초를 태우고도 겹친 채로 끝난다.
    // (정착 구간은 openSettle 로만 열기 때문에, 이 술어가 불리는 동안 settleUntilMs 는 항상
    //  살아 있다 — 0 인 채로 여기 오는 경로는 없다.)
    const chairs = unheldChairs();
    if (anyOverlap(chairs)) separateNow(chairs);
    return true;
  }

  const loop: PhysicsLoop = createLoop({
    step: substep,
    render: () => {}, // 렌더 보간은 render-stage 소관 — read() 를 직접 호출해 읽어간다.
    atRest: settleReady,
    // 쥐고 있던 휠체어를 **먼저** 풀고 알린다 — 듣는 쪽(편집기)이 읽는 순간엔 평소의 dynamic 이어야 한다.
    onSettle: () => {
      releaseNudgeHeld();
      notifySettled();
    },
  });

  const api: PhysicsWorldApi = {
    load(cast, step, mode, size) {
      nudgeHeld.clear(); // 바디를 통째로 다시 세운다 — 쥐고 있던 것도 새 바디는 dynamic 으로 태어난다
      grabbedAt.clear(); // 새 바디 — 손대지 않은 칩이다
      for (const id of kindOf.keys()) world.remove(id);
      kindOf.clear();
      session = null;
      settleUntilMs = 0;
      loop.stop();

      // 2026-08-14 — 스텝의 상태 플래그를 여기서 읽는다.
      //  · **무시**된 휠체어는 body 를 아예 안 만든다 → 공이 통과하고 아무것도 안 밀린다.
      //    (투명도만 낮추고 body 를 두면 "안 보이는데 부딪히는" 유령이 된다.)
      //  · **잠김**은 세 종류 모두 static 이다 — 잠긴 것은 **아무것에도 안 밀린다.**
      //    ⚠️ 2026-08-14 에는 여기 *"휠체어는 원래 static 이라 잠금이 물리를 안 바꾼다"* 고
      //    적혀 있었고, 그것이 틀렸다(기현 신고 2026-08-15: *"잠긴 개체가 다른 개체에 안
      //    밀려야 된다"*). 휠체어가 static 이 되는 것은 **끄는 동안뿐**이다
      //    (`setChairDragging`) — 평소에는 dynamic 이라(bodies.ts 의 'push' 모드) 다른 칩이
      //    밀고 들어오면 그대로 밀려났다. 잘못된 주석이 테스트가 없어야 할 이유처럼 쓰였다.
      const ignored = new Set<string>(step.ignored ?? []);
      const locked = new Set<string>(step.locked ?? []);
      lockedIds.clear();

      for (const c of cast.chairs) {
        const sp = step.chairs[c.id];
        if (!sp) continue; // 미배치 선수 — body 없음
        if (ignored.has(c.id)) continue; // 무시 — 월드에 없다
        world.addChair(c.id, poseFromStored(sp));
        kindOf.set(c.id, 'chair');
        if (locked.has(c.id)) {
          world.setBodyStatic(c.id, true);
          lockedIds.add(c.id);
        }
      }
      for (const bd of cast.balls) {
        const p = step.balls[bd.id];
        if (!p) continue;
        world.addBall(bd.id, p);
        kindOf.set(bd.id, 'ball');
        if (locked.has(bd.id)) {
          world.setBodyStatic(bd.id, true);
          lockedIds.add(bd.id);
        }
      }
      for (const cd of cast.cones) {
        const p = step.cones[cd.id];
        if (!p) continue;
        world.addCone(cd.id, p);
        kindOf.set(cd.id, 'cone');
        if (locked.has(cd.id)) {
          world.setBodyStatic(cd.id, true);
          lockedIds.add(cd.id);
        }
      }
      // 골대는 cast 가 아니라 **코트 정의**에서 온다(드릴에 저장되지 않는다, §5.4 GOAL).
      goalHome.length = 0;
      goalReturnUntilMs = 0;
      courtDefFor(mode, size).goalPosts.forEach((p, i) => {
        const id = `${GOAL_ID_PREFIX}${i}`;
        world.addGoalPost(id, p);
        kindOf.set(id as CastId, 'goal');
        goalHome.push({ id, p });
      });
    },

    step(dtS) {
      // §5.8: 가변 dt 를 그대로 엔진에 넣지 않는다. loop.ts 와 동일한 고정-substep 누산.
      stepAccMs += dtS * 1000;
      let n = 0;
      while (stepAccMs >= PHYS.dtMs && n < PHYS.maxSubsteps) {
        substep(PHYS.dtS);
        stepAccMs -= PHYS.dtMs;
        n++;
      }
      if (n === PHYS.maxSubsteps) stepAccMs = 0; // 밀린 시간은 버린다(몰아치기 금지, loop.ts 와 동일)
    },

    read(out) {
      return readSnapshot(out);
    },

    setLimits(next) {
      limits = next;
    },

    setZones(next) {
      zones = next;
    },

    setDiscBounds(on) {
      if (bounds.disc !== on) grabbedAt.clear();
      bounds.disc = on;
    },

    setInteract(on) {
      if (on === interact) return;
      interact = on;
      world.setInteract(on);
      // 켜는 순간 이미 겹쳐 있던 것들을 물리가 풀게 한 번 깨운다 — 안 깨우면 다음 손짓까지
      // 겹친 채로 서 있다가 엉뚱한 때에 튄다.
      if (on && !session) openSettle();
    },

    setPose(id, pose) {
      const kind = kindOf.get(id);
      if (!kind) return;
      if (kind === 'chair') {
        world.setChairPose(id as ChairId, { x: pose.x, y: pose.y, theta: pose.theta ?? 0 }, false);
      } else {
        world.setPoint(id, { x: pose.x, y: pose.y }, false);
      }
      // driven=false 는 임펄스를 주입하지 않을 뿐 잔여 속도를 지우지 않는다(§5.11 실측).
      // 키보드 이동 뒤에 개체가 스스로 미끄러지면 안 되므로 확실히 멈춘다.
      world.freeze(id);
    },

    fitToBounds(id) {
      const kind = kindOf.get(id);
      if (kind === 'chair') {
        const pose = world.chairPose(id as ChairId);
        const out = pushChairIntoBounds(pose, bounds);
        if (out.x === pose.x && out.y === pose.y) return false;
        world.setChairPose(id as ChairId, { x: out.x, y: out.y, theta: pose.theta }, false);
        world.freeze(id);
        return true;
      }
      if (kind !== 'ball' && kind !== 'cone') return false;
      const p = world.pointOf(id);
      const out = clampPointToBounds(p, kind === 'ball' ? BALL.radiusPx : CONE.radiusPx, bounds);
      if (out.x === p.x && out.y === p.y) return false;
      world.setPoint(id, out, false);
      world.freeze(id);
      return true;
    },

    groupDelta(ids, d) {
      const members: Array<{ minX: number; maxX: number; minY: number; maxY: number }> = [];
      for (const id of ids) {
        const kind = kindOf.get(id as CastId);
        if (kind === 'chair') members.push(boundsExtent(world.chairPose(id as ChairId), bounds));
        else if (kind === 'ball' || kind === 'cone') {
          const p = world.pointOf(id as CastId);
          const r = kind === 'ball' ? BALL.radiusPx : CONE.radiusPx;
          members.push({ minX: p.x - r, maxX: p.x + r, minY: p.y - r, maxY: p.y + r });
        }
      }
      return groupDeltaWithin(members, d, bounds);
    },

    sweepTo(moves, durationS) {
      if (!interact || session) return false;
      const plan: Array<{ id: CastId; chair: boolean; r: number; from: ChairPose; to: ChairPose }> = [];
      for (const m of moves) {
        const kind = kindOf.get(m.id);
        if (!kind || kind === 'goal' || lockedIds.has(m.id)) continue;
        const chair = kind === 'chair';
        const from: ChairPose = chair ? world.chairPose(m.id as ChairId) : { ...world.pointOf(m.id), theta: 0 };
        plan.push({ id: m.id, chair, r: kind === 'ball' ? BALL.radiusPx : CONE.radiusPx, from, to: { x: m.pose.x, y: m.pose.y, theta: chair ? (m.pose.theta ?? from.theta) : 0 } });
        if (chair && !nudgeHeld.has(m.id as ChairId)) {
          world.setChairDragging(m.id as ChairId, true);
          nudgeHeld.add(m.id as ChairId);
        }
      }
      // 실제 시간만큼 substep 을 나눈다 — 속도 = 거리/시간. 건너뛰기 상한보다 굵으면 걸음을 더 잘게(속도는 그 상한으로 묶인다)
      let n = Math.max(1, Math.round(durationS / PHYS.dtS));
      for (const p of plan) {
        const lin = Math.hypot(p.to.x - p.from.x, p.to.y - p.from.y) / SWEEP_STEP_PX;
        const ang = Math.abs(p.to.theta - p.from.theta) / SWEEP_STEP_RAD;
        n = Math.max(n, Math.ceil(lin), Math.ceil(ang));
      }
      n = Math.min(n, SWEEP_MAX_STEPS);
      // ★ 무리는 잠긴 개체 앞에서도 **한 덩어리로** 선다(벽의 groupDelta 와 같은 규칙) — 가장 먼저 막히는 휠체어가 그 걸음의 이동량을
      //   정하고 모두가 그만큼만 간다. 칩마다 따로 막으면(placeSweptChair) 막힌 칩만 서고 나머지가 그 칩 속으로 겹쳐 들어와 간격이
      //   무너진다(쥔 칩끼리는 static–static 이라 서로 안 막는다 — 실측: 간격 45 → 2 px). 미끄러짐은 무리에 없다: 접선으로 비키면
      //   그 칩만 대형에서 빠진다. 혼자 가는 칩·잠긴 것이 없는 판은 아래 갈래를 안 탄다(전과 같은 길).
      const blk = lockedBlockers();
      const lump = plan.length > 1 && (blk.chairs.length > 0 || blk.circles.length > 0);
      /** 무리가 실제로 간 비율 — 공·콘도 이만큼만 간다. */
      let progress = 0;
      for (let i = 1; i <= n; i++) {
        let r = 1;
        if (lump) {
          for (const p of plan) {
            if (p.chair) r = Math.min(r, sweptProgress(p.id as ChairId, { x: (p.to.x - p.from.x) / n, y: (p.to.y - p.from.y) / n, theta: 0 }, blk));
          }
          progress += r / n;
        }
        const t = lump ? progress : i / n;
        for (const p of plan) {
          const x = p.from.x + (p.to.x - p.from.x) * t;
          const y = p.from.y + (p.to.y - p.from.y) * t;
          // driven — 걸음의 변위가 접촉 속도가 되어 밀린 쪽이 그 방향·빠르기로 굴러간다(끄는 칩과 같은 §5.4 경로).
      // 첫 판(2026-11-16)은 driven=false 라 공을 비켜 세우기만 했다 — 기현님 "부딛힌 방향과 속도로 안 굴러간다".
          // ★ 걸음마다 벽 경계로 막는다(2026-11-17 기현님 "객체들이 키보드로 이동하면 코트 가장자리를 넘어감"). 쥔 칩은
          //   static 이라 Matter 벽도 안전망(escapePinnedAll)도 막지 않았다 — 방향키를 누르는 만큼 판 밖으로 나갔다.
          //   끌기(drag.ts resolveMotion)·순간이동(fitToBounds)과 같은 경계: 휠체어는 심플이면 원(2026-11-19 — 옛 원 ∪ 차체), 평소면 차체,
          //   공·콘은 반지름 원. 벽에 선 뒤의 남은 걸음은 그 자리에서 미끄러질 뿐이라 접촉 속도도 0 으로 줄어든다.
          if (p.chair && r < 1) {
            // 막힌 걸음 — 모두가 같은 비율만큼 **곧게** 간다(칩마다 다시 풀면 막힌 칩만 접선으로 비킨다)
            const cur = world.chairPose(p.id as ChairId);
            const theta = cur.theta + ((p.to.theta - p.from.theta) / n) * r;
            const c = pushChairIntoBounds({ x: cur.x + ((p.to.x - p.from.x) / n) * r, y: cur.y + ((p.to.y - p.from.y) / n) * r, theta }, bounds);
            world.setChairPose(p.id as ChairId, { x: c.x, y: c.y, theta }, true);
          } else if (p.chair) {
            placeSweptChair(p.id as ChairId, { x: (p.to.x - p.from.x) / n, y: (p.to.y - p.from.y) / n, theta: (p.to.theta - p.from.theta) / n });
          } else {
            world.setPoint(p.id, clampPointToBounds({ x, y }, p.r, bounds), true);
          }
        }
        substep(PHYS.dtS);
      }
      // 공·콘은 dynamic 이라 걸음 사이에 되밀렸을 수 있다 — 손이 보낸 자리에 세운다(남은 겹침은 정착이 푼다)
      for (const p of plan) {
        if (p.chair) continue;
        const end = lump ? { x: p.from.x + (p.to.x - p.from.x) * progress, y: p.from.y + (p.to.y - p.from.y) * progress } : p.to;
        world.setPoint(p.id, clampPointToBounds(end, p.r, bounds), false);
        world.freeze(p.id);
      }
      openSettle();
      return true;
    },

    driveStep(moves, dtS) {
      if (!interact || session) return false;
      // 시간의 주인은 하나 — 키보드 밀기·골대 원위치가 켜 둔 정착 루프를 세운다(구간도 닫는다: 이 프레임부터 걷는 것은 여기다)
      if (loop.isRunning()) {
        closeSettle();
        loop.stop();
      }
      // 이번 프레임에 안 모는 칩은 놓는다 — 갈아타기 전에 몰던 칩, 키보드 밀기가 쥐고 있던 칩(위에서 그 정착을 끊었다). static 으로 남으면
      // static–static 이라 새로 모는 칩이 그것을 뚫는다(drive.test '갈아탄 휠체어는 놓인다').
      for (const id of [...nudgeHeld]) {
        if (moves.some((m) => m.id === id)) continue;
        if (!lockedIds.has(id)) world.setChairDragging(id, false);
        nudgeHeld.delete(id);
      }
      const plan: Array<{ id: ChairId; from: ChairPose; to: ChairPose }> = [];
      for (const m of moves) {
        if (kindOf.get(m.id) !== 'chair' || lockedIds.has(m.id)) continue;
        plan.push({ id: m.id, from: world.chairPose(m.id), to: m.pose });
        if (!nudgeHeld.has(m.id)) {
          world.setChairDragging(m.id, true);
          nudgeHeld.add(m.id);
        }
      }
      // step() 과 같은 고정-dt 누산 — 부르는 쪽이 잘랐어도 한 번 더 자른다(몰아치기 금지)
      driveAccMs += Math.min(Math.max(0, dtS), DRIVE.maxFrameS) * 1000;
      let n = 0;
      while (driveAccMs >= PHYS.dtMs && n < PHYS.maxSubsteps) {
        driveAccMs -= PHYS.dtMs;
        n++;
      }
      if (n === PHYS.maxSubsteps) driveAccMs = 0;
      const steps = Math.max(1, n);
      // 접촉 속도는 **프레임의 변위 ÷ 프레임 시간** 이다 — 걸음의 변위가 아니다. 한 프레임의 변위를 정수 개의 걸음에 고르게 나눠 놓으므로
      // 주사율이 120 Hz 의 약수가 아니면 걸음마다 실린 시간이 dt 와 다르다(90 Hz: 한 걸음에 11.1 ms 치 → 다음 프레임은 두 걸음에 5.6 ms 치씩,
      // 144 Hz: 걸음 없는 프레임 다음에 6.9 ms 치). 그대로 속도로 읽히면 찬 공이 주사율에 따라 달리 나간다(실측: 밀다 선 뒤 굴러간 거리
      // 60 Hz 124 px · 90 Hz 175 px · 144 Hz 109 px). 자리는 그대로 두고 속도만 (걸음 수 × dt ÷ 프레임 시간)배로 고친다 — 60·120 Hz 는 1.
      const frameS = Math.min(Math.max(0, dtS), DRIVE.maxFrameS);
      const velScale = frameS > 0 ? (steps * PHYS.dtS) / frameS : 1;
      for (let i = 1; i <= steps; i++) {
        for (const p of plan) {
          placeSweptChair(p.id, { x: (p.to.x - p.from.x) / steps, y: (p.to.y - p.from.y) / steps, theta: (p.to.theta - p.from.theta) / steps }, velScale);
        }
        if (n > 0) substep(PHYS.dtS);
      }
      return true;
    },

    driveEnd() {
      driveAccMs = 0;
      releaseNudgeHeld();
      if (!session) openSettle();
    },

    beginDrag(hit, grabWorld) {
      if (!DRAGGABLE_KINDS.has(hit.kind)) return null;

      // major 회귀(§5.11 "사용자가 다시 탭" 종료 조건): 이전 세션(드래그 중이든 릴리스
      // 체이스 중이든)을 endDrag 없이 덮어쓰면 버려진 대상이 마지막 substep 의 잔여 속도를
      // 유지한 static body 로 남아 고스트 푸시를 일으킨다(§5.4/§2.7 실측). 새 세션을 만들기
      // 전에 반드시 정상 종료(freeze)시킨다.
      if (session) {
        endDrag(session, world);
        session = null;
      }
      // blocker 회귀(§5.8): 이전 릴리스가 requestSettle 을 걸어 둔 채였다면 그 데드라인을
      // 지운다 — 안 하면 새 드래그 도중 공이 잠깐 멎는 순간 루프가 스스로 stop 되어 버린다.
      closeSettle();
      // 키보드 이동으로 쥐고 있던 칩이 남아 있으면 손을 바꾸기 전에 놓는다 — static 으로 남으면 이번 드래그에 안 밀린다.
      releaseNudgeHeld();

      const pose: ChairPose =
        hit.kind === 'ball' || hit.kind === 'cone'
          ? { ...world.pointOf(hit.id as CastId), theta: 0 }
          : world.chairPose(hit.id as ChairId);

      session = beginDragSession(hit, grabWorld, internalHitContext(zones), pose);
      // 잡은 칩은 손의 권위를 갖는다 — static 이라야 §5.4 골든값(공 밀기·스핀킥)이 유지된다.
      // 대기 중인 칩만 dynamic 이어서 밀린다(world.setChairDragging 주석).
      if (isId(session.id, 'ch')) {
        world.setChairDragging(session.id as ChairId, true);
        const b = world.bodyOf(session.id);
        if (b && !grabbedAt.has(b)) grabbedAt.set(b, { x: pose.x, y: pose.y });
      }
      loop.start();

      const handle: DragHandle = {
        get zone() {
          return session?.zone ?? null;
        },
        get grabPoint() {
          if (!session) return null;
          const cur: ChairPose =
            session.kind === 'chair'
              ? world.chairPose(session.id as ChairId)
              : { ...world.pointOf(session.id), theta: 0 };
          return grabPointOf(cur, session.grab);
        },
        move(worldPt, nowMs) {
          if (session) updateDragTarget(session, worldPt, nowMs);
        },
        end() {
          if (session) beginRelease(session, performance.now());
        },
      };
      return handle;
    },

    zoneAt(id, worldPt) {
      if (kindOf.get(id) !== 'chair') return null;
      const pose = world.chairPose(id);
      return classifyZone(projectGrab(pose, worldPt).s, zones);
    },

    resetGoals() {
      if (goalHome.length === 0) return { blocked: 0 };
      blockedHomes.clear();
      for (const g of goalHome) {
        if (homeBlockedByChair(g.p)) blockedHomes.add(g.id);
      }
      goalReturnUntilMs = performance.now() + GOAL.returnMaxMs;
      openSettle();
      return { blocked: blockedHomes.size };
    },

    goalsDisplaced() {
      return goalHome.some((g) => {
        const cur = world.pointOf(g.id as CastId);
        return Math.hypot(cur.x - g.p.x, cur.y - g.p.y) > GOAL_DISPLACED_EPS_PX;
      });
    },

    isSettled() {
      return world.allAtRest();
    },

    onSettled(cb) {
      settleListeners.add(cb);
      return () => settleListeners.delete(cb);
    },

    dispose() {
      loop.stop();
      world.destroy();
      kindOf.clear();
      settleListeners.clear();
      nudgeHeld.clear();
      session = null;
      settleUntilMs = 0;
    },
  };

  return api;
}

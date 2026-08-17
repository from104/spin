// §3.7 편집 연산. 전부 순수 함수, 새 Drill 반환. 변화 없으면 동일 참조를 반환한다
// (리렌더·히스토리 억제). 시간축 규약: 추가도 삭제도 "이 스텝부터 끝까지".
import type { Vec2 } from '../core/units.ts';
import { isId, newId } from '../core/ids.ts';
import type { ChairId, BallId, ConeId, CastId, ArrowId, NoteId, ShapeId, StepId } from '../core/ids.ts';
import type { Drill, DrillStep, DrillCast, ChairDef, NoteLabel, PoseMap } from './drill.ts';
import type { Shape } from './shape.ts';
import { ballRingOf, nextBallRing } from './drill.ts';
import type { StoredChairPose } from './chair.ts';
import type { Arrow } from './arrow.ts';
import { LIMITS } from './validate.ts';

/** '없음' 은 오직 키 삭제로만 표현한다. `{...m, [k]: undefined}` 는 절대 금지 —
 *  structuredClone(IDB)은 undefined 키를 보존하고 JSON 은 지운다(실측) →
 *  같은 드릴이 export→import 왕복으로 의미가 바뀐다. */
export function omitKey<K extends string, P>(m: PoseMap<K, P>, k: K): PoseMap<K, P> {
  if (!(k in m)) return m;
  const rest: Record<string, P> = {};
  for (const key of Object.keys(m)) {
    if (key !== k) rest[key] = (m as Record<string, P>)[key]!;
  }
  return rest as PoseMap<K, P>;
}

function withMap<K extends string, P>(m: PoseMap<K, P>, k: K, v: P): PoseMap<K, P> {
  return { ...m, [k]: v };
}

function replaceStep(d: Drill, i: number, step: DrillStep): Drill {
  const steps = d.steps.slice();
  steps[i] = step;
  return { ...d, steps };
}

function poseOfCast(step: DrillStep, id: CastId): StoredChairPose | Vec2 | undefined {
  if (isId(id, 'ch')) return step.chairs[id];
  if (isId(id, 'bl')) return step.balls[id];
  return step.cones[id];
}

function posesEqual(a: StoredChairPose | Vec2, b: StoredChairPose | Vec2): boolean {
  if (a.x !== b.x || a.y !== b.y) return false;
  const aa = (a as StoredChairPose).angleDeg;
  const bb = (b as StoredChairPose).angleDeg;
  return aa === bb;
}

function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}

/** i..끝 스텝 전부에 id→pose 를 채운다(addBall/addCone/addChair 공용). */
function setForward(d: Drill, i: number, id: CastId, pose: StoredChairPose | Vec2): Drill {
  const steps = d.steps.map((s, k) => {
    if (k < i) return s;
    if (isId(id, 'ch')) return { ...s, chairs: withMap(s.chairs, id, pose as StoredChairPose) };
    if (isId(id, 'bl')) return { ...s, balls: withMap(s.balls, id, pose as Vec2) };
    return { ...s, cones: withMap(s.cones, id, pose as Vec2) };
  });
  return { ...d, steps };
}

// id 를 **밖에서 받는다**(2026-08-16). 공·콘만 여기서 id 를 지어내는 바람에 부르는 쪽이
// 방금 놓은 개체의 이름을 몰랐고, 그래서 "놓자마자 선택" 이 도형·메모·선수에만 있고 공·콘에만
// 없었다. 인자를 안 주면 종전대로 지어내므로 기존 호출부는 그대로 돈다.
export function addBall(d: Drill, i: number, at: Vec2, id: BallId = newId('bl')): Drill {
  if (d.cast.balls.length >= LIMITS.maxBalls) return d;
  const cast: DrillCast = { ...d.cast, balls: [...d.cast.balls, { id }] };
  return setForward({ ...d, cast }, i, id, at);
}

export function addCone(d: Drill, i: number, at: Vec2, colorIndex: 0 | 1, id: ConeId = newId('cn')): Drill {
  if (d.cast.cones.length >= LIMITS.maxCones) return d;
  const cast: DrillCast = { ...d.cast, cones: [...d.cast.cones, { id, colorIndex }] };
  return setForward({ ...d, cast }, i, id, at);
}

/** cast 에 이미 있는 휠체어를 stepIndex..끝 에 배치. 이미 pose 가 있으면 no-op. */
export function placeChair(d: Drill, i: number, id: ChairId, pose: StoredChairPose): Drill {
  const step = d.steps[i];
  if (!step) return d;
  if (step.chairs[id] !== undefined) return d;
  if (!d.cast.chairs.some((c) => c.id === id)) return d;
  return setForward(d, i, id, pose);
}

/** cast 에 새 휠체어 등록 + 배치. 팀당 4 초과면 원본 그대로 반환. */
export function addChair(d: Drill, i: number, def: Omit<ChairDef, 'id'>, pose: StoredChairPose): Drill {
  const teamCount = d.cast.chairs.filter((c) => c.team === def.team).length;
  if (teamCount >= LIMITS.maxChairsPerTeam) return d;
  const id = newId('ch');
  const chairDef: ChairDef = { ...def, id };
  const cast: DrillCast = { ...d.cast, chairs: [...d.cast.chairs, chairDef] };
  return setForward({ ...d, cast }, i, id, pose);
}

/** 표시 속성만 갱신(전 스텝 무영향). team 은 바꿀 수 없다. */
export function updateChairDef(d: Drill, id: ChairId, patch: Partial<Omit<ChairDef, 'id' | 'team'>>): Drill {
  const idx = d.cast.chairs.findIndex((c) => c.id === id);
  if (idx === -1) return d;
  const cur = d.cast.chairs[idx]!;
  const next: ChairDef = { ...cur, ...patch };
  if (shallowEqual(cur as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>)) return d;
  const chairs = d.cast.chairs.slice();
  chairs[idx] = next;
  return { ...d, cast: { ...d.cast, chairs } };
}

/** 5.2 — **그 공 하나**의 거리 원을 한 칸 돌린다: 없음 → 3 m → 5 m → 없음.
 *
 *  ⚠️ 공마다 따로다. `cast.balls` 배열에서 그 항목만 갈아 끼우므로 다른 공의 원은 손대지
 *  않는다 — 여기를 드릴 레벨 필드 하나(예: `d.ringMode`)로 바꾸면 공 두 개가 서로 다른
 *  원을 가질 수 없게 되고, **공이 하나뿐인 테스트는 그대로 초록불**이다(그래서 두 개짜리
 *  단언이 따로 있다: model/ballRing.test.ts).
 *  ⚠️ '없음' 은 `ring: undefined` 가 아니라 **키 삭제**다(omitKey 머리말과 같은 이유:
 *  structuredClone 은 undefined 키를 보존하고 JSON 은 지운다 → export 왕복으로 뜻이 바뀐다). */
export function cycleBallRing(d: Drill, id: BallId): Drill {
  const idx = d.cast.balls.findIndex((b) => b.id === id);
  if (idx === -1) return d;
  const cur = d.cast.balls[idx]!;
  const next = nextBallRing(ballRingOf(cur));
  const balls = d.cast.balls.slice();
  if (next === 'none') {
    const { ring, ...rest } = cur;
    void ring;
    balls[idx] = rest;
  } else {
    balls[idx] = { ...cur, ring: next };
  }
  return { ...d, cast: { ...d.cast, balls } };
}

// 오버로드로 id ↔ pose 상관을 강제한다. 단일 유니온이면 휠체어에 {x,y} 를 넣어도 컴파일된다
// (실측 확인) → step.chairs[id].angleDeg === undefined → rotate(NaN) → 그 칩이 화면에서 사라진다.
export function setPose(d: Drill, i: number, id: ChairId, p: StoredChairPose): Drill;
export function setPose(d: Drill, i: number, id: BallId, p: Vec2): Drill;
export function setPose(d: Drill, i: number, id: ConeId, p: Vec2): Drill;
export function setPose(d: Drill, i: number, id: ChairId | BallId | ConeId, p: StoredChairPose | Vec2): Drill {
  const step = d.steps[i];
  if (!step) return d;
  if (isId(id, 'ch')) {
    const pose = p as StoredChairPose;
    const cur = step.chairs[id];
    if (cur && posesEqual(cur, pose)) return d;
    return replaceStep(d, i, { ...step, chairs: withMap(step.chairs, id, pose) });
  }
  if (isId(id, 'bl')) {
    const pose = p as Vec2;
    const cur = step.balls[id];
    if (cur && posesEqual(cur, pose)) return d;
    return replaceStep(d, i, { ...step, balls: withMap(step.balls, id, pose) });
  }
  const pose = p as Vec2;
  const cur = step.cones[id];
  if (cur && posesEqual(cur, pose)) return d;
  return replaceStep(d, i, { ...step, cones: withMap(step.cones, id, pose) });
}

/** 스텝에서 사라지는 개체의 **상태 플래그(잠김·무시)도 함께 지운다** (기현 지시 2026-08-15:
 *  *"칩이 트레이에 들어가면 잠긴 상태, 무시 상태가 꺼져야 한다"*).
 *
 *  ⚠️ 안 지우면 플래그가 **id 로 살아남는다**. 잠긴 칩을 트레이로 뺐다가 다시 놓으면 잠긴 채로
 *  나오고(사용자는 그 사이에 아무것도 잠근 적이 없다), 무시된 칩은 되돌릴 문인 메뉴조차
 *  코트 밖이라 못 연다. 게다가 죽은 id 가 저장본에 계속 쌓인다.
 *
 *  **지우는 자리는 여기 하나뿐이다** — 트레이 반환·지우개·메뉴의 [삭제] 가 전부 이 함수를
 *  지난다(OBJECT_REMOVE 세 갈래 모두 `removeFromStep` 을 부른다). 호출부마다 따로 지우면
 *  언젠가 한 곳이 빠진다. */
function stripStepFlags(s: DrillStep, id: string): DrillStep {
  let next = s;
  for (const flag of ['locked', 'ignored'] as const) {
    const cur = next[flag] as readonly string[] | undefined;
    if (!cur?.includes(id)) continue;
    const rest = cur.filter((x) => x !== id);
    const patched: DrillStep = { ...next };
    // 빈 목록이면 키를 지운다 — `setStepFlag` 와 **같은 규칙**이라야 저장본에 표현이 하나다.
    if (rest.length === 0) delete patched[flag];
    else if (flag === 'locked') patched.locked = rest;
    else patched.ignored = rest as ChairId[];
    next = patched;
  }
  return next;
}

function removeFromStep(s: DrillStep, id: CastId): DrillStep {
  let next = s;
  if (isId(id, 'ch')) {
    const chairs = omitKey(s.chairs, id);
    if (chairs !== s.chairs) next = { ...s, chairs };
  } else if (isId(id, 'bl')) {
    const balls = omitKey(s.balls, id);
    if (balls !== s.balls) next = { ...s, balls };
  } else {
    const cones = omitKey(s.cones, id);
    if (cones !== s.cones) next = { ...s, cones };
  }
  return stripStepFlags(next, id);
}

/** 어느 스텝에도 pose 가 남지 않은 공·콘을 cast 에서 버린다.
 *
 * ⚠️ 이걸 빼먹으면 **지운 개체가 보이지 않는 채로 cast 에 남는다**(유령). 2026-08-10 공개판에서
 * 실제로 터진 결함이다(서권일 제보): 공 10개를 놓고 지우개로 전부 지우면 화면은 비었는데
 * `cast.balls.length` 는 그대로 10 이라, 배치 상한(`useEditorPointer` 의 `ballMax`)이 `10/10`
 * 에 붙박여 **공을 다시는 놓을 수 없다.** 콘은 상한이 없어 증상만 안 보일 뿐 똑같이 부푼다.
 *
 * 휠체어는 **제외한다** — 배치되지 않은 휠체어가 명단에 남는 것은 의도된 동작이고
 * (ToolRail 의 '미배치 선수'), 여기서 버리면 선수가 명단에서 사라진다. */
function pruneOrphanCast(d: Drill): Drill {
  const balls = d.cast.balls.filter((b) => d.steps.some((s) => s.balls[b.id] !== undefined));
  const cones = d.cast.cones.filter((c) => d.steps.some((s) => s.cones[c.id] !== undefined));
  if (balls.length === d.cast.balls.length && cones.length === d.cast.cones.length) return d;
  return { ...d, cast: { ...d.cast, balls, cones } };
}

/** 기본 '삭제': 이 스텝부터 끝까지 pose 를 지운다. */
export function removeFromStepOnward(d: Drill, i: number, id: CastId): Drill {
  let changed = false;
  const steps = d.steps.map((s, k) => {
    if (k < i) return s;
    const next = removeFromStep(s, id);
    if (next !== s) changed = true;
    return next;
  });
  return changed ? pruneOrphanCast({ ...d, steps }) : d;
}

export function removeFromThisStepOnly(d: Drill, i: number, id: CastId): Drill {
  const step = d.steps[i];
  if (!step) return d;
  const next = removeFromStep(step, id);
  if (next === step) return d;
  return pruneOrphanCast(replaceStep(d, i, next));
}

/** 스텝 i 의 현재 pose 를 그 이후 모든 스텝으로 전파(고정)한다. */
export function propagateForward(d: Drill, i: number, id: CastId): Drill {
  const base = d.steps[i];
  if (!base) return d;
  const pose = poseOfCast(base, id);
  if (pose === undefined) return d;
  let changed = false;
  const steps = d.steps.map((s, k) => {
    if (k <= i) return s;
    const cur = poseOfCast(s, id);
    if (cur !== undefined && posesEqual(cur, pose)) return s;
    changed = true;
    if (isId(id, 'ch')) return { ...s, chairs: withMap(s.chairs, id, pose as StoredChairPose) };
    if (isId(id, 'bl')) return { ...s, balls: withMap(s.balls, id, pose as Vec2) };
    return { ...s, cones: withMap(s.cones, id, pose as Vec2) };
  });
  return changed ? { ...d, steps } : d;
}

/** 직전 스텝 복제. 화살표·메모 id 는 그대로 보존한다(§3.5 스코프 표).
 *  이름은 이제 생성하지 않는다(기현님 확정 2026-08-17, 과제⑦) — 자동 생성 '스텝 N' 은
 *  사용자 내용이 아니라 UI 가 채울 자리를 메우던 자리표시자였다. UI 가 이름 필드를 이미
 *  폐기했으니 새 스텝의 name 은 ''(정화기가 이관할 것도, 버릴 것도 없다). */
export function addStepAfter(d: Drill, i: number): Drill {
  const base = d.steps[i];
  if (!base) return d;
  const clone = structuredClone(base);
  clone.id = newId('st');
  clone.name = '';
  const steps = d.steps.slice();
  steps.splice(i + 1, 0, clone);
  return { ...d, steps };
}

/** 스텝 i 를 그대로(이름 포함) 복제한다. 화살표·메모 id 보존이 D6 크로스페이드의 핵심이다.
 *  삽입 자리는 기본이 **바로 뒤**(`i + 1`, 후방 복제 — §복제 기현님 확정 2026-08-17)지만,
 *  맨 앞 틈의 [+]("아래 첫 스텝의 복제를 맨 앞에")처럼 다른 자리가 필요하면 `insertAt` 으로
 *  덮어쓴다. `Array.prototype.splice` 가 범위를 알아서 clamp 하므로 여기서 따로 막지 않는다. */
export function duplicateStep(d: Drill, i: number, insertAt?: number): Drill {
  const base = d.steps[i];
  if (!base) return d;
  const clone = structuredClone(base);
  clone.id = newId('st');
  const steps = d.steps.slice();
  steps.splice(insertAt ?? i + 1, 0, clone);
  return { ...d, steps };
}

export function deleteStep(d: Drill, i: number): Drill {
  if (d.steps.length <= 1) return d;
  if (i < 0 || i >= d.steps.length) return d;
  const steps = d.steps.slice();
  steps.splice(i, 1);
  // 그 스텝에만 있던 공·콘은 여기서 유령이 된다 — 지우개와 같은 결함이다. pruneOrphanCast 참고.
  return pruneOrphanCast({ ...d, steps });
}

export function moveStep(d: Drill, from: number, to: number): Drill {
  const n = d.steps.length;
  if (from === to || from < 0 || from >= n || to < 0 || to >= n) return d;
  const steps = d.steps.slice();
  const [item] = steps.splice(from, 1);
  steps.splice(to, 0, item!);
  return { ...d, steps };
}

// ── ⑤ 다중 선택(기현님 확정 2026-08-17, PLAN-STEP-EDITING.md §다중 선택) ─────────────────────
// 선택 상태 자체(ephemeral)는 컴포넌트 로컬이라 여기 들어오지 않는다 — 여기 셋은 "선택된
// id 묶음" 을 **결과만** 받는 순수 함수다. `ids` 는 순서가 뜻이 없다(전부 `new Set` 으로
// 소속만 물은 뒤, 실제 순서는 `d.steps` 원본 순서에서 다시 뽑는다) — 체크박스를 누른 순서에
// 따라 결과가 갈리면 "같은 걸 선택했는데 어제와 결과가 다르다" 가 된다.

/** 선택 묶음을 통째로 옮긴다(일괄 이동) — **상대 순서 보존**. 단일 `moveStep` 을 ids 개수만큼
 *  반복 호출하면 되돌리기가 조각난다(한 번 끈 이동을 Ctrl+Z 여러 번으로 풀어야 한다) — 그래서
 *  한 액션이 한 번에 계산한다.
 *
 *  `toIndex` 의 좌표계가 핵심이다: **선택되지 않은 나머지 스텝들의 순서 안에서의 삽입 자리**
 *  (0..나머지 길이)다. 화면의 드래그가 재는 것이 "그룹을 뺀 나머지 카드 중심" 이라
 *  (`useStepGroupReorderDrag.ts`), 커밋도 같은 좌표계여야 미리보기와 결과가 어긋나지 않는다
 *  (`movedOrderGroup` 이 미리보기, 이 함수가 커밋 — 둘 다 "나머지 사이에 묶음을 통째로 꽂는다"
 *  는 같은 규칙이다).
 *
 *  선택이 원래 흩어져 있었다면(카드 사이사이에 체크 안 된 카드가 끼어 있었다면) 이동 뒤에는
 *  **반드시 한 덩어리로 뭉친다** — 그게 "묶음을 옮긴다" 는 조작의 뜻이다. 그래서 이미 이웃해
 *  있던 선택을 원래 자리 그대로 놓았을 때만 항등(동일 참조)이 나온다. */
export function moveSteps(d: Drill, ids: readonly StepId[], toIndex: number): Drill {
  if (ids.length === 0) return d;
  const idSet = new Set(ids);
  const moving = d.steps.filter((s) => idSet.has(s.id));
  if (moving.length === 0) return d;
  const rest = d.steps.filter((s) => !idSet.has(s.id));
  const at = Math.min(Math.max(toIndex, 0), rest.length);
  const steps = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
  // 순서가 실제로 안 바뀌었으면(이미 이웃해 있던 선택을 같은 틈에 도로 놓은 경우) 원본을
  // 그대로 돌려준다 — withHistory 가 `next === s.present` 로 히스토리·리렌더를 억제한다.
  if (steps.length === d.steps.length && steps.every((s, i) => s === d.steps[i])) return d;
  return { ...d, steps };
}

/** 선택 묶음을 복제한다(일괄 복제) — 상대 순서를 보존한 사본을 **마지막 선택 카드 바로 뒤**에
 *  통째로 삽입한다(계획서 §다중 선택: "마지막 선택 카드 뒤에 상대 순서대로 삽입"). `duplicateStep`
 *  하나를 ids 개수만큼 반복하면 매번 삽입 자리가 밀려나며 계산이 얽히고 되돌리기도 조각난다.
 *
 *  정원 가드(LIMITS.maxSteps)를 **여기서도** 본다 — 사이드바 버튼이 미리 잠그지만(정원이면
 *  disabled), 그 가드가 뚫려도(예: 다른 탭에서 동시 편집) 여기가 마지막 문이다. 넘치면 원본을
 *  그대로 돌려준다. */
export function duplicateSteps(d: Drill, ids: readonly StepId[]): Drill {
  if (ids.length === 0) return d;
  const idSet = new Set(ids);
  if (d.steps.length + idSet.size > LIMITS.maxSteps) return d;
  let lastIdx = -1;
  d.steps.forEach((s, i) => {
    if (idSet.has(s.id)) lastIdx = i;
  });
  if (lastIdx < 0) return d;
  const clones = d.steps
    .filter((s) => idSet.has(s.id))
    .map((s) => {
      const clone = structuredClone(s);
      clone.id = newId('st');
      return clone;
    });
  const steps = d.steps.slice();
  steps.splice(lastIdx + 1, 0, ...clones);
  return { ...d, steps };
}

/** 선택 묶음을 지운다(일괄 삭제) — 드릴에는 스텝이 **최소 1장은 남아야 한다**(`deleteStep` 과
 *  같은 가드). 선택이 전량이면(또는 그보다 많으면, 있을 수 없지만 방어적으로) 원본을 그대로
 *  돌려준다 — 사이드바 버튼이 미리 잠그지만 여기가 마지막 문이다. stepId 재지정(삭제 묶음에
 *  현재 스텝이 있으면 남는 스텝으로 옮기는 일)은 여기서 하지 않는다 — 이 함수는 `Drill` 만
 *  다루는 순수 함수이고, `stepId` 는 `EditorState` 의 것이라 `store/editor/reducer.ts` 의
 *  `uiReducer` 가 (기존 `STEP_DELETE` 의 이웃 선택 로직을 일반화해) 맡는다. */
export function deleteSteps(d: Drill, ids: readonly StepId[]): Drill {
  if (ids.length === 0) return d;
  const idSet = new Set(ids);
  const steps = d.steps.filter((s) => !idSet.has(s.id));
  if (steps.length === 0 || steps.length === d.steps.length) return d;
  return pruneOrphanCast({ ...d, steps });
}

function arrowsEqual(a: Arrow, b: Arrow): boolean {
  return (
    a.id === b.id &&
    a.color === b.color &&
    // 2026-08-16 — kind 자리를 화살촉 둘이 대신한다. 빠뜨리면 끝을 눌러 화살촉만 바꾼 편집이
    // "변한 것 없음" 으로 버려진다(도형의 pts 가 같은 함정을 겪었다).
    a.headFrom === b.headFrom &&
    a.headTo === b.headTo &&
    a.from.x === b.from.x &&
    a.from.y === b.from.y &&
    a.ctrl.x === b.ctrl.x &&
    a.ctrl.y === b.ctrl.y &&
    a.to.x === b.to.x &&
    a.to.y === b.to.y
  );
}

export function setArrow(d: Drill, i: number, a: Arrow): Drill {
  const step = d.steps[i];
  if (!step) return d;
  const idx = step.arrows.findIndex((x) => x.id === a.id);
  if (idx !== -1 && arrowsEqual(step.arrows[idx]!, a)) return d;
  const arrows = step.arrows.slice();
  if (idx === -1) arrows.push(a);
  else arrows[idx] = a;
  return replaceStep(d, i, { ...step, arrows });
}

export function removeArrow(d: Drill, i: number, id: ArrowId): Drill {
  const step = d.steps[i];
  if (!step) return d;
  if (!step.arrows.some((a) => a.id === id)) return d;
  // 잠근 채로 지우면 플래그가 죽은 id 로 남는다 — 개체 제거와 같은 규칙이다(stripStepFlags).
  return replaceStep(d, i, stripStepFlags({ ...step, arrows: step.arrows.filter((a) => a.id !== id) }, id));
}

function notesEqual(a: NoteLabel, b: NoteLabel): boolean {
  return (
    a.id === b.id &&
    a.x === b.x &&
    a.y === b.y &&
    a.text === b.text &&
    a.size === b.size &&
    a.color === b.color &&
    a.align === b.align
  );
}

/** 도형 하나를 스텝에 넣거나 갈아끼운다. 값이 같으면 **같은 참조를 돌려준다** — 이 한 줄이
 *  드래그 중 매 프레임의 리렌더와 히스토리 한 칸을 함께 막는다(setNote 와 같은 규율). */
export function setShape(d: Drill, i: number, sh: Shape): Drill {
  const step = d.steps[i];
  if (!step) return d;
  const idx = step.shapes.findIndex((x) => x.id === sh.id);
  const cur = idx === -1 ? null : step.shapes[idx]!;
  // ⚠️ `pts` 를 반드시 함께 본다(2026-08-15 자유 삼각형). 꼭짓점을 옮겨도 경계상자가 그대로인
  // 이동이 있는데(예: 한 꼭짓점을 변을 따라 미끄러뜨리기), w/h/rot 만 비교하면 그 편집이
  // "변한 것 없음" 으로 통째로 버려진다 — 화면에서는 손잡이만 따라오고 도형은 안 바뀐다.
  const samePts =
    cur?.pts === sh.pts ||
    (cur?.pts != null &&
      sh.pts != null &&
      cur.pts.every((p, i) => p.x === sh.pts![i]!.x && p.y === sh.pts![i]!.y));
  if (cur && cur.kind === sh.kind && cur.x === sh.x && cur.y === sh.y && cur.w === sh.w && cur.h === sh.h && cur.rot === sh.rot && samePts) {
    return d;
  }
  const shapes = step.shapes.slice();
  if (idx === -1) shapes.push(sh);
  else shapes[idx] = sh;
  return replaceStep(d, i, { ...step, shapes });
}

/** 스텝의 상태 플래그(잠김·무시)를 켜고 끈다. 값이 이미 그러면 **같은 참조**를 돌려준다 —
 *  같은 메뉴를 두 번 눌러도 되돌리기가 한 칸도 안 쌓인다. */
export function setStepFlag(d: Drill, i: number, flag: 'locked' | 'ignored', id: string, on: boolean): Drill {
  const step = d.steps[i];
  if (!step) return d;
  const cur = (step[flag] ?? []) as readonly string[];
  const has = cur.includes(id);
  if (has === on) return d;
  const next = on ? [...cur, id] : cur.filter((x) => x !== id);
  // 빈 목록이면 **키를 지운다.** 남겨 두면 저장본에 `"locked":[]` 가 끝없이 따라다니고,
  // 정화기가 "없으면 빈 목록" 으로 접는 규칙과 두 가지 표현이 공존하게 된다.
  const patched: DrillStep = { ...step };
  if (next.length === 0) delete patched[flag];
  else if (flag === 'locked') patched.locked = next;
  else patched.ignored = next as ChairId[];
  return replaceStep(d, i, patched);
}

export function removeShape(d: Drill, i: number, id: ShapeId): Drill {
  const step = d.steps[i];
  if (!step) return d;
  const shapes = step.shapes.filter((x) => x.id !== id);
  if (shapes.length === step.shapes.length) return d;
  return replaceStep(d, i, stripStepFlags({ ...step, shapes }, id));
}

export function setNote(d: Drill, i: number, n: NoteLabel): Drill {
  const step = d.steps[i];
  if (!step) return d;
  const idx = step.notes.findIndex((x) => x.id === n.id);
  if (idx !== -1 && notesEqual(step.notes[idx]!, n)) return d;
  const notes = step.notes.slice();
  if (idx === -1) notes.push(n);
  else notes[idx] = n;
  return replaceStep(d, i, { ...step, notes });
}

export function removeNote(d: Drill, i: number, id: NoteId): Drill {
  const step = d.steps[i];
  if (!step) return d;
  if (!step.notes.some((n) => n.id === id)) return d;
  return replaceStep(d, i, stripStepFlags({ ...step, notes: step.notes.filter((n) => n.id !== id) }, id));
}

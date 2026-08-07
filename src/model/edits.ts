// §3.7 편집 연산. 전부 순수 함수, 새 Drill 반환. 변화 없으면 동일 참조를 반환한다
// (리렌더·히스토리 억제). 시간축 규약: 추가도 삭제도 "이 스텝부터 끝까지".
import type { Vec2 } from '../core/units.ts';
import { isId, newId } from '../core/ids.ts';
import type { ChairId, BallId, ConeId, CastId, ArrowId, NoteId } from '../core/ids.ts';
import type { Drill, DrillStep, DrillCast, ChairDef, NoteLabel, PoseMap } from './drill.ts';
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

export function addBall(d: Drill, i: number, at: Vec2): Drill {
  if (d.cast.balls.length >= LIMITS.maxBalls) return d;
  const id = newId('bl');
  const cast: DrillCast = { ...d.cast, balls: [...d.cast.balls, { id }] };
  return setForward({ ...d, cast }, i, id, at);
}

export function addCone(d: Drill, i: number, at: Vec2, colorIndex: 0 | 1): Drill {
  if (d.cast.cones.length >= LIMITS.maxCones) return d;
  const id = newId('cn');
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

function removeFromStep(s: DrillStep, id: CastId): DrillStep {
  if (isId(id, 'ch')) {
    const chairs = omitKey(s.chairs, id);
    return chairs === s.chairs ? s : { ...s, chairs };
  }
  if (isId(id, 'bl')) {
    const balls = omitKey(s.balls, id);
    return balls === s.balls ? s : { ...s, balls };
  }
  const cones = omitKey(s.cones, id);
  return cones === s.cones ? s : { ...s, cones };
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
  return changed ? { ...d, steps } : d;
}

export function removeFromThisStepOnly(d: Drill, i: number, id: CastId): Drill {
  const step = d.steps[i];
  if (!step) return d;
  const next = removeFromStep(step, id);
  if (next === step) return d;
  return replaceStep(d, i, next);
}

/** cast + 전 스텝에서 완전히 제거. */
export function removeEverywhere(d: Drill, id: CastId): Drill {
  let changed = false;
  const steps = d.steps.map((s) => {
    const next = removeFromStep(s, id);
    if (next !== s) changed = true;
    return next;
  });
  let cast = d.cast;
  if (isId(id, 'ch')) {
    const chairs = d.cast.chairs.filter((c) => c.id !== id);
    if (chairs.length !== d.cast.chairs.length) {
      cast = { ...d.cast, chairs };
      changed = true;
    }
  } else if (isId(id, 'bl')) {
    const balls = d.cast.balls.filter((b) => b.id !== id);
    if (balls.length !== d.cast.balls.length) {
      cast = { ...d.cast, balls };
      changed = true;
    }
  } else {
    const cones = d.cast.cones.filter((c) => c.id !== id);
    if (cones.length !== d.cast.cones.length) {
      cast = { ...d.cast, cones };
      changed = true;
    }
  }
  return changed ? { ...d, cast, steps } : d;
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

/** 직전 스텝 복제, 이름 '스텝 N'. 화살표·메모 id 는 그대로 보존한다(§3.5 스코프 표). */
export function addStepAfter(d: Drill, i: number): Drill {
  const base = d.steps[i];
  if (!base) return d;
  const clone = structuredClone(base);
  clone.id = newId('st');
  clone.name = `스텝 ${i + 2}`;
  const steps = d.steps.slice();
  steps.splice(i + 1, 0, clone);
  return { ...d, steps };
}

/** 스텝 i 를 그대로(이름 포함) 바로 뒤에 복제한다. 화살표·메모 id 보존이 D6 크로스페이드의 핵심이다. */
export function duplicateStep(d: Drill, i: number): Drill {
  const base = d.steps[i];
  if (!base) return d;
  const clone = structuredClone(base);
  clone.id = newId('st');
  const steps = d.steps.slice();
  steps.splice(i + 1, 0, clone);
  return { ...d, steps };
}

export function deleteStep(d: Drill, i: number): Drill {
  if (d.steps.length <= 1) return d;
  if (i < 0 || i >= d.steps.length) return d;
  const steps = d.steps.slice();
  steps.splice(i, 1);
  return { ...d, steps };
}

export function moveStep(d: Drill, from: number, to: number): Drill {
  const n = d.steps.length;
  if (from === to || from < 0 || from >= n || to < 0 || to >= n) return d;
  const steps = d.steps.slice();
  const [item] = steps.splice(from, 1);
  steps.splice(to, 0, item!);
  return { ...d, steps };
}

function arrowsEqual(a: Arrow, b: Arrow): boolean {
  return (
    a.id === b.id &&
    a.kind === b.kind &&
    a.color === b.color &&
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
  return replaceStep(d, i, { ...step, arrows: step.arrows.filter((a) => a.id !== id) });
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
  return replaceStep(d, i, { ...step, notes: step.notes.filter((n) => n.id !== id) });
}

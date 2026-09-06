// 개체 표시 순서(z-order) — 2026-09-06 기현 지시, 정본 계획서 `docs/PLAN-Z-ORDER.md` 결정 2·4·5.
//
// ⚠️ **`DrillStep.zOrder`(아래→위 id 목록)를 푸는 자리는 여기 하나뿐이다.** 판·시연·인쇄·PNG·
// 썸네일 다섯 렌더 경로와 히트테스트가 전부 `sceneOrder` 를 읽는다 — 경로마다 정렬을 다시
// 짜면 이 저장소에서 이미 네 번 터진 "경로별 드리프트" 의 다섯째 사례가 된다(§0 한 줄 원칙).
//
// ⚠️ **순수하다 — DOM 도, 기하도 없다.** 겹침 판정은 `physics/bounds.ts` 가 하고, 이 파일은
// 그 결과를 `ReadonlySet<string>` 으로 **받기만** 한다. 검증 상한(LIMITS)은 `validate.ts` 에만
// 둔다(AGENTS.md §1.5). 그래야 이 파일이 모델·렌더·히트 어디서든 값싸게 불린다.
import type { DrillCast, DrillStep } from './drill.ts';

/** 순서를 갖는 개체 7종. 골대·규칙존·격자·선택 강조·핸들은 **개체가 아니라** 판의 부속이라
 *  대상이 아니다(계획서 결정 4). */
export type SceneKind = 'cone' | 'stroke' | 'arrow' | 'chair' | 'ball' | 'note' | 'shape';

export interface SceneRef {
  kind: SceneKind;
  id: string;
}

/** 기본층 — **아래→위**. `zOrder` 가 없는 스텝(= 지금까지의 모든 드릴)이 그리던 순서 그대로다.
 *
 *  ⚠️ **도형이 맨 아래인 것은 2026-08-14 지시**(*"도형은 코트보다 높고 칩·화살표보다 낮게"*)
 *  가 **기본값으로 살아 있는** 것이다(계획서 결정 4). 그 지시가 뒤집힌 것이 아니라, 사용자가
 *  스텝마다 뒤집을 수 있게 되었을 뿐이다 — 아무것도 안 하면 판은 한 픽셀도 안 변한다. */
export const DEFAULT_TIERS: readonly SceneKind[] = ['shape', 'cone', 'stroke', 'arrow', 'chair', 'ball', 'note'];

/** id 접두 → 종류(`core/ids.ts` 의 접두 규약이 정본). 모르는 접두는 `null` — 스텝·드릴·항목
 *  같은 문서 id 가 목록에 섞여 들어와도 여기서 조용히 떨어진다. */
export function kindOfId(id: string): SceneKind | null {
  const p = id.slice(0, id.indexOf('_'));
  switch (p) {
    case 'cn':
      return 'cone';
    case 'fh':
      return 'stroke';
    case 'ar':
      return 'arrow';
    case 'ch':
      return 'chair';
    case 'bl':
      return 'ball';
    case 'nt':
      return 'note';
    case 'sh':
      return 'shape';
    default:
      return null;
  }
}

/** 기본층 순서(아래→위)로 그 스텝에 **실제로 있는** 개체를 늘어놓는다.
 *
 *  층 안의 순서는 "그 종류를 지금 그리는 순서" 를 그대로 쓴다 — 화살표·메모·도형·획은 스텝
 *  배열 순서, 휠체어·공·콘은 **cast 배열 순서**(스텝의 PoseMap 은 키 순서가 저장·복원마다
 *  흔들릴 수 있어 기준이 못 된다). */
function baseOrder(step: DrillStep, cast: DrillCast): SceneRef[] {
  const out: SceneRef[] = [];
  // ⚠️ `?? []` — `shapes`·`notes` 는 타입상 필수지만 **키 없는 옛 스텝 객체가 아직 실재한다**
  //   (도형·메모 필드는 2026-08-14 에 생겼고 그 길을 안 지난 저장본·테스트 픽스처에는 키가
  //   없다 — `model/thumb.ts`·`ShapeLayer.tsx` 가 같은 방어를 한다). 2026-09-06 검수에서
  //   방어 없이 훑다가 인쇄·시연 테스트 10건이 `not iterable` 로 죽었다. 여기가 다섯 렌더 경로의
  //   공통 입구라 방어도 여기 한 곳이다 — 호출부마다 빈 배열을 채워 넘기게 하지 않는다.
  for (const kind of DEFAULT_TIERS) {
    switch (kind) {
      case 'shape':
        for (const sh of step.shapes ?? []) out.push({ kind, id: sh.id });
        break;
      case 'cone':
        for (const c of cast.cones) if (step.cones[c.id] !== undefined) out.push({ kind, id: c.id });
        break;
      case 'stroke':
        for (const s of step.strokes ?? []) out.push({ kind, id: s.id });
        break;
      case 'arrow':
        for (const a of step.arrows) out.push({ kind, id: a.id });
        break;
      case 'chair':
        for (const c of cast.chairs) if (step.chairs[c.id] !== undefined) out.push({ kind, id: c.id });
        break;
      case 'ball':
        for (const b of cast.balls) if (step.balls[b.id] !== undefined) out.push({ kind, id: b.id });
        break;
      case 'note':
        for (const n of step.notes ?? []) out.push({ kind, id: n.id });
        break;
    }
  }
  return out;
}

/** 이 스텝의 **유효 표시 순서**(아래→위). 규칙 셋(계획서 결정 2):
 *
 *  ① `zOrder` 가 없으면 기본층 순서(`DEFAULT_TIERS`) — 옛 드릴은 안 변한다.
 *  ② 있으면 그 순서대로. 스텝에 없는 id(고아·모르는 접두)는 **무시**한다.
 *  ③ 목록에 **없는** 개체(목록이 생긴 뒤에 놓은 것)는 기본층 순서대로 **끝(맨 위)** 에 붙는다.
 *
 *  ⚠️ ③은 기본층과 일부러 다르다 — 그리기 도구의 관례("방금 놓은 것이 위")를 따른다. 새
 *  개체를 기본층 자리에 끼우면 사용자가 손으로 정한 순서 **사이로** 파고들어 더 놀란다. */
export function sceneOrder(step: DrillStep, cast: DrillCast): SceneRef[] {
  const base = baseOrder(step, cast);
  const list = step.zOrder;
  if (!list || list.length === 0) return base;

  const byId = new Map(base.map((r) => [r.id, r]));
  const out: SceneRef[] = [];
  const placed = new Set<string>();
  for (const id of list) {
    const ref = byId.get(id);
    if (!ref || placed.has(id)) continue; // ② 고아·중복은 무시
    placed.add(id);
    out.push(ref);
  }
  for (const ref of base) if (!placed.has(ref.id)) out.push(ref); // ③ 목록에 없던 것은 맨 위로
  return out;
}

export type ZOp = 'back' | 'backward' | 'forward' | 'front';

/** 겹치는 것 중 그 방향에서 가장 가까운 것의 인덱스. 없으면 -1. */
function nearestOverlap(ids: readonly string[], i: number, overlaps: ReadonlySet<string>, up: boolean): number {
  if (up) {
    for (let j = i + 1; j < ids.length; j += 1) if (overlaps.has(ids[j]!)) return j;
  } else {
    for (let j = i - 1; j >= 0; j -= 1) if (overlaps.has(ids[j]!)) return j;
  }
  return -1;
}

/** 네 명령이 지금 **가능한가**(계획서 결정 5). 메뉴의 `disabled` 가 이 값 하나를 읽는다.
 *
 *  ⚠️ **겹치는 개체가 하나도 없으면 넷 다 false** 다. 안 겹치는 개체와 자리를 바꾸면 화면이
 *  전혀 안 변해 *"눌렀는데 아무 일도 없음"* 이 된다 — 지시의 *"겹침 판정"* 은 이 문지기다.
 *  겹침이 있을 때, `forward`/`backward` 는 **그 방향에 겹치는 것이 있을 때만**(안 그러면 역시
 *  화면이 안 변한다), `front`/`back` 은 **이미 그 끝이 아닐 때만** 가능하다.
 *
 *  `overlaps` 는 대상 id 와 겹치는 **다른 개체들의 id 집합**이다(`physics/bounds.ts` 가 만든다).
 *  대상 자신이 섞여 있어도 결과는 같다 — 자기 위/아래를 훑을 때 자기 인덱스는 안 본다. */
export function zMoves(
  step: DrillStep,
  cast: DrillCast,
  id: string,
  overlaps: ReadonlySet<string>,
): Record<ZOp, boolean> {
  const none = { back: false, backward: false, forward: false, front: false };
  if (overlaps.size === 0) return none;
  const ids = sceneOrder(step, cast).map((r) => r.id);
  const i = ids.indexOf(id);
  if (i < 0) return none;
  return {
    back: i > 0,
    backward: nearestOverlap(ids, i, overlaps, false) >= 0,
    forward: nearestOverlap(ids, i, overlaps, true) >= 0,
    front: i < ids.length - 1,
  };
}

/** 한 개체를 순서에서 옮긴다. **불가능하면 같은 `step` 참조를 그대로 돌려준다** — 리듀서가
 *  그 동일성으로 "아무 일도 안 일어났다"(undo 스택에 안 쌓는다)를 판단한다(`edits.ts` 규약).
 *
 *  ⚠️ 가능하면 **그 스텝의 전체 순서를 물질화**해 `zOrder` 로 저장한다(계획서 결정 1). 옮긴
 *  개체 하나만 적는 부분 목록은 "목록에 없는 것" 의 자리를 매번 다시 정해야 해서 읽는 규칙이
 *  둘로 갈린다.
 *
 *  `forward` = 자기 **위**에 있는 겹치는 개체 중 가장 가까운 것의 **바로 위**로(겹치지 않는
 *  것은 건너뛴다 — 그것과 자리를 바꿔 봐야 화면이 안 변한다). `backward` 는 대칭.
 *  `front`/`back` 은 목록 끝/처음. */
export function moveZ(
  step: DrillStep,
  cast: DrillCast,
  id: string,
  op: ZOp,
  overlaps: ReadonlySet<string>,
): DrillStep {
  if (!zMoves(step, cast, id, overlaps)[op]) return step;
  const ids = sceneOrder(step, cast).map((r) => r.id);
  const i = ids.indexOf(id);

  // 뽑아낸 뒤의 배열 기준으로 넣을 자리를 센다. 위쪽 기준점(j)은 제거로 한 칸 당겨지므로
  // "바로 위" 가 곧 j 이고, 아래쪽 기준점은 안 밀리므로 "바로 아래" 도 곧 j 다.
  let at: number;
  switch (op) {
    case 'back':
      at = 0;
      break;
    case 'front':
      at = ids.length - 1;
      break;
    case 'forward':
      at = nearestOverlap(ids, i, overlaps, true);
      break;
    case 'backward':
      at = nearestOverlap(ids, i, overlaps, false);
      break;
  }
  const next = ids.slice();
  next.splice(i, 1);
  next.splice(at, 0, id);
  return { ...step, zOrder: next };
}

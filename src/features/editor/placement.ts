// §6.10 개체 배치 규칙 — **한 곳에서만** 정한다.
//
// 개체를 코트에 올리는 경로가 셋이다:
//   ① 도구를 고르고 코트를 탭    (useEditorPointer.placeAt)
//   ② 키보드 커서 Enter (§7.5d)  (useEditorPointer.placeAtCursor → 같은 placeAt)
//   ③ 트레이에서 끌어다 놓기      (2026-08-11 기현 지시로 추가)
//
// 규칙(공 상한, 팀별 초기 방향, 배치 후 선택)이 경로마다 흩어지면 "탭으로는 10개에서 막히는데
// 드래그로는 11개째가 놓인다" 같은 어긋남이 조용히 생긴다. 그래서 dispatch 조합을 여기 모은다.
import type { Dispatch } from 'react';
import type { Vec2 } from '../../core/units.ts';
import { newId } from '../../core/ids.ts';
import type { ChairId } from '../../core/ids.ts';
import type { Drill } from '../../model/drill.ts';
import { COURT_DEFS } from '../../model/court.ts';
import type { EditorAction } from '../../store/editor/actions.ts';

export const BALL_LIMIT_MSG = '공은 최대 10개까지 놓을 수 있습니다.';
export const PLAYER_UNARMED_MSG = '먼저 트레이에서 배치할 선수를 고르세요.';

/** 코트에 '놓을 수 있는' 도구만. select/route/pass/erase 는 배치가 아니다. */
export type PlaceKind = 'ball' | 'cone' | 'note' | 'player';

export interface PlaceDeps {
  drill: Drill;
  coneSlot: 0 | 1;
  ballMax: number;
  /** 배치 대상 휠체어. 트레이 드래그는 **끌고 있는 칩의 id** 를 직접 넣는다. */
  pendingPlayerId: ChairId | null;
  dispatch: Dispatch<EditorAction>;
  showToast(message: string): void;
  onPlayerPlaced(): void;
}

/** 실제로 놓였으면 true. 상한 초과·대상 미선택이면 안내를 띄우고 false. */
export function placeObject(kind: PlaceKind, world: Vec2, d: PlaceDeps): boolean {
  if (kind === 'ball') {
    // 상한은 cast 기준이다. 지운 공이 cast 에 남아 있으면 여기서 영영 막힌다 —
    // 그 유령을 만들지 않는 책임은 model/edits.ts 의 pruneOrphanCast 에 있다.
    if (d.drill.cast.balls.length >= d.ballMax) {
      d.showToast(BALL_LIMIT_MSG);
      return false;
    }
    d.dispatch({ type: 'OBJECT_ADD', kind: 'ball', at: world });
    return true;
  }

  if (kind === 'cone') {
    d.dispatch({ type: 'OBJECT_ADD', kind: 'cone', at: world, colorIndex: d.coneSlot });
    return true;
  }

  if (kind === 'note') {
    const id = newId('nt');
    d.dispatch({ type: 'NOTE_SET', note: { id, x: world.x, y: world.y, text: '' } });
    // 놓자마자 선택해 둔다 — 빈 메모는 화면에서 거의 보이지 않아서, 선택 링이 없으면
    // "메모 도구가 아무 반응도 없다" 로 읽힌다(2026-08-10 김경일 제보).
    d.dispatch({ type: 'SELECT_SET', ids: [id] });
    return true;
  }

  const id = d.pendingPlayerId;
  if (!id) {
    d.showToast(PLAYER_UNARMED_MSG);
    return false;
  }
  const def = d.drill.cast.chairs.find((c) => c.id === id);
  if (!def) return false;
  const court = COURT_DEFS[d.drill.courtMode];
  const headingDeg = def.team === 'home' ? court.homeHeadingDeg : court.awayHeadingDeg;
  d.dispatch({ type: 'CHAIR_PLACE', id, pose: { x: world.x, y: world.y, angleDeg: headingDeg } });
  d.dispatch({ type: 'SELECT_SET', ids: [id] });
  d.onPlayerPlaced();
  return true;
}

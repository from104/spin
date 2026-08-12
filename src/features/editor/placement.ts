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
import { BALL, CONE } from '../../core/constants.ts';
import type { EditorAction } from '../../store/editor/actions.ts';
import { cues } from '../../ui/cues.ts';

// 개수를 문장에 박아 두면 상한을 바꿀 때 안내만 옛말이 된다(실제로 10 → 8 때 그랬다).
export const BALL_LIMIT_MSG = `공은 최대 ${BALL.maxCount}개까지 놓을 수 있습니다.`;
export const coneLimitMsg = (slot: 0 | 1): string =>
  `${slot === 0 ? '주황' : '파랑'} 콘은 최대 ${CONE.maxCountPerColor}개까지 놓을 수 있습니다.`;
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

/** 실제로 놓였으면 true. 상한 초과·대상 미선택이면 안내를 띄우고 false.
 *
 *  §4.3 P1-4 놓임 '탁' 도 여기서 낸다 — 이 파일이 존재하는 이유(경로 셋이 같은 규칙을
 *  쓴다)가 그대로 소리에도 적용된다. 경로마다 따로 울리면 "탭으로는 소리가 나는데 트레이로
 *  끌면 안 난다" 가 조용히 생긴다.
 *  **실패했을 때는 울리지 않는다**: 상한 초과·대상 미선택은 토스트(`role="status"`)가
 *  이미 말하고 있고, 놓이지도 않았는데 놓임 소리가 나면 그 신호는 거짓말이다. */
export function placeObject(kind: PlaceKind, world: Vec2, d: PlaceDeps): boolean {
  const placed = placeObjectInner(kind, world, d);
  if (placed) cues.play('drop');
  return placed;
}

function placeObjectInner(kind: PlaceKind, world: Vec2, d: PlaceDeps): boolean {
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
    // 콘도 공과 같은 상자 은유다 — 색상별로 8개씩. 상한은 cast 기준이라 유령이 남으면
    // 여기서 영영 막힌다(pruneOrphanCast 책임, 공 쪽 주석과 같은 이유).
    const sameColor = d.drill.cast.cones.filter((c) => c.colorIndex === d.coneSlot).length;
    if (sameColor >= CONE.maxCountPerColor) {
      d.showToast(coneLimitMsg(d.coneSlot));
      return false;
    }
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

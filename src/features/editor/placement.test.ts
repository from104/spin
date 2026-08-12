// §6.10 배치 규칙 — 상한이 **한 곳에서만** 정해지는지. 경로가 셋(탭·키보드·트레이 드래그)인데
// 전부 이 함수를 지나므로, 여기가 막으면 세 경로가 같이 막힌다.
import { describe, expect, it, vi } from 'vitest';
import { placeObject, BALL_LIMIT_MSG, coneLimitMsg, PLAYER_UNARMED_MSG } from './placement.ts';
import type { PlaceDeps } from './placement.ts';
import { BALL, CONE } from '../../core/constants.ts';
import { newId } from '../../core/ids.ts';
import type { Drill } from '../../model/drill.ts';
import { createDrill } from '../../model/defaults.ts';
import { cues } from '../../ui/cues.ts';

function deps(over: { balls?: number; cones?: (0 | 1)[]; coneSlot?: 0 | 1 } = {}) {
  const drill: Drill = createDrill({ courtMode: 'full', empty: true });
  drill.cast.balls = Array.from({ length: over.balls ?? 0 }, () => ({ id: newId('bl') }));
  drill.cast.cones = (over.cones ?? []).map((colorIndex) => ({ id: newId('cn'), colorIndex }));
  const dispatch = vi.fn();
  const showToast = vi.fn();
  const d: PlaceDeps = {
    drill,
    coneSlot: over.coneSlot ?? 0,
    ballMax: BALL.maxCount,
    pendingPlayerId: null,
    dispatch,
    showToast,
    onPlayerPlaced: vi.fn(),
  };
  return { d, dispatch, showToast };
}

const AT = { x: 100, y: 100 };

describe('placeObject — 공 상한', () => {
  it(`${BALL.maxCount - 1}개까지는 놓인다`, () => {
    const { d, dispatch, showToast } = deps({ balls: BALL.maxCount - 1 });
    expect(placeObject('ball', AT, d)).toBe(true);
    expect(dispatch).toHaveBeenCalledWith({ type: 'OBJECT_ADD', kind: 'ball', at: AT });
    expect(showToast).not.toHaveBeenCalled();
  });

  it(`${BALL.maxCount}개째부터는 막고 안내한다`, () => {
    const { d, dispatch, showToast } = deps({ balls: BALL.maxCount });
    expect(placeObject('ball', AT, d)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(BALL_LIMIT_MSG);
  });

  it('안내 문구가 상한 숫자를 문장에 박아 두지 않는다', () => {
    // 10 → 8 로 줄였을 때 안내만 "최대 10개" 로 남아 있었다. 상수에서 나와야 한다.
    expect(BALL_LIMIT_MSG).toContain(String(BALL.maxCount));
  });
});

describe('placeObject — 콘 상한은 색깔마다 따로다', () => {
  it('한 색이 가득 차도 다른 색은 놓인다', () => {
    // 상한이 합계였다면 여기서 막힌다 — 상자가 색마다 따로라는 은유가 깨진다.
    const full: (0 | 1)[] = Array.from({ length: CONE.maxCountPerColor }, () => 0);
    const { d, dispatch, showToast } = deps({ cones: full, coneSlot: 1 });
    expect(placeObject('cone', AT, d)).toBe(true);
    expect(dispatch).toHaveBeenCalledWith({ type: 'OBJECT_ADD', kind: 'cone', at: AT, colorIndex: 1 });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('가득 찬 색은 그 색 이름으로 안내하며 막는다', () => {
    const full: (0 | 1)[] = Array.from({ length: CONE.maxCountPerColor }, () => 1);
    const { d, dispatch, showToast } = deps({ cones: full, coneSlot: 1 });
    expect(placeObject('cone', AT, d)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(coneLimitMsg(1));
    expect(coneLimitMsg(1)).toContain('파랑');
    expect(coneLimitMsg(0)).toContain('주황');
  });

  it('다른 색 콘은 상한 계산에 끼지 않는다', () => {
    const mixed: (0 | 1)[] = [...Array.from({ length: CONE.maxCountPerColor - 1 }, () => 0 as const), 1, 1, 1];
    const { d } = deps({ cones: mixed, coneSlot: 0 });
    expect(placeObject('cone', AT, d)).toBe(true);
  });
});

describe('placeObject — 선수', () => {
  it('배치 대상이 없으면 안내만 하고 아무것도 놓지 않는다', () => {
    const { d, dispatch, showToast } = deps();
    expect(placeObject('player', AT, d)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(PLAYER_UNARMED_MSG);
  });
});

// §4.3 P1-4 — 놓임 '탁' 도 이 함수가 낸다. 경로가 셋인데 소리를 경로마다 붙이면
// "탭으로는 소리가 나는데 트레이로 끌면 안 난다" 가 조용히 생긴다(이 파일이 존재하는 이유와 같다).
describe('placeObject — 놓임 신호 (P1-4)', () => {
  it('놓인 종류마다 전부 같은 신호를 한 번씩 낸다', () => {
    const play = vi.spyOn(cues, 'play').mockImplementation(() => {});
    const chairId = newId('ch');
    for (const kind of ['ball', 'cone', 'note'] as const) {
      play.mockClear();
      const { d } = deps();
      expect(placeObject(kind, AT, d)).toBe(true);
      expect(play.mock.calls, kind).toEqual([['drop']]);
    }
    play.mockClear();
    const { d } = deps();
    d.drill.cast.chairs = [{ id: chairId, team: 'home', number: '2', isGk: false }];
    d.pendingPlayerId = chairId;
    expect(placeObject('player', AT, d)).toBe(true);
    expect(play.mock.calls).toEqual([['drop']]);
    play.mockRestore();
  });

  it('막혀서 못 놓으면 울리지 않는다 — 토스트가 이미 말한다(두 통보가 겹치지 않는다)', () => {
    const play = vi.spyOn(cues, 'play').mockImplementation(() => {});
    const { d, showToast } = deps({ balls: BALL.maxCount });
    expect(placeObject('ball', AT, d)).toBe(false);
    expect(play).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledTimes(1); // 대조군 — 아무 일도 안 일어난 것이 아니다
    play.mockRestore();
  });
});

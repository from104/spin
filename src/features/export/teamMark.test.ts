// 4.4 — 팀 표식이 **한 함수에서만** 나오는지, 그리고 그 함수가 화면 렌더러와 갈라지지
// 않는지.
//
// 4.6 갱신: 예전에는 화면(`chairColorFor`)과 내보내기(`teamMarkFor`)가 같은 규칙을 **각자
// 적어 두고** 이 파일이 둘을 대조했다. 4.6 이 색 밖 채널(테두리 파선·볼가드 톤)을 더하면서
// 규칙을 `src/render/teamMark.ts` 하나로 모았고, 이제 `chairColorFor` 는 그 함수를 그대로
// 부른다 — 그래서 둘을 대조하는 단언은 **동어반복**이 된다. 대신 §3.5 규칙(개별 색 > GK 색 >
// 팀 색)을 기대값으로 직접 적어 못박는다. 두 곳이 다시 갈라지는 사고는 이제 타입이 아니라
// '복제가 없다'는 사실이 막는다.
import { describe, expect, it } from 'vitest';
import { inkFor, OBJ_STROKE } from '../../core/colors.ts';
import { chairColorFor } from '../present/PresentObjects.tsx';
import { buildStaticSvg } from './buildStaticSvg.ts';
import { teamMarkFor } from './teamMark.ts';
import { chairDef, makeFrame, TEAMS } from './sceneFixture.ts';

describe('teamMarkFor — 화면 렌더러와 같은 색을 낸다', () => {
  // ★ §3.5 색 규칙을 기대값으로 직접 적는다(위 머리말 참고 — 대조 대상이 사라졌다).
  it.each([
    ['필드 플레이어', chairDef('ch_1', 'home', '4'), TEAMS.home.color],
    ['골키퍼', chairDef('ch_2', 'home', 'G', true), TEAMS.home.gkColor],
    ['원정 골키퍼', chairDef('ch_3', 'away', 'G', true), TEAMS.away.gkColor],
    ['개별 색 지정', { ...chairDef('ch_4', 'away', '2'), color: '#7c5cd6' }, '#7c5cd6'],
  ])('%s', (_label, def, expected) => {
    expect(teamMarkFor(def, TEAMS).fill).toBe(expected);
    // 화면 렌더러도 같은 값을 낸다 — 이제 같은 함수를 부르므로 이건 '복제가 없다'의 확인이다.
    expect(chairColorFor(def, TEAMS)).toBe(expected);
  });

  it('글자색은 채움색 밝기에서 나온다', () => {
    expect(teamMarkFor(chairDef('ch_1', 'home', 'G', true), TEAMS).ink).toBe(inkFor(TEAMS.home.gkColor));
    // 대조군: 어두운 팀 색에서는 흰 글자, 밝은 GK 색에서는 어두운 글자 — 같은 값이 아니다.
    expect(teamMarkFor(chairDef('ch_2', 'home', '4'), TEAMS).ink).not.toBe(teamMarkFor(chairDef('ch_3', 'home', 'G', true), TEAMS).ink);
  });

  it('테두리 패턴이 팀을 가른다 — 4.6 이 채운 자리', () => {
    const home = teamMarkFor(chairDef('ch_1', 'home', '4'), TEAMS);
    const away = teamMarkFor(chairDef('ch_2', 'away', '4'), TEAMS);
    // 테두리 '색'은 여전히 팀과 무관하다(둘 다 흰 선) — 팀을 가르는 것은 **패턴**이다.
    expect(home.stroke).toBe(OBJ_STROKE);
    expect(away.stroke).toBe(OBJ_STROKE);
    expect(home.strokeDash).toBeUndefined(); // 우리팀 = 실선
    expect(away.strokeDash).toBe('5 3'); // 상대팀 = 파선
    // 4.4 시절 여기 있던 단언(`home.strokeDash === away.strokeDash`)이 곧 결함의 기술이었다.
    // 이제는 fill 도, strokeDash 도, guardFill 도 셋 다 갈린다.
    expect(home.fill).not.toBe(away.fill);
    expect(home.strokeDash).not.toBe(away.strokeDash);
    expect(home.guardFill).not.toBe(away.guardFill);
  });
});

describe('SVG 는 teamMarkFor 만 읽는다', () => {
  it('teamMarkFor 가 돌려준 fill 이 그대로 칩 색이 된다', () => {
    const svg = buildStaticSvg(makeFrame(), { mode: 'full', teams: TEAMS });
    expect(svg).toContain(`fill="${TEAMS.home.color}"`);
    expect(svg).toContain(`fill="${TEAMS.away.gkColor}"`);
    // 대조군: 팀 색을 바꾸면 SVG 도 따라 바뀐다(어디선가 색이 하드코딩돼 있지 않다).
    const other = { home: { ...TEAMS.home, color: '#123456' }, away: TEAMS.away };
    const svg2 = buildStaticSvg(makeFrame(), { mode: 'full', teams: other });
    expect(svg2).toContain('fill="#123456"');
    expect(svg2).not.toContain(`fill="${TEAMS.home.color}"`);
  });
});

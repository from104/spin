// 4.4 — 팀 표식이 **한 함수에서만** 나오는지, 그리고 그 함수가 화면 렌더러와 갈라지지
// 않는지. 4.6(흑백 인쇄 대책)이 고칠 자리가 여기 하나임을 이 파일이 붙잡는다.
import { describe, expect, it } from 'vitest';
import { inkFor, OBJ_STROKE } from '../../core/colors.ts';
import { chairColorFor } from '../present/PresentObjects.tsx';
import { buildStaticSvg } from './buildStaticSvg.ts';
import { teamMarkFor } from './teamMark.ts';
import { chairDef, makeFrame, TEAMS } from './sceneFixture.ts';

describe('teamMarkFor — 화면 렌더러와 같은 색을 낸다', () => {
  // ★ 드리프트 가드: 색 규칙(§3.5 "ChairDef.color 개별 지정이 팀 색을 덮어쓴다")을 두 곳에
  //   적어 두었으므로, 둘이 갈라지면 여기서 빨간불이 된다.
  it.each([
    ['필드 플레이어', chairDef('ch_1', 'home', '4')],
    ['골키퍼', chairDef('ch_2', 'home', 'G', true)],
    ['원정 골키퍼', chairDef('ch_3', 'away', 'G', true)],
    ['개별 색 지정', { ...chairDef('ch_4', 'away', '2'), color: '#7c5cd6' }],
  ])('%s', (_label, def) => {
    expect(teamMarkFor(def, TEAMS).fill).toBe(chairColorFor(def, TEAMS));
  });

  it('글자색은 채움색 밝기에서 나온다', () => {
    expect(teamMarkFor(chairDef('ch_1', 'home', 'G', true), TEAMS).ink).toBe(inkFor(TEAMS.home.gkColor));
    // 대조군: 어두운 팀 색에서는 흰 글자, 밝은 GK 색에서는 어두운 글자 — 같은 값이 아니다.
    expect(teamMarkFor(chairDef('ch_2', 'home', '4'), TEAMS).ink).not.toBe(teamMarkFor(chairDef('ch_3', 'home', 'G', true), TEAMS).ink);
  });

  it('테두리는 지금 팀과 무관하다 — 4.6 이 채울 자리가 비어 있다', () => {
    const home = teamMarkFor(chairDef('ch_1', 'home', '4'), TEAMS);
    const away = teamMarkFor(chairDef('ch_2', 'away', '4'), TEAMS);
    expect(home.stroke).toBe(OBJ_STROKE);
    expect(away.stroke).toBe(OBJ_STROKE);
    expect(home.strokeDash).toBeUndefined();
    // 즉 지금 두 팀을 가르는 채널은 **fill 하나뿐**이다. 4.6 이 닫을 결함을 여기 못박아 둔다.
    expect(home.fill).not.toBe(away.fill);
    expect(home.strokeDash).toBe(away.strokeDash);
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

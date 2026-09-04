// ★ 5.6 완료 판정의 핵심 — **강제색(Windows 고대비) 화면에서 코치가 우리 팀과 상대 팀을
//   구분할 수 있는가.**
//
// 이 항목의 진짜 난점은 "SVG 를 강제색에 맡길 것인가, 뺄 것인가" 였다. 산문으로 판단만 적어
// 두면 되돌려도 아무 테스트가 빨개지지 않는다(이 저장소가 겪은 헛통과 2형태: "설계의 뒷문장에
// 단언이 없다"). 그래서 **두 세계를 다 시뮬레이션해 양쪽에 단언을 둔다.**
//
//   A) 판을 강제색에 맡긴 세계 — fill 과 stroke 가 **둘 다** 같은 전경색(CanvasText)이 된다.
//      · 4.6 의 파선 테두리는 마크업에 그대로 남는다 → **마크업 단언은 통과한다(헛통과).**
//        그러나 "CanvasText 면 위의 CanvasText 파선" 은 대비 1.00:1 이라 **보이지 않는다.**
//      · 대체 채널이 **하나도 없는** 것 넷이 함께 죽는다: 등번호(글자 fill=차체 fill),
//        팀 색, 골키퍼 표시(색이 전부다), §3.5 개별 색 지정.
//      → 완료 판정("코치가 우리 팀과 상대 팀을 구분할 수 있는가") 실패.
//   B) 판을 강제색에서 뺀 세계(우리가 고른 쪽, styles/contrast.css ①) —
//      기본 팀 색에서 흰 테두리가 차체 위 4.06~4.88:1, 코트 위 4.78:1 이라 파선이 실제로 보이고
//      등번호는 4.5:1 이상을 유지한다. 강제색 팔레트가 라이트든 다크든 결과가 같다.
//   대조군 — 콘(실루엣)·화살표(파선·굵기)는 A 에서도 산다. 즉 판을 빼는 이유는 "색 밖 채널이
//   없어서" 라는 뭉뚱그린 말이 아니라 **위 넷에만 없어서**다.
//
// 축: 강제 팔레트 라이트/다크.
/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChairId } from '../core/ids.ts';
import type { ChairDef, TeamSide, TeamStyle } from '../model/drill.ts';
import { DEFAULT_TEAMS } from '../model/defaults.ts';
import { ChairChip } from '../render/objects/ChairChip.tsx';
import { createTransformWriter } from '../render/transformWriter.ts';
import { teamMarkFor } from '../render/teamMark.ts';
import { compositeOver, contrastRatio } from './contrastMath.ts';

const TEAMS: Record<TeamSide, TeamStyle> = { home: { ...DEFAULT_TEAMS.home }, away: { ...DEFAULT_TEAMS.away } };
const CHAIR_ID = 'ch_1' as ChairId;
const defOf = (team: TeamSide, color?: string): ChairDef =>
  color === undefined ? { id: CHAIR_ID, team, number: '4', isGk: false } : { id: CHAIR_ID, team, number: '4', isGk: false, color };

/** 강제색 팔레트 두 종. 시스템 색은 사용자가 고르지만 전경/배경이 **한 쌍**이라는 점은 같다. */
const PALETTES = [
  ['고대비 다크', { canvas: '#000000', canvasText: '#ffffff' }],
  ['고대비 라이트', { canvas: '#ffffff', canvasText: '#000000' }],
] as const;

/** 칩 하나의 화면 마크업(teamMonochrome.test.tsx 와 같은 방식). */
function screenChip(team: TeamSide, color?: string): string {
  const def = defOf(team, color);
  return renderToStaticMarkup(
    createElement(ChairChip, {
      id: CHAIR_ID,
      writer: createTransformWriter(),
      color: teamMarkFor(def, TEAMS).fill,
      team,
      number: def.number,
      selected: false,
      active: false,
      ariaLabel: '칩',
    }),
  );
}

/** 강제색 모드가 색을 나르는 속성에 하는 일. CSS Color Adjust 의 강제 목록대로 **fill·stroke 를
 *  같은 전경색으로** 바꾼다. `stroke-width`·`stroke-dasharray` 는 색이 아니므로 건드리지 않는다
 *  — 정규식이 이름 뒤에 곧바로 `=` 를 요구해 하이픈 붙은 이름에는 걸리지 않는다. */
const COLOR_ATTR = /(\s(?:fill|stroke|color|stop-color|flood-color))="[^"]*"/g;
const forceColors = (markup: string, fg: string): string => markup.replace(COLOR_ATTR, `$1="${fg}"`);

describe.each(PALETTES)('A) 판을 강제색에 맡기면 무엇이 죽는가 — %s', (_name, pal) => {
  // 여기서 재는 것은 "치환 뒤에도 마크업이 다른가" 가 **아니다**. 마크업은 다르다 — 그런데도
  // 화면에서는 같아 보이는 것이 이 항목의 함정이다. 그래서 전부 **대비 숫자**로 잰다.
  const F = pal.canvasText; // 치환 뒤 fill·stroke 는 전부 이 하나가 된다

  it('★ 보조 채널(볼가드 톤)도 같이 죽는다 — guardFill **자체가** 치환 대상이다', () => {
    for (const team of ['home', 'away'] as const) {
      const m = teamMarkFor(defOf(team), TEAMS);
      // 기준선: 반투명 가드는 차체 위에서 밝기 방향으로 벌어진다(회색조에서 살아남는 면 채널).
      expect(contrastRatio(compositeOver(m.guardFill, m.fill), m.fill), `${team} 기준선`).toBeGreaterThan(1.2);
      // 치환 후: 가드의 `fill` 은 색 속성이라 차체와 **같은 값**으로 바뀐다(알파째 사라진다).
      expect(forceColors(screenChip(team), F), `${team}: 가드 톤이 치환을 피해 갔다`).not.toContain(m.guardFill);
    }
    expect(contrastRatio(F, F)).toBe(1);
  });
});


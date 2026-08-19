// §6.3 [A-1] 준비물 — 인쇄물 머리글의 "선수 n명 · 공 n개 · 콘 n개".
//
// **파생원이 개체 종류마다 다르다.** 계획서 A-1 이 실측으로 정정한 지점이다:
//  · 선수 = **전 스텝 chairs pose 키의 합집합** ∩ cast.
//    `cast.chairs` 를 그냥 세면 안 된다 — `defaultCast()`(defaults.ts:25-33)는 courtMode 와
//    무관하게 **항상 양팀 8대**를 만들고, 하프 코트는 홈 GK 를 배치하지 않아(실제 6대)
//    어떤 드릴이든 "선수 8명" 이 찍힌다. 코치가 훈련장에 사람을 두 명 더 부른다.
//  · 공·콘 = **cast**. 이쪽은 `pruneOrphanCast` 가 고아를 걷어내므로 정확하고, 공은 스텝에
//    안 놓여도 가방에 들어 있어야 한다(콘도 같다).
//
// ⚠️ `drill.steps.some(...)` 을 `drill.steps[0]` 로 좁히면 **3번 스텝에만 등장하는 선수가
// 준비물에서 빠진다.** 코치는 콘·사람을 모자라게 들고 훈련장에 간다. drillUses.ts 가 겪은
// 것과 정확히 같은 함정이라(그때는 1623 테스트가 전건 초록이었다) 여기도 순수 함수로 떼어
// `prep.test.ts` 가 그 한 줄에 단언을 직접 댄다.
import type { ChairId } from '../../core/ids.ts';
import type { Drill } from '../../model/drill.ts';
import { translate } from '../../i18n/useT.ts';
import type { Locale } from '../../i18n/locale.ts';

/** 종이에 찍히는 세 숫자. 세션(여러 드릴) 합산에도 쓰려고 id 를 뺀 형태로 따로 둔다. */
export interface PrepCounts {
  players: number;
  balls: number;
  cones: number;
}

export interface PrepList extends PrepCounts {
  /** cast 순서를 그대로 유지한 등장 선수. 4.6(흑백 인쇄 팀 구분)이 여기서 팀별로 갈라 쓴다. */
  playerIds: ChairId[];
}

/** 드릴 하나의 준비물. `steps` 와 `cast` 만 본다 — 모델 확장 0 · validate 화이트리스트 0. */
export function prepFor(drill: Pick<Drill, 'steps' | 'cast'>): PrepList {
  // 전 스텝의 합집합. 어느 한 스텝에만 서 있어도 그 선수는 훈련장에 와야 한다.
  const seen = new Set<string>();
  for (const step of drill.steps) {
    for (const id of Object.keys(step.chairs)) {
      // `PoseMap` 은 Partial 이라 키가 있고 값이 undefined 인 형태가 타입상 가능하다.
      if (step.chairs[id as ChairId] !== undefined) seen.add(id);
    }
  }

  // cast 에 없는 pose 키는 세지 않는다 — 팀도 등번호도 없어 코트에 **그릴 수조차 없는**
  // 유령이다. 세면 "선수 5명" 이라 적어 놓고 그림에는 4명만 있는 종이가 나온다.
  const playerIds = drill.cast.chairs.filter((c) => seen.has(c.id)).map((c) => c.id);

  return {
    playerIds,
    players: playerIds.length,
    balls: drill.cast.balls.length,
    cones: drill.cast.cones.length,
  };
}

/** 세션(드릴 여러 개)의 준비물 = 드릴별 준비물의 **최대**. 합이 아니다 —
 *  공 2개짜리 드릴 3개를 이어서 하는 세션에 공 6개를 들고 갈 이유가 없다. 같은 장비를
 *  드릴 사이에 다시 쓴다. 빈 목록이면 0 (0 을 "미지정" 으로 읽는 쪽은 표시 계층의 몫이다). */
export function maxPrep(list: readonly PrepCounts[]): PrepCounts {
  let players = 0;
  let balls = 0;
  let cones = 0;
  for (const p of list) {
    if (p.players > players) players = p.players;
    if (p.balls > balls) balls = p.balls;
    if (p.cones > cones) cones = p.cones;
  }
  return { players, balls, cones };
}

/** "선수 6명 · 공 1개 · 콘 4개". 0 인 항목은 아예 적지 않는다 — 없는 것을 "콘 0개" 라고
 *  적으면 코치가 한 줄을 더 읽고 아무것도 얻지 못한다. 전부 0 이면 빈 문자열. */
export function prepLine(p: PrepCounts, locale: Locale): string {
  const parts: string[] = [];
  if (p.players > 0) parts.push(translate(locale, 'print.prep.players', { n: p.players }));
  if (p.balls > 0) parts.push(translate(locale, 'print.prep.balls', { n: p.balls }));
  if (p.cones > 0) parts.push(translate(locale, 'print.prep.cones', { n: p.cones }));
  return parts.join(' · ');
}

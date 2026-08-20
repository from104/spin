// §7 3.4 — 선수를 화면에서 **뭐라고 부를 것인가** 의 단일 출처.
//
// `ChairDef.name` 은 처음부터 모델에 있었는데 읽는 곳이 인스펙터 명단 행 하나뿐이었다. 트레이도
// 시연도 등번호만 말했다 — **실제 세션 계획서는 "3번" 이 아니라 이름으로 읽힌다**(결정 ⑦).
// 부르는 규칙을 각 화면이 따로 쓰면 같은 선수가 자리마다 다른 이름으로 불리므로 여기 모은다.
// 4차 PDF 계획서가 다음 소비자다 — 그때 규칙을 또 쓰지 않도록 이 파일에서 가져다 쓴다.
import type { ChairDef, TeamSide, TeamStyle } from './drill.ts';

/** 이 두 함수가 필요로 하는 최소한. `Drill` 전체를 받게 하면 PDF·트레이처럼 요약만 들고 있는
 *  호출자가 못 쓴다. */
export type ChairNamed = Pick<ChairDef, 'team' | 'number' | 'isGk'> & { name?: string };

/** 이름 칸에 적힌 것이 실제로 이름인가. 공백만 적힌 값은 이름이 아니다 —
 *  화면에서는 빈 칸으로 보이는데 `name || …` 만 쓰면 폴백이 막혀 아무것도 안 읽힌다. */
export function hasChairName(def: Pick<ChairNamed, 'name'>): boolean {
  return (def.name ?? '').trim().length > 0;
}

/** 명단 한 줄이 읽는 이름. 실명이 있으면 실명, 없으면 팀 라벨 + 등번호다.
 *  골키퍼의 폴백이 'G' 가 아니라 'GK' 인 것은 등번호 'G' 가 **칩에 이미 찍혀 있는 글자**라
 *  "G G" 로 들리기 때문이다. */
export function chairName(def: ChairNamed, teams: Record<TeamSide, TeamStyle>): string {
  const n = (def.name ?? '').trim();
  if (n) return n;
  const label = teams[def.team].label;
  return def.isGk ? `${label} GK` : `${label} ${def.number}`;
}

/** 등번호를 앞에 세운 표기 — **칩에 찍힌 번호와 사람을 잇는 자리**(트레이 손잡이 · 시연 범례).
 *  팀 라벨을 붙이지 않는 이유는 그 자리에서는 색이 팀을 말하기 때문이고, 이름이 없으면
 *  번호만 읽는다(없는 이름 자리를 팀 라벨로 메우면 같은 말을 두 번 하게 된다).
 *
 *  ⚠️ 이름 없는 경우의 결과가 `'2번'` 인 것은 **기존 트레이 손잡이 이름과 같아야 하기 때문**이다
 *  (`'2번 선수 배치'`). 여기서 형식을 바꾸면 이름을 한 번도 안 적은 사용자의 버튼 이름이
 *  통째로 달라진다. */
export function numberedName(number: string, name?: string): string {
  const n = (name ?? '').trim();
  return n ? `${number}번 ${n}` : `${number}번`;
}

/** 실명을 **적은 선수만** "3번 홍길동" 형식으로 나열한다 — 시연 범례(PresentRunner)가
 *  세우고 인쇄·PNG(§0.5 미배송 빚, 2026-08-20)가 그대로 물려받는 단일 출처. 안 적었으면
 *  빈 배열, 절반만 적었으면 적은 절반만 — 번호뿐인 선수를 나열하면 코트에 이미 있는
 *  정보를 옮겨 적는 것뿐이다(PresentRunner 의 원래 근거 그대로). */
export function namedRosterOf(chairs: readonly ChairNamed[]): string[] {
  return chairs.filter(hasChairName).map((c) => numberedName(c.number, c.name));
}

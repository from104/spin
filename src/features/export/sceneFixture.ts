// 4.4 테스트 전용 장면 픽스처. 세 테스트 파일이 **같은 장면**을 봐야 "가드는 통과했는데
// 실은 아무것도 안 그려졌다" 를 서로 교차 검증할 수 있다(칩 8 · 화살표 2 · 콘 2 · 공 1 ·
// 쪽지 2[그중 하나는 빈 메모]).
//
// 프로덕션 코드가 아니다 — 어디서도 import 되지 않는다면 지워도 된다. `.test.ts` 가 아닌
// 이유는 vitest 가 `src/**/*.test.{ts,tsx}` 만 수집하기 때문이다(vite.config.ts).
import type { ChairId, BallId, ConeId, ArrowId, NoteId, StrokeId } from '../../core/ids.ts';
import type { ChairDef, TeamSide, TeamStyle } from '../../model/drill.ts';
import { DEFAULT_TEAMS } from '../../model/defaults.ts';
import type { RenderChair, RenderFrame } from '../../model/playback.ts';

export const TEAMS: Record<TeamSide, TeamStyle> = {
  home: { ...DEFAULT_TEAMS.home },
  away: { ...DEFAULT_TEAMS.away },
};

export function chairDef(id: string, team: TeamSide, number: string, isGk = false): ChairDef {
  return { id: id as ChairId, team, number, isGk };
}

/** 풀 코트 기본 포메이션에 가까운 8대. 좌표는 판정에 걸리지 않는 위치를 골랐다(규칙 대조군용). */
const CHAIR_SPEC: Array<[string, TeamSide, string, boolean, number, number]> = [
  ['ch_h1', 'home', 'G', true, 75, 262.5],
  ['ch_h2', 'home', '2', false, 322.5, 127.5],
  ['ch_h3', 'home', '3', false, 322.5, 397.5],
  ['ch_h4', 'home', '4', false, 364.5, 262.5],
  ['ch_a1', 'away', 'G', true, 750, 262.5],
  ['ch_a2', 'away', '2', false, 502.5, 397.5],
  ['ch_a3', 'away', '3', false, 502.5, 127.5],
  ['ch_a4', 'away', '4', false, 460.5, 262.5],
];

export function makeChairs(): RenderChair[] {
  return CHAIR_SPEC.map(([id, team, number, isGk, x, y]) => ({
    id: id as ChairId,
    def: chairDef(id, team, number, isGk),
    x,
    y,
    theta: 0,
    opacity: 1,
  }));
}

export function makeFrame(over: Partial<RenderFrame> = {}): RenderFrame {
  return {
    stepIndex: 2,
    t: 1,
    chairs: makeChairs(),
    balls: [{ id: 'bl_1' as BallId, x: 412.5, y: 262.5, opacity: 1 }],
    cones: [
      { id: 'cn_1' as ConeId, colorIndex: 0, x: 200, y: 200, opacity: 1 },
      { id: 'cn_2' as ConeId, colorIndex: 1, x: 240, y: 200, opacity: 1 },
    ],
    arrows: [
      { id: 'ar_1' as ArrowId, from: { x: 100, y: 100 }, ctrl: { x: 150, y: 120 }, to: { x: 200, y: 140 }, opacity: 1 },
      { id: 'ar_2' as ArrowId, headTo: 'wide', from: { x: 300, y: 300 }, ctrl: { x: 350, y: 320 }, to: { x: 400, y: 340 }, opacity: 1 },
    ],
    notes: [
      { id: 'nt_1' as NoteId, x: 260, y: 440, text: '왼쪽으로 전환', opacity: 1 },
      // 빈 메모 — 쪽지는 그려지지만 글자 배치는 나오지 않는다(플레이스홀더 '메모' 는 앱의
      // 안내문이지 코치가 보내려는 내용이 아니다).
      { id: 'nt_2' as NoteId, x: 600, y: 440, text: '', opacity: 1 },
    ],
    // 자유 그리기 획(2026-09-03) — 굵기·색·화살촉이 **전부 기본**인 한 획. 기본만 담는 것이
    // 요점이다: 이 픽스처는 여러 대조 테스트의 공통 배경이라, 여기에 특이값을 심으면 그 값이
    // 무엇을 재는지와 상관없는 테스트의 기대치에까지 스며든다. 변주는 부르는 쪽이 `over` 로 준다.
    strokes: [{ id: 'fh_1' as StrokeId, points: [{ x: 120, y: 420 }, { x: 180, y: 380 }, { x: 250, y: 400 }, { x: 310, y: 360 }], opacity: 1 }],
    ...over,
  };
}

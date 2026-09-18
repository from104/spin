// PLAN-UI-SCALE 결정 3(2026-09-19 재정의) — 「자동」이 무엇을 답하는지의 정본.
//
// 기준: *"보드 화면에서 풀코트 판이 상하좌우 꽉 차 있으면서 왼쪽(위) 레일, 아래쪽(오른쪽)
// 트레이가 최대 크기면서 둘다 스크롤이 안 되는 상태"*(기현 지시). 판이 꽉 차는 것은 보드
// 레이아웃이 늘 보장하므로(파일 머리말), 실제로 답을 정하는 것은 **스크롤 둘**이다.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { autoUiScale, maxFittingScale, resolveUiScale } from './autoUiScale.ts';
import type { AutoUiScaleInput } from './autoUiScale.ts';
import { railContentHeightPx } from './railMetrics.ts';
import { TRAY_BAND_BOARD_PARTS, trayBandContentWidthPx } from '../features/editor/trayMetrics.ts';
import { INTERACT } from '../core/constants.ts';
import { UI_SCALE_STEPS } from '../core/uiScale.ts';

const HIT = INTERACT.hitTargetCssPx;
const land = (w: number, h: number): AutoUiScaleInput => ({ availW: w, availH: h, landscape: true, hitPx: HIT });

describe('치수 — 자동이 읽는 두 상수', () => {
  it('레일은 세로로 662px 이 필요하다', () => {
    // 손 검산: 패딩 30 + 마크 48 + 워드마크 28 + 이동칸 6×58 + 아이콘 3×44 + 버전 21 + 간격 11×5.
    expect(railContentHeightPx()).toBe(30 + 48 + 28 + 348 + 132 + 21 + 55);
    expect(railContentHeightPx()).toBe(662);
    // [데스크톱 앱 받기] 는 웹에서만 선다 — 그만큼 레일이 길어진다(44 + 간격 5).
    expect(railContentHeightPx({ downloadBtn: true })).toBe(662 + 49);
  });

  it('띠는 가로로 832px 이 필요하다 — 에뮬레이터 실측 831 과 1px 안에서 맞는다', () => {
    const w = trayBandContentWidthPx(HIT, TRAY_BAND_BOARD_PARTS);
    expect(w).toBe(832);
    // 실측은 계산과 **독립인 관찰**이다(2026-09-19, iPad mini 규격 WebView 의 scrollWidth).
    // 1px 은 카운터 테두리의 반올림 — 여기가 2px 넘게 벌어지면 식이 화면과 갈라진 것이다.
    expect(Math.abs(w - 831)).toBeLessThanOrEqual(1);
  });
});

describe('자동 — 둘 다 스크롤 안 되는 가장 큰 눈금', () => {
  // 세 기기의 레이아웃 가용 상자(= #root 내용 상자, safe-area 를 뺀 값).
  const DEVICES = [
    { name: '7인치 (CSS 960×600)', w: 960, h: 532, expect: 0.75 },
    { name: 'iPad mini 규격 (1133×744)', w: 1133, h: 676, expect: 1 },
    { name: '10.1인치 (1371×857)', w: 1371, h: 789, expect: 1 },
  ] as const;

  it.each(DEVICES)('$name → $expect', ({ w, h, expect: want }) => {
    expect(autoUiScale(land(w, h))).toBe(want);
  });

  it('고른 눈금에서는 둘 다 들어가고, **한 눈금 위**에서는 무언가 넘친다', () => {
    for (const { w, h } of DEVICES) {
      const picked = autoUiScale(land(w, h));
      expect(picked, `${w}×${h}`).toBeLessThanOrEqual(maxFittingScale(land(w, h)));
      const next = UI_SCALE_STEPS.find((s) => s > picked);
      // 이 단언이 "가장 큰" 을 지킨다 — 없으면 무조건 50% 를 답해도 위 단언이 통과한다.
      if (next !== undefined) expect(next, `${w}×${h} 한 눈금 위`).toBeGreaterThan(maxFittingScale(land(w, h)));
    }
  });

  it('화면이 커지면 자동도 작아지지 않는다 — 단조성', () => {
    let prev = 0;
    for (const k of [0.6, 0.8, 1, 1.4, 2, 3]) {
      const s = autoUiScale(land(1133 * k, 676 * k));
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  it('레일이 문턱일 때와 띠가 문턱일 때가 **둘 다 실제로 일어난다**', () => {
    // 세로로만 짧은 화면 → 레일이 먼저 막힌다. 가로로만 좁은 화면 → 띠가 먼저 막힌다.
    const tall = maxFittingScale(land(4000, 676));
    const wide = maxFittingScale(land(1133, 4000));
    expect(tall).toBeCloseTo(676 / railContentHeightPx(), 6);
    expect(wide).toBeLessThan(2000); // 띠가 잡는다
    expect(wide).toBeCloseTo(1133 / (trayBandContentWidthPx(HIT, TRAY_BAND_BOARD_PARTS) + 84 + 56 + 24), 6);
  });

  it('어느 눈금도 못 넘으면 가장 작은 눈금 — 스크롤을 감수하고 판을 키운다', () => {
    expect(autoUiScale(land(200, 150))).toBe(UI_SCALE_STEPS[0]);
  });

  it('세로 화면은 다른 문턱을 본다 — 레일이 없고 트레이가 오른쪽 기둥이다', () => {
    const portrait = { availW: 744, availH: 1133, landscape: false, hitPx: HIT };
    const landscape = { ...portrait, landscape: true };
    expect(maxFittingScale(portrait)).not.toBeCloseTo(maxFittingScale(landscape), 6);
  });

  it('고정값은 그대로 내고 auto 만 계산한다', () => {
    expect(resolveUiScale(0.5, land(1133, 676))).toBe(0.5);
    expect(resolveUiScale(2, land(1133, 676))).toBe(2);
    expect(resolveUiScale('auto', land(1133, 676))).toBe(1);
  });
});

// 예산표가 소스와 이어져 있어야 사는 것과 같은 이유(chromeBudget.test.ts 머리말):
// 레일 치수가 railMetrics 밖에서 다시 적히면 화면과 자동값이 조용히 갈라지고, 그때 틀리는 것은
// **아무도 안 보는 수**(자동이 고른 배율)라 실기에서도 눈치채기 어렵다.
describe('레일 치수가 실제 소스와 어긋나지 않는다', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/app/AppRail.tsx'), 'utf-8');

  it('AppRail 이 railMetrics 의 상수를 쓴다 — 리터럴로 되돌아가면 빨간불', () => {
    expect(src).toContain("from './railMetrics.ts'");
    expect(src).toContain('width: RAIL_W');
    expect(src).toContain('height: RAIL_ITEM_H');
    expect(src).toContain('height: RAIL_ICON_BTN_H');
  });

  it('레일의 칸들이 줄어들지 않는다 — 줄어들면 "최대 크기" 가 거짓이 된다', () => {
    // 2026-09-19 실측: flexShrink 가 없던 동안 200% 에서 44px 표적이 20px 로 눌렸다.
    // 마크·워드마크·이동칸·아이콘 셋·버전 — 레일의 직계 자식 전부가 이 속성을 들어야 한다.
    expect(src.match(/flexShrink: 0/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });
});

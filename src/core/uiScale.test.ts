// PLAN-UI-SCALE 결정 3 — 「자동」이 무엇을 답하는지는 이 파일이 정본이다.
//
// 왜 테스트를 붙이는가(§ 테스트 절제 원칙에도 불구하고): 자동은 **기기마다 다른 답**을 내는
// 계산이고, 틀려도 화면은 멀쩡히 뜬다. "왜 이 태블릿만 150% 인가" 를 나중에 되짚을 곳이 여기다.
import { describe, expect, it } from 'vitest';
import {
  AUTO_TARGET_CSS_PX,
  TARGET_MIN_MM,
  UI_SCALE_STEPS,
  autoUiScale,
  isUiScaleSetting,
  migrateLegacyUiScale,
  resolveUiScale,
  targetMmAt,
} from './uiScale.ts';

const ANDROID = 160; // 1 CSS px = 1 dp = 1/160 in
const DESKTOP = 96; // CSS 규격

describe('표적의 물리 크기', () => {
  it('안드로이드 100% 에서 44px 표적은 7.0mm 다 — 기준선 9mm 에 못 미친다', () => {
    expect(targetMmAt(1, ANDROID)).toBeCloseTo(6.985, 3);
    expect(targetMmAt(1, ANDROID)).toBeLessThan(TARGET_MIN_MM);
  });

  it('데스크톱의 CSS px 가 더 커서 같은 44px 이 11.6mm 다', () => {
    expect(targetMmAt(1, DESKTOP)).toBeCloseTo(11.64, 2);
    expect(targetMmAt(1, DESKTOP)).toBeGreaterThan(targetMmAt(1, ANDROID));
  });

  it('배율에 비례한다 — 두 배면 두 배', () => {
    expect(targetMmAt(2, ANDROID)).toBeCloseTo(targetMmAt(1, ANDROID) * 2, 6);
  });
});

describe('자동 — 표적이 기준선을 넘는 가장 작은 눈금', () => {
  it('안드로이드는 150% 를 고른다(125% 는 8.7mm 로 모자란다)', () => {
    expect(targetMmAt(1.25, ANDROID)).toBeLessThan(TARGET_MIN_MM);
    expect(targetMmAt(1.5, ANDROID)).toBeGreaterThanOrEqual(TARGET_MIN_MM);
    expect(autoUiScale(ANDROID)).toBe(1.5);
  });

  it('데스크톱은 100% 를 고른다(75% 는 8.7mm 로 모자란다)', () => {
    expect(targetMmAt(0.75, DESKTOP)).toBeLessThan(TARGET_MIN_MM);
    expect(autoUiScale(DESKTOP)).toBe(1);
  });

  // 돌연변이 방어: "가장 작은" 이 아니라 아무거나 넘는 것을 고르면(예: 뒤에서부터 훑으면)
  // 아래가 200% 를 내놓는다. 그러면 보드가 가장 작아진다 — 지시의 정반대다.
  it('조건을 넘는 **첫** 눈금이다 — 더 큰 눈금도 조건을 넘지만 고르지 않는다', () => {
    const picked = autoUiScale(ANDROID);
    const bigger = UI_SCALE_STEPS.filter((s) => s > picked);
    expect(bigger.length).toBeGreaterThan(0);
    for (const s of bigger) expect(targetMmAt(s, ANDROID)).toBeGreaterThanOrEqual(TARGET_MIN_MM);
    expect(picked).toBe(Math.min(...UI_SCALE_STEPS.filter((s) => targetMmAt(s, ANDROID) >= TARGET_MIN_MM)));
  });

  it('어느 눈금도 기준선을 못 넘으면 가장 큰 눈금 — 못 누르는 화면을 주느니 큰 쪽이다', () => {
    // 표적이 200% 에서도 9mm 에 못 미치려면 CSS px 가 아주 촘촘해야 한다.
    const absurd = (AUTO_TARGET_CSS_PX * 2 * 25.4) / (TARGET_MIN_MM * 0.5);
    expect(targetMmAt(2, absurd)).toBeLessThan(TARGET_MIN_MM);
    expect(autoUiScale(absurd)).toBe(2);
  });

  it('눈금은 오름차순이어야 한다 — autoUiScale 이 그 순서에 기댄다', () => {
    expect([...UI_SCALE_STEPS]).toEqual([...UI_SCALE_STEPS].sort((a, b) => a - b));
  });
});

describe('설정값 풀기', () => {
  it("'auto' 만 계산으로 풀고 고정값은 그대로 낸다", () => {
    expect(resolveUiScale('auto', ANDROID)).toBe(1.5);
    expect(resolveUiScale(0.5, ANDROID)).toBe(0.5);
    expect(resolveUiScale(2, DESKTOP)).toBe(2);
  });

  it('값 집합 밖은 설정값이 아니다', () => {
    expect(isUiScaleSetting('auto')).toBe(true);
    expect(isUiScaleSetting(1.25)).toBe(true);
    expect(isUiScaleSetting(1.15)).toBe(false); // 옛 눈금은 더 이상 설정값이 아니다
    expect(isUiScaleSetting('1.25')).toBe(false); // 문자열 숫자도 아니다
    expect(isUiScaleSetting(3)).toBe(false);
  });
});

describe('옛 3단 옮기기', () => {
  it('1.15 → 1.25, 1.3 → 1.5, 1 은 그대로', () => {
    expect(migrateLegacyUiScale(1)).toBe(1);
    expect(migrateLegacyUiScale(1.15)).toBe(1.25);
    expect(migrateLegacyUiScale(1.3)).toBe(1.5);
  });

  it('모르는 값은 자동으로 — 100% 로 굳히면 자동이 한 번도 안 도는 사용자가 생긴다', () => {
    expect(migrateLegacyUiScale(undefined)).toBe('auto');
    expect(migrateLegacyUiScale(0.9)).toBe('auto');
  });
});

// PLAN-UI-SCALE 결정 2 — 배율의 **값 집합**과 옛 3단 이사.
// 「자동」의 산술은 여기 없다(2026-09-19 재정의로 app/autoUiScale.ts 로 옮겼다).
import { describe, expect, it } from 'vitest';
import { UI_SCALE_STEPS, UI_SCALE_VALUES, isUiScaleSetting, migrateLegacyUiScale } from './uiScale.ts';

describe('값 집합', () => {
  it('눈금은 오름차순이어야 한다 — autoUiScale 이 앞에서부터 훑어 "넘지 않는 가장 큰" 을 찾는다', () => {
    expect([...UI_SCALE_STEPS]).toEqual([...UI_SCALE_STEPS].sort((a, b) => a - b));
  });

  it("'auto' 가 맨 앞이고 고정값 일곱이 뒤따른다 — 설정 화면의 칸 순서가 이 배열이다", () => {
    expect(UI_SCALE_VALUES[0]).toBe('auto');
    expect(UI_SCALE_VALUES).toHaveLength(UI_SCALE_STEPS.length + 1);
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

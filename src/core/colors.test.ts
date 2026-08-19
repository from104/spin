import { describe, expect, it } from 'vitest';
import {
  BALL_FILL,
  DRILL_TYPE_COLORS,
  CONE_COLORS,
  GK_AWAY_COLOR,
  GK_HOME_COLOR,
  TEAM_COLOR_CHOICES,
  TEAM_COLOR_NAMES,
  inkFor,
  relLuminance,
} from './colors.ts';
import { SUPPORTED_LOCALES } from '../i18n/locale.ts';

/** sRGB 감마 역변환 — colors.ts 내부 함수와 동일. 테스트가 독립적으로 다시 구현한다. */
const srgb = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

// WCAG 대비비. inkFor 임계 0.25 는 "팔레트 전체가 ≥4.5:1" 을 만족하도록 정한 값(§2.9)이라
// 그 주장을 직접 검증한다.
const contrastRatio = (hexA: string, hexB: string): number => {
  const la = relLuminance(hexA);
  const lb = relLuminance(hexB);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

describe('inkFor', () => {
  // 글자를 얹는 색 전량 — 드릴 유형 5색(v8, 옛 카테고리 팔레트를 물려받은 값)이 모두 들어간다.
  // 콘은 등번호·라벨이 없어 제외한다: 콘의 접근성 근거는 흰 테두리(코트 녹색 대비 4.47:1)이지
  // 잉크 대비가 아니다. 콘 2색의 구분은 아래 별도 테스트에서 본다.
  const palette = [
    ...Object.values(DRILL_TYPE_COLORS),
    GK_HOME_COLOR,
    GK_AWAY_COLOR,
    BALL_FILL,
  ];

  it.each(palette)('%s 위 잉크의 대비가 ≥ 4.5:1', (fill) => {
    const ink = inkFor(fill);
    expect(contrastRatio(fill, ink)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('콘 2색', () => {
  // 콘은 코트 위에 놓이고 글자가 없다. 요구사항이 '2가지 색'이므로 두 색이 서로 구분돼야 한다.
  // 주의: 명도 대비로 판정하면 안 된다. 두 색은 명도가 비슷하지만(1.24:1) 색상축이 달라
  // 이색각에서도 올리브 vs 슬레이트로 갈라진다 — 실제 판정 기준은 이색각 시뮬레이션이다.
  const COURT_BG_DARK = '#1f7a46';

  const toLinear = (hex: string): [number, number, number] =>
    (hex.replace('#', '').match(/../g) ?? []).map((x) => srgb(parseInt(x, 16) / 255)) as [number, number, number];

  const mul = (m: number[][], v: number[]): number[] =>
    m.map((row) => row[0]! * v[0]! + row[1]! * v[1]! + row[2]! * v[2]!);

  // Viénot–Brettel–Mollon 1999 이색각 시뮬레이션
  const RGB2LMS = [
    [17.8824, 43.5161, 4.11935],
    [3.45565, 27.1554, 3.86714],
    [0.0299566, 0.184309, 1.46709],
  ];
  const LMS2RGB = [
    [0.080944, -0.130504, 0.116721],
    [-0.0102485, 0.0540194, -0.113615],
    [-0.000365294, -0.00412163, 0.693513],
  ];
  const PROTAN = [
    [0, 2.02344, -2.52581],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const DEUTAN = [
    [1, 0, 0],
    [0.494207, 0, 1.24827],
    [0, 0, 1],
  ];

  const simulate = (hex: string, deficiency: number[][]): number[] =>
    mul(LMS2RGB, mul(deficiency, mul(RGB2LMS, toLinear(hex))));

  /** 선형 RGB 공간 유클리드 거리 — 두 색이 얼마나 떨어져 보이는가 */
  const separation = (a: number[], b: number[]): number =>
    Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

  it.each([
    ['적색맹', PROTAN],
    ['녹색맹', DEUTAN],
  ])('%s 에서도 두 콘 색이 구분된다', (_name, deficiency) => {
    const a = simulate(CONE_COLORS[0], deficiency);
    const b = simulate(CONE_COLORS[1], deficiency);
    expect(separation(a, b)).toBeGreaterThan(0.25);
  });

  it('흰 테두리가 코트 녹색 대비 3:1 을 넘는다 (SC 1.4.11 — 콘의 식별 근거)', () => {
    expect(contrastRatio('#ffffff', COURT_BG_DARK)).toBeGreaterThanOrEqual(3);
  });
});

describe('TEAM_COLOR_NAMES — 스와치 aria-label 용 이름 (2026-08-14 선행 수리, i18n C3 로케일 확장)', () => {
  // aria-label 이 hex 면 스크린리더가 '빨강' 대신 "#d93a3a" 를 낱글자로 읽는다.
  // 이름 맵이 선택지를 전부 덮는지(빠지면 라벨이 undefined 로 사라진다)를 값 수준에서도 못박는다 —
  // 타입 수준(Record<유니언, string>)은 as 캐스팅 한 줄로 뚫리기 때문이다. 세 언어 전부 돈다.
  for (const locale of SUPPORTED_LOCALES) {
    it.each(TEAM_COLOR_CHOICES)(`[${locale}] %s 에 이름이 있고 그 이름은 hex 가 아니다`, (c) => {
      const name = TEAM_COLOR_NAMES[locale][c];
      expect(name).toBeTruthy();
      expect(name).not.toMatch(/^#/);
      expect(name.length).toBeGreaterThan(0);
    });
  }
});

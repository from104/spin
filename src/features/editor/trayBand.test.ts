// 가로 띠(트레이가 코트 아래에 눕는 배치)의 **숫자.**
//
// ── 2026-08-14 기현님 재설계로 이 파일의 전제가 뒤집혔다 ────────────────────────────────
// P5 시절 머리말(지우지 않는다): *"세로 2행 띠 … ① 132/156 이 상한 175 미만인가 ② 176 에서
// rotForFit 이 실제로 뒤집히는가 ③ 띠가 정말 2행인가."*
//
// 그때 띠는 **세로 화면**의 것이었다. 세로 창은 높이가 남고 폭이 모자라니, 띠를 두껍게 해서
// 한 줄에 다 담는 편이 나았다 — 2행 132 는 그 계산의 답이다.
// 이제 트레이는 **코트 긴 변**에 붙는다(기현 지시). 코트 셋은 viewBox 가 전부 가로로 길므로
// 띠가 뜨는 것은 **가로 화면**이고, 가로 화면에서 모자라는 것은 정확히 **높이**다. 그래서:
//   · 2행(132) → **1행(66/72)**. 넘치는 줄은 좌우 스크롤이 받는다.
//   · 칩 상자가 정사각(44×44)이 되면서 1행이 실제로 가능해졌다(옛 44×60 이면 1행도 76 이다).
//   · `trayBandSectionsPx`/`trayBandLayoutAt`(줄나눔 모형)은 **없어졌다** — nowrap 이라 띠는
//     언제나 1행이고, 모형이 답할 물음 자체가 사라졌다.
//
// 그래서 이 파일이 지금 답하는 것은 셋이다:
//   ① 띠 높이가 44/56 에서 66/72 인가.
//   ② 가로 띠에는 **절벽이 없다** — 띠를 키워도 rot 은 안 뒤집히고 축척만 단조 감소한다.
//      그래서 옛 상한 `TRAY_BAND_MAX_PX = 175` 도 지웠다. 규칙은 "작을수록 좋다" 뿐이다.
//   ③ 크롬 예산이 **배치 축과 화면**을 아는가 — 두 쌍의 행이 각각 서로의 반대인가.
//
// jsdom 은 레이아웃도 calc(var()) 도 계산하지 않으므로 픽셀은 전부 순수 함수로 잰다. 화면의
// 인라인 style 이 정말 같은 식을 쓰는지는 ToolRail.band.test.tsx 가 **리터럴 대조**로 본다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOOL_BTN_H, TRAY_BAND_1ROW_CSS, TRAY_BAND_PAD_Y, trayBandHeightPx } from './trayMetrics.ts';
import { CHROME_ROWS, chromeRowPx, courtBoxPx, courtScale } from '../../app/chromeBudget.ts';
import type { ChromeState, Size } from '../../app/chromeBudget.ts';
import { INTERACT } from '../../core/constants.ts';

const read = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf-8');

const HIT = INTERACT.hitTargetCssPx;
const HIT_LARGE = INTERACT.hitTargetLargeCssPx;

/** 띠가 뜨는 대표 기기 — 작은 가로 창. 이 앱이 잡은 **최악의 작은 창**이다. */
const SMALL_LANDSCAPE: Size = { w: 1024, h: 600 };
/** 가로 화면 = 코트가 눕는다 = 트레이가 아래 띠다. */
const bandState: ChromeState = { narrow: true, inspector: 'hidden', trayBand: true, board: true };

/** 띠 높이를 `band` 로 **가정했을 때**의 코트 상자. 예산의 세로 행이 띠 하나만 다른 것으로
 *  바뀌는 것과 같으므로, 실제 행 값을 빼고 가정값을 더해 만든다 — 절벽 실험이 예산표 함수를
 *  우회해 자기 산수를 하지 않게 하려는 것이다. */
function boxWithBand(band: number): Size {
  const here = courtBoxPx(SMALL_LANDSCAPE, bandState);
  return { w: here.w, h: here.h + trayBandHeightPx(HIT) - band };
}

describe('① 띠 높이 — 1행 66/72', () => {
  it('도구 줄 하나 + 상하 패딩이다', () => {
    expect(trayBandHeightPx(HIT)).toBe(66);
    expect(trayBandHeightPx(HIT_LARGE)).toBe(72);
    // 식이 리터럴이 아니라 상수 조립임을 못박는다 — 한쪽만 고치면 화면과 갈라진다.
    expect(trayBandHeightPx(HIT)).toBe(Math.max(TOOL_BTN_H, HIT) + TRAY_BAND_PAD_Y * 2);
  });

  it('재설계 전 2행 띠는 132 · 156 이었다 — 이번에 되찾은 것이 그 차이다', () => {
    // 대조군이자 기록. 가로 화면에서 코트 축척을 −11~15% 만들던 것이 그 66px 이다.
    expect(132 - trayBandHeightPx(HIT)).toBe(66);
    expect(156 - trayBandHeightPx(HIT_LARGE)).toBe(84);
  });

});

describe('② 가로 띠에는 축척 절벽이 **없다** — 작을수록 좋다', () => {
  it('★ 띠를 키워도 rot 은 안 뒤집힌다 — 옛 175 상한이 왜 사라졌는지의 증거', () => {
    // P5 의 절벽은 **세로 창**의 것이었다: 거기서는 띠가 높이를 먹어 rotForFit 의 1.08 문턱을
    // 못 넘게 만들었다. 가로 창에서는 코트도 상자도 이미 가로로 길어, 높이를 아무리 깎아도
    // 눕힌 쪽이 계속 이긴다. 이 스캔이 그 사실을 **찾아서** 적는다.
    for (let band = trayBandHeightPx(HIT); band <= 400; band += 1) {
      expect(courtScale('full', boxWithBand(band)).rot, `띠 ${band} 에서 뒤집혔다`).toBe(0);
    }
  });

  it('축척은 띠 높이에 대해 **단조 감소**다 — 문턱이 없으니 규칙은 "작을수록 좋다" 뿐이다', () => {
    let prev = Infinity;
    for (let band = trayBandHeightPx(HIT); band <= 400; band += 10) {
      const px = courtScale('full', boxWithBand(band)).pxPerUnit;
      expect(px, `띠 ${band} 에서 축척이 되레 늘었다`).toBeLessThanOrEqual(prev);
      prev = px;
    }
    // 그리고 실제로 줄어든다 — 전 구간이 평평하면 위 단언은 아무것도 안 잡는다.
    expect(courtScale('full', boxWithBand(400)).pxPerUnit).toBeLessThan(
      courtScale('full', boxWithBand(trayBandHeightPx(HIT))).pxPerUnit,
    );
  });
});

describe('③ 크롬 예산이 배치 축과 화면을 안다', () => {
  it('★ 작은 가로 창의 코트 상자와 축척', () => {
    // 944 → 900. 2026-08-14 [드릴로 저장]이 기능 바로 오면서 칸이 12가 됐고, 1024×600 은
    // **좁은 창**이라 헤더(52)가 남는다 — 바에 남는 높이가 548 이라 12칸이 2열로 흐른다.
    // 예산이 그 열 수를 직접 센다(courtBoxPx 의 functionBarExtraColsPx).
    expect(courtBoxPx(SMALL_LANDSCAPE, bandState)).toEqual({ w: 900, h: 466 });
    const s = courtScale('full', courtBoxPx(SMALL_LANDSCAPE, bandState));
    expect(s.rot).toBe(0);
    // 재설계 전 0.8914 → 0.8876. **−0.4%** 다 — 1행 띠가 가로 화면의 손해를 거의 다 지웠다.
    expect(s.pxPerUnit).toBeCloseTo(0.8876, 4);
  });

  it('⚠️ 좁은 세로 창은 −19.9% 다 — 트레이가 폭을 먹고 기능 바가 또 먹는다 (실기 확인 항목)', () => {
    // 정직한 기록. 480×800 은 코트 상자가 **307×732** 까지 좁아진다: 480 에서 트레이 기둥 93
    // 과 기능 바 56, 좌우 패딩 24가 빠진다. 아이패드 세로(768×1024)는 반대로 **+13.2%** 다 —
    // 폭이 넉넉하면 하단 바가 사라진 이득이 더 크기 때문이다. 좁은 세로 기기에서 이 손해가
    // 견딜 만한지가 이번 배포의 실기 확인 항목이다.
    const portrait: ChromeState = { narrow: true, inspector: 'hidden', trayBand: false, board: true };
    expect(courtBoxPx({ w: 480, h: 800 }, portrait)).toEqual({ w: 307, h: 732 });
    expect(courtScale('full', courtBoxPx({ w: 480, h: 800 }, portrait)).pxPerUnit).toBeCloseTo(0.5848, 4);
    expect(courtScale('full', courtBoxPx({ w: 768, h: 1024 }, portrait)).pxPerUnit).toBeCloseTo(1.1333, 4);
  });

  it('두 트레이 행은 **서로의 반대**다 — 절대 동시에 켜지지 않는다', () => {
    const rail = CHROME_ROWS.find((r) => r.id === 'toolRail')!;
    const band = CHROME_ROWS.find((r) => r.id === 'trayBand')!;
    for (const trayBand of [true, false]) {
      const st: ChromeState = { narrow: true, inspector: 'hidden', trayBand, board: true };
      const both = chromeRowPx(rail, st) > 0 && chromeRowPx(band, st) > 0;
      expect(both, '트레이가 폭과 높이를 이중으로 빼앗고 있다').toBe(false);
    }
  });

  it('기능 바와 하단 바도 서로의 반대다 — 전술판은 기둥, 드릴 편집은 바다', () => {
    const fn = CHROME_ROWS.find((r) => r.id === 'functionBar')!;
    const bar = CHROME_ROWS.find((r) => r.id === 'transportBar')!;
    for (const board of [true, false]) {
      const st: ChromeState = { narrow: true, inspector: 'hidden', trayBand: true, board };
      expect(chromeRowPx(fn, st) > 0 && chromeRowPx(bar, st) > 0).toBe(false);
      // 그리고 언제나 **정확히 하나**는 켜져 있다 — 둘 다 0 이면 예산이 그만큼 거짓말한다.
      expect(chromeRowPx(fn, st) + chromeRowPx(bar, st)).toBeGreaterThan(0);
    }
  });

  it('띠 행의 값이 리터럴이 아니라 trayBandHeightPx 에서 온다', () => {
    const band = CHROME_ROWS.find((r) => r.id === 'trayBand')!;
    expect(band.wide).toBe(trayBandHeightPx(HIT));
    expect(band.narrow).toBe(trayBandHeightPx(HIT));
  });
});

describe('④ calc 문자열이 픽셀 식과 같은 상수로 조립된다', () => {
  it('TRAY_BAND_1ROW_CSS 는 그 식이다', () => {
    expect(TRAY_BAND_1ROW_CSS).toBe('calc(max(50px, var(--hit)) + 16px)');
  });

  it('화면이 그 상수를 쓴다 — 리터럴 높이가 되살아나면 식과 갈라진다', () => {
    const src = read('src/features/editor/ToolRail.tsx');
    expect(src).toContain('height: TRAY_BAND_1ROW_CSS');
    // 옛 2행 식이 되살아나면 여기서 잡힌다.
    expect(src).not.toContain('TRAY_BAND_2ROW_CSS');
  });
});

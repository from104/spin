// 2026-08-14 P5 (설계서 §4.7 · §5-P5) — **세로 2행 띠의 숫자.**
//
// 이 파일이 답하는 것은 셋이다:
//   ① 띠 높이가 44/56 에서 132/156 이고 **둘 다 상한 175 미만**인가(축척 절벽 회피).
//   ② 그 상한이 정말 175 인가 — 176 에서 `rotForFit` 이 90 → 0 으로 **실제로 뒤집히는가**.
//      "175 라고 적혀 있다" 는 증거가 아니다. 절벽을 넘겨 보고 판이 눕는 것을 확인한다.
//   ③ 띠가 정말 **2행**인가 — 화면이 쓰는 flex 줄나눔을 폭에서 다시 계산해 높이 식과 맞댄다.
//      ③ 이 없으면 ① 은 "132 라고 적었으니 132" 라는 자기 사본이다(계기가 거짓말하는 형태).
//
// jsdom 은 레이아웃도 calc(var()) 도 계산하지 않으므로 픽셀은 전부 순수 함수로 잰다. 화면의
// 인라인 style 이 정말 같은 식을 쓰는지는 ToolRail.band.test.tsx 가 **리터럴 대조**로 본다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  TRAY_BAND_2ROW_CSS,
  TRAY_BAND_MAX_PX,
  TRAY_BAND_PAD_X,
  TRAY_BAND_PAD_Y,
  trayBand1RowHeightPx,
  trayBandHeightPx,
  trayBandLayoutAt,
  trayBandSectionsPx,
} from './trayMetrics.ts';
import { CHROME_ROWS, chromeRowPx, courtBoxPx, courtScale } from '../../app/chromeBudget.ts';
import type { ChromeState, Size } from '../../app/chromeBudget.ts';
import { INTERACT } from '../../core/constants.ts';

const read = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf-8');

const HIT = INTERACT.hitTargetCssPx;
const HIT_LARGE = INTERACT.hitTargetLargeCssPx;

/** 설계서 §4.7 의 그 기기 — 7인치 태블릿 세로. 이번 재설계의 **주 표적**이다. */
const SEVEN_INCH: Size = { w: 480, h: 800 };
const portraitState: ChromeState = { narrow: true, inspector: 'hidden', portrait: true };

/** 띠 높이를 `band` 로 **가정했을 때**의 코트 상자. 예산의 세로 행이 띠 하나만 다른 것으로
 *  바뀌는 것과 같으므로, 실제 행 값을 빼고 가정값을 더해 만든다 — 절벽 실험이 예산표 함수를
 *  우회해 자기 산수를 하지 않게 하려는 것이다. */
function boxWithBand(band: number): Size {
  const here = courtBoxPx(SEVEN_INCH, portraitState);
  return { w: here.w, h: here.h + trayBandHeightPx(HIT) - band };
}

describe('① 띠 높이 — 44/56 → 132/156, 둘 다 절벽 아래', () => {
  it('2행 띠는 132(hit 44) · 156(hit 56)', () => {
    expect(trayBandHeightPx(HIT)).toBe(132);
    expect(trayBandHeightPx(HIT_LARGE)).toBe(156);
    expect([HIT, HIT_LARGE]).toEqual([44, 56]);
  });

  it('재설계 전 1행 띠는 76 · 94 였다 — 대조군이자 §4.6 축척표의 "지금" 열', () => {
    expect(trayBand1RowHeightPx(HIT)).toBe(76);
    expect(trayBand1RowHeightPx(HIT_LARGE)).toBe(94);
    // 2행이 1행보다 정확히 도구 줄 + gap 만큼 크다 — 늘어난 것이 무엇인지 식에 남긴다.
    expect(trayBandHeightPx(HIT) - trayBand1RowHeightPx(HIT)).toBe(56); // 도구 50 + gap 6
    expect(trayBandHeightPx(HIT_LARGE) - trayBand1RowHeightPx(HIT_LARGE)).toBe(62); // 도구 56 + gap 6
  });

  it('★ 완료 판정: 132·156 이 **둘 다 상한 175 미만**이다', () => {
    expect(TRAY_BAND_MAX_PX).toBe(175);
    expect(trayBandHeightPx(HIT)).toBeLessThan(TRAY_BAND_MAX_PX);
    expect(trayBandHeightPx(HIT_LARGE)).toBeLessThan(TRAY_BAND_MAX_PX);
    // 여유까지 적어 둔다 — 띠에 한 줄 더 얹으려는 다음 사람이 얼마가 남았는지 바로 본다.
    expect(TRAY_BAND_MAX_PX - trayBandHeightPx(HIT_LARGE)).toBe(19);
  });

  it('3행은 상한 밖이다 — 2행이 물리적 최대라는 근거', () => {
    // 3행 = 2행 + 도구 줄 하나 더(50/56) + gap 6.
    const threeRows = (hit: number): number => trayBandHeightPx(hit) + Math.max(50, hit) + 6;
    expect(threeRows(HIT)).toBe(188);
    expect(threeRows(HIT_LARGE)).toBe(218);
    expect(threeRows(HIT)).toBeGreaterThan(TRAY_BAND_MAX_PX);
    expect(threeRows(HIT_LARGE)).toBeGreaterThan(TRAY_BAND_MAX_PX);
  });
});

describe('② 상한 175 는 "적당히" 가 아니라 축척 절벽이다', () => {
  it('★ 반증 실험 — 띠를 176 으로 올리면 rot 이 90 → 0 으로 실제로 뒤집힌다', () => {
    // 175 까지는 판이 서 있다.
    const at175 = boxWithBand(175);
    expect(at175).toEqual({ w: 456, h: 493 });
    expect(courtScale('full', at175).rot).toBe(90);
    expect(courtScale('full', at175).pxPerUnit).toBeCloseTo(0.5976, 4);

    // 1px 을 더 주면 눕는다. 축척은 0.5976 → 0.5527(**−7.5%**)로 한 칸에 떨어진다.
    const at176 = boxWithBand(176);
    expect(at176).toEqual({ w: 456, h: 492 });
    expect(courtScale('full', at176).rot).toBe(0);
    expect(courtScale('full', at176).pxPerUnit).toBeCloseTo(0.5527, 4);
    expect(courtScale('full', at176).pxPerUnit / courtScale('full', at175).pxPerUnit - 1).toBeLessThan(-0.07);
  });

  it('절벽의 정체 — 492 = 456 × 1.0789 라 ROTATE_GAIN 1.08 을 1px 차이로 못 넘는다', () => {
    const at176 = boxWithBand(176);
    expect(at176.h / at176.w).toBeLessThan(1.08);
    expect(boxWithBand(175).h / boxWithBand(175).w).toBeGreaterThan(1.08);
  });

  it('절벽의 위치를 **찾아서** 175 와 맞댄다 — 상수가 스캔 결과와 같은가', () => {
    // 상한 있는 루프다(계약: 반드시 끝난다). 0..400 을 넘어서까지 볼 이유가 없다.
    let firstFlat = -1;
    for (let band = 0; band <= 400; band++) {
      if (courtScale('full', boxWithBand(band)).rot === 0) {
        firstFlat = band;
        break;
      }
    }
    expect(firstFlat).toBe(176);
    expect(firstFlat - 1).toBe(TRAY_BAND_MAX_PX);
  });

  it('§4.7 표 네 줄을 그대로 재현한다', () => {
    const row = (band: number) => {
      const box = boxWithBand(band);
      const s = courtScale('full', box);
      return [box.w, box.h, s.rot, Number(s.pxPerUnit.toFixed(4))];
    };
    expect(row(trayBand1RowHeightPx(HIT))).toEqual([456, 592, 90, 0.7176]);
    expect(row(trayBandHeightPx(HIT))).toEqual([456, 536, 90, 0.6497]);
    expect(row(trayBandHeightPx(HIT_LARGE))).toEqual([456, 512, 90, 0.6206]);
    expect(row(176)).toEqual([456, 492, 0, 0.5527]);
  });

  it('세로 full 코트가 감수한 손해는 −9.5% 하나뿐이다 (설계서 §4.6 마지막 줄)', () => {
    const before = courtScale('full', boxWithBand(trayBand1RowHeightPx(HIT))).pxPerUnit;
    const after = courtScale('full', boxWithBand(trayBandHeightPx(HIT))).pxPerUnit;
    expect((after / before - 1) * 100).toBeCloseTo(-9.5, 1);
    // half/flat 은 손해가 0 이다 — 그쪽은 폭이 제약이라 세로를 뺏겨도 축척이 안 움직인다.
    for (const mode of ['half', 'flat'] as const) {
      const b = courtScale(mode, boxWithBand(trayBand1RowHeightPx(HIT))).pxPerUnit;
      const a = courtScale(mode, boxWithBand(trayBandHeightPx(HIT))).pxPerUnit;
      expect(a, mode).toBe(b);
    }
  });
});

describe('③ 크롬 예산이 세로 배치를 안다 — 완료 판정의 그 등식', () => {
  it('★ courtBoxPx({480,800}, portrait) === {456,536} 이고 rot 이 90 이다', () => {
    const box = courtBoxPx(SEVEN_INCH, portraitState);
    expect(box).toEqual({ w: 456, h: 536 });
    expect(courtScale('full', box).rot).toBe(90);
    expect(courtScale('full', box).pxPerUnit).toBeCloseTo(0.6497, 4);
  });

  it('대조군 — portrait 를 안 넘기면 예산이 여전히 363×668 이라고 거짓말한다', () => {
    // P1·P2·P3 가 세 번 보고한 구멍이다. 폭에서 트레이 93 을 잘못 빼고, 높이에서 띠를 안 뺀다.
    // 이 대조군이 없으면 위 it 은 "courtBoxPx 가 늘 456×536" 으로도 통과한다.
    expect(courtBoxPx(SEVEN_INCH, { narrow: true, inspector: 'hidden' })).toEqual({ w: 363, h: 668 });
  });

  it('두 트레이 행은 **서로의 반대**다 — 절대 동시에 켜지지 않는다', () => {
    const railRow = CHROME_ROWS.find((r) => r.id === 'toolRail')!;
    const bandRow = CHROME_ROWS.find((r) => r.id === 'trayBand')!;
    expect(railRow.axis).toBe('width');
    expect(bandRow.axis).toBe('height');
    for (const narrow of [true, false]) {
      for (const inspector of ['hidden', 'overlay', 'pinned'] as const) {
        const land: ChromeState = { narrow, inspector };
        const port: ChromeState = { narrow, inspector, portrait: true };
        expect(chromeRowPx(railRow, land)).toBe(93);
        expect(chromeRowPx(bandRow, land)).toBe(0);
        expect(chromeRowPx(railRow, port)).toBe(0);
        expect(chromeRowPx(bandRow, port)).toBe(132);
        // 배타성 그 자체 — 곱이 0 이면 둘 중 하나는 반드시 0 이다.
        expect(chromeRowPx(railRow, port) * chromeRowPx(bandRow, port)).toBe(0);
        expect(chromeRowPx(railRow, land) * chromeRowPx(bandRow, land)).toBe(0);
      }
    }
  });

  it('띠 행의 값이 리터럴이 아니라 trayBandHeightPx 에서 온다', () => {
    const bandRow = CHROME_ROWS.find((r) => r.id === 'trayBand')!;
    expect(bandRow.wide).toBe(trayBandHeightPx(HIT));
    expect(bandRow.narrow).toBe(trayBandHeightPx(HIT));
    // now 는 0 이라야 '현재' 합계 196 이 참으로 남는다(chromeBudget.test.ts 가 그것을 잰다).
    expect(bandRow.now).toBe(0);
  });

  it('가로 기기의 상자는 한 자리도 안 변했다 — P4 까지의 모든 칸이 그대로다', () => {
    // §5.3 실측표의 네 칸. 세로 축이 예산에 들어왔다고 가로가 흔들리면 그건 회귀다.
    expect(courtBoxPx({ w: 1024, h: 600 }, { narrow: true, inspector: 'hidden' })).toEqual({ w: 907, h: 468 });
    expect(courtBoxPx({ w: 800, h: 480 }, { narrow: true, inspector: 'hidden' })).toEqual({ w: 683, h: 348 });
    expect(courtBoxPx({ w: 1280, h: 800 }, { narrow: false, inspector: 'pinned' })).toEqual({ w: 742, h: 634 });
    expect(courtBoxPx({ w: 1920, h: 1080 }, { narrow: false, inspector: 'pinned' })).toEqual({ w: 1382, h: 914 });
  });
});

describe('④ 띠가 정말 2행인가 — 줄나눔을 폭에서 다시 계산한다', () => {
  /** 기본 캐스트 8명(두 팀 × G·2·3·4). wrap 이 실제로 일어나는 그 개수다. */
  const CHIPS = 8;

  it('구역은 여섯이고 **DOM 순서 그대로**다 — 순서가 곧 줄나눔이다', () => {
    // 2026-08-14 두 번째 지시로 '편집 이력'(되돌리기·다시하기)이 줌 **바로 뒤**에 들어왔다.
    // 헤더에서 옮겨온 것이라 총 표적 수는 그대로고, 늘어난 것은 띠가 세어야 할 구역 하나다.
    expect(trayBandSectionsPx(HIT, CHIPS).map((s) => s.name)).toEqual([
      '확대',
      '편집 이력',
      '구분선',
      '개체',
      '구분선',
      '기능',
    ]);
  });

  it('구역 폭 실측 — 줌 142 · 이력 93 · 구분선 9 · 벤치 561 · 기능 223 (hit 44 · 선수 8명)', () => {
    const w = Object.fromEntries(trayBandSectionsPx(HIT, CHIPS).map((s, i) => [`${s.name}${i}`, s.w]));
    expect(w).toEqual({ '확대0': 142, '편집 이력1': 93, '구분선2': 9, '개체3': 561, '구분선4': 9, '기능5': 223 });
    // 줄 높이를 정하는 것은 벤치(칩 상자 60)와 기능(도구 50)이다. 구분선은 alignSelf:stretch 라 0.
    expect(trayBandSectionsPx(HIT, CHIPS).map((s) => s.h)).toEqual([44, 44, 0, 60, 0, 50]);
  });

  it('★ 띠가 넉넉하면 2행 132 — 높이 식과 **정확히 같은 값**이 나온다', () => {
    // 두 계산이 독립이다: trayBandHeightPx 는 "칩 줄 + 도구 줄" 을 더하고, trayBandLayoutAt 은
    // 폭에서 줄을 나눠 그 줄 높이를 더한다. 같은 답이 나와야 "2행" 이 참이다.
    //
    // ⚠️ 폭이 810 → **849** 로 올랐다(2026-08-14 이력 구역 93 + gap 6). 810 은 이제 3행이다 —
    // 그것이 이 추가의 실제 대가이고, 아래 문턱 it 이 그 자리를 정확히 적는다.
    const wide = trayBandLayoutAt(HIT, 849, CHIPS);
    expect(wide.rows).toBe(2);
    expect(wide.heightPx).toBe(trayBandHeightPx(HIT));
    expect(wide.heightPx).toBe(132);
    expect(trayBandLayoutAt(HIT, 810, CHIPS).rows, '810 이 아직 2행이면 이력 구역이 안 세어지고 있다').toBe(3);
  });

  it('⚠️ 480×800(주 표적)의 띠 폭 456 에서는 **3행 182** 다 — 132 에 안 들어간다', () => {
    // 정직한 기록: 벤치 하나가 561px 이라 줌·구분선(157) 뒤에 못 들어가 자기 줄로 내려가고,
    // 기능 구역이 셋째 줄이 된다. 띠 높이는 132 로 **고정**이므로 코트는 안 움직이지만(그것이
    // 이 설계의 요점이다) 도구 줄은 `overflowY:'auto'` 로 스크롤해야 보인다.
    // 설계서 §4.7 은 이 기기에서 2행을 그렸다 — 높이 예산은 맞고 **줄 수 전망이 틀렸다.**
    const seven = trayBandLayoutAt(HIT, 456, CHIPS);
    expect(seven.rows).toBe(3);
    expect(seven.heightPx).toBe(182);
    expect(seven.heightPx).toBeGreaterThan(trayBandHeightPx(HIT));
    // 그래서 스크롤이 **유일한 도달 경로**다. 이 등식이 위험 3(작도·설명에 영영 못 닿는다)의
    // 세로판을 막는 계약이고, ToolRail.band.test.tsx 가 화면의 overflowY 를 직접 본다.
    expect(seven.heightPx - trayBandHeightPx(HIT)).toBe(50);
  });

  it('2행이 되는 문턱 폭을 **찾아서** 적는다 — 다음 사람이 어디를 넓혀야 하는지 알게', () => {
    let firstTwoRow = -1;
    for (let w = 200; w <= 2000; w++) {
      if (trayBandLayoutAt(HIT, w, CHIPS).rows <= 2) {
        firstTwoRow = w;
        break;
      }
    }
    // 750 → **831**. 이력 구역(93 + gap 6 = 99)이 첫 줄에 들어오면서 벤치가 그만큼 늦게
    // 자리를 얻는다. 띠 폭 = 창 폭 − 코트 래퍼 좌우 패딩(narrow 24) → 창으로는 855px 부터다.
    expect(firstTwoRow).toBe(831);
    expect(firstTwoRow + 24).toBe(855);
    expect(trayBandLayoutAt(HIT, firstTwoRow - 1, CHIPS).rows).toBe(3);
    // ⚠️ **2행이 곧 132 는 아니다.** 831~848 구간은 첫 줄이 줌·이력·구분선(높이 44)뿐이라
    // 내용이 126 밖에 안 된다 — 132 에 들어가므로 스크롤은 없지만 값은 다르다. 132 와 정확히
    // 같아지는 것은 벤치까지 첫 줄에 오르는 849 부터다. 계약은 "132 와 같다" 가 아니라
    // **"132 를 안 넘는다"** 이고, 그것이 스크롤 유무를 정하는 유일한 조건이다.
    expect(trayBandLayoutAt(HIT, firstTwoRow, CHIPS).heightPx).toBe(126);
    expect(trayBandLayoutAt(HIT, firstTwoRow, CHIPS).heightPx).toBeLessThanOrEqual(trayBandHeightPx(HIT));
    expect(trayBandLayoutAt(HIT, 849, CHIPS).heightPx).toBe(132);
  });

  it('선수가 적으면 좁은 띠에서도 2행이 된다 — 모형이 폭을 정말 보고 있다는 대조군', () => {
    // 이 대조군이 없으면 위 it 들은 "trayBandLayoutAt 이 늘 3을 답한다" 로도 통과한다.
    // 같은 폭(562)에서 선수만 2명↔8명으로 바꾼다 — 갈리면 모형이 폭과 개수를 정말 보고 있다.
    expect(trayBandLayoutAt(HIT, 562, 2).rows).toBe(2);
    expect(trayBandLayoutAt(HIT, 562, 2).heightPx).toBe(132);
    expect(trayBandLayoutAt(HIT, 562, 8).rows).toBe(3);
  });

  it('띠 좌우 패딩이 줄나눔에 실제로 들어간다', () => {
    expect([TRAY_BAND_PAD_Y, TRAY_BAND_PAD_X]).toEqual([8, 13]);
    // 패딩을 0 으로 본 폭(831 + 26)이면 한 줄이 더 들어갈 만큼 넉넉해진다 — 26px 이 공짜가 아니다.
    expect(trayBandLayoutAt(HIT, 831, 8).rows).toBe(2);
    expect(trayBandLayoutAt(HIT, 831 - 26, 8).rows).toBe(3);
  });
});

describe('⑤ calc 문자열이 픽셀 식과 같은 상수로 조립된다', () => {
  // 문자열을 소스에서 import 해 비교하면 식이 틀려도 함께 움직여 아무것도 못 잡는다.
  // **리터럴로 다시 적는다**(트레이 폭 calc 가 ToolRail.hit.test.tsx 에서 간 길과 같다).
  it('TRAY_BAND_2ROW_CSS 는 그 식이다', () => {
    expect(TRAY_BAND_2ROW_CSS).toBe('calc((var(--hit) - 8px) * 1.5 + 6px + max(50px, var(--hit)) + 22px)');
  });

  it('⚠️ 설계서 식(`+ var(--hit) +`)은 hit 44 에서 126 이라 **목표 132 와 다르다**', () => {
    // 설계서 §4.7·§5-P5 의 오타를 코드로 박제해 둔다 — 다음 사람이 "설계서대로 고쳐 놓는" 것을
    // 막는 것이 목적이다. 둘째 줄은 도구 버튼 줄이고 그 높이는 max(TOOL_BTN_H, --hit) 이다.
    const asDesigned = (hit: number): number => (hit - 8) * 1.5 + 6 + hit + 22;
    expect(asDesigned(HIT)).toBe(126);
    expect(asDesigned(HIT_LARGE)).toBe(156); // 56 에서는 우연히 맞는다 — 그래서 못 보고 넘어간다
    expect(asDesigned(HIT)).not.toBe(trayBandHeightPx(HIT));
    // 126 이었다면 코트 상자가 456×542 가 되어 완료 판정의 536 이 거짓이 된다.
    expect(boxWithBand(asDesigned(HIT))).toEqual({ w: 456, h: 542 });
  });

  it('화면이 그 상수를 쓴다 — 리터럴 패딩·높이가 되살아나면 식과 갈라진다', () => {
    const src = read('src/features/editor/ToolRail.tsx');
    expect(src).toContain('height: TRAY_BAND_2ROW_CSS');
    expect(src, "옛 리터럴 패딩이 되살아났다 — 줄나눔 모형이 26px 을 잘못 센다").not.toContain("padding: '8px 13px'");
  });
});

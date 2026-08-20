// §5.2/§5.3 크롬 예산의 **계산 테스트**. 계획서의 실측표를 여기서 다시 만들어 대조한다.
//
// 표를 문서에만 두면 다음 사람이 한 행을 줄일 때 합계가 맞는지 확인할 길이 없고, 몇 달 뒤에는
// 표와 코드 중 어느 쪽이 참인지도 알 수 없게 된다. 여기서는 §5.3 의 **모든 칸**(상자 크기·
// pxPerUnit·변화율)을 `courtBoxPx`/`courtScale` 로 계산해 맞춘다 — 표가 틀렸거나 코드가 틀리면
// 둘 중 하나는 반드시 빨간불이 된다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHROME_HEIGHT_NARROW_PX,
  CHROME_HEIGHT_NOW_PX,
  CHROME_ROWS,
  CHROME_WIDTH_NARROW_PX,
  CHROME_WIDTH_NOW_PX,
  COURT_PAD_PX,
  SAFE_AREA_HOME_INDICATOR,
  SAFE_AREA_NONE,
  SAFE_AREA_NOTCH_LANDSCAPE,
  chromeHeightPx,
  chromeRowPx,
  chromeWidthPx,
  courtBoxPx,
  courtPadCss,
  courtScale,
} from './chromeBudget.ts';
import type { ChromeAxis, ChromeState, Size } from './chromeBudget.ts';
import { INSPECTOR_PIN_MIN_PX, canPinInspector } from '../features/editor/inspectorLayout.ts';
import { trayRailWidthPx } from '../features/editor/trayMetrics.ts';
import { NARROW_MAX_PX } from '../ui/useIsNarrow.ts';
import { COURT_DEFS } from '../model/court.ts';
import { computeMetrics, rotForFit } from '../render/useStageMetrics.ts';

const read = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf-8');

/** 재편 이전('현재' 열) 합계. 이 열만 rows 의 now 를 쓴다 — 나머지는 전부 wide/narrow 다. */
const sumNow = (axis: ChromeAxis): number =>
  CHROME_ROWS.filter((r) => r.axis === axis).reduce((s, r) => s + r.now, 0);

const NOW: Size = { w: CHROME_WIDTH_NOW_PX, h: CHROME_HEIGHT_NOW_PX };
const nowBox = (viewport: Size): Size => ({ w: viewport.w - NOW.w, h: viewport.h - NOW.h });

const narrowState: ChromeState = { narrow: true, inspector: 'hidden' };
const pcOverlay: ChromeState = { narrow: false, inspector: 'overlay' };
const pcPinned: ChromeState = { narrow: false, inspector: 'pinned' };

describe('예산 합계 — 못박은 값', () => {
  it('폭 합계는 523 → 173 이다 (재설계 ② 로 기능 바 56 이 상시가 됐다)', () => {
    expect(sumNow('width')).toBe(CHROME_WIDTH_NOW_PX);
    expect(CHROME_WIDTH_NOW_PX).toBe(523);
    expect(chromeWidthPx(narrowState)).toBe(CHROME_WIDTH_NARROW_PX);
    expect(CHROME_WIDTH_NARROW_PX).toBe(173);
  });

  it('세로 합계는 196 → 125 이다', () => {
    expect(sumNow('height')).toBe(CHROME_HEIGHT_NOW_PX);
    expect(CHROME_HEIGHT_NOW_PX).toBe(196);
    expect(chromeHeightPx(narrowState)).toBe(CHROME_HEIGHT_NARROW_PX);
    // 132 → 128(2026-08-14 좁은 헤더 52 → 48) → 109(2026-08-18 하단 철거: 하단 바 64 가
    // 빠지고 노트 패널 접힘 줄 45 가 들어왔다 — 순이득 19px) → **125**(2026-08-20 재생 묶음
    // 공용화: 노트 패널 행이 45 → 61 로 자란다 — 좁은 창의 appHeader 는 이미 narrow 값 48 을
    // 쓰고 있었으므로 그대로고, 늘어난 16 은 전부 이 행 몫이다).
    expect(CHROME_HEIGHT_NARROW_PX).toBe(125);
  });

  it('행별 값이 §5.2 표와 같다', () => {
    const byId = Object.fromEntries(CHROME_ROWS.map((r) => [r.id, r]));
    expect([byId.appRail!.now, byId.appRail!.narrow]).toEqual([84, 0]);
    expect([byId.inspector!.now, byId.inspector!.narrow]).toEqual([313, 0]);
    expect([byId.toolRail!.now, byId.toolRail!.narrow]).toEqual([78, 93]);
    expect([byId.courtPadX!.now, byId.courtPadX!.narrow]).toEqual([48, 24]);
    expect([byId.appHeader!.now, byId.appHeader!.narrow]).toEqual([62, 48]);
    // 2026-08-18 하단 철거 — transportBar 는 은퇴 행(역사 94 만 남고 현재 0), 후계는
    // stepSidebar(폭, 재편 후 태생이라 now 0)와 notePanel(접힘 줄 45)이다.
    expect([byId.transportBar!.now, byId.transportBar!.wide, byId.transportBar!.narrow]).toEqual([94, 0, 0]);
    expect([byId.stepSidebar!.now, byId.stepSidebar!.wide, byId.stepSidebar!.narrow]).toEqual([0, 154, 0]);
    expect([byId.notePanel!.now, byId.notePanel!.wide, byId.notePanel!.narrow]).toEqual([0, 61, 61]);
    expect([byId.courtPadY!.now, byId.courtPadY!.narrow]).toEqual([40, 16]);
  });

  it('넓은 창의 폭 크롬은 인스펙터 모드가 가른다 — 281(오버레이) / 594(핀)', () => {
    // 트레이 93 은 **좁을 때만이 아니다.** 44px 미만 손잡이는 PC 에서도 결함이라 기기와 무관하게
    // 커진다(§5.4). §5.3 의 PC 두 행이 이 93 으로 계산된 값이다 — 78 로 두면 표가 안 맞는다.
    expect(chromeWidthPx(pcOverlay)).toBe(281);
    expect(chromeWidthPx(pcPinned)).toBe(594);
    // 세로 166 → 104(2026-08-15: 넓은 창 헤더 철거) → 85(2026-08-18 하단 철거: 남는 것은
    // 노트 패널 접힘 줄 45 + 코트 래퍼 상하 40) → **149**(2026-08-20 — 드릴 편집이 넓은 창에서도
    // 컴팩트 헤더 48 을 도로 얻고, 노트 행이 45 → 61 로 자란다: 85 + 48 + 16 = 149).
    expect(chromeHeightPx(pcOverlay)).toBe(149);
    // 재편 전 196 → 149. 94 는 하단 바가 통째로 돌려준 몫, 62 는 예전 표준 헤더 몫인데 이제
    // 컴팩트 48 을 도로 쓰므로 **14 만** 돌아온다(62 − 48), 새로 든 것은 노트 패널 61 이다
    // (94 + 14 − 61 = 47).
    expect(CHROME_HEIGHT_NOW_PX - chromeHeightPx(pcOverlay)).toBe(47);
  });

  it('인스펙터 행만 narrow 가 아니라 자기 모드가 정한다', () => {
    const row = CHROME_ROWS.find((r) => r.id === 'inspector')!;
    expect(chromeRowPx(row, pcPinned)).toBe(313);
    expect(chromeRowPx(row, pcOverlay)).toBe(0);
    // 대조군 — 다른 행은 모드를 바꿔도 꿈쩍하지 않는다(같은 narrow 면 같은 값).
    const rail = CHROME_ROWS.find((r) => r.id === 'appRail')!;
    expect(chromeRowPx(rail, pcPinned)).toBe(chromeRowPx(rail, pcOverlay));
  });

  it('좁은 창에서는 붙박이 인스펙터가 설 수 없다', () => {
    // 두 문턱이 같은 1100 이지만 **판정 대상이 다르다**(창 vs 편집기 컨테이너). 컨테이너는
    // 창보다 클 수 없으므로 창이 좁으면 핀도 불가능하다 — 그래도 하나로 묶지 마라.
    expect(INSPECTOR_PIN_MIN_PX).toBe(NARROW_MAX_PX);
    expect(canPinInspector(NARROW_MAX_PX - 1)).toBe(false);
    expect(canPinInspector(NARROW_MAX_PX)).toBe(true);
  });

  it('코트 래퍼 패딩은 예산 행의 절반이다(양쪽이라서)', () => {
    expect(courtPadCss(false)).toBe('20px 24px');
    expect(courtPadCss(true)).toBe('8px 12px');
    expect(COURT_PAD_PX.wide.x * 2).toBe(48);
    expect(COURT_PAD_PX.narrow.y * 2).toBe(16);
  });
});

// §5.3 실측표. 상자 크기는 **정수로 정확히** 맞고, 축척은 소수 넷째 자리까지 맞는다.
// (1920 행만 계획서가 1.6749 로 적혀 있는데 실제 계산은 1.67515 다 — 계획서 쪽 반올림이다.)
describe('§5.3 실측표를 계산으로 재현한다 — 풀 코트', () => {
  const px = (box: Size): number => courtScale('full', box).pxPerUnit;

  it('1024×600 가로 — 0.6073 → 0.9048 (+49.0%)', () => {
    const before = nowBox({ w: 1024, h: 600 });
    const after = courtBoxPx({ w: 1024, h: 600 }, narrowState);
    expect(before).toEqual({ w: 501, h: 404 });
    // h 472 → 491(2026-08-18 하단 철거: 하단 바 64 → 노트 접힘 줄 45) → **475**(2026-08-20
    // 재생 묶음 공용화: 노트 행 45 → 61, −16).
    // w 807 → **851**(2026-08-20 [저장] 칸·구분선이 드릴 편집에서 빠지며 기능 바가 599px →
    // 544px 요구로 줄어, 552px 가용 높이에서 2열 → 1열이 됐다 — 44px 를 코트가 돌려받는다).
    // 세로가 병목이라(h 는 그대로) 축척·변화율·1m 열은 **전혀 안 바뀐다** — 실측으로 확인함.
    expect(after).toEqual({ w: 851, h: 475 });
    expect(px(before)).toBeCloseTo(0.6073, 4);
    expect(px(after)).toBeCloseTo(0.9048, 4);
    expect((px(after) / px(before) - 1) * 100).toBeCloseTo(49.0, 1);
    // '1 m' 열. 22.6 px 은 휠체어(1.5 m)가 화면에서 34 px 로 그려진다는 뜻이다.
    expect(courtScale('full', after).pxPerMeter).toBeCloseTo(22.6, 1);
  });

  it('800×480 진짜 7인치 — 0.3358 → 0.6762 (+101.4%)', () => {
    const before = nowBox({ w: 800, h: 480 });
    const after = courtBoxPx({ w: 800, h: 480 }, narrowState);
    expect(before).toEqual({ w: 277, h: 284 });
    // h 371(2026-08-18 하단 철거로 균형점에 섰던 값) → **355**(2026-08-20 노트 행 45 → 61).
    expect(after).toEqual({ w: 583, h: 355 });
    expect(px(before)).toBeCloseTo(0.3358, 4);
    expect(px(after)).toBeCloseTo(0.6762, 4);
    expect((px(after) / px(before) - 1) * 100).toBeCloseTo(101.4, 1);
    // ⚠️ 2026-08-20 — 노트 행이 다시 자라며(45→61) **균형점이 깨졌다.** 2026-08-18 은 이
    // 기기를 폭·세로 양쪽이 동시에 제약인 유리수 균형(583·525 = 371·825)에 세웠는데, 세로
    // 크롬이 다시 16 늘면서 세로가 홀로 제약으로 돌아갔다(355/525 = 0.6762 < 583/825 = 0.7067).
    expect(after.h / 525).toBeLessThan(after.w / 825);
  });

  // [2.10 정정] 계획서 §5.3 의 PC 두 행은 하단 바가 넓은 창에서 94 로 남는다는 전제로
  // 계산돼 있었다(상자 높이 604). 사진 뭉치가 라벨줄을 흡수하며 그 전제가 깨졌다 —
  // **세로 상자가 30px 커진다.** 폭이 제약인 두 경우(핀·1920)는 축척이 그대로이고, 세로가
  // 제약이던 오버레이만 1.1505 → 1.2076 으로 오른다. 표가 화면보다 작게 말하고 있었으므로
  // 이 갱신은 손해가 아니라 이득의 반영이다.
  it('1280×800 PC — 오버레이 +31.6%, [고정] 핀은 −2.0%', () => {
    const view = { w: 1280, h: 800 };
    const before = nowBox(view);
    const overlay = courtBoxPx(view, pcOverlay);
    const pinned = courtBoxPx(view, pcPinned);
    expect(before).toEqual({ w: 757, h: 604 });
    // h 696 → 715(2026-08-18 하단 철거의 +19) → **651**(2026-08-20 — 드릴 편집이 넓은 창에서도
    // 컴팩트 헤더 48 을 도로 얻고 노트 행이 45→61: 715 − 48 − 16 = 651). 두 경우 다 여전히
    // **폭이 제약**이라(651/525 > 999/825, 651/525 > 686/825) 축척 자체는 그대로다.
    expect(overlay).toEqual({ w: 999, h: 651 });
    expect(pinned).toEqual({ w: 686, h: 651 });
    expect(px(before)).toBeCloseTo(0.9176, 4);
    expect(px(overlay)).toBeCloseTo(1.2109, 4);
    // 핀은 **폭**이 제약이라 세로 30px 이 남아도 축척이 안 변한다 — 하단 바 갱신이 이 행을
    // 건드리지 않는다는 것을 함께 못박는다(0.8994 는 2.3 이 계산한 그 값 그대로다).
    expect(px(pinned)).toBeCloseTo(0.8315, 4);
    expect(pinned.w / 825).toBeLessThan(pinned.h / 525);
    expect((px(overlay) / px(before) - 1) * 100).toBeCloseTo(32.0, 1);
    // 핀 상태가 지금보다 2% 작다는 것은 감수한 손해다(원인은 트레이 78→93). 이 부호가
    // 뒤집히면 §5.3 '정직한 인정 2번' 이 거짓이 되므로 함께 못박는다.
    expect((px(pinned) / px(before) - 1) * 100).toBeCloseTo(-9.4, 1);
  });

  it('1920×1080 PC 핀 — 1.607 (기능 바 56 만큼 폭이 더 빠졌다)', () => {
    const box = courtBoxPx({ w: 1920, h: 1080 }, pcPinned);
    // h 995 → **931**(2026-08-20 — 컴팩트 헤더 48 + 노트 행 +16). 여전히 폭이 제약이라
    // (931/525 > 1326/825) 축척은 그대로다.
    expect(box).toEqual({ w: 1326, h: 931 });
    expect(px(box)).toBeCloseTo(1.6073, 3);
    expect(courtScale('full', box).pxPerMeter).toBeCloseTo(40.2, 1);
  });
});

// [A-13] 정정 — 원안 표는 `min(boxW/825, boxH/525)` 로 **풀 코트만** 계산했다. half/flat 은
// 525×450 이라 같은 상자에서 다른 답이 나온다. 하프는 '마무리·세트피스 훈련'용으로 지정돼
// 있어 사용 빈도가 낮지 않다.
describe('§5.3 half/flat 행 [A-13]', () => {
  const at = (mode: 'full' | 'half' | 'flat', box: Size): number => courtScale(mode, box).pxPerUnit;

  it('1024×600 narrow — full 0.9048 · half 1.0556 · flat 은 half 와 같다', () => {
    const box = courtBoxPx({ w: 1024, h: 600 }, narrowState);
    expect(at('full', box)).toBeCloseTo(0.9048, 4);
    expect(at('half', box)).toBeCloseTo(1.0556, 4);
    // D12 — half↔flat 은 viewBox 가 정확히 같아야 무손실 전환이다. 축척도 따라서 같다.
    expect(at('flat', box)).toBe(at('half', box));
    expect(COURT_DEFS.flat.vbW).toBe(COURT_DEFS.half.vbW);
  });

  it('하프의 이득은 full 의 1/3 뿐이다 — 원래 폭에 굶주려 있지 않았기 때문이다', () => {
    const before = nowBox({ w: 1024, h: 600 });
    const after = courtBoxPx({ w: 1024, h: 600 }, narrowState);
    // 재편 전 풀 코트는 **폭**이 제약이었다(501/825 < 404/525). 그래서 폭 크롬 523→117 이
    // 그대로 이득이 된다.
    expect(before.w / 825).toBeLessThan(before.h / 525);
    expect((at('full', after) / at('full', before) - 1) * 100).toBeCloseTo(49.0, 1);
    // 하프는 재편 전에도 **세로**가 제약이었다(404/450 < 501/525). 폭을 아무리 벌어도 안 커지고,
    // 세로 예산만큼만(475/404 = +17.6%) 커진다. (2026-08-20 재생 묶음 공용화로 세로 예산이
    // 109→125 로 늘어 이득이 21.5%→17.6% 로 준다.)
    expect(before.h / 450).toBeLessThan(before.w / 525);
    expect((at('half', after) / at('half', before) - 1) * 100).toBeCloseTo(17.6, 1);
    expect((at('half', after) / at('half', before) - 1) * 100).toBeCloseTo((475 / 404 - 1) * 100, 4);
  });

  it('800×480 에서도 하프가 세로에 갇힌다 — 0.5276 → 0.7889 (+49.5%)', () => {
    const before = nowBox({ w: 800, h: 480 });
    const after = courtBoxPx({ w: 800, h: 480 }, narrowState);
    expect(at('half', before)).toBeCloseTo(0.5276, 4);
    expect(at('half', after)).toBeCloseTo(0.7889, 4);
    expect((at('half', after) / at('half', before) - 1) * 100).toBeCloseTo(49.5, 1);
  });

  it('세로로 긴 창에서는 코트가 돌고, 축척도 돌린 값으로 잰다', () => {
    // iPad 세로 834×1194. 여기서 rotForFit 이 개입하지 않으면 예산표가 화면과 다른 숫자를
    // 말하게 된다 — 판이 돌면 상자에 맞는 변이 바뀌기 때문이다.
    const box = courtBoxPx({ w: 834, h: 1194 }, narrowState);
    // h 1085 → **1069**(2026-08-20 노트 행 +16). 이 케이스는 여전히 **폭**이 제약이라
    // (rot 90 에서 661/525 < 1069/825) 축척(pxPerUnit)은 그대로다.
    expect(box).toEqual({ w: 661, h: 1069 });
    const full = courtScale('full', box);
    expect(full.rot).toBe(90);
    expect(full.pxPerUnit).toBeCloseTo(1.2590, 4);
    // 대조군 — 돌리지 않았다면 0.869 로 3할 이상 작다.
    expect(Math.min(box.w / 825, box.h / 525)).toBeCloseTo(0.8012, 4);
  });
});

// [A-12] 정정 — 원안 표에 safe-area 가 빠져 있었다. `#root` 가 env(safe-area-inset-*) 를
// 패딩으로 먹으므로(appShell.css) 이 여백은 어느 상자도 나눠 갖지 않고 예산에 **더해진다.**
describe('safe-area 를 예산에 포함한다 [A-12]', () => {
  it('없으면 표 그대로다 — 기본값은 0 이다', () => {
    const bare = courtBoxPx({ w: 1024, h: 600 }, narrowState);
    const explicit = courtBoxPx({ w: 1024, h: 600 }, { ...narrowState, safeArea: SAFE_AREA_NONE });
    expect(explicit).toEqual(bare);
    // 807 → 851(2026-08-20, 위 §5.3 1024×600 케이스와 같은 이유).
    expect(explicit).toEqual({ w: 851, h: 475 });
  });

  it('아이패드 홈 인디케이터 20px 이 세로 예산에서 더 빠진다 — 0.9048 이 아니라 0.8667', () => {
    // §5.2 가 *"확정 배율 0.8914 는 안드로이드 태블릿 기준 상한이지 아이패드 실측이 아니다"*
    // 라고 적어 둔 것의 계산이 이것이다. 2026-08-20 재생 묶음 공용화 뒤에도 이 여백은 세로
    // 예산 위에 그대로 더해진다 — 대략 4.2% 작다.
    const box = courtBoxPx({ w: 1024, h: 600 }, { ...narrowState, safeArea: SAFE_AREA_HOME_INDICATOR });
    // 807 → 851(2026-08-20 §0.5 Phase 5, 위 §5.3 1024×600 케이스와 같은 이유 — [도움말] 칸이
    // 기능 바에서 빠져 1열 요구가 줄었다).
    expect(box).toEqual({ w: 851, h: 455 });
    expect(chromeHeightPx({ ...narrowState, safeArea: SAFE_AREA_HOME_INDICATOR })).toBe(CHROME_HEIGHT_NARROW_PX + 20);
    expect(courtScale('full', box).pxPerUnit).toBeCloseTo(0.8667, 4);
  });

  it('노치 기기를 눕히면 폭이 88 더 빠진다', () => {
    const state: ChromeState = { ...narrowState, safeArea: SAFE_AREA_NOTCH_LANDSCAPE };
    expect(chromeWidthPx(state)).toBe(CHROME_WIDTH_NARROW_PX + 88);
    const box = courtBoxPx({ w: 1024, h: 600 }, state);
    // 719 → 763(2026-08-20 §0.5 Phase 5, 위와 같은 이유).
    expect(box).toEqual({ w: 763, h: 454 });
    // 2026-08-18 하단 철거 뒤에는 이 상자가 **폭 제약**으로 넘어갔었다(719/825 < 470/525).
    // 2026-08-20 재생 묶음 공용화로 세로가 다시 줄며(470→454) **도로 세로 제약**이 된다
    // (454/525 < 719/825) — 노치의 폭 88 은 더 이상 유일한 대가가 아니다.
    expect(courtScale('full', box).pxPerUnit).toBeCloseTo(0.8648, 4);
  });

  it('창보다 크롬이 크면 상자는 0 이다 — 음수 상자로 축척을 계산하지 않는다', () => {
    const box = courtBoxPx({ w: 100, h: 100 }, narrowState);
    expect(box).toEqual({ w: 0, h: 0 });
    expect(courtScale('full', box).pxPerUnit).toBe(0);
  });
});

describe('courtScale 이 화면과 같은 식을 쓴다', () => {
  // computeMetrics 는 실측 DOMRect 를 받으므로 예산 계산에서 직접 부를 수 없다. 대신 두 식이
  // **같은 답**을 낸다는 것을 여기서 붙잡는다 — 갈라지면 표가 화면과 다른 숫자를 말한다.
  const asRect = (box: Size): DOMRect =>
    ({ x: 0, y: 0, left: 0, top: 0, right: box.w, bottom: box.h, width: box.w, height: box.h, toJSON: () => ({}) }) as DOMRect;

  it.each([
    ['full', { w: 907, h: 472 }],
    ['full', { w: 717, h: 1066 }], // 돌아가는 상자
    ['half', { w: 683, h: 352 }],
    ['flat', { w: 1055, h: 604 }],
  ] as const)('%s %o 에서 computeMetrics 와 같은 pxPerUnit·rot 을 낸다', (mode, box) => {
    const def = COURT_DEFS[mode];
    const view = { x: 0, y: 0, w: def.vbW, h: def.vbH };
    const rot = rotForFit({ width: box.w, height: box.h }, view);
    const m = computeMetrics(asRect(box), view, rot);
    const s = courtScale(mode, box);
    expect(s.rot).toBe(rot);
    expect(s.pxPerUnit).toBe(m.pxPerUnit);
  });
});

// 예산표는 소스와 이어져 있어야 산다. 아래가 깨지면 **예산이 틀린 것이 아니라 표를 함께 안
// 고친 것**이다 — 행의 now/wide/narrow 를 그 자리에서 갱신하라(FALSIFICATION-BASELINE §15).
describe('예산표가 실제 소스와 어긋나지 않는다', () => {
  const row = (id: string) => CHROME_ROWS.find((r) => r.id === id)!;

  it('앱 레일 폭 84', () => {
    expect(read('src/app/AppRail.tsx'), '레일 폭을 바꿨다면 appRail 행도 함께 고쳐라').toContain(`width: ${row('appRail').now}`);
  });

  it('앱 헤더 높이 62', () => {
    expect(read('src/app/AppHeader.tsx'), '헤더 높이를 바꿨다면 appHeader 행도 함께 고쳐라').toContain(
      `minHeight: ${row('appHeader').now}`,
    );
  });

  it('트레이 폭은 --hit 파생이고, hit=44 값이 예산의 wide/narrow 다 (2.4)', () => {
    // §16.1 사전 등록 그대로 2.4 에서 깨졌고, 등록문("now 를 새 실측값으로")과 달리 now=78 은
    // 남긴다 — now 는 재편 **이전** 실측값이라(ChromeRow 주석) 위 '현재' 열(523·0.6073)이 전부
    // 이 값으로 계산된다. 대신 결합을 리터럴 텍스트에서 **함수 import** 로 올린다: 트레이 폭이
    // 더는 소스의 단일 리터럴이 아니라 --hit 파생 식이기 때문이다(§5.4, FALSIFICATION §17.1).
    expect(trayRailWidthPx(44)).toBe(row('toolRail').wide);
    expect(trayRailWidthPx(44)).toBe(row('toolRail').narrow);
    expect(trayRailWidthPx(44)).toBe(93);
    // 큰 터치 타깃(--hit 56)이면 117. 좁은 폭 합계 117 과 같은 숫자인 것은 우연이다 — 묶지 마라.
    expect(trayRailWidthPx(56)).toBe(117);
    // 리터럴 78 이 되살아나면 함수와 화면이 갈라진 것이다.
    expect(read('src/features/editor/ToolRail.tsx')).not.toContain('width: 78');
  });

  it('코트 래퍼 패딩은 리터럴이 아니라 예산에서 온다', () => {
    const workspace = read('src/features/editor/EditorWorkspace.tsx');
    expect(workspace).toContain('padding: courtPadCss(');
    expect(workspace, '리터럴 패딩이 되살아나면 예산표와 화면이 갈라진다').not.toContain("padding: '20px 24px'");
  });

  it('하단 바 후계 행이 실제 소스와 같다 — 스텝 바 폭 154 · 노트+재생 줄 61 (2026-08-20)', () => {
    // 옛 검증(transportBarHeightPx 가 행의 wide/narrow)은 바와 함께 은퇴했다. 후계 계약:
    //  · stepSidebar 행의 wide 는 StepSidebar.tsx 의 SIDEBAR_WIDTH_PX 리터럴과 같다(자기
    //    사본 문제 때문에 import 비교가 아니라 **소스 텍스트**로 잡는다 — 트레이 표와 같다).
    //  · notePanel 행의 61 은 2026-08-20 부터 토글 줄 --hit(44) + 경계선 1(=45, 2026-08-17
    //    기준) 이 아니라 **공용 PlaybackControls 의 60px 재생 버튼 + 경계선 1** 이다 — 노트
    //    자체는 여전히 NotePanel(minHeight var(--hit))이지만, 같은 줄에 선 재생 묶음이 더
    //    크므로 행 높이는 그쪽이 정한다.
    expect(read('src/features/editor/StepSidebar.tsx')).toContain(`export const SIDEBAR_WIDTH_PX = ${row('stepSidebar').wide};`);
    expect(read('src/features/editor/NotePanel.tsx')).toContain("minHeight: 'var(--hit)'");
    expect(row('notePanel').wide).toBe(60 + 1);
    // 은퇴 행은 현재값이 0 이어야 한다 — 값이 살아나면 있지도 않은 바를 예산이 도로 뺀다.
    expect([row('transportBar').wide, row('transportBar').narrow]).toEqual([0, 0]);
  });
});

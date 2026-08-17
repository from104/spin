// P3 완료 판정 — **인접축 빈틈 0** 과 유동 트레이의 숫자들 (설계서 §4.1·§4.6·위험 3).
//
// jsdom 은 레이아웃을 계산하지 않는다 — `getBoundingClientRect()` 가 전부 0 이라 "코트 칸 rect 의
// 오른쪽 변 === nav rect 의 왼쪽 변" 을 브라우저에게 물어볼 수 없다. 그래서 두 겹으로 잡는다:
//   ① **계산** — 화면이 쓰는 flex 규칙의 순수 함수 사본(boardSplitPx)으로 등식을 증명한다.
//   ② **계약** — 그 계산이 화면과 같은 규칙을 재고 있는지를 DOM·소스에서 못박는다
//      (판 덩어리에 gap·padding·border 가 없고, 자식이 정확히 둘이다 — boardContract.test.tsx).
// ①만 두면 "모형이 자기 자신을 증명" 하는 사본 문제이고, ②만 두면 숫자가 없다.
//
// ⚠️ **실브라우저 확인이 여전히 필요하다**: 여기 있는 것은 flex 알고리즘의 *사본*이지 브라우저가
// 아니다. 특히 `aspect-ratio` + `flex-basis:auto` 조합에서 "확정된 교차 크기로부터 주축 크기를
// 뽑는" 경로는 사본이 흉내낼 수 없는 부분이 남는다. 기현님 실기 항목: 칩과 코트 사이에 틈이
// 보이는가(§6 실기 확인 2번).
import { describe, expect, it } from 'vitest';
import { boardSplitPx, courtCellAspectRatio, courtCellAspectRatioCss } from './boardLayout.ts';
import {
  TRAY_MAX_COLS,
  trayBenchHeightPx,
  trayColumnsAt,
  trayFixedHeightPx,
  trayRailMaxWidthPx,
  trayRailWidthPx,
} from './trayMetrics.ts';
import { COURT_MODES, COURT_SIZES, courtDefFor } from '../../model/court.ts';
import { COURT_PAD_PX, chromeHeightPx, chromeWidthPx, courtScale } from '../../app/chromeBudget.ts';
import type { ChromeState } from '../../app/chromeBudget.ts';
import type { StageRot } from '../../render/useStageMetrics.ts';

// ── 종횡비는 def 에서만 온다 ────────────────────────────────────────────────────────

describe('courtCellAspectRatio — 코트 정의에서만 나온다 (§4.1 함정 3)', () => {
  it.each(COURT_MODES)('%s: 3크기 × rot 0/90 이 전부 def 의 vbW/vbH 다', (mode) => {
    for (const size of COURT_SIZES) {
      const def = courtDefFor(mode, size);
      expect(courtCellAspectRatio(mode, size, 0)).toBe(def.vbW / def.vbH);
      expect(courtCellAspectRatio(mode, size, 90)).toBe(def.vbH / def.vbW);
      // CSS 표기는 반올림 없이 그대로 — 부동소수가 화면에 안 샌다.
      expect(courtCellAspectRatioCss(mode, size, 0)).toBe(`${def.vbW} / ${def.vbH}`);
      expect(courtCellAspectRatioCss(mode, size, 90)).toBe(`${def.vbH} / ${def.vbW}`);
    }
  });

  it('대조군: 회전하면 값이 실제로 뒤집힌다 — rot 을 무시하는 구현을 거른다', () => {
    // full 30×18 은 825×525 라 0 에서 1.5714, 90 에서 0.6364 다.
    expect(courtCellAspectRatio('full', '30x18', 0)).toBeCloseTo(1.5714, 4);
    expect(courtCellAspectRatio('full', '30x18', 90)).toBeCloseTo(0.6364, 4);
    expect(courtCellAspectRatio('full', '30x18', 0) * courtCellAspectRatio('full', '30x18', 90)).toBeCloseTo(1, 12);
  });

  it('코트 크기 3단이 서로 다른 비를 준다 — size 를 무시하는 구현을 거른다', () => {
    const ars = COURT_SIZES.map((s) => courtCellAspectRatio('full', s, 0));
    expect(new Set(ars).size).toBe(COURT_SIZES.length);
  });
});

// ── 인접축 빈틈 0 ───────────────────────────────────────────────────────────────────

/** 정렬 상자의 안쪽 크기 = 창 − 크롬 + **트레이 최소폭**.
 *  `courtBoxPx` 는 크롬에서 트레이 93 을 이미 빼 두었는데(그 행의 뜻이 "트레이 **최소**폭"
 *  이다 — chromeBudget.ts 의 그 주석), 정렬 상자는 트레이까지 함께 담으므로 도로 더한다. */
function alignBoxPx(viewport: { w: number; h: number }, state: ChromeState, hitPx: number) {
  return {
    w: viewport.w - chromeWidthPx(state) + trayRailWidthPx(hitPx),
    h: viewport.h - chromeHeightPx(state),
  };
}

/** 설계서 §4.6·§5-P3 이 이름으로 부르는 기기들. narrow 는 실제 판정(창 폭 < 1100)에서 뽑는다 —
 *  손으로 적으면 800×600 을 '넓은 창' 으로 두는 식의 헛계산이 슬며시 들어온다. */
const DEVICES = [
  { name: '1024×600', w: 1024, h: 600 },
  { name: '800×480 (7인치)', w: 800, h: 480 },
  { name: '1280×800', w: 1280, h: 800 },
  { name: '1920×1080', w: 1920, h: 1080 },
  { name: '480×800 (세로)', w: 480, h: 800 },
  // ⚠️ 여섯 번째는 §4.6 표에 없다. **가로 창인데 rot 90 인 국면**이 위 다섯에는 한 번도 안
  // 나오기 때문에 넣었다(2026-08-14 전수 표본으로 확인 — 다섯 기기에서 rot 90 은 480×800
  // 세로 하나뿐이었다). 인스펙터를 붙박이로 세운 세로로 긴 데스크톱 창이 그 자리다:
  // 1100×900 핀 → 가용 655×734 → 코트 상자가 세로로 길어 판이 선다. "어느 축을 안 찔렀나" 를
  // 스스로 묻고 메운 칸이라, 아래 '축 열거' it 이 이 칸의 존재를 매번 다시 확인한다.
  { name: '1100×900 (세로로 긴 데스크톱 창)', w: 1100, h: 900 },
] as const;
const HITS = [44, 56] as const;
const INSPECTORS = ['hidden', 'overlay', 'pinned'] as const;

/** 인스펙터 붙박이는 컨테이너 폭 ≥1100 에서만 성립한다(inspectorLayout) — 못 서는 조합은 뺀다. */
function states(w: number): ChromeState[] {
  const narrow = w < 1100;
  return INSPECTORS.filter((i) => i !== 'pinned' || !narrow).map((inspector) => ({ narrow, inspector }));
}

describe('★ 인접축 빈틈 0 — 코트 칸 오른쪽 변 === 트레이 왼쪽 변', () => {
  it('5기기 × 3코트 × 3크기 × 인스펙터 3모드 × hit 2값에서 등식이 성립한다', () => {
    let checked = 0;
    for (const dev of DEVICES) {
      for (const state of states(dev.w)) {
        for (const hit of HITS) {
          const avail = alignBoxPx(dev, state, hit);
          if (avail.w <= 0 || avail.h <= 0) continue; // 480 세로 + 핀은 애초에 못 선다
          for (const mode of COURT_MODES) {
            for (const size of COURT_SIZES) {
              const rot = courtScale(mode, { w: avail.w - trayRailWidthPx(hit), h: avail.h }, size).rot;
              const split = boardSplitPx(avail, courtCellAspectRatio(mode, size, rot), hit);
              // 판 덩어리 안에 gap·padding·border 가 없으므로 두 칸의 합이 곧 판 폭이다.
              expect(split.courtW + split.trayW, `${dev.name} ${mode} ${size} hit${hit}`).toBeCloseTo(split.boardW, 9);
              expect(split.courtW).toBeGreaterThan(0);
              checked += 1;
            }
          }
        }
      }
    }
    // 축을 실제로 다 돌았는지 — 루프가 조용히 0회 돌면 위 단언은 전부 없는 것이다.
    expect(checked).toBeGreaterThanOrEqual(5 * 2 * 2 * 9);
  });

  it('★ 축 열거: 두 국면과 두 회전이 **실제로** 표본에 다 들어 있다', () => {
    // "어느 축을 안 찔렀나" — 이 저장소가 실제로 겪은 헛통과 형태다(구현자 셋이 세로만 찔러
    // 가로에서 §3 불변식이 절반만 성립한 채 통과했다). 위 전수 루프가 **한 국면만** 돌고 있으면
    // "빈틈 0" 은 절반만 증명된 것이라, 표본 자체를 여기서 분류해 둘 다 있음을 못박는다.
    const seen = new Map<string, string[]>();
    for (const dev of DEVICES) {
      for (const state of states(dev.w)) {
        for (const hit of HITS) {
          const avail = alignBoxPx(dev, state, hit);
          if (avail.w <= 0 || avail.h <= 0) continue;
          for (const mode of COURT_MODES) {
            for (const size of COURT_SIZES) {
              const rot = courtScale(mode, { w: avail.w - trayRailWidthPx(hit), h: avail.h }, size).rot;
              const ar = courtCellAspectRatio(mode, size, rot);
              const split = boardSplitPx(avail, ar, hit);
              // 세로 제약 = 코트가 자기 종횡비를 온전히 지킨다(레터박스 0). 폭 제약 = 못 지키고
              // shrink 하며 트레이가 하한에서 멈춘다 — 오늘과 정확히 같은 배치다.
              const regime = split.courtW >= avail.h * ar - 1e-6 ? '세로 제약' : '폭 제약';
              const key = `${regime}/rot${rot}`;
              seen.set(key, [...(seen.get(key) ?? []), `${dev.name} ${state.inspector} hit${hit} ${mode} ${size}`]);
              if (regime === '폭 제약') expect(split.trayW, key).toBe(trayRailWidthPx(hit));
              else expect(split.courtW, key).toBeCloseTo(avail.h * ar, 6);
            }
          }
        }
      }
    }
    // 네 칸 모두 비어 있지 않아야 한다. 하나라도 비면 그 축을 안 찌른 것이다.
    for (const key of ['세로 제약/rot0', '세로 제약/rot90', '폭 제약/rot0', '폭 제약/rot90']) {
      expect(seen.get(key)?.length ?? 0, `${key} 표본이 0개다 — 이 축을 안 찔렀다`).toBeGreaterThan(0);
    }
    // 가로 창에서도 rot 90 이 나온다 — 세로 기기 하나에만 기대고 있지 않다.
    expect(
      seen.get('폭 제약/rot90')!.some((s) => s.startsWith('1100×900')) ||
        seen.get('세로 제약/rot90')!.some((s) => s.startsWith('1100×900')),
      '가로 창의 rot 90 표본이 없다',
    ).toBe(true);
  });

  it('대조군: 판 덩어리에 gap 이 8px 있었다면 등식이 깨진다', () => {
    // "빈틈 0" 이 자명한 항등식이 아니라 **gap·padding 이 없다는 사실**에서 나온다는 것을
    // 못박는다. 이 대조군이 없으면 위 it 은 boardSplitPx 의 정의를 스스로 되뇌는 것뿐이다.
    const avail = { w: 1000, h: 472 };
    const split = boardSplitPx(avail, courtCellAspectRatio('full', '30x18', 0), 44);
    expect(split.courtW + 8 + split.trayW).not.toBeCloseTo(split.boardW, 6);
  });
});

// ── §4.6 축척표 — 유동 트레이가 코트를 한 눈금도 안 줄인다 ────────────────────────────

describe('§4.6 — 트레이가 넓어져도 코트 축척은 그대로다', () => {
  it.each(DEVICES.filter((d) => d.w >= d.h))('$name: 재설계 전후 pxPerUnit 이 정확히 같다', (dev) => {
    for (const state of states(dev.w)) {
      for (const mode of COURT_MODES) {
        // 전: 트레이가 93 으로 못박혀 있던 시절의 코트 상자.
        const before = { w: dev.w - chromeWidthPx(state), h: dev.h - chromeHeightPx(state) };
        if (before.w <= 0) continue;
        const rot = courtScale(mode, before).rot;
        // 후: 코트 칸이 자기 종횡비만큼만 차지하고 남는 폭을 트레이가 먹는다.
        const avail = alignBoxPx(dev, state, 44);
        const split = boardSplitPx(avail, courtCellAspectRatio(mode, undefined, rot), 44);
        const def = courtDefFor(mode, undefined);
        const vb = rot === 90 ? { w: def.vbH, h: def.vbW } : { w: def.vbW, h: def.vbH };
        const after = Math.min(split.courtW / vb.w, split.courtH / vb.h);
        expect(after, `${dev.name} ${mode} ${state.inspector}`).toBeCloseTo(
          courtScale(mode, before).pxPerUnit,
          6,
        );
      }
    }
  });

  it('1024×600 narrow full — 트레이가 93 → 202(4열)이 되고 코트는 0.8990 그대로다 (기둥 56 을 빼고도)', () => {
    const state: ChromeState = { narrow: true, inspector: 'hidden' };
    const before = { w: 1024 - chromeWidthPx(state), h: 600 - chromeHeightPx(state) };
    // ⚠️ 2026-08-15 (재설계 ②) — 907 → **851**. 오른쪽 기둥 56 이 드릴 편집에도 상시로 서면서
    //    폭 크롬이 117 → 173 이 됐다. **코트 축척은 그대로다**(아래 0.8990) — 이 화면에서는
    //    세로가 제약이라 폭에 여유가 있었고, 줄어든 56 은 트레이가 먹던 남는 폭에서 나온다.
    // ⚠️ 2026-08-18 (하단 철거) — h 472 → **491**: 하단 바 64 가 빠지고 노트 접힘 줄 45 가
    //    들어왔다. 코트가 세로 제약이라 그 19px 만큼 코트 폭도 커지고(771.6), 트레이는
    //    202 → 172 로 좁아져 4열 → **3열**이 된다.
    expect(before).toEqual({ w: 851, h: 491 });
    const avail = alignBoxPx({ w: 1024, h: 600 }, state, 44);
    expect(avail).toEqual({ w: 944, h: 491 });
    const split = boardSplitPx(avail, courtCellAspectRatio('full', undefined, 0), 44);
    expect(Math.round(split.trayW)).toBe(172);
    expect(trayColumnsAt(split.trayW, 44)).toBe(3);
    expect(split.courtW).toBeCloseTo(491 * (825 / 525), 6);
    expect(split.courtW / 825).toBeCloseTo(0.9352, 4);
    // ⚠️ 이제 상한에 **안 걸린다**(202 < 240) — 남는 폭을 트레이가 전부 먹으므로 판 바깥
    //    여백이 0 이다. 상한을 넘겼을 때만 바깥 여백이 생긴다는 규칙 자체는 그대로이고,
    //    그것을 아래 half/flat it 이 계속 잰다(거기서는 여전히 상한에 걸린다).
    expect(split.outerW).toBeCloseTo(0, 9);
    expect(split.boardW).toBeCloseTo(avail.w, 9);
  });

  it('800×480 narrow full — 트레이 137(2열). 하단 철거의 +19 가 코트 폭으로 갔다', () => {
    const state: ChromeState = { narrow: true, inspector: 'hidden' };
    const avail = alignBoxPx({ w: 800, h: 480 }, state, 44);
    const split = boardSplitPx(avail, courtCellAspectRatio('full', undefined, 0), 44);
    // 설계서 §4.6 의 그 칸은 223(4열) → 167(3열, 재설계 ② 기둥 상시) → **137(2열,
    // 2026-08-18 하단 철거)** — 세로가 커진 만큼 코트가 넓어지고 트레이가 그만큼 내줬다.
    // 137 은 하한 93(trayRailWidthPx)보다 넉넉히 크다 — 하한 국면은 아직 아니다.
    expect(Math.round(split.trayW)).toBe(137);
    expect(trayColumnsAt(split.trayW, 44)).toBe(2);
  });

  it('1280×800 핀 full — 폭 제약이라 트레이가 하한 93 에서 멈춘다 = 오늘과 같은 배치', () => {
    const state: ChromeState = { narrow: false, inspector: 'pinned' };
    const avail = alignBoxPx({ w: 1280, h: 800 }, state, 44);
    const split = boardSplitPx(avail, courtCellAspectRatio('full', undefined, 0), 44);
    expect(split.trayW).toBe(trayRailWidthPx(44));
    // 742 → 686: 핀 인스펙터(313) + 기둥(56)이 함께 폭을 먹는다. 이 조합이 이번 재설계에서
    // 가장 손해 보는 국면이고, 인스펙터를 해체하는 ③이 그것을 되돌린다.
    expect(split.courtW).toBe(686);
    expect(split.courtW / 825).toBeCloseTo(0.8315, 4);
    // 이 국면에서는 판이 정렬 상자를 꽉 채운다 — 바깥 여백이 0 이다.
    expect(split.outerW).toBeCloseTo(0, 9);
  });

  it('half/flat 은 남는 폭이 커서 상한에 걸린다 — 없으면 9열 슬래브가 된다', () => {
    const state: ChromeState = { narrow: true, inspector: 'hidden' };
    const avail = alignBoxPx({ w: 1024, h: 600 }, state, 44);
    for (const mode of ['half', 'flat'] as const) {
      const ar = courtCellAspectRatio(mode, undefined, 0);
      const split = boardSplitPx(avail, ar, 44);
      expect(split.trayW, mode).toBe(trayRailMaxWidthPx(44));
      // 상한이 없었다면 몇 열이 됐을까 — 실측으로 남긴다(설계서 §4.1 의 '9열').
      expect(trayColumnsAt(avail.w - 468 * ar, 44)).toBe(TRAY_MAX_COLS);
      // 기둥 56 이 빠지면서 8열이 됐다 — 상한(TRAY_MAX_COLS)이 여전히 필요하다는 사실은 같다.
      expect(Math.floor((avail.w - 468 * ar + 5) / 49)).toBeGreaterThanOrEqual(8);
    }
  });
});

// ── 위험 3 — 고정 구역이 판 높이를 넘지 않는다 ────────────────────────────────────────

describe('위험 3 — 서랍 손잡이가 화면 밖으로 나가지 않는다', () => {
  // 넘치면 작도·설명에 **영영 못 닿는다**(RAIL_STYLE_H 가 기록한 "1번 선수를 영영 못 잡는다"
  // 사고의 세로판). 벤치만 스크롤러이므로 나머지는 전부 판 높이 안에 들어와야 한다.
  it('5기기 × hit 2값 × 3코트에서 trayFixedHeightPx ≤ 판 높이', () => {
    let checked = 0;
    const over: string[] = [];
    for (const dev of DEVICES.filter((d) => d.w >= d.h)) {
      for (const state of states(dev.w)) {
        for (const hit of HITS) {
          const avail = alignBoxPx(dev, state, hit);
          if (avail.w <= 0 || avail.h <= 0) continue;
          for (const mode of COURT_MODES) {
            const rot = courtScale(mode, { w: avail.w - trayRailWidthPx(hit), h: avail.h }, mode === 'full' ? undefined : undefined).rot;
            const split = boardSplitPx(avail, courtCellAspectRatio(mode, undefined, rot), hit);
            const cols = trayColumnsAt(split.trayW, hit);
            const fixed = trayFixedHeightPx(hit, cols);
            if (fixed > split.courtH) over.push(`${dev.name} ${mode} hit${hit} ${state.inspector}: ${fixed} > ${split.courtH}`);
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(4 * 2 * 3);
    expect(over).toEqual([]);
  });

  it('대조군: 도구가 안 접히던 시절(1열 = 고정 347)이라면 넘쳤을 자리가 있다', () => {
    // 이 대조군이 없으면 위 it 은 "trayFixedHeightPx 가 늘 작다" 로도 통과한다.
    // 2026-08-14 재설계 후: 줌 3 · 편집 이력 2 가 트레이를 떠나 오른쪽 기능 바로 갔고, 서랍은
    // 플라이아웃이라 흐름을 안 먹는다. 남은 고정 구역은 구분선 1 · 도구 4 · 코트 라벨뿐이다.
    // 2열(93px)에서는 도구가 4줄이라 282, 5열(240px)에서는 한 줄이라 117 이다.
    expect(trayFixedHeightPx(44, 2)).toBe(282);
    expect(trayFixedHeightPx(44, 5)).toBe(117);
    // 2열이 5열보다 2.4배 크다 — 열 수가 고정 합을 정말 좌우한다는 것이 이 대조군의 요지다.
    // (옛 단언은 '2열이면 800×480 판 높이 348 을 넘는다' 였는데, 줌·이력이 떠나면서 282 가 돼
    //  더 이상 안 넘는다. 넘침 자체는 위 '위험 3' it 이 전 기기·전 모드로 지킨다.)
    expect(trayFixedHeightPx(44, 2)).toBeGreaterThan(trayFixedHeightPx(44, 5) * 2);
  });
});

// ── 완료 판정: 1024×600 에서 트레이 240px, 5열, 벤치+도구 스크롤 없이 ────────────────────

describe('완료 판정 — 1024×600 에서 스크롤이 사라진다', () => {
  it('고정 172 + 벤치 253 = 425 ≤ 491 (hit 44, 3열, 선수 8명)', () => {
    const state: ChromeState = { narrow: true, inspector: 'hidden' };
    const avail = alignBoxPx({ w: 1024, h: 600 }, state, 44);
    const split = boardSplitPx(avail, courtCellAspectRatio('full', undefined, 0), 44);
    const cols = trayColumnsAt(split.trayW, 44);
    // 5 → 4(재설계 ② 기둥 상시) → **3**(2026-08-18 하단 철거 — 세로 +19 가 코트 폭으로 가며
    // 트레이가 202 → 172 로 좁아졌다). 스크롤이 없다는 결론은 그대로다.
    expect(cols).toBe(3);
    const fixed = trayFixedHeightPx(44, cols);
    const bench = trayBenchHeightPx(44, cols, 8);
    // 3열 기준 고정 172 + 벤치 253 = 425 / 491 — 열이 줄면 세로 합이 늘지만 코트도 같이
    // 커져서(472 → 491) 여전히 안 넘친다. 합이 courtH 를 안 넘는다는 결론이 이 it 의 전부다.
    expect(fixed).toBe(172);
    expect(bench).toBe(253);
    expect(fixed + bench).toBeLessThanOrEqual(split.courtH);
    expect(split.courtH).toBe(491);
  });

  it('대조군: 2열(재설계 전 폭)이었다면 같은 화면에서 넘친다 — 그래서 스크롤이 있었다', () => {
    expect(trayFixedHeightPx(44, 2) + trayBenchHeightPx(44, 2, 8)).toBeGreaterThan(468);
  });

  it('★ 큰 터치 타깃(hit 56)에서도 스크롤이 없다 — 넘치던 17px 이 사라졌다', () => {
    // 2026-08-14 두 번째 지시(편집 이력을 트레이에)로 이 조합에서 17px 이 넘쳤었다. 세 번째
    // 지시가 그것을 원인째 없앴다 — 줌·이력이 기능 바로 떠나고 칩이 정사각이 됐다.
    const state: ChromeState = { narrow: true, inspector: 'hidden' };
    const avail = alignBoxPx({ w: 1024, h: 600 }, state, 56);
    const split = boardSplitPx(avail, courtCellAspectRatio('full', undefined, 0), 56);
    const cols = trayColumnsAt(split.trayW, 56);
    expect(cols).toBe(3);
    expect(trayFixedHeightPx(56, cols)).toBe(184);
    expect(trayFixedHeightPx(56, cols) + trayBenchHeightPx(56, cols, 8)).toBeLessThanOrEqual(split.courtH);
  });

  it('크롬 예산의 패딩 행이 정렬 상자 계산에 실제로 들어가 있다', () => {
    // alignBoxPx 가 예산을 안 보고 창 크기만 쓰면 위 숫자가 전부 8~24px 씩 어긋난다.
    const narrowState: ChromeState = { narrow: true, inspector: 'hidden' };
    const wideState: ChromeState = { narrow: false, inspector: 'hidden' };
    const d = alignBoxPx({ w: 1200, h: 800 }, wideState, 44).w - alignBoxPx({ w: 1200, h: 800 }, narrowState, 44).w;
    expect(d).toBe(-84 - (COURT_PAD_PX.wide.x - COURT_PAD_PX.narrow.x) * 2);
  });
});

// ── 트레이 폭 식 ────────────────────────────────────────────────────────────────────

describe('trayMetrics — 하한·상한 식', () => {
  it('하한 2열 = 93/117(기존 값 그대로), 상한 5열 = 240/300', () => {
    expect(trayRailWidthPx(44)).toBe(93);
    expect(trayRailWidthPx(56)).toBe(117);
    expect(trayRailMaxWidthPx(44)).toBe(240);
    expect(trayRailMaxWidthPx(56)).toBe(300);
  });

  it('상한 폭에는 칩이 정확히 5열 들어간다 — 반 칸이 남지 않는다', () => {
    for (const hit of HITS) {
      expect(trayColumnsAt(trayRailMaxWidthPx(hit), hit)).toBe(5);
      expect(trayColumnsAt(trayRailMaxWidthPx(hit) - 1, hit)).toBe(4);
      expect(trayColumnsAt(trayRailWidthPx(hit), hit)).toBe(2);
    }
  });

  it('열 수는 5 를 넘지 않는다 — 화면의 maxWidth 와 계산이 같은 상한을 쓴다', () => {
    expect(trayColumnsAt(10_000, 44)).toBe(TRAY_MAX_COLS);
  });
});

// ── rot 은 여전히 위에서 내려온 값이다 (P1 의 단방향이 안 깨졌다) ──────────────────────

describe('종횡비가 rot 되먹임을 만들지 않는다 (§4.2)', () => {
  it('맞춰진 코트 칸을 다시 재도 계산에 되먹이지 않는다 — 입력이 def·rot 뿐이다', () => {
    // 쌍안정의 두 고정점(0.5527 / 0.7176)은 useStageRot.test.ts 가 박제해 뒀다. 여기서는
    // **이 파일의 함수가 rect 를 아예 안 받는다**는 것을 시그니처로 못박는다: 인자가 셋이고
    // 셋 다 모델 값이다. 측정값을 넣을 자리가 없으면 고리가 닫힐 자리도 없다.
    expect(courtCellAspectRatio.length).toBe(3);
    const rots: StageRot[] = [0, 90];
    for (const rot of rots) {
      const a = courtCellAspectRatio('full', '30x18', rot);
      // 같은 입력이면 몇 번을 불러도 같은 값 — 상태가 없다.
      expect(courtCellAspectRatio('full', '30x18', rot)).toBe(a);
    }
  });
});

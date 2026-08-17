// §4.2 P1 — `rot` 을 위에서 내려보낸다. **화면 변화 0** 인 단계라 눈으로는 아무것도 안 보인다:
// 이 파일이 "무엇이 달라졌는지" 를 대신 말하는 자리다.
//
// 네 가지를 잰다.
//   ① 전수 일치 — 5기기 × 3모드 × 3크기 × narrow/wide × 인스펙터 3모드에서 `courtScale(...).rot` 과 같다.
//   ② ★ 쌍안정 회귀 — **통과가 목적이 아니다.** 왜 재는 곳을 뒤집었는지를 숫자로 박제한다.
//   ③ 소스 계약 — 프로덕션에서 `rotForFit` 을 부르는 곳이 예산 모듈 하나뿐이다.
//   ④ 구독 — matchMedia 경로를 스텁으로 실제로 **실행시켜** 문턱에서만 다시 계산하는지 본다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { courtBoxPx, courtScale } from './chromeBudget.ts';
import type { ChromeState, Size } from './chromeBudget.ts';
import { stageRotFor, stageRotHoldBox, stageRotHoldQuery, useStageRot, viewportSizePx } from './useStageRot.ts';
import { COURT_DEFS, COURT_MODES, COURT_SIZES, courtDefFor } from '../model/court.ts';
import type { CourtMode, CourtSize } from '../model/court.ts';
import type { InspectorMode } from '../features/editor/inspectorLayout.ts';
import { computeMetrics, rotForFit } from '../render/useStageMetrics.ts';
import type { StageRot } from '../render/useStageMetrics.ts';

const read = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf-8');

/** 주석 줄을 걷어낸 **실행되는 코드**만 남긴다. 이 파일의 소스 계약이 노리는 것은 "무엇을
 *  부르는가" 이지 "무엇을 적어 뒀는가" 가 아니다 — 주석까지 금지하면 *왜 뒤집었는지*를 기록할
 *  수 없게 되고(주석 규율과 정면 충돌), 뒤집힌 옛 결정을 지우도록 압력을 준다. */
function codeOf(src: string): string {
  return src
    .split('\n')
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
}

/** §5.3 실측표의 기기 5종. 마지막 하나가 이번 재설계의 주 표적이자 **유일하게 판이 도는** 자리다. */
const DEVICES: readonly (Size & { name: string })[] = [
  { name: '1024×600', w: 1024, h: 600 },
  { name: '800×480 (7인치)', w: 800, h: 480 },
  { name: '1280×800', w: 1280, h: 800 },
  { name: '1920×1080', w: 1920, h: 1080 },
  { name: '480×800 (7인치 세로)', w: 480, h: 800 },
];
const INSPECTORS: readonly InspectorMode[] = ['hidden', 'overlay', 'pinned'];

interface Case {
  label: string;
  mode: CourtMode;
  size: CourtSize;
  state: ChromeState;
  viewport: Size;
}

/** 5 × 3 × 3 × 2 × 3 = 270 칸. */
const MATRIX: readonly Case[] = DEVICES.flatMap((d) =>
  COURT_MODES.flatMap((mode) =>
    COURT_SIZES.flatMap((size) =>
      [true, false].flatMap((narrow) =>
        INSPECTORS.map((inspector) => ({
          label: `${d.name} ${mode} ${size} narrow=${narrow} ins=${inspector}`,
          mode,
          size,
          state: { narrow, inspector } as ChromeState,
          viewport: { w: d.w, h: d.h },
        })),
      ),
    ),
  ),
);

describe('① 전수 일치 — 예산표가 말하는 회전과 화면이 쓰는 회전이 같다', () => {
  it('270칸 전부에서 courtScale(...).rot 과 같다', () => {
    expect(MATRIX).toHaveLength(270);
    for (const c of MATRIX) {
      const want = courtScale(c.mode, courtBoxPx(c.viewport, c.state), c.size).rot;
      expect(stageRotFor(c.mode, c.size, c.state, c.viewport), c.label).toBe(want);
    }
  });

  it('대조군 — 그 270칸 안에 0 과 90 이 **둘 다** 있다', () => {
    // 이 대조군이 없으면 위 단언은 "전부 0" 인 표에서도 통과한다. 그러면 회전을 아예 잃어도
    // 초록불이다 — 5차 검증관이 '시연 화면만 팀 구분을 잃은 채 2233 전건 초록' 을 만난 형태다.
    const seen = new Set(MATRIX.map((c) => stageRotFor(c.mode, c.size, c.state, c.viewport)));
    expect([...seen].sort()).toEqual([0, 90]);
  });

  it('7인치 세로 480×800 에서는 세 코트가 모두 돈다 — 재설계의 주 표적', () => {
    const st: ChromeState = { narrow: true, inspector: 'hidden' };
    for (const mode of COURT_MODES) expect(stageRotFor(mode, '30x18', st, { w: 480, h: 800 }), mode).toBe(90);
    // 같은 기기를 눕히면 안 돈다(=회전이 창 모양을 실제로 보고 있다).
    for (const mode of COURT_MODES) expect(stageRotFor(mode, '30x18', st, { w: 800, h: 480 }), mode).toBe(0);
  });

  it('인스펙터가 폭을 먹으면 판단이 달라진다 — 창만 보는 판정이 아니다', () => {
    // 옛 코드가 svg rect 를 잰 이유가 이것이었다("인스펙터가 옆에 있느냐 아래로 갔느냐").
    // 그 이유는 지금도 살아 있고, 답은 크롬 예산에서 나온다.
    const v = { w: 800, h: 480 };
    const wide = (inspector: InspectorMode): StageRot => stageRotFor('full', '30x18', { narrow: false, inspector }, v);
    expect(wide('overlay')).toBe(0);
    expect(wide('pinned')).toBe(90); // 313 을 떼어 주면 남는 상자가 262×314 라 세로로 길다
  });

  it('DOM 을 한 번도 안 잰다 — 소스에 측정 API 가 없다', () => {
    const code = codeOf(read('src/app/useStageRot.ts'));
    expect(code, '하네스 검산 — 주석만 남기고 다 지운 게 아니다').toContain('window.matchMedia');
    for (const forbidden of ['getBoundingClientRect', 'ResizeObserver', 'clientWidth', 'offsetWidth']) {
      expect(code, `${forbidden} 이 들어오면 되먹임 고리가 다시 열린다`).not.toContain(forbidden);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────────────────────
// ② ★ 쌍안정. **통과가 목적이 아니라 "왜 분리했는지를 코드로 남기는 것" 이 목적이다.**
//
// P3 는 코트 칸을 `rot` 이 정한 종횡비로 맞춘다. 그러면 맞춰진 rect 가 rot 의 함수가 되고,
// 그 rect 로 rot 을 다시 정하면 고리가 닫힌다. 아래가 보이는 것은 그 고리에 고정점이 **둘**
// 이라는 사실이다 — 0 도 90 도 자기모순이 없다. 그래서 "재보고 맞으면 된다" 는 검사로는
// 틀린 쪽에 앉아 있는지 영영 알 수 없고, 창을 줄인 순서에 따라 축척이 23% 갈리며 재현이 안 된다.
// jsdom 은 레이아웃을 계산하지 않아 이 사고는 단위 테스트로 **절대** 안 잡힌다. 그래서 여기서는
// 레이아웃을 흉내내지 않고 **산수로** 박제한다.
// ────────────────────────────────────────────────────────────────────────────────────────────

/** 가용 상자 안에 종횡비 AR 로 맞춰진 코트 칸의 rect(P3 의 `aspect-ratio` 칸이 하는 일). */
function fittedCourtCell(rot: StageRot, avail: Size): { width: number; height: number } {
  const def = COURT_DEFS.full;
  // ⚠️ AR 은 `view` 가 아니라 **`def`** 에서 뽑는다(§4.1 함정 3) — view 를 쓰면 줌이 칸 크기를
  //    흔들어 §3 불변식 1(표적이 안 움직인다)을 정면으로 위반한다.
  const ar = rot === 90 ? def.vbH / def.vbW : def.vbW / def.vbH;
  const width = Math.min(avail.w, avail.h * ar);
  return { width, height: width / ar };
}

describe('② 쌍안정 — 0 과 90 이 **둘 다** 고정점이다 (§4.2)', () => {
  /** 7인치 세로에서 판 덩어리가 쓸 수 있는 가용 상자(§4.7 표 첫 행). */
  const AVAIL: Size = { w: 456, h: 592 };
  const view = { x: 0, y: 0, w: COURT_DEFS.full.vbW, h: COURT_DEFS.full.vbH };

  it('rot 0 을 가정하면 456.0×290.2 가 되고, 그 rect 는 다시 0 을 낳는다 (px/u 0.5527)', () => {
    const rect = fittedCourtCell(0, AVAIL);
    expect(rect.width).toBeCloseTo(456.0, 1);
    expect(rect.height).toBeCloseTo(290.2, 1);
    expect(computeMetrics(rect as DOMRect, view, 0).pxPerUnit).toBeCloseTo(0.5527, 4);
    expect(rotForFit(rect, view), '가정이 자기를 재생산한다 = 고정점').toBe(0);
  });

  it('rot 90 을 가정하면 376.7×592.0 이 되고, 그 rect 는 다시 90 을 낳는다 (px/u 0.7176)', () => {
    const rect = fittedCourtCell(90, AVAIL);
    expect(rect.width).toBeCloseTo(376.7, 1);
    expect(rect.height).toBeCloseTo(592.0, 1);
    expect(computeMetrics(rect as DOMRect, view, 90).pxPerUnit).toBeCloseTo(0.7176, 4);
    expect(rotForFit(rect, view), '이쪽도 자기를 재생산한다 = 또 하나의 고정점').toBe(90);
  });

  it('두 고정점의 축척 차이가 23% 다 — 창을 줄인 순서에 따라 갈리던 값이다', () => {
    const flat = computeMetrics(fittedCourtCell(0, AVAIL) as DOMRect, view, 0).pxPerUnit;
    const turned = computeMetrics(fittedCourtCell(90, AVAIL) as DOMRect, view, 90).pxPerUnit;
    expect((turned / flat - 1) * 100).toBeCloseTo(29.8, 1); // 작은 쪽에서 보면 +29.8%
    expect((1 - flat / turned) * 100).toBeCloseTo(23.0, 1); // 큰 쪽에서 보면 −23.0%
  });

  it('하프 코트도 같다 — 0.8686 vs 1.0133', () => {
    const half = { x: 0, y: 0, w: COURT_DEFS.half.vbW, h: COURT_DEFS.half.vbH };
    const arFlat = COURT_DEFS.half.vbW / COURT_DEFS.half.vbH;
    const arTurned = COURT_DEFS.half.vbH / COURT_DEFS.half.vbW;
    const fit = (ar: number): { width: number; height: number } => {
      const width = Math.min(AVAIL.w, AVAIL.h * ar);
      return { width, height: width / ar };
    };
    expect(computeMetrics(fit(arFlat) as DOMRect, half, 0).pxPerUnit).toBeCloseTo(0.8686, 4);
    expect(computeMetrics(fit(arTurned) as DOMRect, half, 90).pxPerUnit).toBeCloseTo(1.0133, 4);
    expect(rotForFit(fit(arFlat), half)).toBe(0);
    expect(rotForFit(fit(arTurned), half)).toBe(90);
  });

  it('★ 위에서 내려보내면 답이 하나다 — 480×800 에서 90 이고, rect 를 아예 안 본다', () => {
    // 고리를 끊은 결과가 이것이다: 입력이 창 크기뿐이라 "어떤 순서로 줄였는가" 가 답에
    // 들어올 자리가 없다. 두 고정점 중 **큰 쪽(0.7176)** 이 정답이라는 것도 여기서 정해진다.
    expect(stageRotFor('full', '30x18', { narrow: true, inspector: 'hidden' }, { w: 480, h: 800 })).toBe(90);
    expect(courtScale('full', AVAIL).rot, 'AVAIL 자체로 물어봐도 90 이다').toBe(90);
  });
});

// ────────────────────────────────────────────────────────────────────────────────────────────
// ③ 소스 계약 — 화면 경로가 실측 rect 로 회전을 정하지 않는다.
// ────────────────────────────────────────────────────────────────────────────────────────────

function productionFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) {
      productionFiles(p, out);
      continue;
    }
    if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
    if (p.includes(`${'/'}src${'/'}test${'/'}`)) continue; // 테스트 하네스
    out.push(p);
  }
  return out;
}

describe('③ 소스 계약 — rotForFit 을 부르는 프로덕션 자리는 예산 모듈 하나뿐이다', () => {
  const files = productionFiles(resolve(process.cwd(), 'src'));

  it('하네스가 살아 있다 — 파일을 실제로 훑었고 정의 자리를 찾아냈다', () => {
    // "0건이었다" 는 아무 파일도 못 읽었을 때도 통과한다. 먼저 계기를 검산한다.
    expect(files.length).toBeGreaterThan(120);
    expect(files.some((p) => p.endsWith('src/render/useStageMetrics.ts'))).toBe(true);
    expect(files.some((p) => p.endsWith('src/app/chromeBudget.ts'))).toBe(true);
    expect(read('src/render/useStageMetrics.ts')).toContain('export function rotForFit(');
  });

  it('호출자는 chromeBudget.courtScale 뿐이다', () => {
    const callers: string[] = [];
    for (const p of files) {
      for (const line of codeOf(readFileSync(p, 'utf-8')).split('\n')) {
        if (!/rotForFit\s*\(/.test(line)) continue;
        if (line.includes('export function rotForFit(')) continue; // 정의 자리
        callers.push(`${p.slice(p.indexOf('src/'))}: ${line.trim()}`);
      }
    }
    expect(callers).toHaveLength(1);
    expect(callers[0]).toContain('src/app/chromeBudget.ts');
  });

  it('무대·워크스페이스는 실측 rect 로 회전을 정하지 않는다', () => {
    for (const f of [
      'src/render/CourtStage.tsx',
      'src/render/useStageMetrics.ts',
      'src/features/editor/EditorStage.tsx',
      'src/features/editor/EditorWorkspace.tsx',
    ]) {
      const code = codeOf(read(f));
      expect(code.split('\n').filter((l) => /rotForFit\s*\(/.test(l) && !l.includes('export function')), f).toEqual([]);
    }
    // 하네스 검산 — 같은 방식으로 훑으면 예산 모듈에서는 **잡힌다**.
    expect(codeOf(read('src/app/chromeBudget.ts')).split('\n').filter((l) => /rotForFit\s*\(/.test(l))).toHaveLength(1);
  });

  it('rot 은 prop 으로 흐른다 — 사슬의 세 마디가 소스에 있다', () => {
    // tsc 가 필수 prop 으로 이미 지키지만(세 마디 중 하나만 끊어도 컴파일이 안 된다),
    // vitest 만 도는 반증 실험에서도 빨간불이 나야 한다.
    const ws = readFileSync(resolve(process.cwd(), 'src/features/editor/EditorWorkspace.tsx'), 'utf-8');
    expect(ws).toContain('useStageRot(drill.courtMode, drill.courtSize,');
    expect(ws).toContain('rot={stageRot}');
    const stage = readFileSync(resolve(process.cwd(), 'src/features/editor/EditorStage.tsx'), 'utf-8');
    expect(stage).toContain('rot={rot}');
    const court = readFileSync(resolve(process.cwd(), 'src/render/CourtStage.tsx'), 'utf-8');
    expect(court).toContain('rotRef.current = rot;');
  });
});

// ────────────────────────────────────────────────────────────────────────────────────────────
// ④ 구독 — matchMedia 로 **문턱에서만** 다시 계산한다(useIsNarrow.ts:11-13 과 같은 규율).
// ────────────────────────────────────────────────────────────────────────────────────────────

describe('④ rot 불변 상자 — 이 안에 있는 동안은 답이 안 바뀐다', () => {
  it('상자가 지금 창을 담고 있다 (담지 못하면 질의가 처음부터 거짓이라 회전이 굳는다)', () => {
    for (const c of MATRIX) {
      const b = stageRotHoldBox(c.mode, c.size, c.state, c.viewport);
      expect(b.minW, c.label).toBeLessThanOrEqual(c.viewport.w);
      expect(b.maxW, c.label).toBeGreaterThanOrEqual(c.viewport.w);
      expect(b.minH, c.label).toBeLessThanOrEqual(c.viewport.h);
      expect(b.maxH, c.label).toBeGreaterThanOrEqual(c.viewport.h);
    }
  });

  it('상자 **안쪽 격자**의 모든 점이 같은 답을 준다 — 꼭짓점 논증의 반증 장치', () => {
    // 구현은 네 꼭짓점만 검산한다(상자 안에서 판정이 볼록하다는 논증). 그 논증이 틀리면
    // 안쪽에 다른 답의 섬이 생긴다 — 실제로 `m` 상한을 풀면 그런 섬이 생긴다(useStageRot.ts 주석).
    // 여기서는 논증을 믿지 않고 9×9 로 훑는다.
    const N = 8;
    for (const c of MATRIX) {
      const here = stageRotFor(c.mode, c.size, c.state, c.viewport);
      const b = stageRotHoldBox(c.mode, c.size, c.state, c.viewport);
      for (let i = 0; i <= N; i++) {
        for (let j = 0; j <= N; j++) {
          const w = b.minW + ((b.maxW - b.minW) * i) / N;
          const h = b.minH + ((b.maxH - b.minH) * j) / N;
          expect(stageRotFor(c.mode, c.size, c.state, { w, h }), `${c.label} @ ${w}×${h}`).toBe(here);
        }
      }
    }
  });

  it('상자는 문턱 근처에서만 좁다 — 1024×768 에서 ±75px 이다(resize 마다 다시 재지 않는다)', () => {
    // 이 숫자가 1 로 주저앉으면 사실상 resize 리스너가 되어 규율이 사라진다.
    const b = stageRotHoldBox('full', '30x18', { narrow: false, inspector: 'hidden' }, { w: 1024, h: 768 });
    // ⚠️ 2026-08-15 (재설계 ②) — 상자가 좁아졌다: 폭 ±75 → **±41**(983…1065). 기둥 56 이
    //    폭 예산에 들어오면서 같은 창에서 코트 상자가 문턱에 더 가까워졌기 때문이다.
    //    세로도 ±75 → ±41 로 같이 좁아졌다. 이 숫자가 1 로 주저앉으면 규율이 사라지지만,
    //    41 은 아직 resize 리스너와 거리가 멀다.
    // ⚠️ 2026-08-18 (하단 철거) — 세로 크롬이 19px 줄며(하단 바 64 → 노트 접힘 줄 45) 경계
    //    전부가 1px 안팎으로 밀렸다(982…1066 / 726…810). 폭·높이 반경 ±42 는 그대로다.
    expect(b).toEqual({ minW: 982, maxW: 1066, minH: 726, maxH: 810 });
    expect(stageRotHoldQuery(b)).toBe('(min-width: 982px) and (max-width: 1066px) and (min-height: 726px) and (max-height: 810px)');
  });

  it('상한 있는 좁히기다 — 코트 상자가 0 인 구석에서도 끝난다(행으로 죽지 않는다)', () => {
    const b = stageRotHoldBox('full', '30x18', { narrow: false, inspector: 'pinned' }, { w: 480, h: 800 });
    expect(b.maxW - b.minW).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(b.minW + b.maxW + b.minH + b.maxH)).toBe(true);
  });
});

/** matchMedia 스텁. jsdom 에 없으므로 안 깔면 구독 경로가 **한 줄도 실행되지 않은 채** 초록불이
 *  된다(narrow.test.tsx 의 stubMedia 와 같은 이유). 질의 문자열과 리스너를 그대로 들고 있다가
 *  테스트가 직접 발화시킨다. */
function stubMatchMedia() {
  const armed: { query: string; fire: () => void }[] = [];
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const listeners = new Set<() => void>();
      return {
        media: query,
        matches: false, // ⚠️ 훅은 이 값을 **읽지 않는다** — 답은 언제나 창 크기에서 다시 계산한다
        addEventListener: (_t: string, fn: () => void) => {
          listeners.add(fn);
          armed.push({ query, fire: () => listeners.forEach((f) => f()) });
        },
        removeEventListener: (_t: string, fn: () => void) => listeners.delete(fn),
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      };
    },
  });
  return armed;
}

function setViewport(w: number, h: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: h });
}

const ORIGINAL_VIEWPORT: Size = { w: window.innerWidth, h: window.innerHeight };

afterEach(() => {
  setViewport(ORIGINAL_VIEWPORT.w, ORIGINAL_VIEWPORT.h);
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  vi.restoreAllMocks();
});

describe('④ useStageRot — 창 크기를 구독한다', () => {
  const state: ChromeState = { narrow: true, inspector: 'hidden' };

  it('viewportSizePx 가 창을 읽는다 (계기 검산)', () => {
    setViewport(480, 800);
    expect(viewportSizePx()).toEqual({ w: 480, h: 800 });
  });

  it('마운트 시점의 창으로 답한다 — matchMedia 가 없어도 (jsdom 기본)', () => {
    setViewport(480, 800);
    expect(renderHook(() => useStageRot('full', '30x18', state)).result.current).toBe(90);
    setViewport(1024, 600);
    expect(renderHook(() => useStageRot('full', '30x18', state)).result.current).toBe(0);
  });

  it('matchMedia 로 rot 불변 상자를 건다 — resize 가 아니라 문턱이다', () => {
    const armed = stubMatchMedia();
    setViewport(1024, 600);
    renderHook(() => useStageRot('full', '30x18', state));
    expect(armed).toHaveLength(1);
    expect(armed[0]!.query).toBe(
      stageRotHoldQuery(stageRotHoldBox('full', '30x18', state, { w: 1024, h: 600 })),
    );
    expect(armed[0]!.query).toMatch(/^\(min-width: \d+px\) and \(max-width: \d+px\) and \(min-height: \d+px\) and \(max-height: \d+px\)$/);
  });

  it('상자를 벗어나면 다시 재고 다시 건다 — 회전이 실제로 뒤집힌다', () => {
    const armed = stubMatchMedia();
    setViewport(1024, 600);
    const { result } = renderHook(() => useStageRot('full', '30x18', state));
    expect(result.current).toBe(0);

    setViewport(480, 800); // 태블릿을 세웠다
    act(() => armed[0]!.fire());
    expect(result.current).toBe(90);
    expect(armed.length, '새 자리에 상자를 다시 걸었다').toBe(2);
  });

  it('대조군 — 발화가 없으면 값도 안 바뀐다(스텁이 답을 대신 말해 주는 게 아니다)', () => {
    stubMatchMedia();
    setViewport(1024, 600);
    const { result } = renderHook(() => useStageRot('full', '30x18', state));
    setViewport(480, 800);
    expect(result.current).toBe(0);
  });

  it('상자 안에서 발화해도 리렌더가 늘지 않는다 — 값이 정말 뒤집힐 때만 상태를 건드린다', () => {
    const armed = stubMatchMedia();
    setViewport(1024, 600);
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useStageRot('full', '30x18', state);
    });
    const before = renders;
    setViewport(1030, 604); // 같은 상자 안 — 답이 그대로다
    act(() => armed[0]!.fire());
    expect(result.current).toBe(0);
    expect(renders, '같은 값이면 React 가 리렌더를 생략한다').toBe(before);
  });

  it('코트 종류가 바뀌면 다시 건다 — 종횡비가 판정의 한 축이다', () => {
    const armed = stubMatchMedia();
    setViewport(800, 480);
    const { rerender, result } = renderHook(({ mode }: { mode: CourtMode }) => useStageRot(mode, '30x18', { narrow: false, inspector: 'pinned' }), {
      initialProps: { mode: 'full' as CourtMode },
    });
    expect(result.current).toBe(90);
    expect(armed).toHaveLength(1);
    rerender({ mode: 'flat' });
    expect(armed.length).toBeGreaterThan(1);
    expect(result.current).toBe(courtScale('flat', courtBoxPx({ w: 800, h: 480 }, { narrow: false, inspector: 'pinned' }), '30x18').rot);
  });

  it('언마운트하면 구독을 끊는다', () => {
    const armed = stubMatchMedia();
    setViewport(1024, 600);
    const { unmount } = renderHook(() => useStageRot('full', '30x18', state));
    unmount();
    setViewport(480, 800);
    act(() => armed[0]!.fire()); // 끊긴 리스너 — 남아 있으면 setState 경고가 난다
    expect(armed).toHaveLength(1);
  });
});

describe('회전 규칙은 이 파일에 없다 — courtScale 에서 빌려 온다', () => {
  it('ROTATE_GAIN(1.08)도 종횡비 비교도 소스에 없다', () => {
    // 규칙을 두 곳에 적으면 화면은 1.08 로 돌고 예산표는 안 도는 순간이 생긴다
    // (chromeBudget.ts:221 이 rotForFit 을 빌려 쓰는 것과 같은 이유).
    const code = codeOf(read('src/app/useStageRot.ts'));
    expect(code).not.toContain('1.08');
    expect(code).toContain('courtScale(');
  });

  it('코트 정의도 courtDefFor 를 지난다 — 좌표 리터럴이 없다', () => {
    // 25 px = 1 m 의 유일한 출처는 COURT_DEFS / courtDefFor 다.
    expect(courtDefFor('full', '30x18').vbW).toBe(COURT_DEFS.full.vbW);
    const code = codeOf(read('src/app/useStageRot.ts'));
    for (const literal of ['825', '525', '450', '700']) expect(code, literal).not.toContain(literal);
  });
});

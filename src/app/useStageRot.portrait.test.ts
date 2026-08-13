// 2026-08-14 P5 — **세로 배치가 `rot` 까지 흐르는가.**
//
// ── 왜 이 파일이 P5 에서 생겼나 ──────────────────────────────────────────────────────
// `useStageRot`(P1)은 크롬 예산에서 `rot` 을 뽑는다. 그런데 예산의 `ChromeState` 에는 P4 까지
// **세로 축이 없었고**(P1·P2·P3 가 세 번 보고한 구멍), 그래서 세로 화면에서는 폭에서 트레이 93 을
// 잘못 빼고 높이에서 띠를 안 빼는 상자로 회전을 정하고 있었다.
//
// P4 까지는 그 오차가 `rot` 을 **뒤집지 못했다** — 띠가 76 이라 틀린 상자와 옳은 상자가 같은
// 답을 냈다. 띠가 76 → 132 로 커지는 순간 그 우연이 끝난다. 아래 첫 it 이 그 자리를 박제한다:
// **768×1024 아이패드 세로에서 옳은 답은 0 인데 배선이 없으면 90 이 나온다.**
//
// 그래서 P5 는 자기 파일 밖 두 줄을 함께 고쳤다(EditorWorkspace 의 호출 인자 하나, useStageRot 의
// 상태 사본 하나). 그 두 줄이 다시 빠지는 것을 여기서 **행동으로**(EditorWorkspace.portrait.test)
// 와 **소스로**(아래 마지막 절) 두 겹으로 막는다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { courtBoxPx, courtScale } from './chromeBudget.ts';
import type { ChromeState, Size } from './chromeBudget.ts';
import { stageRotFor } from './useStageRot.ts';
import { trayBand1RowHeightPx, trayBandHeightPx } from '../features/editor/trayMetrics.ts';
import { INTERACT } from '../core/constants.ts';

const read = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf-8');

const wired = (narrow: boolean): ChromeState => ({ narrow, inspector: 'hidden', portrait: true });
const unwired = (narrow: boolean): ChromeState => ({ narrow, inspector: 'hidden' });

const rotAt = (v: Size, state: ChromeState) => stageRotFor('full', undefined, state, v);

describe('세로 배치를 예산에 넘기지 않으면 판이 엉뚱하게 돈다', () => {
  it('★ 768×1024 아이패드 세로 — 옳은 답은 0, 안 넘기면 90', () => {
    const v: Size = { w: 768, h: 1024 };
    expect(rotAt(v, wired(true))).toBe(0);
    expect(rotAt(v, unwired(true))).toBe(90);
    // 근거를 숫자로 남긴다. 옳은 상자는 744×760 — 돌려 봐야 0.921 vs 0.902 로 2% 밖에 안 커져
    // ROTATE_GAIN(8%)에 한참 못 미친다. 틀린 상자 651×892 는 세로로 길어 8%를 넘겨 버린다.
    expect(courtBoxPx(v, wired(true))).toEqual({ w: 744, h: 760 });
    expect(courtBoxPx(v, unwired(true))).toEqual({ w: 651, h: 892 });
    expect(courtScale('full', courtBoxPx(v, wired(true))).pxPerUnit).toBeCloseTo(0.9018, 4);
  });

  it('띠가 76 이던 시절에는 같은 기기에서 **안 갈렸다** — 이 갈림을 만든 것이 P5 다', () => {
    // 옳은 상자의 높이만 옛 띠로 되돌린다(폭은 세로 배치라 그대로다).
    const old: Size = { w: 744, h: 1024 - 52 - 64 - 16 - trayBand1RowHeightPx(INTERACT.hitTargetCssPx) };
    expect(old).toEqual({ w: 744, h: 816 });
    expect(courtScale('full', old).rot).toBe(90);
    // 그래서 P4 까지는 배선 없이도 답이 맞아떨어졌다 — **우연이었지 옳아서가 아니다.**
    expect(courtScale('full', old).rot).toBe(rotAt({ w: 768, h: 1024 }, unwired(true)));
  });

  it('⚠️ 480×800(설계서가 든 기기)만 보면 **못 잡는다** — 거기서는 둘 다 90 이다', () => {
    // "어느 축을 안 찔렀나" 의 표본이다. 주 표적 하나만 확인하고 넘어가면 이 결함은 초록인 채
    // 아이패드 세로에서만 판이 눕는다(5차 검증의 '시연 화면만 빠졌다' 와 같은 형태).
    const v: Size = { w: 480, h: 800 };
    expect(rotAt(v, wired(true))).toBe(90);
    expect(rotAt(v, unwired(true))).toBe(90);
  });

  it('현실 세로 창 전수 — 3분의 1이 갈린다(상한 있는 루프)', () => {
    let n = 0;
    let differ = 0;
    for (const mode of ['full', 'half', 'flat'] as const) {
      for (let w = 320; w <= 1024; w += 8) {
        for (let h = w + 8; h <= Math.min(1600, Math.round(w * 2.2)); h += 8) {
          const narrow = w < 1100;
          n += 1;
          if (
            stageRotFor(mode, undefined, wired(narrow), { w, h }) !==
            stageRotFor(mode, undefined, unwired(narrow), { w, h })
          ) {
            differ += 1;
          }
        }
      }
    }
    expect(n).toBe(22191);
    expect(differ / n).toBeGreaterThan(0.3);
    expect(differ / n).toBeLessThan(0.4);
  });

  it('대조군 — **가로** 창에서는 두 상태가 한 칸도 안 갈린다(P4 까지가 안 깨졌다는 증거)', () => {
    for (const [w, h] of [
      [1024, 600],
      [800, 480],
      [1280, 800],
      [1920, 1080],
      [1100, 900],
    ] as const) {
      for (const inspector of ['hidden', 'overlay', 'pinned'] as const) {
        const land: ChromeState = { narrow: w < 1100, inspector };
        expect(stageRotFor('full', undefined, land, { w, h }), `${w}x${h} ${inspector}`).toBe(
          stageRotFor('full', undefined, { ...land, portrait: false }, { w, h }),
        );
      }
    }
  });
});

describe('세로 상자에서 띠가 실제로 빠진다', () => {
  it('세로 상자 높이 = 창 − (헤더 52 + 하단 바 64 + 패딩 16 + 띠 132)', () => {
    const box = courtBoxPx({ w: 480, h: 800 }, wired(true));
    expect(box.h).toBe(800 - 52 - 64 - 16 - trayBandHeightPx(INTERACT.hitTargetCssPx));
    expect(box.h).toBe(536);
    // 폭에서는 트레이가 **한 픽셀도** 안 빠진다 — 세로에서 트레이는 폭을 안 먹는다.
    expect(box.w).toBe(480 - 24);
  });

  it('붙박이 인스펙터를 켜도 띠는 그대로 높이를 먹는다 — 두 축이 서로 독립이다', () => {
    // 세로 + 핀은 실재하는 국면이다(EditorWorkspace 는 그때 판과 인스펙터를 가로로 나눈다).
    const box = courtBoxPx({ w: 1200, h: 1600 }, { narrow: false, inspector: 'pinned', portrait: true });
    expect(box).toEqual({ w: 1200 - 84 - 313 - 48, h: 1600 - 62 - 64 - 40 - 132 });
    expect(box).toEqual({ w: 755, h: 1302 });
  });
});

// 행동 검사(EditorWorkspace.portrait.test.tsx)가 본체이고, 아래는 **그 두 줄이 어디에 있어야
// 하는지를 사람에게 알려 주는** 두 번째 겹이다. 리터럴 코드 조각이라 주석에 우연히 걸리지 않는다.
describe('소스 계약 — 배선 두 줄이 제자리에 있다', () => {
  it('EditorWorkspace 가 useStageRot 에 portrait 를 넘긴다', () => {
    expect(read('src/features/editor/EditorWorkspace.tsx')).toContain(
      'useStageRot(drill.courtMode, drill.courtSize, { narrow, portrait, inspector: inspectorLayout })',
    );
  });

  it('useStageRot 의 이펙트 사본(here)과 deps 가 둘 다 portrait 를 안다', () => {
    const src = read('src/app/useStageRot.ts');
    expect(src).toContain('const { narrow, portrait, inspector } = state;');
    // 초기 useState 는 state 통째로 쓰는데 이펙트만 portrait 를 모르면 **첫 렌더와 그 다음이
    // 다른 답**을 낸다 — 창을 건드리지도 않았는데 판이 도는 증상이다.
    expect(src).toContain('const here: ChromeState = { narrow, portrait, inspector,');
    expect(src).toContain('[mode, size, narrow, portrait, inspector, saTop, saRight, saBottom, saLeft]');
  });
});

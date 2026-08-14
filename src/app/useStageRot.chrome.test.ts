// **배치 축과 화면이 `rot` 까지 흐르는가.**
//
// ── 왜 이 파일이 P5 에서 생겼나 ──────────────────────────────────────────────────────
// `useStageRot`(P1)은 크롬 예산에서 `rot` 을 뽑는다. 그런데 예산의 `ChromeState` 에는 P4 까지
// **세로 축이 없었고**(P1·P2·P3 가 세 번 보고한 구멍), 그래서 세로 화면에서는 폭에서 트레이 93 을
// 잘못 빼고 높이에서 띠를 안 빼는 상자로 회전을 정하고 있었다.
//
// ⚠️ 2026-08-14 기현님 재설계로 **입력의 이름과 뜻이 바뀌었다.** `portrait`(창이 세로인가) →
// `trayBand`(트레이가 아래 띠인가) + `board`(전술판인가). 트레이가 코트 긴 변에 붙으면서
// 창 방향과 배치 축이 **정반대**가 됐기 때문이다 — 창이 가로면 코트가 눕고 트레이는 띠다.
// 그리고 전술판에는 하단 바 대신 오른쪽 기능 바가 서므로 예산이 그것도 알아야 한다.
//
// 배선은 여전히 자기 파일 밖 두 줄이다(EditorWorkspace 의 호출 인자, useStageRot 의 상태 사본).
// 그 두 줄이 다시 빠지는 것을 여기서 **행동으로**와 **소스로** 두 겹으로 막는다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { courtBoxPx } from './chromeBudget.ts';
import type { ChromeState, Size } from './chromeBudget.ts';
import { stageRotFor } from './useStageRot.ts';
import { trayBandHeightPx } from '../features/editor/trayMetrics.ts';
import { INTERACT } from '../core/constants.ts';

const read = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf-8');

const wired = (narrow: boolean): ChromeState => ({ narrow, inspector: 'hidden', trayBand: false, board: true });
const unwired = (narrow: boolean): ChromeState => ({ narrow, inspector: 'hidden' });

const rotAt = (v: Size, state: ChromeState) => stageRotFor('full', undefined, state, v);


describe('배선이 빠지면 예산이 틀린 상자를 답한다', () => {
  it('★ 배선 유무가 rot 을 실제로 뒤집는 창이 있다 — 찾아서 적는다', () => {
    // 값을 못박지 않고 **스캔한다**: 기기 하나를 적어 두면 그 기기만 안 깨지는 배선으로도
    // 초록이 된다. 여기서 묻는 것은 "어딘가에서 갈리는가" 이고, 갈리면 배선이 필수라는 뜻이다.
    let found: Size | null = null;
    for (let w = 320; w <= 1600 && !found; w += 16) {
      for (let h = 320; h <= 1600; h += 16) {
        const v = { w, h };
        const narrow = w < 1100;
        if (rotAt(v, wired(narrow)) !== rotAt(v, unwired(narrow))) {
          found = v;
          break;
        }
      }
    }
    expect(found, '어디서도 안 갈리면 이 파일이 지키는 것이 없다').not.toBeNull();
  });

  it('갈리는 창이 드물지 않다 — 전수 스캔에서 최소 5%', () => {
    let total = 0;
    let differ = 0;
    for (let w = 320; w <= 1600; w += 16) {
      for (let h = 320; h <= 1600; h += 16) {
        const v = { w, h };
        const narrow = w < 1100;
        total += 1;
        if (rotAt(v, wired(narrow)) !== rotAt(v, unwired(narrow))) differ += 1;
      }
    }
    expect(total).toBeGreaterThan(1000);
    expect(differ / total, '갈림이 거의 없으면 배선이 실은 안 중요한 것이다').toBeGreaterThan(0.05);
  });
});

describe('상자에서 행이 실제로 빠진다', () => {
  it('가로 창(띠 배치): 높이 = 창 − (헤더 + 띠 + 패딩), 폭에서는 트레이를 안 뺀다', () => {
    const band: ChromeState = { narrow: true, inspector: 'hidden', trayBand: true, board: true };
    const box = courtBoxPx({ w: 1024, h: 600 }, band);
    // 헤더 52 + 띠 66 + 상하 패딩 16 = 134 → 600 − 134 = 466.
    expect(box.h).toBe(600 - (52 + trayBandHeightPx(INTERACT.hitTargetCssPx) + 16));
    // 폭에서는 트레이가 빠지지 않는다(띠는 높이를 먹는다). 대신 기능 바 56 + 패딩 24 가 빠진다.
    expect(box.w).toBe(1024 - (56 + 24));
  });

  it('세로 창(기둥 배치): 폭에서 트레이가 빠지고 높이에서는 띠가 안 빠진다 — 두 축이 배타적이다', () => {
    const col: ChromeState = { narrow: true, inspector: 'hidden', trayBand: false, board: true };
    const box = courtBoxPx({ w: 480, h: 800 }, col);
    // 480 − (트레이 93 + 기능 바 56 + 패딩 24) = 307.
    expect(box.w).toBe(307);
    // 높이에서는 띠가 안 빠진다: 800 − (헤더 52 + 패딩 16) = 732.
    expect(box.h).toBe(800 - (52 + 16));
  });

  it('붙박이 인스펙터를 켜도 배치 축은 그대로다 — 두 축이 서로 독립이다', () => {
    const a = courtBoxPx({ w: 1400, h: 900 }, { narrow: false, inspector: 'hidden', trayBand: true, board: true });
    const b = courtBoxPx({ w: 1400, h: 900 }, { narrow: false, inspector: 'pinned', trayBand: true, board: true });
    expect(b.h, '인스펙터가 높이를 먹으면 축이 섞인 것이다').toBe(a.h);
    expect(b.w).toBeLessThan(a.w);
  });
});

describe('소스 계약 — 배선 두 줄이 제자리에 있다', () => {
  it('EditorWorkspace 가 useStageRot 에 배치 축과 화면을 넘긴다', () => {
    const src = read('src/features/editor/EditorWorkspace.tsx');
    expect(src).toContain(
      'useStageRot(drill.courtMode, drill.courtSize, { narrow, trayBand, board: isBoard, inspector: inspectorLayout })',
    );
  });

  it('useStageRot 의 이펙트 사본(here)과 deps 가 둘 다 그것을 안다', () => {
    const src = read('src/app/useStageRot.ts');
    expect(src).toContain('const { narrow, trayBand, board, inspector } = state;');
    expect(src).toContain('const here: ChromeState = { narrow, trayBand, board, inspector,');
    expect(src).toContain('}, [mode, size, narrow, trayBand, board, inspector, saTop, saRight, saBottom, saLeft]);');
  });
});

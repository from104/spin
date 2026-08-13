// §4.1 (재설계 2026-08-14) — **판 덩어리**가 폭을 코트 칸과 트레이에 어떻게 나누는가.
//
// ── 왜 이 파일이 생겼나 ──────────────────────────────────────────────────────────────
// 기현님 원문: *"칩들은 코트와 붙어있게 하여 진짜 보드판을 조작하는 느낌"*. 붙지 못하게 막고
// 있던 것은 트레이가 아니라 **레터박스**였다 — `<svg>` 는 래퍼를 100% 채우지만 코트 그림은
// `preserveAspectRatio="xMidYMid meet"` 로 그 안에서 가운데 정렬되므로, 1024×600 에서 남는
// 폭 172px 이 좌우 각 86px 로 갈려 칩과 코트 사이에 **86px 죽은 띠**를 만들었다.
//
// **레터박스 폭 = 트레이가 못 먹고 있는 폭이다.** 코트 칸이 자기 종횡비만큼만 차지하고 남는
// 폭을 트레이에 흘려보내면 "칩이 코트에 안 붙어 보인다" 와 "22칸이 안 들어간다" 가 동시에 풀린다.
//
// 여기 있는 것은 그 나눗셈의 **순수 함수 사본**이다. jsdom 에는 레이아웃이 없어 "코트 칸의
// 오른쪽 변 === 트레이의 왼쪽 변" 을 브라우저에게 물어볼 수 없으므로, 화면이 쓰는 flex 규칙을
// 그대로 계산으로 재현해 완료 판정을 증명한다(boardLayout.test.ts). 모형과 화면이 갈라지면
// 이 파일은 거짓말을 하므로, **화면 쪽 계약**(판 덩어리에 gap·padding 이 없고 자식이 정확히
// 둘이다)을 같은 테스트가 소스와 DOM 양쪽에서 함께 못박는다.
import { courtDefFor } from '../../model/court.ts';
import type { CourtMode, CourtSize } from '../../model/court.ts';
import type { StageRot } from '../../render/useStageMetrics.ts';
import type { Size } from '../../app/chromeBudget.ts';
import { trayRailMaxWidthPx, trayRailWidthPx } from './trayMetrics.ts';

/** 코트 칸의 `aspect-ratio` — **`def` 에서만 뽑는다**(§4.1 함정 3).
 *
 *  ⚠️ 무대의 `view`(줌·팬이 갈아 끼우는 viewBox)나 **측정된 rect** 로 이 값을 만들면 안 된다:
 *   · rect 로 만들면 "rect → 칸 크기 → rect" 고리가 닫히고 그 고리는 **쌍안정**이다
 *     (app/useStageRot.ts 머리말이 0.5527 vs 0.7176 두 고정점을 숫자로 박제해 뒀다).
 *   · `view` 로 만들면 줌이 트레이 폭을 흔들어 칩이 움직인다 = §3 불변식 1 정면 위반.
 *  2026-08-14 실측으로 확인한 사실 하나를 함께 남긴다: 지금의 `zoomAt` 은 `w = vbW/z, h = vbH/z`
 *  라 **view 의 종횡비가 줌으로 변하지 않는다**(useStageMetrics.ts:123-131). 즉 오늘 `view` 를
 *  써도 값은 같다 — 그래도 `def` 로 못박는 이유는 값이 아니라 **의존**이 계약이기 때문이다.
 *  줌이 축을 하나만 건드리도록 바뀌는 날, 계약이 없으면 아무도 못 잡는다. */
export function courtCellAspectRatio(mode: CourtMode, size: CourtSize | undefined, rot: StageRot): number {
  const def = courtDefFor(mode, size);
  return rot === 90 ? def.vbH / def.vbW : def.vbW / def.vbH;
}

/** 같은 값의 CSS 표기 — `825 / 525` 꼴. 부동소수 반올림이 화면에 새지 않고, DOM 을 읽는 사람이
 *  어느 코트인지 바로 알아본다. jsdom 도 이 문자열을 그대로 보관한다(2026-08-14 프로브 확인). */
export function courtCellAspectRatioCss(mode: CourtMode, size: CourtSize | undefined, rot: StageRot): string {
  const def = courtDefFor(mode, size);
  return rot === 90 ? `${def.vbH} / ${def.vbW}` : `${def.vbW} / ${def.vbH}`;
}

export interface BoardSplit {
  /** 판 덩어리의 폭. **코트 칸 폭 + 트레이 폭과 정확히 같다** — 그 등식이 "인접축 빈틈 0" 이다. */
  boardW: number;
  courtW: number;
  courtH: number;
  trayW: number;
  /** 정렬 상자 안에서 판 덩어리가 못 쓰고 남긴 폭. 좌우로 갈리는 **바깥** 여백이라
   *  코트↔트레이 사이가 아니다(트레이 상한을 넘긴 half/flat 에서 커진다). */
  outerW: number;
}

/** 가로 배치(트레이가 판 **오른쪽**)에서 정렬 상자 `avail` 을 코트 칸과 트레이가 나누는 법.
 *
 *  화면이 쓰는 flex 규칙 그대로다:
 *   · 코트 칸 `height:'100%'` + `aspectRatio:AR` + `flex:'0 1 auto'` → flex base = 높이 × AR
 *   · 트레이 `flex:'1 1 0'` → base 0. 남는 폭을 **전부** 먹고, 모자라면 `minWidth` 에서 멈춘다
 *   · 판 덩어리는 폭이 shrink-to-fit + `maxWidth:'100%'` → min(가용, 코트 base + 트레이 상한)
 *
 *  두 국면이 한 규칙에서 나온다:
 *   · **세로 제약**(1024×600 등) — base 가 들어가므로 남는 폭이 전부 트레이로. 레터박스 0.
 *   · **폭 제약**(1280·1920 핀) — base 가 안 들어가 코트가 shrink 하고 트레이는 min 에서 멈춘다
 *     = 오늘과 정확히 같은 배치(1280 핀 742×634 → pxPerUnit 0.8994). */
export function boardSplitPx(avail: Size, ar: number, hitPx: number): BoardSplit {
  const courtH = Math.max(0, avail.h);
  const base = courtH * ar;
  const trayMin = trayRailWidthPx(hitPx);
  const trayMax = trayRailMaxWidthPx(hitPx);
  const boardW = Math.min(Math.max(0, avail.w), base + trayMax);
  const trayW = Math.min(trayMax, Math.max(trayMin, boardW - base));
  return { boardW, courtW: boardW - trayW, courtH, trayW, outerW: Math.max(0, avail.w) - boardW };
}

// §4.2 (재설계 2026-08-14) — 스테이지 표시 회전 `rot` 을 **위에서 내려보낸다.**
//
// ── 왜 이 파일이 생겼나: `rot` 쌍안정 ──────────────────────────────────────────────
// 지금까지 `rot` 은 `<svg>` 가 **실제로 차지한 상자**를 재서 정했다(CourtStage 의 refreshMetrics).
// 재설계 P3 가 코트 칸을 자기 종횡비로 맞추면 그 상자가 다시 `rot` 의 함수가 되어 고리가 닫힌다.
// 그리고 이 고리는 단순 순환이 아니라 **쌍안정**이다 — 7인치 세로 가용 456×592, full 30×18:
//
//   가정 rot 0  → 맞춰진 rect 456.0×290.2 (px/u 0.5527) → rotForFit 재계산 = 0   ← 고정점
//   가정 rot 90 → 맞춰진 rect 376.7×592.0 (px/u 0.7176) → rotForFit 재계산 = 90  ← 고정점
//
// 정답은 90 인데 **0 도 자기모순 없이 안정**하다. 창을 어떤 순서로 줄였는지에 따라 판이 눕거나
// 서고 **축척이 23% 달라지며 재현이 안 된다.** 두 고정점 다 자기와 일치하므로 어떤 사후
// 검사로도 "지금 틀린 쪽에 앉아 있다" 를 알아낼 수 없고, jsdom 단위 테스트로는 절대 안 잡힌다
// (jsdom 은 레이아웃을 계산하지 않아 rect 가 언제나 0×0 이다).
// 그 숫자들을 코드로 박제해 둔 곳이 useStageRot.test.ts 의 '쌍안정' 절이다.
//
// ── 해소: 단방향 ─────────────────────────────────────────────────────────────────
// `rot` 을 **창 크기**에서 정해 위에서 내려보낸다. 측정된 rect 는 좌표 변환(computeMetrics)에만
// 쓰고 크기 결정으로 되돌리지 않는다. 입력이 창 크기라 레이아웃의 영향을 받지 않으므로
// 되먹임 고리가 **원리적으로** 없다 — 과거 ResizeObserver ↔ setState 되먹임이 렌더러를 얼렸고
// 단위 테스트로 못 잡았던 사고(useContainerWidth.ts 머리말 · CourtStage.tsx 의 rotRef 주석)를
// rot 축에서 다시 막는 것이다.
//
// 판정식은 `courtScale`(chromeBudget.ts)에서 **빌려 온다.** 여기에 "세로로 길면 돌린다" 를 다시
// 적으면 화면은 ROTATE_GAIN 1.08 로 돌고 예산표는 안 도는 순간이 생겨, 표가 화면과 다른 숫자를
// 말하게 된다(chromeBudget.ts:221 이 같은 이유로 rotForFit 을 빌려 쓴다). 그래서 이 파일에는
// 회전 규칙이 한 줄도 없다 — 있는 것은 **어디서 재는가**뿐이다.
import { useEffect, useState } from 'react';
import type { CourtMode, CourtSize } from '../model/court.ts';
import { SAFE_AREA_NONE, courtBoxPx, courtScale } from './chromeBudget.ts';
import type { ChromeState, Size } from './chromeBudget.ts';
import type { StageRot } from '../render/useStageMetrics.ts';

/** 창 크기 → 표시 회전. **순수하고 DOM 측정이 0 이다.**
 *
 *  `courtBoxPx` 는 창에서 크롬 예산을 뺀 상자를 계산할 뿐 아무것도 재지 않는다(chromeBudget.ts:200).
 *  그래서 이 함수의 입력은 레이아웃 결과에 의존하지 않고, 출력(`rot`)이 레이아웃을 바꿔도
 *  입력이 따라 움직이지 않는다 — 되먹임 고리가 닫힐 자리가 없다. */
export function stageRotFor(mode: CourtMode, size: CourtSize | undefined, state: ChromeState, viewport: Size): StageRot {
  return courtScale(mode, courtBoxPx(viewport, state), size).rot;
}

export function viewportSizePx(): Size {
  if (typeof window === 'undefined') return { w: 0, h: 0 };
  return { w: window.innerWidth, h: window.innerHeight };
}

/** `rot` 이 바뀌지 않는 창 크기 상자. 이 안에 머무는 동안은 다시 계산할 필요가 없다. */
export interface StageRotHoldBox {
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
}

/** 상자를 좁히는 횟수 상한. 없으면 반증 실험 하나가 무한 루프로 죽는다(계약: 이 루프는
 *  **반드시** 끝난다). 2의 24승이면 어떤 실기 창 크기에서도 1px 까지 내려온다. */
const HOLD_HALVINGS = 24;

/** 지금 창을 감싸는 **rot 불변 상자**를 구한다.
 *
 *  ⚠️ 네 모서리만 검산해도 되는 이유가 `m` 의 상한에 있다: 상자 폭·높이를 코트 상자
 *  (`courtBoxPx`)보다 작게 조여 두면 그 안에서는 코트 상자의 두 변이 **항상 양수**로 남는다.
 *  양수 구간에서 `rotForFit` 의 판정은 (boxW, boxH) 에 대해 1차 동차라 경계가 원점을 지나는
 *  직선이고, 양쪽이 모두 볼록하다 — 네 꼭짓점이 같은 답이면 상자 전체가 같은 답이다.
 *  상한을 풀면 이 논증이 깨진다: 창 폭이 크롬보다 작아지는 구석(코트 상자 폭 0)에서는 판정이
 *  0 으로 잘려 볼록성이 사라지고, **꼭짓점 넷이 전부 0 인데 안쪽에 90 인 섬이 생긴다**(실제로
 *  1024×768 에서 m 을 안 조이면 (300,1700) 이 그런 점이다). useStageRot.test.ts 가 꼭짓점만이
 *  아니라 **안쪽 격자까지 표본으로** 다시 확인하는 것이 이 논증의 반증 장치다. */
export function stageRotHoldBox(mode: CourtMode, size: CourtSize | undefined, state: ChromeState, viewport: Size): StageRotHoldBox {
  const here = stageRotFor(mode, size, state, viewport);
  const court = courtBoxPx(viewport, state);
  let m = Math.max(1, Math.min(Math.floor(court.w) - 1, Math.floor(court.h) - 1));
  for (let i = 0; i < HOLD_HALVINGS && m > 1; i++) {
    const same =
      stageRotFor(mode, size, state, { w: viewport.w - m, h: viewport.h - m }) === here &&
      stageRotFor(mode, size, state, { w: viewport.w - m, h: viewport.h + m }) === here &&
      stageRotFor(mode, size, state, { w: viewport.w + m, h: viewport.h - m }) === here &&
      stageRotFor(mode, size, state, { w: viewport.w + m, h: viewport.h + m }) === here;
    if (same) break;
    m = Math.floor(m / 2);
  }
  m = Math.max(1, m);
  // 창 크기는 배율 화면에서 소수일 수 있다. **안쪽으로 반올림**한다(min 은 올림, max 는 내림):
  //   · `m ≥ 1` 이므로 지금 창은 반드시 상자 안에 남는다 — 밖이면 질의가 처음부터 거짓이라
  //     change 가 영영 안 오고 회전이 굳는다.
  //   · 동시에 검산한 ±m 을 **넘지 않는다** — 바깥으로 반올림하면 검산 안 한 1px 이 붙는다.
  return {
    minW: Math.ceil(viewport.w - m),
    maxW: Math.floor(viewport.w + m),
    minH: Math.ceil(viewport.h - m),
    maxH: Math.floor(viewport.h + m),
  };
}

export function stageRotHoldQuery(box: StageRotHoldBox): string {
  return `(min-width: ${box.minW}px) and (max-width: ${box.maxW}px) and (min-height: ${box.minH}px) and (max-height: ${box.maxH}px)`;
}

/** 창 크기에서 파생된 표시 회전.
 *
 *  ⚠️ **분기 boolean 을 늘리는 것이 아니다**(§5.1 은 `useIsPortrait`·`useIsNarrow` 둘로 못박혀
 *  있다). `rot` 은 그 둘과 같은 층의 판정이 아니라 크롬 예산에서 나오는 **파생값**이다.
 *
 *  구독은 `useIsNarrow`·`useIsPortrait` 와 **같은 종류의 소스**(matchMedia)를 쓴다. 그 둘이
 *  resize 리스너를 안 쓰는 이유가 여기에도 그대로 적용된다(useIsNarrow.ts:11-13): *"문턱을
 *  넘을 때만 발화한다. resize 마다 setState 하면 리렌더가 수십 번 돌고, 그 리렌더가 코트 렌더
 *  루프와 같은 프레임을 나눠 쓴다"*(§6.1 규칙 1).
 *
 *  다만 `rot` 의 문턱은 **고정된 한 줄이 아니다** — 코트 상자의 종횡비가 정하므로 창 좌표계에서는
 *  기울어진 직선이고, `(max-width:)` 같은 축 정렬 질의 하나로는 못 적는다. 그래서 문턱을 미리
 *  적는 대신 **지금 창을 감싸는 rot 불변 상자**를 질의로 걸고, 그 상자를 벗어날 때만 다시 재고
 *  다시 건다. 질의의 `matches` 는 답으로 **읽지 않는다**(답은 언제나 창 크기에서 다시 계산한다)
 *  — 질의는 순수히 "언제 다시 볼지" 만 정하는 방아쇠다.
 *
 *  `arm()` 안에서 다시 `arm()` 을 부르는 것은 **change 이벤트 경로뿐**이다. matchMedia 생성도
 *  리스너 등록도 동기 발화를 하지 않으므로 재귀가 그 자리에서 되돌지 않는다(무한 루프 없음).
 *
 *  matchMedia 가 없으면(jsdom 등) 마운트 시점 한 번만 계산하고 구독하지 않는다 — 테스트는
 *  창 크기를 고정해 두고 렌더하므로 그것으로 충분하고, 없는 API 를 흉내내다 조용히 틀린 답을
 *  주는 것보다 낫다. */
export function useStageRot(mode: CourtMode, size: CourtSize | undefined, state: ChromeState): StageRot {
  const { narrow, inspector } = state;
  // safe-area 도 **원시값 넷으로 풀어** 둔다 — 객체째로 들고 있으면 호출부가 매 렌더 새로 만든
  // 리터럴에 이펙트가 매번 다시 걸린다(그리고 exhaustive-deps 가 정확히 그걸 지적한다).
  const { top: saTop, right: saRight, bottom: saBottom, left: saLeft } = state.safeArea ?? SAFE_AREA_NONE;
  const [rot, setRot] = useState<StageRot>(() => stageRotFor(mode, size, state, viewportSizePx()));

  useEffect(() => {
    const here: ChromeState = { narrow, inspector, safeArea: { top: saTop, right: saRight, bottom: saBottom, left: saLeft } };
    let disposed = false;
    let off: (() => void) | null = null;

    const arm = (): void => {
      off?.();
      off = null;
      if (disposed) return;
      const viewport = viewportSizePx();
      // 값이 정말 뒤집힐 때만 상태를 건드린다 — 출력이 2값 이산량이라 리렌더는 그때뿐이다.
      setRot((prev) => {
        const next = stageRotFor(mode, size, here, viewport);
        return prev === next ? prev : next;
      });
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      const mq = window.matchMedia(stageRotHoldQuery(stageRotHoldBox(mode, size, here, viewport)));
      const onChange = (): void => arm();
      // Safari 16 이전은 addEventListener 를 지원하지 않는다 — addListener 로 물러난다.
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onChange);
        off = () => mq.removeEventListener('change', onChange);
      } else if (typeof mq.addListener === 'function') {
        mq.addListener(onChange);
        off = () => mq.removeListener(onChange);
      }
    };

    arm();
    return () => {
      disposed = true;
      off?.();
    };
    // state 객체는 호출부에서 매 렌더 새로 만들어지므로 **원시값으로 풀어** 건다.
  }, [mode, size, narrow, inspector, saTop, saRight, saBottom, saLeft]);

  return rot;
}

// §4.3 P1-4 막힘 '툭' 의 **판정만** 하는 순수 층. 소리를 내는 것은 ui-kit 의 `cues` 다.
//
// "막혔다" 를 무엇으로 아는가가 이 파일의 전부다. 리시(포인터와 앵커 사이가 벌어짐)만으로는
// 안 된다 — 속도 제한이 켜져 있으면 빠르게 끌 때마다 늘 벌어진다(선속 상한 69.4 px/s).
// 그래서 조건 셋을 **모두** 요구한다:
//   ① 이미 뒤처져 있다   — 앵커·포인터 거리가 리시 표시 문턱을 넘었다
//   ② 개체가 멎어 있다   — 속도 제한 지연은 개체가 '느리게 가는' 것이고 막힘은 '안 가는' 것이다
//   ③ 손이 떠나고 있다   — 벌어지는 속도(= 상대속도)가 손떨림과 구별될 만큼 크다
// 세기는 ③ 에 비례한다(계획서 "상대속도 비례").
//
// 한 번 울리면 재무장 전까지 다시 울리지 않는다. 벽에 대고 계속 미는 동안 매 프레임 '툭' 이
// 나면 그건 신호가 아니라 소음이다.
import type { Vec2 } from '../../core/units.ts';

/** 화면 기준 눈금이다 — 줌을 해도 손끝이 느끼는 문턱이 같아야 한다(정착 스냅과 같은 원칙,
 *  INTERACT.settleSnapCssPx 주석). 월드 단위 변환은 `blockCueLimits` 가 한 곳에서 한다. */
const STILL_CSS_PX_PER_S = 30;
const MIN_REL_CSS_PX_PER_S = 150;
const FULL_REL_CSS_PX_PER_S = 900;
/** 표본 간격이 이보다 벌어졌으면 판정하지 않는다. 손을 멈췄다가(포인터 이벤트 없음) 다시
 *  움직인 첫 프레임은 "0.4초 동안 200px 벌어졌다" 로 읽혀 유령 '툭' 을 낸다. */
const MAX_SAMPLE_GAP_MS = 200;

export interface BlockCueSample {
  /** 잡은 지점(앵커)과 포인터 사이 거리. 월드 px. */
  gapPx: number;
  /** 개체 피벗의 월드 좌표. 이번 프레임 실제 이동량을 재는 데 쓴다. */
  at: Vec2;
  nowMs: number;
}

export interface BlockCueLimits {
  /** 이 거리를 넘어야 '뒤처짐' 으로 본다. 월드 px. */
  leashPx: number;
  /** 개체가 '멎었다' 고 볼 속도 상한. 월드 px/s. */
  stillPxPerS: number;
  /** 이 상대속도 미만이면 울리지 않는다. 월드 px/s. */
  minRelPxPerS: number;
  /** 세기 1.0 이 되는 상대속도. 월드 px/s. */
  fullRelPxPerS: number;
}

export interface BlockCueState {
  /** 다음 막힘을 울릴 수 있는가. 한 번 울리면 개체가 따라잡을 때까지 false. */
  readonly armed: boolean;
  readonly prev: BlockCueSample | null;
}

export const initialBlockCue: BlockCueState = { armed: true, prev: null };

/** 화면 눈금(CSS px)을 월드 눈금으로 옮긴다. `leashVisibleAtPx` 는 호출자가 이미 쓰고 있는
 *  값이라 인자로 받는다 — 리시가 보이는 순간과 막힘 판정의 문턱이 어긋나면 안 된다. */
export function blockCueLimits(pxPerUnit: number, leashCssPx: number): BlockCueLimits {
  const s = pxPerUnit > 0 ? pxPerUnit : 1;
  return {
    leashPx: leashCssPx / s,
    stillPxPerS: STILL_CSS_PX_PER_S / s,
    minRelPxPerS: MIN_REL_CSS_PX_PER_S / s,
    fullRelPxPerS: FULL_REL_CSS_PX_PER_S / s,
  };
}

/** 표본 하나를 먹이고 다음 상태와 (울릴 때만) 세기 0..1 을 돌려준다. */
export function stepBlockCue(
  state: BlockCueState,
  sample: BlockCueSample,
  lim: BlockCueLimits,
): { state: BlockCueState; impact: number | null } {
  const prev = state.prev;
  // 개체가 포인터를 따라잡았다 = 막힘이 풀렸다. 재무장은 판정보다 **먼저** 본다 —
  // 따라잡은 그 프레임이 곧 다음 막힘의 첫 프레임일 수 있다.
  const armed = state.armed || sample.gapPx <= lim.leashPx;
  const idle = { state: { armed, prev: sample }, impact: null };

  if (!prev) return idle; // 속도를 잴 짝이 없다
  const dtMs = sample.nowMs - prev.nowMs;
  if (dtMs <= 0 || dtMs > MAX_SAMPLE_GAP_MS) return idle;
  if (!armed) return idle;

  const dtS = dtMs / 1000;
  const objPxPerS = Math.hypot(sample.at.x - prev.at.x, sample.at.y - prev.at.y) / dtS;
  const relPxPerS = (sample.gapPx - prev.gapPx) / dtS;

  const stuck = sample.gapPx > lim.leashPx && objPxPerS < lim.stillPxPerS && relPxPerS >= lim.minRelPxPerS;
  if (!stuck) return idle;

  const span = Math.max(lim.fullRelPxPerS - lim.minRelPxPerS, 1e-6);
  const impact = Math.min(1, (relPxPerS - lim.minRelPxPerS) / span);
  return { state: { armed: false, prev: sample }, impact };
}

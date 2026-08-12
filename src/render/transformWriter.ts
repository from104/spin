// §6.2 — 60fps 드래그 루프가 DOM `transform` 을 직접 쓰는 유일한 경로. React 는 이 속성을
// 절대 렌더하지 않는다(§6.1 규칙 1) — 그래서 상위 리렌더가 일어나도 여기서 쓴 값이
// 되돌려지지 않는다.
import { DEG } from '../core/angle.ts';

export interface TransformWriter {
  register(id: string, el: SVGGElement | null): void;
  registerCounter(id: string, el: SVGGElement | null): void;
  /** 개체와 **같은** transform 을 받는 부속 그룹(존 핸들 등). 개체 본체와 별개의 SVG 위치에
   *  그려지면서도 60fps 로 함께 움직여야 하는 오버레이용 — 본체 <g> 안에 넣을 수 없을 때 쓴다.
   *
   *  `scaleWithHeld:false` 는 잡힘 배율(1.06)만 빼고 따라간다 — **길이가 곧 의미인** 오버레이용이다.
   *  3 m 링(§4.4 P2-4)은 공을 잡았다고 3.18 m 가 되면 안 된다: 판정은 75px 로 하는데 그림만
   *  커지면 "둘이 안에 있는데 링이 안 붉다" 가 눈에 보인다. 존 핸들은 반대로 칩과 **함께**
   *  커져야 하므로(가이드가 칩에서 떨어져 보인다) 기본값은 true 다. */
  registerFollower(id: string, el: SVGGElement | null, opts?: { scaleWithHeld?: boolean }): void;
  write(id: string, x: number, y: number, rad: number): void;
  writeFrame(frame: Readonly<Record<string, { x: number; y: number; theta: number }>>): void;
  /** §4.3 P1-1 '잡히면 칩이 판에서 뜬다'. 잡은 개체에 `chip--held` 를 붙이고 배율을 얹는다.
   *  드래그 시작·종료에 **딱 두 번** 호출한다 — selection 을 props 로 내리는 것은 §6.1 규칙 1
   *  위반이므로 60fps transform 을 쓰는 이 층에서 className 도 함께 토글한다. */
  setHeld(id: string, held: boolean): void;
  snapshot(): Record<string, { x: number; y: number; theta: number }>;
  clear(): void;
}

interface Pose {
  x: number;
  y: number;
  theta: number;
}

interface Follower {
  el: SVGGElement;
  scaleWithHeld: boolean;
}

const EPS_PX = 0.1;
const EPS_RAD = 1e-3;

/** 잡힌 개체가 판에서 뜨는 배율(§4.3 P1-1). 그림자와 함께 "손에 들려 있다" 를 만든다. */
const HELD_SCALE = 1.06;
/** 그림자는 CSS 가 그린다(styles/a11y.css). 배율은 왜 CSS 가 아닌가:
 *  SVG 의 `transform` **표현 속성**은 CSS `transform` **속성**에 매핑되고, 스타일시트 규칙이
 *  표현 속성을 이긴다. `.chip--held { transform: scale(1.06) }` 를 쓰는 순간 여기서 쓴
 *  translate·rotate 가 통째로 덮여 잡은 칩이 원점으로 순간이동한다 — 그래서 배율만은
 *  transform 문자열 **뒤에** 곱해 쓴다(회전 뒤 = 개체 로컬 원점 기준 = 피벗 기준 확대). */
const HELD_CLASS = 'chip--held';

/** §6.2 구현 요건 1: 클로저 지역 함수로 정의한다. 객체 리터럴 메서드로 만들면
 *  `raf.add(writer.writeFrame)` 처럼 메서드만 떼어 넘기는 순간 `this` 가 undefined 라
 *  즉시 크래시한다(ESM strict) — 여기 함수들은 애초에 `this` 를 쓰지 않는다. */
export function createTransformWriter(): TransformWriter {
  const els = new Map<string, SVGGElement>();
  const counters = new Map<string, SVGGElement>();
  const followers = new Map<string, Follower>();
  const prev = new Map<string, Pose>();
  // 마지막으로 기록된 프레임 전체 — register() 가 늦게 마운트된 노드에 즉시 흘려보낼 때 쓴다.
  const frame = new Map<string, Pose>();
  // 지금 손에 들려 있는 개체. 마운트 순서와 무관하게 유지돼야 한다(드래그 중 재등록).
  const held = new Set<string>();

  function applyMain(el: SVGGElement, id: string, x: number, y: number, rad: number, scaleWithHeld = true): void {
    const base = `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(rad * DEG).toFixed(2)})`;
    // 부속 그룹(follower)도 같은 배율을 받는다 — 존 핸들만 제자리 크기로 남으면 잡은 칩과
    // 가이드가 어긋난다(registerFollower 의 "**같은** transform" 계약). 예외는 규칙 링처럼
    // 길이 자체가 의미인 오버레이뿐이다(scaleWithHeld:false).
    el.setAttribute('transform', scaleWithHeld && held.has(id) ? `${base} scale(${HELD_SCALE})` : base);
  }
  function applyCounter(el: SVGGElement, rad: number): void {
    el.setAttribute('transform', `rotate(${(-rad * DEG).toFixed(2)})`);
  }

  function register(id: string, el: SVGGElement | null): void {
    if (!el) {
      els.delete(id);
      return;
    }
    els.set(id, el);
    // 잡힌 채로 노드가 새로 마운트되면(스텝 점프·재시드) 표시가 사라지므로 여기서도 맞춘다.
    el.classList.toggle(HELD_CLASS, held.has(id));
    // 요건 2: 마지막 프레임을 즉시 기록한다 — 안 하면 마운트 첫 페인트에 개체가 원점에
    // 겹치고, 아무도 write 하지 않는 경로(드릴 재마운트)에서는 영구 고착한다.
    const p = frame.get(id);
    if (p) applyMain(el, id, p.x, p.y, p.theta);
  }

  function registerFollower(id: string, el: SVGGElement | null, opts?: { scaleWithHeld?: boolean }): void {
    if (!el) {
      followers.delete(id);
      return;
    }
    const f: Follower = { el, scaleWithHeld: opts?.scaleWithHeld ?? true };
    followers.set(id, f);
    const p = frame.get(id);
    if (p) applyMain(el, id, p.x, p.y, p.theta, f.scaleWithHeld);
  }

  function registerCounter(id: string, el: SVGGElement | null): void {
    if (!el) {
      counters.delete(id);
      return;
    }
    counters.set(id, el);
    const p = frame.get(id);
    if (p) applyCounter(el, p.theta);
  }

  function write(id: string, x: number, y: number, rad: number): void {
    frame.set(id, { x, y, theta: rad });
    const p = prev.get(id);
    // 요건 3: 숫자로 먼저 비교하고 바뀐 것만 문자열화한다 — 정지 개체가 프레임마다
    // 임시 문자열을 만들지 않게 한다(콘 40개 × 60fps = GC 스파이크).
    if (p && Math.abs(p.x - x) < EPS_PX && Math.abs(p.y - y) < EPS_PX && Math.abs(p.theta - rad) < EPS_RAD) {
      return;
    }
    prev.set(id, { x, y, theta: rad });
    const el = els.get(id);
    if (el) applyMain(el, id, x, y, rad);
    const counter = counters.get(id);
    if (counter) applyCounter(counter, rad);
    const follower = followers.get(id);
    if (follower) applyMain(follower.el, id, x, y, rad, follower.scaleWithHeld);
  }

  function writeFrame(f: Readonly<Record<string, Pose>>): void {
    // 요건 4: for...in 대신 Object.keys().
    for (const id of Object.keys(f)) {
      const p = f[id]!;
      write(id, p.x, p.y, p.theta);
    }
  }

  function setHeld(id: string, next: boolean): void {
    if (held.has(id) === next) return; // 같은 상태면 DOM 을 건드리지 않는다(요건 3 과 같은 규율)
    if (next) held.add(id);
    else held.delete(id);
    const el = els.get(id);
    if (el) el.classList.toggle(HELD_CLASS, next);
    // 배율이 바뀌었으니 transform 을 곧바로 다시 쓴다 — write() 의 EPS 비교는 좌표만 보므로
    // 여기서 쓰지 않으면 다음 좌표 변화가 올 때까지 뜨지 않는다(놓자마자 멈춘 칩은 영영).
    const p = frame.get(id);
    if (!p) return;
    if (el) applyMain(el, id, p.x, p.y, p.theta);
    const follower = followers.get(id);
    if (follower) applyMain(follower.el, id, p.x, p.y, p.theta, follower.scaleWithHeld);
  }

  function snapshot(): Record<string, Pose> {
    const out: Record<string, Pose> = {};
    for (const [id, p] of frame) out[id] = { ...p };
    return out;
  }

  function clear(): void {
    els.clear();
    counters.clear();
    followers.clear();
    prev.clear();
    frame.clear();
    held.clear();
  }

  return { register, registerCounter, registerFollower, write, writeFrame, setHeld, snapshot, clear };
}

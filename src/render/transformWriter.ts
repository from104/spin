// §6.2 — 60fps 드래그 루프가 DOM `transform` 을 직접 쓰는 유일한 경로. React 는 이 속성을
// 절대 렌더하지 않는다(§6.1 규칙 1) — 그래서 상위 리렌더가 일어나도 여기서 쓴 값이
// 되돌려지지 않는다.
import { DEG } from '../core/angle.ts';

export interface TransformWriter {
  register(id: string, el: SVGGElement | null): void;
  registerCounter(id: string, el: SVGGElement | null): void;
  /** 개체와 **같은** transform 을 받는 부속 그룹(존 핸들 등). 개체 본체와 별개의 SVG 위치에
   *  그려지면서도 60fps 로 함께 움직여야 하는 오버레이용 — 본체 <g> 안에 넣을 수 없을 때 쓴다. */
  registerFollower(id: string, el: SVGGElement | null): void;
  write(id: string, x: number, y: number, rad: number): void;
  writeFrame(frame: Readonly<Record<string, { x: number; y: number; theta: number }>>): void;
  snapshot(): Record<string, { x: number; y: number; theta: number }>;
  clear(): void;
}

interface Pose {
  x: number;
  y: number;
  theta: number;
}

const EPS_PX = 0.1;
const EPS_RAD = 1e-3;

/** §6.2 구현 요건 1: 클로저 지역 함수로 정의한다. 객체 리터럴 메서드로 만들면
 *  `raf.add(writer.writeFrame)` 처럼 메서드만 떼어 넘기는 순간 `this` 가 undefined 라
 *  즉시 크래시한다(ESM strict) — 여기 함수들은 애초에 `this` 를 쓰지 않는다. */
export function createTransformWriter(): TransformWriter {
  const els = new Map<string, SVGGElement>();
  const counters = new Map<string, SVGGElement>();
  const followers = new Map<string, SVGGElement>();
  const prev = new Map<string, Pose>();
  // 마지막으로 기록된 프레임 전체 — register() 가 늦게 마운트된 노드에 즉시 흘려보낼 때 쓴다.
  const frame = new Map<string, Pose>();

  function applyMain(el: SVGGElement, x: number, y: number, rad: number): void {
    el.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(rad * DEG).toFixed(2)})`);
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
    // 요건 2: 마지막 프레임을 즉시 기록한다 — 안 하면 마운트 첫 페인트에 개체가 원점에
    // 겹치고, 아무도 write 하지 않는 경로(드릴 재마운트)에서는 영구 고착한다.
    const p = frame.get(id);
    if (p) applyMain(el, p.x, p.y, p.theta);
  }

  function registerFollower(id: string, el: SVGGElement | null): void {
    if (!el) {
      followers.delete(id);
      return;
    }
    followers.set(id, el);
    const p = frame.get(id);
    if (p) applyMain(el, p.x, p.y, p.theta);
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
    if (el) applyMain(el, x, y, rad);
    const counter = counters.get(id);
    if (counter) applyCounter(counter, rad);
    const follower = followers.get(id);
    if (follower) applyMain(follower, x, y, rad);
  }

  function writeFrame(f: Readonly<Record<string, Pose>>): void {
    // 요건 4: for...in 대신 Object.keys().
    for (const id of Object.keys(f)) {
      const p = f[id]!;
      write(id, p.x, p.y, p.theta);
    }
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
  }

  return { register, registerCounter, registerFollower, write, writeFrame, snapshot, clear };
}

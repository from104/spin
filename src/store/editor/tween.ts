// §6.7 "스텝 전환 트윈" 순수 로직. 실제 TransformWriter(§6.2)·raf(§6.3) 는 render-stage 소유라
// Wave 3 안에서 파일이 존재하지 않을 수 있다 — 여기서는 계약이 명시한 시그니처와 구조적으로
// 호환되는 최소 인터페이스(TweenWriter/RafAdd)만 두고, 실제 구현체는 렌더 레이어가 주입한다
// (TS 는 구조적 타이핑이라 createTransformWriter()/raf.add 가 이 타입을 그대로 만족한다).
import { isId } from '../../core/ids.ts';
import type { DrillStep } from '../../model/drill.ts';
import { poseFromStored, type ChairPose } from '../../model/chair.ts';
import { interpChair } from '../../model/playback.ts';

export type PoseXYT = { x: number; y: number; theta: number };

export interface TweenWriter {
  writeFrame(frame: Readonly<Record<string, PoseXYT>>): void;
}
/** src/render/rafLoop.ts 의 `raf.add` 와 같은 모양. */
export type RafAdd = (fn: (dtMs: number, nowMs: number) => void) => () => void;
export interface TweenHandle {
  cancel(): void;
}

/** DrillStep → TransformWriter.writeFrame 입력용 평탄 포즈 맵. 공/콘/메모는 theta=0(렌더에서 무시).
 *
 *  ⚠️ 메모가 빠져 있었다(§4.3 P1-5 의 다섯 번째 원인). `NoteLabel` 은 다른 개체와 똑같이
 *  `writer.register` 로 자리를 받는데 이 맵에도, 물리 스냅샷(`world.read()` — 메모는 바디가
 *  없다)에도 없었으므로 **아무도 메모의 transform 을 쓰지 않았다.** 결과: 코트 어디를 탭해
 *  만든 메모든 전부 viewBox 원점(판 왼쪽 위 마진)에 그려졌다 — 탭한 자리에는 아무것도 안
 *  나타나는 것이 "메모 도구 무반응" 의 실체 중 하나다. 메모 드래그·키보드 이동도 같은 경로로
 *  화면에 반영된다(NOTE_SET → step 교체 → ObjectLayer 의 initialFrame 재적용). */
export function poseFrame(step: DrillStep): Record<string, PoseXYT> {
  const out: Record<string, PoseXYT> = {};
  for (const [id, p] of Object.entries(step.chairs)) {
    if (!p) continue;
    const pose = poseFromStored(p);
    out[id] = { x: pose.x, y: pose.y, theta: pose.theta };
  }
  for (const [id, p] of Object.entries(step.balls)) {
    if (!p) continue;
    out[id] = { x: p.x, y: p.y, theta: 0 };
  }
  for (const [id, p] of Object.entries(step.cones)) {
    if (!p) continue;
    out[id] = { x: p.x, y: p.y, theta: 0 };
  }
  for (const n of step.notes) {
    out[n.id] = { x: n.x, y: n.y, theta: 0 };
  }
  return out;
}

function lerp(a: number, b: number, e: number): number {
  return a + (b - a) * e;
}

/** id 가 양쪽에 다 있으면 보간(휠체어는 model/playback.ts 와 동일한 Hermite, 공/콘은 선형),
 *  한쪽에만 있으면(스텝 전환 중 등장/퇴장) 있는 쪽 값을 그대로 쓴다 — 페이드는 ObjectLayer 의
 *  React opacity 몫이고(§6.6), 이 writer 는 위치만 다룬다. */
function frameAt(from: Readonly<Record<string, PoseXYT>>, to: Readonly<Record<string, PoseXYT>>, e: number): Record<string, PoseXYT> {
  const ids = new Set<string>([...Object.keys(from), ...Object.keys(to)]);
  const out: Record<string, PoseXYT> = {};
  for (const id of ids) {
    const a = from[id];
    const b = to[id];
    if (a && b) {
      if (isId(id, 'ch')) {
        const p = interpChair(a as ChairPose, b as ChairPose, e);
        out[id] = { x: p.x, y: p.y, theta: p.theta };
      } else {
        out[id] = { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), theta: 0 };
      }
    } else if (b) {
      out[id] = b;
    } else if (a) {
      out[id] = a;
    }
  }
  return out;
}

/** §6.7 frameSync 안에서 쓰는 트윈 스케줄러. `add` 가 반환한 구독 해지 함수는 완주 시 스스로
 *  호출한다 — raf.ts 의 "마지막 구독자가 tick 안에서 해지" 규칙과 맞물려 루프가 저절로 멈춘다. */
export function startTween(
  from: Readonly<Record<string, PoseXYT>>,
  to: Readonly<Record<string, PoseXYT>>,
  ms: number,
  ease: (t: number) => number,
  add: RafAdd,
  writer: TweenWriter,
): TweenHandle {
  if (ms <= 0) {
    writer.writeFrame(to);
    return { cancel() {} };
  }
  let elapsed = 0;
  let done = false;
  let unsubscribe: (() => void) | null = null;
  unsubscribe = add((dtMs) => {
    if (done) return;
    elapsed += dtMs;
    const t = Math.min(1, elapsed / ms);
    writer.writeFrame(frameAt(from, to, ease(t)));
    if (t >= 1) {
      done = true;
      unsubscribe?.();
    }
  });
  return {
    cancel() {
      if (done) return;
      done = true;
      unsubscribe?.();
    },
  };
}

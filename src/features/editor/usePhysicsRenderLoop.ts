// §6.2/§6.4 렌더 펌프. `PhysicsWorldApi` 는 자기 자신의 rAF(§5.8 physics/loop.ts, 앱 rAF 와는
// 별개 인스턴스)로 시뮬레이션을 굴리지만 "읽어서 write" 하는 쪽은 아무도 없다(§5.10 "렌더 보간은
// render-stage 소관 — read() 를 직접 호출해 읽어간다" 주석). 드래그 중뿐 아니라 pointerup 이후의
// 릴리스 체이스(§5.11, 최대 4000ms) 동안에도 CourtStage 는 더 이상 onPointerMove 를 부르지
// 않으므로(포인터가 이미 떨어졌다), 포인터 활성 여부와 무관하게 앱 rAF 에 물린 상시 구독 하나로
// 매 프레임 `writer.writeFrame(world.read())` 를 흘려보낸다 — TransformWriter 의 EPS 비교
// (§6.2 요건3)가 정지 상태에서는 DOM 을 건드리지 않으므로 상시 구독 비용은 무시할 만하다.
import { useEffect } from 'react';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import type { TransformWriter } from '../../render/transformWriter.ts';
import type { RuleOverlayApi } from '../../render/ruleOverlay.ts';
import { raf } from '../../render/rafLoop.ts';

/** `rules` 는 §4.4 P2-4 규칙 오버레이(3 m 링·골 지역 3인). **같은 스냅샷**을 자세와 판정에 함께
 *  흘려보낸다 — 판정 쪽에서 `read()` 를 한 번 더 부르면 물리 루프(§5.8, 앱 rAF 와 별개 인스턴스)가
 *  그 사이에 한 스텝을 돌 수 있어 "링은 붉은데 아무도 안 들어와 있다" 가 한 프레임씩 보인다. */
export function usePhysicsRenderLoop(worldRef: EditorWorldRef, writer: TransformWriter, rules?: RuleOverlayApi): void {
  useEffect(() => {
    return raf.add(() => {
      const w = worldRef.current;
      if (!w) return;
      const frame = w.read();
      writer.writeFrame(frame);
      rules?.write(frame);
    });
  }, [worldRef, writer, rules]);
}

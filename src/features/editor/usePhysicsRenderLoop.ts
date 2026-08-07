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
import { raf } from '../../render/rafLoop.ts';

export function usePhysicsRenderLoop(worldRef: EditorWorldRef, writer: TransformWriter): void {
  useEffect(() => {
    return raf.add(() => {
      const w = worldRef.current;
      if (!w) return;
      writer.writeFrame(w.read());
    });
  }, [worldRef, writer]);
}

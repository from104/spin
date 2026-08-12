// 2존 모드(§4.4 P2-2 · §9 결정 ④ · 5.5) — 차체 전체를 '평행 이동' 한 구역으로 합친다.
//
// 왜 있는가: 기본(4존)에서 차체는 s(축 방향 정규 위치)로 towRear/translate/spin/towFront 로
// 갈린다. 7인치 태블릿(pxPerUnit 0.663)에서 가장 좁은 밴드는 화면 16.7 px 이라 손가락 접촉면
// (약 40 px)에 한참 못 미친다 — 발 마우스·입 젓가락 사용자에게는 "이동하려다 회전시키는" 실수가
// 상시로 난다. 2존이면 차체 어디를 잡아도 통째로 밀리고, 회전·견인은 **차체 밖** 앞뒤 가이드
// (ZoneHandles 의 towRear/towFront)로만 한다.
//
// 이 파일이 순수 함수인 이유: 같은 성질을 컴포넌트 prop 뒤에 숨기면 단언이 닿지 않는다.
// (이 저장소의 실제 사고: 순수 함수를 좁혀도 1623개가 전건 초록이었다.)
import type { DragZone, ZoneConfig } from '../model/chair.ts';
import type { HitResult } from './hitTest.ts';

/** 2존 모드에서 차체를 잡으면 언제나 이 존이다. 'translate' = 잡은 점이 포인터를 따라가고
 *  헤딩은 변하지 않는다(kinematics.stepTranslate). */
export const TWO_ZONE_BODY: DragZone = 'translate';

/** 히트 결과에 2존 모드를 입힌다. **차체 직접 히트에만** 걸린다.
 *
 *  - 존 핸들(`zoneHandle`)은 그대로 둔다 — 2존 모드에서 회전·견인이 남아 있는 **유일한**
 *    수단이라, 여기까지 translate 로 덮으면 사용자가 회전 수단을 통째로 잃는다(§4.4 P2-2 가
 *    "핸들만 쓴다"를 그대로 되살리면 안 되는 이유로 든 바로 그 사고).
 *  - 공·콘·메모·화살표는 애초에 존이 없다.
 *
 *  ⚠️ `hit.zone` 이 UI 에서 물리로 2존을 전달하는 **유일한 통로**다. `physics/index.ts` 의
 *  `beginDrag` 는 UI 의 `HitContext` 를 받지 않고 `internalHitContext()` 를 스스로 만들어
 *  쓰므로(그 함수 주석 참고), HitContext 에 필드를 더해도 여기까지 오지 않는다. */
export function applyTwoZone(hit: HitResult, twoZone: boolean): HitResult {
  if (!twoZone || hit.kind !== 'chair') return hit;
  return { ...hit, zone: TWO_ZONE_BODY };
}

/** 차체 위에 비치는 존 음영·마우스 커서(ChairChip.zoneSpans)가 쓸 경계표.
 *
 *  2존이면 `sTowRearMax=0 · sSpinMin=1 · sTowFrontMin=1` 로 접어 **translate 한 구간이 차체
 *  전체를 덮게** 한다(나머지 셋은 폭 0 이라 ChairChip 의 `x1-x0 > 0.01` 필터가 걷어낸다).
 *  `grabPadPx` 는 히트 여유라 존과 무관하므로 그대로 들고 간다.
 *
 *  ⚠️ 경계 s=0 · s=1 **딱 그 점**에서는 이 표만으로 classifyZone 이 towRear/towFront 를
 *  돌려준다(부등호가 `<=` 와 `<` 라서다). 그래서 **드래그 판정은 이 표가 아니라
 *  `applyTwoZone` 이 한다** — 이 표는 그리기 전용이다. 둘이 어긋나지 않는지는
 *  twoZone.test.ts 의 '음영과 판정이 같은 말을 한다' 가 s 격자로 잰다.
 *  ±Infinity 로 접지 않은 이유: sToX(±Infinity) 가 SVG rect 의 x/width 를 망가뜨린다. */
export function twoZoneViewConfig(z: ZoneConfig, twoZone: boolean): ZoneConfig {
  if (!twoZone) return z;
  return { ...z, sTowRearMax: 0, sSpinMin: 1, sTowFrontMin: 1 };
}

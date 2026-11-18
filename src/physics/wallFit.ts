// 심플 모드를 **끌 때** 실물 차체가 벽 밖에 걸친 휠체어를 판 안으로 넣는 패치(2026-11-19 기현님 선택 *"복귀 때 판 안으로"*,
// docs/PLAN-SIMPLE-DRIVE.md 결정 A7).
//
// 왜: 심플 모드의 벽은 원 하나라(obb.ts boundsHull) 앞을 벽에 댄 원은 실물 차체로 13.5 px 판 밖이다. 평소 모드로 돌아가 [물리·상호작용]
// 이 켜지면 Matter 벽이 그 차체를 다음 손짓에 67 px 밀어냈고(정착 커밋이 그 자리를 썼다), 꺼져 있어도 판 밖인 채 남았다. 그래서 끄는
// 순간 **딱 필요한 만큼만**(pushChairIntoBounds — 끌기·fitToBounds 와 같은 최소 밀기, 각도는 그대로) 넣고 되돌리기 한 칸으로 쓴다.
//
// ⚠️ 드릴의 **모든 스텝**을 본다. 지금 스텝만 고치면 다른 스텝으로 넘어가는 순간 그 스텝의 칩이 벽에 밀린다. 저장 자세만 읽으므로
//    스텝 수에 비례하는 산수뿐이다. 잠긴 칩도 넣는다 — 판 밖은 존재하지 않는다(§4.2 P0-3)가 잠금보다 앞선다.
// ⚠️ 켤 때(심플 ON)는 아무것도 쓰지 않는다 — 평소 모드의 자세는 원으로도 거의 늘 판 안이고, 아니어도(뒤를 댄 칩의 원 6 px) 안전망이
//    둔다(world.ts escapePinnedAll 의 관대한 규칙).
import type { ChairId, StepId } from '../core/ids.ts';
import { courtDefFor } from '../model/court.ts';
import { poseFromStored, type StoredChairPose } from '../model/chair.ts';
import type { Drill } from '../model/drill.ts';
import { pushChairIntoBounds } from './obb.ts';

export interface WallFitPatch {
  /** 스텝 id → 옮긴 휠체어의 새 자세(옮긴 것만). */
  poses: Record<StepId, Record<ChairId, StoredChairPose>>;
  /** 옮긴 휠체어 수(여러 스텝에서 옮겨도 한 대로 센다) — 토스트의 N. */
  chairs: number;
}

/** 평소 모드(실물 차체)의 벽 밖에 걸친 휠체어를 판 안으로 넣는 패치. 넣을 것이 없으면 null. */
export function wallFitPatch(drill: Drill): WallFitPatch | null {
  const { vbW, vbH } = courtDefFor(drill.courtMode, drill.courtSize);
  const bounds = { w: vbW, h: vbH };
  const poses: WallFitPatch['poses'] = {};
  const moved = new Set<string>();
  for (const step of drill.steps) {
    for (const [id, sp] of Object.entries(step.chairs)) {
      if (!sp) continue;
      const out = pushChairIntoBounds(poseFromStored(sp), bounds);
      if (out.x === sp.x && out.y === sp.y) continue;
      (poses[step.id] ??= {})[id as ChairId] = { ...sp, x: out.x, y: out.y };
      moved.add(id);
    }
  }
  return moved.size === 0 ? null : { poses, chairs: moved.size };
}

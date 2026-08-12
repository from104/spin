// §3 seed 드릴 — **심는 장치**의 저장소 쪽 절반. "한 번만 심는다"를 여기서 지킨다.
//
// 내용은 `model/seedDrillContent.ts` 에 있고 **아직 기현님 승인 전이다**(결정 ⑥). 이 파일은
// 내용을 모른다 — 무엇을 심든 규칙은 같기 때문이고, 승인된 내용이 오면 이쪽은 한 줄도 안 바뀐다.
//
// ── 자물쇠가 둘인 이유 ────────────────────────────────────────────────────────────
// ① `prefs.seeded` 도장(3.0) — **유일한 게이트**다. *"드릴이 0개인가"* 로 대신할 수 없다:
//    그러면 seed 를 지운 사람에게 매번 되살아난다(prefs.ts 의 `seeded` 주석).
// ② 같은 제목이 이미 목록에 있으면 안 심는다 — ①이 **없을 때만** 보는 보조 잠금이다.
//    도장은 localStorage 에 산다. 사파리 프라이빗 모드처럼 localStorage 가 죽은 기기에서는
//    `savePrefs` 가 매번 실패해 도장이 증발하고, 그러면 **실행할 때마다 3개씩 쌓인다.**
//    ②는 그 한 갈래만 막는다 — 목록을 비운 사람 앞에서는 ②도 통과하므로 "지운 것을 다시 심지
//    않는다"의 책임은 여전히 전적으로 ①에 있다. ②는 중복 방지지 게이트가 아니다.
//
// **판(BoardScreen)은 건드리지 않는다.** 자유 전술판은 `storage/board.ts`(localStorage
// `spin.board`)에 따로 살고, seed 는 오직 drillRepo 에만 쓴다 — *"전술판은 빈 코트로
// 시작한다"*(2026-08-10 기현 지시)를 어기지 않기 위해서다.
import type { Drill } from '../model/drill.ts';
import { buildSeedDrills } from '../model/seedDrills.ts';
import type { DrillRepo } from './drillRepo.ts';

export type SeedReason =
  /** 실제로 심었다. */
  | 'planted'
  /** 도장이 이미 찍혀 있다(자물쇠 ①). */
  | 'stamped'
  /** 같은 제목의 드릴이 이미 목록에 있다(자물쇠 ②). */
  | 'already-present';

export interface SeedOutcome {
  seeded: boolean;
  count: number;
  reason: SeedReason;
}

/** 한 번만 심는다. 심었으면 호출자가 `prefs.seeded = true` 로 도장을 찍는다 — 도장 찍기를 이
 *  함수가 하지 않는 이유는 storage 모듈이 prefs 를 쓰는 순간 "설정을 고치는 부작용이 있는
 *  드릴 함수"가 되기 때문이다. 실패(IDB 열화 등)는 예외로 던진다: 도장은 **성공한 뒤에만**
 *  찍혀야 하고, 그 판단은 호출자의 catch 에 있다. */
export async function seedDrillsOnce(
  repo: DrillRepo,
  opts: { seeded: boolean; drills?: readonly Drill[] },
): Promise<SeedOutcome> {
  if (opts.seeded) return { seeded: false, count: 0, reason: 'stamped' };

  const drills = opts.drills ?? buildSeedDrills();
  if (drills.length === 0) return { seeded: false, count: 0, reason: 'planted' };

  const titles = new Set(drills.map((d) => d.title));
  const existing = await repo.listDrillSummaries();
  if (existing.some((s) => titles.has(s.title))) return { seeded: false, count: 0, reason: 'already-present' };

  // touch:false — `buildSeedDrills` 가 매긴 시각을 지킨다. 그대로 두면 putDrill 이 셋 다
  // 같은 ms 로 덮어써 목록 정렬(updatedAt 내림차순)에서 초·중·고 순서가 무너진다.
  for (const d of drills) await repo.putDrill(d, { touch: false });
  return { seeded: true, count: drills.length, reason: 'planted' };
}

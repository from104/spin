// §3 seed 드릴 — **심는 장치**의 저장소 쪽 절반. "한 번만 심는다"를 여기서 지킨다.
//
// ⚠️ 2026-09-06 — 옛 머리말은 *"내용은 `model/seedDrillContent.ts` 에 있고 아직 기현님 승인
// 전이다(결정 ⑥). 이 파일은 내용을 모른다"* 였다. 그 파일은 폐기됐다(기현 지시 2026-09-06:
// *"첫 실행시 기본 저장되어있는 드릴을 규칙에 있는 드릴로 교체 (앞으로 쭉 그 정책 유지"*,
// docs/PLAN-SEED-FROM-RULES.md). 승인 대기라는 상태 자체가 사라졌다 — 심는 것은 규칙 화면
// 장면 22벌이고, 그 정본은 `features/rules/ruleScenes.ts` 의 `RULE_SCENE_IDS` 다.
//
// **"내용을 모른다" 는 성질만 뒤집혔다**: 무엇을 심을지는 이제 이 파일이 정한다(아래 import).
// 그렇게 한 이유는 *"첫 실행에 규칙 장면 22벌이 심긴다"* 가 **검증 가능한 계약**이어야 하기
// 때문이다 — 호출자(App.tsx)가 드릴 배열을 만들어 넘기는 모양이면 무엇이 심기는지가 배선 코드에
// 흩어져 `seed.test.ts` 가 잴 것이 없어진다. `drills` 옵션은 그 계약을 우회하는 테스트용이다.
// (`storage` → `features` 를 향하는 유일한 import 다. 방향이 거꾸로인 것은 맞지만, 시드의 정본이
// 규칙 화면으로 옮겨 간 이상 그 반대편에 두면 두 벌이 된다 — §3 정본 하나.)
//
// ── 자물쇠가 둘인 이유 ────────────────────────────────────────────────────────────
// ① `prefs.seeded` 도장(3.0) — **유일한 게이트**다. *"드릴이 0개인가"* 로 대신할 수 없다:
//    그러면 seed 를 지운 사람에게 매번 되살아난다(prefs.ts 의 `seeded` 주석).
// ② 같은 **id** 가 이미 목록에 있으면 안 심는다 — ①이 **없을 때만** 보는 보조 잠금이다.
//    도장은 localStorage 에 산다. 사파리 프라이빗 모드처럼 localStorage 가 죽은 기기에서는
//    `savePrefs` 가 매번 실패해 도장이 증발하고, 그러면 **실행할 때마다 22벌씩 쌓인다.**
//    ②는 그 한 갈래만 막는다 — 목록을 비운 사람 앞에서는 ②도 통과하므로 "지운 것을 다시 심지
//    않는다"의 책임은 여전히 전적으로 ①에 있다. ②는 중복 방지지 게이트가 아니다.
//
//    ⚠️ 2026-09-06 — ②의 열쇠가 **제목에서 id 로** 바뀌었다(계획 결정 5). 옛 근거는 *"제목이
//    하나만 겹쳐도 막는다 — 반쪽만 심어 놓는 것이 가장 나쁘다"* 였는데, 그때는 시드 id 가 심을
//    때마다 새로 발급돼서 **제목 말고는 대조할 열쇠가 없었다.** 지금은 id 가 고정이라(결정 3)
//    제목보다 정확하다. 제목으로 재면 대가가 둘이다: 사용자가 시드 제목을 바꾸면 ②가 눈이 멀고,
//    반대로 자기 드릴을 우연히 '2-1 킥오프' 라 이름 붙인 사람은 시드를 **영영 못 받는다.**
//
// **판(BoardScreen)은 건드리지 않는다.** 자유 전술판은 `storage/board.ts`(localStorage
// `spin.board`)에 따로 살고, seed 는 오직 drillRepo 에만 쓴다 — *"전술판은 빈 코트로
// 시작한다"*(2026-08-10 기현 지시)를 어기지 않기 위해서다.
import type { Drill } from '../model/drill.ts';
import type { Locale } from '../i18n/locale.ts';
import { seedRuleDrills } from '../features/rules/ruleScenes.ts';
import type { DrillRepo } from './drillRepo.ts';

export type SeedReason =
  /** 실제로 심었다. */
  | 'planted'
  /** 도장이 이미 찍혀 있다(자물쇠 ①). */
  | 'stamped'
  /** 같은 id 의 드릴이 이미 목록에 있다(자물쇠 ②). */
  | 'already-present';

export interface SeedOutcome {
  seeded: boolean;
  count: number;
  reason: SeedReason;
}

/** 한 번만 심는다. 심었으면 호출자가 `prefs.seeded = true` 로 도장을 찍는다 — 도장 찍기를 이
 *  함수가 하지 않는 이유는 storage 모듈이 prefs 를 쓰는 순간 "설정을 고치는 부작용이 있는
 *  드릴 함수"가 되기 때문이다. 실패(IDB 열화 등)는 예외로 던진다: 도장은 **성공한 뒤에만**
 *  찍혀야 하고, 그 판단은 호출자의 catch 에 있다.
 *
 *  `locale` 은 장면의 팀 라벨(과 로케일판이 있는 장면의 글자)에만 쓰인다 — 좌표·순서·id·시각은
 *  로케일과 무관하다. 생략하면 ko: 이 함수를 로케일 없이 부르는 자리는 테스트뿐이고, 제품
 *  호출부(App.tsx)는 `useLocale()` 값을 넘긴다. */
export async function seedDrillsOnce(
  repo: DrillRepo,
  opts: { seeded: boolean; locale?: Locale; drills?: readonly Drill[] },
): Promise<SeedOutcome> {
  if (opts.seeded) return { seeded: false, count: 0, reason: 'stamped' };

  const drills = opts.drills ?? seedRuleDrills(opts.locale ?? 'ko');
  if (drills.length === 0) return { seeded: false, count: 0, reason: 'planted' };

  const ids = new Set<string>(drills.map((d) => d.id));
  const existing = await repo.listDrillSummaries();
  if (existing.some((s) => ids.has(s.id))) return { seeded: false, count: 0, reason: 'already-present' };

  // touch:false — `seedRuleDrills` 가 매긴 고정 시각을 지킨다. 그대로 두면 putDrill 이 22벌을
  // 전부 같은 ms(= 기계 시계)로 덮어써 목록 정렬에서 카드 순서가 무너지고, 더 나쁘게는 동기화
  // LWW 에서 **미편집 시드가 다른 기기의 편집을 이긴다**(ruleScenes.ts 의 `SEED_EPOCH` 근거).
  for (const d of drills) await repo.putDrill(d, { touch: false });
  return { seeded: true, count: drills.length, reason: 'planted' };
}

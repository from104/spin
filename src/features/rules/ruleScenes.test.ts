// 규칙 화면 장면 데이터(2026-08-21 신설) 불변식 — docs/PLAN-RULES-SCREEN.md §E.
//
// ⚠️ 2026-08-31 — 장면 12개가 **손코딩 원고에서 편집기 JSON 으로 바뀌었다**(계획
// PLAN-RULES-9CARDS.md §4). 그전까지 여기 단언들은 `SCENE_META` 라는 **입력** 표를 되읽어
// "표대로 나왔나" 를 보고 있었다 — 그 입력이 JSON 안으로 들어가는 순간 같은 단언이
// **JSON 자기증명**("데이터가 자기 자신과 같다")이 되어 조용히 무장해제된다(§6.1 의 ⚠️).
// 그래서 이 파일은 `RULE_SCENE_EXPECT`(21개 전수 **검사표**)와 대조한다.
//
// ⚠️ **검사표는 한 덩어리가 아니다 — 칸마다 출처가 다르다.** 예전 이 자리에 *"검사표는 데이터를
// 베낀 것이 아니라 계획 §4.2 표와 정본의 거리 규정에서 다시 뜬 것"* 이라고만 적혀 있었는데,
// 그것은 칸별로 참이 아니다(2026-08-31 정정). 칸별 근거는 `ruleScenes.ts` 의 `RuleSceneExpect`
// 주석에 이미 정직하게 적혀 있고, 요약하면 이렇다:
//  - **문서에서 다시 뜬 값** — `mode`·`size`(계획 §4.2 표), `rings` 의 **종류**(정본
//    docs/RULES-FIPFA-2025.md 의 거리 규정: 재개 7종 5m·세트볼 3m·2-on-1 3m), `retreat` 중
//    정본이 킥커를 못 박는 셋(goal-kick Law 16·corner Law 17·penalty Law 14), `steps` 중
//    §4.2 가 못 박은 넷(inout 5·scoring 6·set-ball 1·two-on-one 1).
//  - **빌드한 데이터를 재어 옮긴 스냅샷 핀** — `cut`(21/21), `defense`(21/21), `steps` 의 나머지
//    여덟, `rings` 의 **어느 스텝에 찍혔나**, `retreat` 중 나머지 넷(kickoff·kick-in·dfk·ifk).
//
// ⚠️ **스냅샷 핀은 오늘의 임베드를 검증하지 못한다.** 데이터를 재어 적은 값이라 오늘은 정의상
// 초록이다 — 임베드가 애초에 틀렸다면 핀도 같이 틀린 채로 굳는다. 핀이 잡는 것은 **앞으로의
// 조용한 변화**뿐이다(재임베드·손편집이 값을 바꿨을 때). 오늘치 검증은 문서에서 뜬 칸들과,
// 표를 아예 거치지 않는 단언들(`RULE_SCENE_KICKER_BY_LAW` 유도 대조·`repairs` 빈 배열·
// schemaVersion 도장·컷은 첫 스텝일 수 없다)이 맡는다.
// **단언을 통과시키려고 검사표를 데이터에 맞추지 마라** — 어긋나면 표를 먼저 의심한다.
import { describe, expect, it } from 'vitest';
import {
  buildRuleScene,
  RULE_SCENE_EXPECT,
  RULE_SCENE_GEO,
  RULE_SCENE_IDS,
  RULE_SCENE_KICKER_BY_LAW,
} from './ruleScenes.ts';
import type { RuleSceneId } from './ruleScenes.ts';
import { ruleContentFor } from './ruleContent.ts';
import { courtDefFor } from '../../model/court.ts';
import { validateDrill } from '../../model/validate.ts';
import { CURRENT_DRILL_SCHEMA } from '../../model/drill.ts';
import type { Drill, StoredBallRing } from '../../model/drill.ts';
import type { BallId } from '../../core/ids.ts';
import { defaultDefense, fiveMeterRetreat, otherSide } from '../../model/rules.ts';

/** v9 — 링은 스텝 소유다. **스텝별로** 그 스텝에 찍힌 링 종류(공마다 하나, 중복 포함·정렬) —
 *  검사표 `rings` 와 같은 단위다. 링이 하나도 없는 스텝은 키를 만들지 않는다.
 *
 *  ⚠️ 정렬하는 이유: 한 스텝에 종류가 섞이는 장면이 생기면 객체 키 순서(= 공 배열 순서)에 단언이
 *  묶인다. 정렬해 두면 "이 스텝에 어떤 규칙이 몇 개 걸려 있나" 만 남는다.
 *  ⚠️ 2026-08-31 — 옛 helper 는 장면 전체를 **종류 집합 하나**로 접었다(`['3m']`). 그러면 링이
 *  한 스텝만 남아도, 공 둘 중 하나가 링을 잃어도 초록이다 — 링은 규칙 선택이라
 *  (model/rules.ts `ruleForRing`) 잃은 쪽은 5m 대신 2-on-1 로 판정된다. 스텝별 배치와 개수를
 *  둘 다 살린 지금 구조가 옛 `two-on-one` 전용 단언(공 2개에 3m ×2)까지 흡수한다. */
const ringsByStepOf = (d: Drill): Record<number, StoredBallRing[]> => {
  const out: Record<number, StoredBallRing[]> = {};
  d.steps.forEach((s, i) => {
    const kinds = Object.values(s.ballRings ?? {})
      .filter((r): r is StoredBallRing => r !== undefined)
      .sort();
    if (kinds.length > 0) out[i] = kinds;
  });
  return out;
};

/** 5m 링이 걸린 스텝마다 **5m 를 물러나야 하는 팀** — 검사표 `retreat` 와 같은 단위다.
 *
 *  `model/rules.ts` 의 `fiveMeterRetreat` 를 **앱과 같은 두 인자로** 부른다: 소유는 그 스텝의
 *  `ballOwner[ballId]`, 진영은 `drill.defense ?? defaultDefense(courtMode)`(`Drill.defense` 가
 *  옵셔널이라 화면 `RuleOverlay.tsx`·PNG `buildStaticSvg.ts` 가 쓰는 바로 그 유도다). 판정
 *  경로와 같은 함수를 지나야 "테스트에서만 다른 팀이 물러나는" 자리가 없다.
 *
 *  ⚠️ 3m 링은 넣지 않는다 — `ruleForRing('3m')` 은 2-on-1 이라 물러날 팀이라는 개념이 없다.
 *  ⚠️ 한 스텝에 5m 공이 여럿이면 팀이 갈릴 수 있다. 지금 21개엔 그런 스텝이 없지만, 생기는 날
 *  조용히 하나로 접히면 안 되므로 `'away|home'` 처럼 붙여 내보내 단언이 그 자리를 가리키게 한다. */
const retreatByStepOf = (d: Drill): Record<number, string> => {
  const defense = d.defense ?? defaultDefense(d.courtMode);
  const out: Record<number, string> = {};
  d.steps.forEach((s, i) => {
    const teams = new Set<string>();
    for (const [id, ring] of Object.entries(s.ballRings ?? {}) as [BallId, StoredBallRing][]) {
      if (ring !== '5m') continue;
      const team = fiveMeterRetreat(s.ballOwner?.[id], defense);
      if (team !== null) teams.add(team);
    }
    if (teams.size > 0) out[i] = [...teams].sort().join('|');
  });
  return out;
};

/** cut:true 스텝의 0-based 인덱스(오름차순) — 검사표 `cut` 과 같은 단위다. */
const cutIndicesOf = (d: Drill): number[] => d.steps.map((s, i) => (s.cut ? i : -1)).filter((i) => i >= 0);

describe('buildRuleScene', () => {
  it.each(RULE_SCENE_IDS)('%s — validateDrill 을 **보정 없이** 통과한다(저장 왕복 불변)', (id) => {
    const drill = buildRuleScene(id);
    const result = validateDrill(drill);
    // `expect(...).toBe(true)` 는 타입을 좁히지 못한다 — 좁히려면 여기서 끊어야 한다.
    if (!result.ok) throw new Error(`${id} — validateDrill 실패: ${JSON.stringify(result.issues)}`);
    // ⚠️ `repairs` 가 비어 있어야 한다(2026-08-31 신설). `ok:true` 는 "고쳐서 살렸다" 도 포함하므로
    // 통과만 봐서는 임베드한 JSON 이 **원본과 다른 그림으로** 뜨는 것을 못 잡는다 — 고아 id 삭제·
    // 좌표 클램프·문자열 절단은 전부 조용한 보정이다. 장면은 사람이 눈으로 검수한 판이라
    // 보정이 하나라도 일어났으면 그건 화면이 기현님이 찍은 것과 다르다는 뜻이다.
    expect(result.repairs, `${id} — 보정이 일어났다(화면이 원본과 다르다)`).toEqual([]);
  });

  it.each(RULE_SCENE_IDS)('%s — 코트가 검사표와 일치한다', (id) => {
    // 예전에는 `28×15 풀 코트다` 를 21케이스에 하드코딩했다. 이제 (2) 갈래 12개가 30×18 이고
    // 그중 11개가 half 라(§4.2) 하드넘버로는 잴 수 없다 — 장면마다 검사표가 주장하는 값을 본다.
    const drill = buildRuleScene(id);
    const want = RULE_SCENE_EXPECT[id];
    expect(drill.courtMode, id).toBe(want.mode);
    expect(drill.courtSize, id).toBe(want.size);
  });

  it.each(RULE_SCENE_IDS)('%s — 링이 검사표가 못 박은 스텝에, 못 박은 개수만큼 있다', (id) => {
    // 예전에는 "3m 은 이 6개, 5m 은 저 7개" 를 이 파일에 두 벌 하드코딩했고, 그다음엔 장면당
    // **종류 집합** 하나로 접어 비교했다. 접힌 단위로는 링이 한 스텝만 남아도 초록이었다 —
    // 편집기 데이터는 링을 1~2 스텝에만 찍기 때문이다(옛 후처리는 전 스텝에 깔았다).
    // 지금은 `스텝 → 종류 목록` 통째로 본다: 없어야 할 스텝에 없고, 있어야 할 스텝에 **그 개수만큼**
    // 있다. 근거는 docs/RULES-FIPFA-2025.md — 재개 7종 5m, 세트볼 3m, 2-on-1 3m.
    // ⚠️ `two-on-one` 의 3m ×2 를 받던 전용 단언이 여기 흡수됐다(`{ 0: ['3m','3m'] }`).
    const drill = buildRuleScene(id);
    expect(ringsByStepOf(drill), id).toEqual(RULE_SCENE_EXPECT[id].rings);
  });

  it.each(RULE_SCENE_IDS)('%s — 5m 링이 걸린 스텝마다 물러날 팀이 검사표와 일치한다', (id) => {
    // ⚠️ 2026-08-31 신설. 이 단언이 없는 동안 `goal-kick` 스텝 2 의 `ballOwner` 를 통째로 지워도
    // 테스트가 전부 초록이었다 — 지우면 `fiveMeterRetreat(undefined,'away') = 'away'` 로 떨어져
    // **공을 차는 away 가 5m 위반으로 붉어진다.** 그 오판정을 데이터로 고친 것이 계획 §4.1
    // 근거 3(= 이 커밋의 간판)인데, 정작 그 수리를 지키는 단언이 하나도 없었다.
    //
    // `RULE_SCENE_EXPECT.rings` 와 갈라 둔 이유: 링은 "어느 규칙으로 재는가", 이 값은 "그 규칙이
    // 누구를 제한하는가" 다. 링만 맞고 소유가 틀리면 판은 정확히 반대 팀을 칠한다.
    const drill = buildRuleScene(id);
    expect(retreatByStepOf(drill), id).toEqual(RULE_SCENE_EXPECT[id].retreat);
  });

  it.each(Object.keys(RULE_SCENE_KICKER_BY_LAW) as RuleSceneId[])(
    '%s — 물러날 팀이 정본이 못 박은 킥커에서 유도한 값과 같다',
    (id) => {
      // 위 단언은 손으로 옮겨 적은 **핀**이라, 데이터가 뒤집힌 날 표를 데이터에 맞춰 고치면
      // 그대로 초록이 된다(그 파일 머리말이 하지 말라고 적어 둔 바로 그 짓). 이 단언은 표를
      // 거치지 않는다 — docs/RULES-FIPFA-2025.md 가 킥커를 못 박는 재개 3종에서, 물러날 팀을
      // **진영에서 유도해** 데이터와 직접 맞춘다. 골킥은 수비가 차므로 유도값이 진영의 **반대**이고
      // (Law 16), 그래서 **소유가 통째로 빠졌을 때의 폴백**(= 진영)과 갈리는 것은 셋 중 goal-kick
      // 뿐이다. 코너·페널티는 유도값이 폴백과 같으므로 여기서 걸리는 것은 소유가 **뒤집힌** 경우다.
      const drill = buildRuleScene(id);
      const defense = drill.defense ?? defaultDefense(drill.courtMode);
      const want = RULE_SCENE_KICKER_BY_LAW[id] === 'defense' ? otherSide(defense) : defense;
      const measured = retreatByStepOf(drill);
      // 링이 통째로 사라지면 대조할 스텝이 0개가 되어 조용히 통과한다 — 그 자리를 막는다.
      expect(Object.keys(measured).length, `${id} — 5m 링이 걸린 스텝이 하나도 없다`).toBeGreaterThan(0);
      for (const [step, team] of Object.entries(measured)) {
        expect(team, `${id} 스텝 ${step} — 물러날 팀`).toBe(want);
      }
    },
  );

  it.each(RULE_SCENE_IDS)('%s — 스텝 수·컷 위치·수비 진영이 검사표와 일치한다', (id) => {
    const drill = buildRuleScene(id);
    const want = RULE_SCENE_EXPECT[id];
    expect(drill.steps.length, `${id} 스텝 수`).toBe(want.steps);
    expect(cutIndicesOf(drill), `${id} 컷 위치`).toEqual([...want.cut]);
    expect(drill.defense, `${id} 수비 진영`).toBe(want.defense);
  });

  it('컷 스텝(cut:true)은 첫 스텝일 수 없다', () => {
    // 위 단언이 **지금 21개**의 컷 위치를 못 박는다면, 이것은 **앞으로 들어올 장면**까지 거는
    // 구조적 규칙이다: cut 은 "직전 스텝에서 보간하지 말고 뚝 끊어라" 라는 뜻이라 첫 스텝에서는
    // 가리킬 직전이 없다. 검사표를 [0] 으로 고쳐 적어도 이쪽이 막는다.
    for (const id of RULE_SCENE_IDS) {
      for (const i of cutIndicesOf(buildRuleScene(id))) {
        expect(i, `${id} 스텝 ${i}`).toBeGreaterThan(0);
      }
    }
  });

  it.each(RULE_SCENE_IDS)('%s — schemaVersion 도장이 CURRENT_DRILL_SCHEMA 와 같다', (id) => {
    // ⚠️ 2026-08-31 신설. (2) 갈래 12벌은 `schemaVersion: 9` 가 **소스에 박힌 리터럴**이라
    // `CURRENT_DRILL_SCHEMA` 가 10이 되는 날 12개가 한꺼번에 옛 문서가 된다. 장면은 저장 대상이
    // 아니라 `migrateDoc` 을 타지 않고, 그래서 too-new 거절도 v9→v10 이관도 못 받는다 —
    // 아무도 안 알려 주면 옛 스키마 그림이 그대로 화면에 뜬다.
    //
    // ⚠️ 계획 §4.3 은 *"`satisfies Drill` 이라야 스키마가 올라가는 날 **컴파일 오류로** 알려
    // 준다"* 고 적었지만 **그렇지 않다**: `Drill.schemaVersion` 은 리터럴 9 가 아니라
    // `number` 다(src/model/drill.ts:351). 9든 10이든 `satisfies` 를 통과한다. 컴파일러가 못
    // 잡으므로 그 자리를 이 테스트가 대신 선다.
    //
    // 빨개졌다면 고칠 곳은 이 단언이 아니라 장면 12벌이다: `scripts/import-rule-scene.mjs` 로
    // 새 스키마 봉투에서 다시 찍거나(백업 필요 — ruleScenes.ts 머리말), 그때의 마이그레이션을
    // 태워 올린다.
    expect(buildRuleScene(id).schemaVersion, id).toBe(CURRENT_DRILL_SCHEMA);
  });
});

describe('RULE_SCENE_GEO ↔ court.ts 드리프트', () => {
  // ⚠️ 2026-08-31 신설 — `ruleScenes.ts` 꼬리 주석이 **세 번 약속하고 세 번 안 붙인** 그 단언이다.
  // 그동안 그 파일 머리말은 "이 테스트가 드리프트를 잡는다" 고 적었지만 `rg courtDefFor
  // src/features/rules/*.test.ts` 는 0건이었다. 네 번째 약속을 적는 대신 여기 붙인다.
  //
  // 무엇을 지키나: 남은 손코딩 장면 9개의 좌표는 GEO 를 **참조하지 않고** 손 리터럴로 적혀 있고,
  // GEO 는 그 숫자가 어디서 나왔는지를 적어 둔 대조표다. court.ts 의 28×15 계산(마진·PX_PER_M·
  // 골 폭·골에어리어·페널티 마크)이 바뀌면 그 리터럴들은 **조용히** 코트와 어긋난다 — 장면이
  // 여전히 뜨고 validateDrill 도 통과하므로 아무도 모른다. 이 단언은 그 순간 GEO 를 빨갛게 만들어
  // "손코딩 장면 9개의 좌표를 다시 봐야 한다" 를 알린다.
  // 빨개졌다면 고칠 곳은 GEO 만이 아니다: GEO 를 새 계산에 맞춘 다음, 그 값을 전제로 적힌 (1) 갈래
  // 좌표들을 같이 옮겨야 한다.
  it('28×15 풀 코트 상수가 courtDefFor 의 계산과 일치한다', () => {
    const def = courtDefFor('full', '28x15');
    const s = def.surface;
    const center = { x: s.x + s.w / 2, y: s.y + s.h / 2 };

    expect({ vbW: RULE_SCENE_GEO.vbW, vbH: RULE_SCENE_GEO.vbH }, 'viewBox').toEqual({
      vbW: def.vbW,
      vbH: def.vbH,
    });
    // GEO 는 경기면을 두 모서리(x0,y0)-(x1,y1) 로, court.ts 는 원점+크기로 적는다 — 같은 사각형이다.
    expect(RULE_SCENE_GEO.surface, '경기면').toEqual({
      x0: s.x,
      y0: s.y,
      x1: s.x + s.w,
      y1: s.y + s.h,
    });
    expect({ x: RULE_SCENE_GEO.cx, y: RULE_SCENE_GEO.cy }, '경기면 중심').toEqual(center);
    // 센터 마크는 하프라인의 중점 = 경기면 중심이다(court.ts buildFullCourt). `def.centerMark` 는
    // path 문자열이라 좌표로 비교할 수 없어, 그것이 그려지는 점을 대신 건다.
    expect(RULE_SCENE_GEO.centerMark, '센터 마크').toEqual(center);

    // 골포스트 4개 = (좌·우 골라인) × (위·아래 포스트). court.ts 의 배열 순서와 같은 순서로 적는다.
    expect(def.goalPosts, '골포스트').toEqual([
      { x: RULE_SCENE_GEO.goalLeftX, y: RULE_SCENE_GEO.goalTopY },
      { x: RULE_SCENE_GEO.goalLeftX, y: RULE_SCENE_GEO.goalBottomY },
      { x: RULE_SCENE_GEO.goalRightX, y: RULE_SCENE_GEO.goalTopY },
      { x: RULE_SCENE_GEO.goalRightX, y: RULE_SCENE_GEO.goalBottomY },
    ]);

    // 골에어리어 = ruleZones 두 개(좌·우). GEO 는 여기서도 두 모서리로 적는다.
    const { areaLeft, areaRight, areaDepth } = RULE_SCENE_GEO;
    expect(def.ruleZones, '골에어리어').toEqual([
      { x: areaLeft.x0, y: areaLeft.y0, w: areaLeft.x1 - areaLeft.x0, h: areaLeft.y1 - areaLeft.y0 },
      { x: areaRight.x0, y: areaRight.y0, w: areaRight.x1 - areaRight.x0, h: areaRight.y1 - areaRight.y0 },
    ]);
    // `areaDepth` 는 위 사각형과 따로 적힌 값이라 둘이 갈릴 수 있다 — 갈리면 여기서 걸린다.
    expect([areaLeft.x1 - areaLeft.x0, areaRight.x1 - areaRight.x0], '골에어리어 깊이').toEqual([
      areaDepth,
      areaDepth,
    ]);

    expect(def.spotMarks, '페널티 마크').toEqual([RULE_SCENE_GEO.penaltyLeft, RULE_SCENE_GEO.penaltyRight]);
  });
});

describe('ruleContent ↔ ruleScenes 연결', () => {
  it('sceneId 가 있는 모든 조항이 buildRuleScene 이 실제로 처리하는 값을 가리킨다', () => {
    const laws = ruleContentFor('ko');
    const withScene = laws.filter((l) => l.sceneId !== undefined);
    expect(withScene.length).toBeGreaterThan(0);
    for (const law of withScene) {
      expect(() => buildRuleScene(law.sceneId as RuleSceneId), `law ${law.law}`).not.toThrow();
      expect(RULE_SCENE_IDS, `law ${law.law}`).toContain(law.sceneId);
    }
  });

  it('RULE_SCENE_IDS 는 정확히 22개다', () => {
    // 21 → 23 (2026-09-01). 기현님이 새 드릴 4벌을 주셨고, 그중 둘은 손코딩 장면을 **교체**했고
    // (two-on-one-gk · contested-touch) 둘은 **신설**이다:
    //   `two-on-one-gk-only` — 골키퍼 면제가 팀 전체 면제가 아니라는 것
    //   `gk-behind-line`     — 골라인 뒤 골키퍼의 5m 예외(정본 Law 13 에 빠져 있던 조항)
    // 23 → 22 (2026-09-04). 기현님 지시로 카드 8 1번째 장면(ramming)을 지웠다 — 어디에도 배치
    // 안 되는 장면은 남겨 두지 않는다(ruleTopics.test.ts 의 '고아 장면 없음' 불변식과 같은 원칙, ruleScenes.ts
    // 머리말 참조). 개수를 하드코딩해 두는 이유는 장면이 **조용히 늘거나 줄지 않게** 하기
    // 위해서다 — 늘리거나 줄이는 커밋은 반드시 이 줄을 함께 고치며 "왜 바뀌었나" 를 적게 된다.
    expect(RULE_SCENE_IDS).toHaveLength(22);
  });
});

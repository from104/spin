// §3 seed 드릴 — **스펙 → Drill 변환기**의 계약. 여기서 지키는 것은 *"내용이 좋은가"* 가 아니라
// *"내용이 무엇이든 앱이 삼킬 수 있는 문서가 되는가"* 다.
//
// ⚠️ 2026-09-06 — **이 파일에서 케이스 4묶음(콘텐츠 계약)을 지웠다.** 그것들은 전부 손코딩 시드
// 3벌(`seedDrillContent.ts`)의 **본문을 전제**하고 있었다: 초·중·고 하나씩이라는 것, 스텝 메모가
// *"① 훈련 내용 ⏎ ② 조작: …"* 두 도막이라는 것, 교육 필드 7종이 채워져 있다는 것, 대본이 앱의
// 말(선수·공·콘·선·메모·스텝 시간·실명)을 한 번씩 쓴다는 것. 첫 실행 시드가 규칙 화면 장면으로
// 바뀌면서(기현 지시 2026-09-06, docs/PLAN-SEED-FROM-RULES.md) 그 본문이 폐기됐으므로 단언들은
// 남은 데이터가 없다. 왕복 동일성·코트 밖·겹침 같은 **형식** 반증선은 사라진 것이 아니라 심는
// 것 22벌 위로 옮겨 갔다 — `features/rules/ruleScenes.test.ts` 의 「첫 실행 시드」 절.
//
// 남은 것은 변환기 자체의 계약뿐이다. 규칙 장면 (1) 갈래 3벌이 여전히 `buildSeedDrill` 로
// 만들어지므로(ruleScenes.ts 머리말) 이 계약은 살아 있다.
import { describe, it, expect } from 'vitest';
import { buildSeedDrill, type SeedDrillSpec } from './seedDrills.ts';
import { DRILL_LEVELS } from './drill.ts';

describe('buildSeedDrill — 변환기 자체', () => {
  const minimal: SeedDrillSpec = {
    title: '변환기 시험',
    drillType: 'tactical',
    level: '중급',
    courtMode: 'full',
    durationMin: 5,
    steps: [{ name: '한 장', note: '내용입니다.\n조작: 이렇게 합니다.', chairs: { 'home-2': [200, 200, 0] } }],
  };

  it('명단은 8명 그대로다 — 스텝에 안 놓인 선수도 트레이 주차 슬롯에 남아야 한다', () => {
    const d = buildSeedDrill(minimal, 1);
    expect(d.cast.chairs).toHaveLength(8);
    expect(Object.keys(d.steps[0]!.chairs)).toHaveLength(1);
  });

  it('공 개수를 스텝에서 파생한다 — 스펙에 개수 필드가 없어 어긋날 수 없다', () => {
    const two = buildSeedDrill({ ...minimal, steps: [{ ...minimal.steps[0]!, balls: [[10, 10], [20, 20]] }] }, 1);
    expect(two.cast.balls).toHaveLength(2);
    // 대조군 — 공이 한 번도 안 나오는 스펙은 cast 에도 공이 없다(놓지도 못하는 유령 방지).
    expect(buildSeedDrill(minimal, 1).cast.balls).toHaveLength(0);
  });

  it('콘 색이 드릴 쪽 배열 순서대로 붙는다', () => {
    const d = buildSeedDrill({ ...minimal, cones: [1, 0], steps: [{ ...minimal.steps[0]!, cones: [[10, 10], [20, 20]] }] }, 1);
    expect(d.cast.cones.map((c) => c.colorIndex)).toEqual([1, 0]);
  });

  it('실명은 적은 자리에만 붙는다', () => {
    const d = buildSeedDrill({ ...minimal, players: { 'home-2': '민수' } }, 1);
    const byNumber = Object.fromEntries(d.cast.chairs.filter((c) => c.team === 'home').map((c) => [c.number, c.name]));
    expect(byNumber['2']).toBe('민수');
    expect(byNumber['3']).toBeUndefined();
  });

  it('durationMs 는 적은 스텝에만 실린다 — 안 적은 스텝에 0 을 심으면 재생이 멈춘다', () => {
    const d = buildSeedDrill({ ...minimal, steps: [minimal.steps[0]!, { ...minimal.steps[0]!, durationMs: 3000 }] }, 1);
    expect('durationMs' in d.steps[0]!).toBe(false);
    expect(d.steps[1]!.durationMs).toBe(3000);
  });

  it('DRILL_LEVELS 밖의 난이도는 애초에 타입이 막는다(런타임 폴백에 기대지 않는다)', () => {
    expect(DRILL_LEVELS as readonly string[]).toContain(buildSeedDrill(minimal, 1).level);
  });
});

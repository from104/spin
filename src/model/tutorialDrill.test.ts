// 따라하기 드릴이 **그 언어로** 심기는가 (2026-09-16, T7).
//
// 지우면 새는 것: 내보낸 판에는 한국어 한 벌뿐이라, 덮는 것을 빼먹으면 영어·일본어 사용자의
// 드릴 목록 **맨 위**에 "sample"·"우리 팀"·"상대" 가 한국어로 앉는다. 화면은 멀쩡히 그려지고
// 에러도 없다 — 그 언어로 쓰는 사람만 본다.
//
// 그림(좌표·스텝)은 여기서 안 잰다. 그건 기현님이 편집기로 만든 것이고, 온전히 심기는가는
// `storage/seed.test.ts` 가 22벌과 함께 IDB 왕복·스키마·보정 0 으로 잰다.
import { describe, expect, it } from 'vitest';
import { TUTORIAL_DRILL_ID, tutorialDrill } from './tutorialDrill.ts';
import { TUTORIAL_DRILL_RAW } from './tutorialDrillData.ts';

const AT = 1_700_000_000_000;

describe('따라하기 드릴', () => {
  it('제목과 팀 이름이 언어를 따른다 — 셋이 서로 달라야 덮는 일이 실제로 일어난 것이다', () => {
    const titles = (['ko', 'en', 'ja'] as const).map((l) => tutorialDrill(l, AT).title);
    expect(new Set(titles).size, '세 언어의 제목이 같다 — 번역을 안 거쳤다').toBe(3);
    for (const t of titles) expect(t).not.toBe(TUTORIAL_DRILL_RAW.title); // 'sample' 이 새어 나가면 안 된다

    const en = tutorialDrill('en', AT);
    expect(en.teams.home.label).not.toBe('우리 팀');
    expect(en.teams.away.label).not.toBe('상대');
    // 색은 그대로다 — 언어가 팀 색을 바꾸면 안 된다.
    expect(en.teams.home.color).toBe(TUTORIAL_DRILL_RAW.teams.home.color);
  });

  it('id 와 시각은 호출부가 정한 고정값이다 — 기계가 뽑으면 실행할 때마다 다른 드릴이 된다', () => {
    const d = tutorialDrill('ko', AT);
    expect(d.id).toBe(TUTORIAL_DRILL_ID);
    expect(d.id).not.toBe(TUTORIAL_DRILL_RAW.id); // 내보낸 판의 id 를 그대로 쓰지 않는다
    expect([d.createdAt, d.updatedAt]).toEqual([AT, AT]);
  });

  it('난이도는 **원문 그대로** 둔다 — 여기서 번역하면 비교·필터가 언어마다 갈린다', () => {
    for (const l of ['ko', 'en', 'ja'] as const)
      expect(tutorialDrill(l, AT).level).toBe(TUTORIAL_DRILL_RAW.level);
  });

  it('돌려준 드릴을 **깊이** 고쳐도 원본이 안 더러워진다 — 모듈 상수가 오염되면 그 뒤 전부가 틀린다', () => {
    // ⚠️ 이 단언은 한 번 **자기증명**이었다: 처음에는 `tutorialDrill()` 을 부르기만 하고
    //    `JSON.stringify(RAW)` 가 그대로인지 봤는데, 이 함수는 전개(`{...d}`)만 하므로 복제를
    //    빼도 원본을 안 건드린다 — 즉 `structuredClone` 을 지워도 초록이었다(돌연변이로 확인).
    //    새는 곳은 «부른 뒤» 가 아니라 «돌려준 것을 고친 뒤» 다: 전개는 얕아서 `steps`·`cast` 가
    //    모듈 상수와 **같은 객체**로 남고, 누가 그것을 제자리에서 고치면 그 프로세스의 남은
    //    모든 호출이 더러워진 판을 받는다. 그래서 깊은 자리를 실제로 고쳐 본다.
    const d = tutorialDrill('en', AT);
    (d.steps[0] as { name: string }).name = 'MUTATED';
    (d.cast.chairs[0] as { number: string }).number = 'MUTATED';
    expect(TUTORIAL_DRILL_RAW.steps[0]!.name).not.toBe('MUTATED');
    expect(TUTORIAL_DRILL_RAW.cast.chairs[0]!.number).not.toBe('MUTATED');
  });
});

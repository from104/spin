// §3.11/SUMMARY_BUILD 3 — 목록 카드 부제(드릴 짧은 설명). 계획 문서(PLAN-STEP-EDITING.md
// §텍스트의 소속)의 확정: `Drill.description` 은 목록 카드에 부제로 뜬다. 여기서 검증하는 건
// summary.ts 의 변환 규칙 자체다 — 렌더 쪽(부제 줄 유무)은 DrillCard.test.tsx 가 맡는다.
import { describe, expect, it } from 'vitest';
import { buildSummary, SUMMARY_BUILD } from './summary.ts';
import { createDrill } from './defaults.ts';

function drillWith(description: string | undefined) {
  return { ...createDrill({ courtMode: 'full', title: '부제 검증 드릴' }), description };
}

describe('DrillSummary.description — SUMMARY_BUILD 3', () => {
  it('description 첫 줄이 부제로 실린다', () => {
    const s = buildSummary(drillWith('한 줄 설명\n둘째 줄은 안 보임'));
    expect(s.description).toBe('한 줄 설명');
  });

  it('description 이 없으면 키 자체가 없다 — {description: undefined} 를 남기지 않는다', () => {
    // validate.ts 121행 교리와 같은 이유: structuredClone(IDB)은 undefined 값도 키로
    // 보존하고 JSON(export)은 지워서, 그 한 줄이 저장·내보내기 왕복마다 문서를 바꾼다.
    const s = buildSummary(drillWith(undefined));
    expect('description' in s).toBe(false);
  });

  it('빈 문자열·공백뿐인 첫 줄도 키를 생략한다', () => {
    expect('description' in buildSummary(drillWith(''))).toBe(false);
    expect('description' in buildSummary(drillWith('   \n둘째 줄'))).toBe(false);
  });

  it('상한(SUBTITLE_MAX = LIMITS.titleLen = 80) 을 넘으면 잘린다', () => {
    const long = 'A'.repeat(120);
    const s = buildSummary(drillWith(long));
    expect(s.description).toHaveLength(80);
    expect(s.description).toBe('A'.repeat(80));
  });

  it('searchKey 에 description 이 들어간다 — 카드가 부제로 읽으므로 reason① 이 안 선다', () => {
    const s = buildSummary(drillWith('스핀턴전개 연습용 설명'));
    expect(s.searchKey).toContain('스핀턴전개');
  });

  it('SUMMARY_BUILD 는 5다 — i18n C4 에서 searchKey 가 세 언어를 전부 싣도록 확장됐다', () => {
    expect(SUMMARY_BUILD).toBe(5);
  });

  it('요약이 유형을 싣고 searchKey 가 한국어 라벨로 찾힌다 (BUILD 4)', () => {
    const s = buildSummary({ ...createDrill({ courtMode: 'full', drillType: 'set-piece' }), situation: 'kick-in' as const });
    expect(s.drillType).toBe('set-piece');
    expect(s.situation).toBe('kick-in');
    expect(s.searchKey).toContain('세트피스');
    expect(s.searchKey).toContain('킥인');
    // 옛 category 필드는 요약에서 사라졌다 — 죽은 키를 남기지 않는다(summary.ts BUILD 4 주석).
    expect('category' in s).toBe(false);
  });

  it('searchKey 는 세 언어 라벨을 전부 싣는다 (BUILD 5, i18n C4) — UI 언어와 무관하게 찾혀야 한다', () => {
    // 소문자로 접기 전에 합치므로 영어 라벨도 소문자로 들어간다(buildSearchKey 의 .toLowerCase()).
    const s = buildSummary({ ...createDrill({ courtMode: 'full', drillType: 'set-piece' }), situation: 'kick-in' as const });
    expect(s.searchKey).toContain('세트피스');
    expect(s.searchKey).toContain('set piece'); // 'Set Piece' → 소문자로 접힌다(buildSearchKey)
    expect(s.searchKey).toContain('セットプレー');
    expect(s.searchKey).toContain('킥인');
    expect(s.searchKey).toContain('kick-in');
    expect(s.searchKey).toContain('キックイン');
  });

  it('situation 미지정이면 요약에도 키가 없다', () => {
    const s = buildSummary(createDrill({ courtMode: 'full' }));
    expect('situation' in s).toBe(false);
  });
});

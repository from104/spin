// 규칙 화면(2026-08-21 신설)의 "문서가 사실인지 확인하는 테스트" — docsMatchCode.test.ts 와
// 같은 발상이지만 다른 방향이다: 그쪽은 REQUIREMENTS.md 를 **코드 상수**와 대조하지만, 이
// 조항 데이터는 코드가 계산한 값이 아니라 FIPFA 원문을 사람이 옮겨 적은 것이다(외부 규칙
// 문서에는 파생시킬 코드 상수가 없다). 그래서 여기서는 두 **사람이 쓴 텍스트**
// (docs/RULES-FIPFA-2025.md ↔ ruleContent.ts)가 서로 어긋나지 않는지를 대조한다 — 한쪽만
// 고치고 다른 쪽을 잊는 드리프트가 목표다.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ruleContentFor } from './ruleContent.ts';

const DOC = readFileSync('docs/RULES-FIPFA-2025.md', 'utf-8');
const LAWS = ruleContentFor('ko');

describe('규칙 화면 콘텐츠 ↔ docs/RULES-FIPFA-2025.md', () => {
  it('ruleContentFor 는 18개 조항을 1~18 빠짐없이 갖는다', () => {
    expect(LAWS).toHaveLength(18);
    expect(LAWS.map((l) => l.law)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it('각 조항 번호가 정본 문서의 "## Law N —" 절과 대응한다', () => {
    for (const law of LAWS) {
      expect(DOC, `Law ${law.law}`).toContain(`## Law ${law.law} —`);
    }
  });

  // 손으로 고른 "핵심 수치" 목록이다(docsMatchCode.test.ts 의 "손-숫자 금지"와 다른 이유는
  // 파일 머리말 참고 — 코드에서 파생시킬 상수가 애초에 없는 도메인 데이터다). 둘 중 한쪽에서
  // 이 수치가 빠지거나 값이 바뀌면(예: 5m → 4m 오탈자) 여기서 잡힌다.
  const CORE_FACTS = ['3m', '5m', '3.5m', '8m', '6m', '10km/h', '50.8cm', '20분', '1m'];

  it.each(CORE_FACTS)('핵심 수치 %s 가 정본 문서와 화면 콘텐츠 양쪽에 있다', (fact) => {
    expect(DOC, 'RULES-FIPFA-2025.md').toContain(fact);
    const appText = LAWS.flatMap((l) => [l.title, ...l.summary]).join('\n');
    expect(appText, 'ruleContent.ts').toContain(fact);
  });
});

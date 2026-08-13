// 2026-08-14 선행 수리 (설계서 §7 표) — InspectorPanel 의 하드코딩 minHeight:44 두 곳(명단 행 ·
// '스텝 추가')과 hex aria-label 스와치. jsdom 은 CSS 변수를 계산하지 않으므로 styles/a11y.test.ts
// 관례를 따라 **소스 텍스트**에 못을 박는다. 렌더된 값 쪽은 InspectorPanel.colorName.test.tsx 가 본다.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// vitest 는 프로젝트 루트를 cwd 로 실행한다(a11y.test.ts 와 같은 전제).
const SRC = readFileSync('src/features/editor/InspectorPanel.tsx', 'utf-8');

describe('InspectorPanel 터치 타깃 — minHeight 44 리터럴 금지', () => {
  it('minHeight: 44 리터럴이 0회 — 44 로 박으면 큰 터치 타깃(--hit 44→56)을 켜도 그 표적만 안 커진다', () => {
    // \b 로 44 뒤를 끊어 minHeight:440 같은 값은 오탐하지 않되, 72·56(텍스트영역 최소높이,
    // 터치 타깃 아님)은 일부러 대상에서 뺀다 — 금지 대상은 '표적 크기 44' 하드코딩뿐이다.
    expect(SRC.match(/minHeight:\s*44\b/g) ?? []).toEqual([]);
  });

  it("대조군: minHeight: 'var(--hit)' 가 4곳 이상 남아 있다 — 정규식이 소스를 실제로 읽고 있다", () => {
    // 기존 2곳(공용 스타일 상수) + 이번 수리 2곳(명단 행 · 스텝 추가). 이 대조군이 없으면
    // 위 단언은 파일 경로가 틀려도(빈 문자열) 초록이 된다.
    expect((SRC.match(/minHeight:\s*'var\(--hit\)'/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});

describe('색 스와치 aria-label — hex 가 아니라 한국어 이름', () => {
  it('스와치가 TEAM_COLOR_NAMES 를 라벨로 쓰고, hex(c) 를 그대로 라벨로 내거는 곳이 없다', () => {
    expect(SRC).toContain('aria-label={TEAM_COLOR_NAMES[c]}');
    // 되돌리면(aria-label={c}) 스크린리더가 '빨강' 대신 "#d93a3a" 를 낱글자로 읽는다.
    expect(SRC).not.toContain('aria-label={c}');
  });
});

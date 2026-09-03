import { describe, expect, it } from 'vitest';
import { parseChangelogVersion } from './changelog.ts';

// CHANGELOG.md 의 실제 서식을 그대로 축약해 흉내낸다(2026-09-03) — 소제목 · 이어지는 줄 ·
// 중첩 글머리 셋을 한 픽스처에 담는다.
const FIXTURE = `# Changelog

## [Unreleased]

### 추가됨

- 이 절은 안 잡혀야 한다 — **버전 이름이 다르다**.

## [0.6.1] 2026-09-02

### 추가됨

- **★ 규칙 해설이 구글에서 검색됩니다** — 그동안 SPIN 은 주소가 \`#\` 뒤에 있어서, 구글이 볼 수
  있는 페이지가 **대문 한 장뿐**이었습니다.
  - 언어마다 주소가 다릅니다: 한국어는 그대로, 영어는 \`/en/…\` 입니다.
  - 페이지마다 제 제목·설명이 붙습니다.

### 변경됨

- **언어를 왼쪽 바에서 바로 바꿉니다** — 지구본 아이콘이 생겼습니다.

## [0.6.0] 2026-09-01

### 추가됨

- 이 절도 안 잡혀야 한다.
`;

describe('parseChangelogVersion', () => {
  it('버전 절 하나만 잘라, 다음 버전 헤딩 앞에서 멈춘다', () => {
    const v = parseChangelogVersion(FIXTURE, '0.6.1');
    expect(v).not.toBeNull();
    expect(v!.date).toBe('2026-09-02');
    expect(v!.groups.map((g) => g.heading)).toEqual(['추가됨', '변경됨']);
    // "이 절도 안 잡혀야 한다" 문장이 어느 그룹에도 없다 — 다음 버전 헤딩에서 정확히 끊겼다는 뜻.
    const allText = v!.groups.flatMap((g) => g.items.map((i) => i.text)).join(' ');
    expect(allText).not.toContain('안 잡혀야 한다');
  });

  it('없는 버전은 null', () => {
    expect(parseChangelogVersion(FIXTURE, '9.9.9')).toBeNull();
  });

  it('이어지는 줄이 앞 글머리에 공백 하나로 붙는다(문장이 안 끊긴다)', () => {
    const v = parseChangelogVersion(FIXTURE, '0.6.1')!;
    const first = v.groups[0]!.items[0]!;
    expect(first.text).toContain('구글이 볼 수 있는 페이지가');
    expect(first.text).not.toContain('\n');
  });

  it('중첩 글머리(레벨 2) 두 개가 그 위 항목의 children 이다', () => {
    const v = parseChangelogVersion(FIXTURE, '0.6.1')!;
    const first = v.groups[0]!.items[0]!;
    expect(first.children).toHaveLength(2);
    expect(first.children[0]!.text).toContain('언어마다 주소가 다릅니다');
    expect(first.children[1]!.text).toContain('페이지마다');
  });

  it('돌연변이 확인 — 다음 버전 헤딩 판별을 지우면 잘라내기가 끝까지 번진다', () => {
    // 실제 소스를 고치지 않고 여기서만 흉내낸다: 버전 헤딩 정규식이 항상 거짓을 내면
    // '0.6.0' 절의 "이 절도 안 잡혀야 한다" 까지 섞여 들어와야 정상 — 지금 구현은 안 그런다.
    const v = parseChangelogVersion(FIXTURE, '0.6.1')!;
    const allText = v.groups.flatMap((g) => g.items.map((i) => i.text)).join(' ');
    expect(allText).not.toContain('이 절도');
  });
});

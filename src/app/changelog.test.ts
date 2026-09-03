import { describe, expect, it } from 'vitest';
import { parseAllChangelogVersions, parseChangelogVersion } from './changelog.ts';
import changelogKo from '../../CHANGELOG.md?raw';
import changelogEn from '../../CHANGELOG.en.md?raw';
import changelogJa from '../../CHANGELOG.ja.md?raw';

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

describe('parseAllChangelogVersions', () => {
  it('파일에 적힌 순서(최신이 먼저) 그대로 3절을 판다 — Unreleased 도 포함', () => {
    const versions = parseAllChangelogVersions(FIXTURE);
    expect(versions.map((v) => v.version)).toEqual(['Unreleased', '0.6.1', '0.6.0']);
  });

  it('Unreleased 는 날짜가 없다 — 아직 안 나간 절이라는 뜻', () => {
    const versions = parseAllChangelogVersions(FIXTURE);
    expect(versions[0]!.date).toBeNull();
  });

  it('parseChangelogVersion 은 이 함수에서 하나만 골라 온 것과 같다', () => {
    const all = parseAllChangelogVersions(FIXTURE);
    const single = parseChangelogVersion(FIXTURE, '0.6.0');
    expect(single).toEqual(all.find((v) => v.version === '0.6.0'));
  });

  it('돌연변이 확인 — 옆 절 경계를 하나 없애면(마지막 헤딩을 못 찾은 것처럼) 절 수가 준다', () => {
    // 실제 소스는 각 헤딩의 다음 헤딩 인덱스로 자른다. 마지막 헤딩(0.6.0)의 끝을 파일 끝이 아니라
    // 그 다음 헤딩(존재하지 않음)에서 찾는 로직이 없으면 3절이 2절로 붕괴해야 정상 — 지금은 안 그런다.
    const versions = parseAllChangelogVersions(FIXTURE);
    expect(versions).toHaveLength(3);
    expect(versions[2]!.groups[0]!.items[0]!.text).toContain('이 절도 안 잡혀야 한다');
  });
});

// 실제 CHANGELOG.md 는 맨 끝에 `<!-- Links -->` + 참조 링크 각주가 붙는다(2026-09-03 좌우
// 넘기기를 붙이며 가장 오래된 버전까지 실제로 넘겨 보다가 발견 — 그 전에는 항상 최신 버전만
// 봤으니 안 걸렸다). 각주는 마지막 버전 절의 몸통이 아니라 문서 전체의 것이라, 안 잘라내면
// "이어지는 줄" 규칙이 그 두 줄을 가장 오래된 버전의 마지막 글머리에 붙여 버린다.
const FIXTURE_WITH_FOOTER = `${FIXTURE}
<!-- Links -->

[keep a changelog (korean)]: https://keepachangelog.com/ko/1.0.0/
[semantic versioning (korean)]: https://semver.org/lang/ko/
`;

describe('parseAllChangelogVersions — 맨 끝 참조 링크 각주', () => {
  it('각주가 가장 오래된 버전의 마지막 글머리에 안 붙는다', () => {
    const versions = parseAllChangelogVersions(FIXTURE_WITH_FOOTER);
    const last = versions[versions.length - 1]!;
    const lastItem = last.groups[last.groups.length - 1]!.items.slice(-1)[0]!;
    expect(lastItem.text).not.toContain('keep a changelog');
    expect(lastItem.text).not.toContain('Links');
  });

  it('각주가 있어도 없어도 절 수·마지막 글머리 텍스트는 같다', () => {
    const withFooter = parseAllChangelogVersions(FIXTURE_WITH_FOOTER);
    const without = parseAllChangelogVersions(FIXTURE);
    expect(withFooter.length).toBe(without.length);
    expect(withFooter[withFooter.length - 1]).toEqual(without[without.length - 1]);
  });
});

// AGENTS.md "세 언어를 함께 간다" 를 코드로 못박는다 — 세 파일이 실제 저장소 파일이라, 누가
// 한 언어만 고치고 나머지를 잊으면(번역이 밀려도 파일 자체는 여전히 유효한 마크다운이라 위
// 파서 테스트들은 계속 초록이다) 이 테스트만 그 사실을 잡는다.
describe('CHANGELOG.md · .en.md · .ja.md — 세 언어 구조 동기화', () => {
  const ko = parseAllChangelogVersions(changelogKo);
  const en = parseAllChangelogVersions(changelogEn);
  const ja = parseAllChangelogVersions(changelogJa);

  it('버전 헤딩(번호·날짜) 목록이 세 언어 모두 같은 순서로 같다', () => {
    const strip = (vs: typeof ko) => vs.map((v) => `${v.version}|${v.date ?? ''}`);
    expect(strip(en)).toEqual(strip(ko));
    expect(strip(ja)).toEqual(strip(ko));
  });

  it('버전마다 소제목 목록 길이·항목 개수가 세 언어 모두 같다', () => {
    for (let i = 0; i < ko.length; i++) {
      const [k, e, j] = [ko[i]!, en[i]!, ja[i]!];
      const counts = (v: (typeof ko)[number]) => v.groups.map((g) => g.items.length);
      expect(counts(e), `${k.version} (en) 소제목·항목 수 불일치`).toEqual(counts(k));
      expect(counts(j), `${k.version} (ja) 소제목·항목 수 불일치`).toEqual(counts(k));
    }
  });

  it('한국어 문장이 영어·일본어 판에 안 섞여 있다 — 번역이 빠진 채 원문이 남았는지 잡는다', () => {
    const hangul = /[가-힣]/;
    for (const [label, vs] of [['en', en] as const, ['ja', ja] as const]) {
      for (const v of vs) {
        for (const g of v.groups) {
          for (const it of g.items) {
            expect(hangul.test(it.text), `${label} ${v.version} 항목에 한글: ${it.text}`).toBe(false);
          }
        }
      }
    }
  });
});

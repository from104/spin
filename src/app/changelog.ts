// 변경 내역 모달이 읽는 소스 — CHANGELOG.md 그 자체(2026-09-03, 기현 지시: *"버전 클릭하면 이번
// 버전 changelog 보이는 모달 띄우자"*). 별도 데이터 파일을 만들지 않는다 — 두 벌을 유지하면
// 반드시 어긋난다(RULES-FIPFA-2025.md 를 정본으로 둔 것과 같은 이유). `?raw` 로 파일 내용을
// 문자열째 번들에 넣고 여기서 파싱한다.
//
// 처음엔 "일단 한국어만" 이었다가(모달은 어느 로케일에서 열어도 한국어 텍스트를 그대로 보여줬다),
// 2026-09-03 같은 날 안에 영어·일본어 번역(`CHANGELOG.en.md`·`CHANGELOG.ja.md`)이 붙었다 —
// `ruleTopics.ts`/`ruleTopics.en.ts`/`ruleTopics.ja.ts` 와 같은 파일-당-로케일 관례다. 이 파서는
// **셋 다 같은 형식**이라는 전제로 로케일 무관하게 짠다(`ChangelogModal.tsx` 가 `raw` 를 셋 중
// 하나로 고른다). 세 파일을 함께 유지하는 규칙은 `AGENTS.md` "세 언어를 함께 간다".

/** 파싱된 한 항목 — 위쪽 글머리 하나 + 그 아래 딸린 하위 글머리(있으면). */
export interface ChangelogItem {
  text: string;
  children: readonly ChangelogItem[];
}

/** `### 추가됨`처럼 그 아래 항목들을 묶는 소제목 하나. */
export interface ChangelogGroup {
  heading: string;
  items: readonly ChangelogItem[];
}

/** `## [0.6.1] 2026-09-02` 한 절 전체. */
export interface ChangelogVersion {
  version: string;
  date: string | null;
  groups: readonly ChangelogGroup[];
}

const VERSION_HEADING_RE = /^## \[([^\]]+)\](?:\s+(\S+))?\s*$/;

/** `raw`(CHANGELOG.md 전문)의 `## [version]` 절 전부를, 파일에 나온 순서(최신이 위) 그대로 판다.
 *  버전 모달의 좌우 넘기기(2026-09-03, 기현 지시: *"모든 버전이 모달 헤더 양쪽 버튼으로 좌우로
 *  스크롤 되게"*)가 이 배열 위에서 인덱스만 옮겨 다닌다. */
export function parseAllChangelogVersions(raw: string): ChangelogVersion[] {
  // 파일 맨 끝의 `<!-- Links -->` + 참조 링크 각주(`[label]: url`)는 마지막 버전 절 안이 아니라
  // 문서 전체의 각주다. 이 자르기가 없으면 그 두 줄이 **가장 오래된 버전의 마지막 글머리에**
  // 이어지는 줄로 붙어 버린다(모든 버전 절이 "다음 헤딩 앞까지" 를 자기 몸통으로 보는데, 파일의
  // 진짜 끝은 마지막 헤딩의 몸통이 아니라 각주이기 때문 — 2026-09-03 좌우 넘기기를 넣으며 가장
  // 오래된 버전까지 실제로 넘겨 보다가 발견했다).
  // ⚠️ **`\r\n` 으로 쪼갠다** — 줄 끝의 `\r` 하나가 이 파일 전체를 조용히 비운다(2026-09-16
  // 기현님 MSI 실기 제보: *"버전 체인지로그 구분만 있고 내용이 없다"*). 원인은 윈도우 체크아웃이
  // 준 CRLF 다. 갈리는 자리가 고약하다:
  //   · `## [0.6.10]` — `\s*$` 의 `\s` 가 `\r` 를 먹어 **통과한다**
  //   · `### 추가됨`  — `startsWith` 라 `\r` 와 무관하게 **통과한다**
  //   · `- 글머리`    — 자바스크립트의 `.` 은 `\r` 를 **안 먹고**, `m` 없는 `$` 는 `\r` 앞에서
  //     끝나지 않는다. 그래서 **글머리만 전부 떨어진다.**
  // 실측(CHANGELOG.md 전문): LF 는 버전 19·소제목 47·글머리 277, CRLF 는 19·47·**0**.
  // 곧 «칸은 다 있는데 안이 비어 있는» 화면이 되고, 오류는 한 줄도 안 난다.
  // `.gitattributes` 로 체크아웃을 LF 로 고정했지만 그것만 믿지 않는다 — 사본이 어떤 경로로
  // 들어오든(압축 해제·복사·편집기) 파서 쪽에서 한 번 더 막는다.
  const allLines = raw.split(/\r?\n/);
  const footerAt = allLines.findIndex((l) => l.trimStart().startsWith('<!--'));
  const lines = footerAt === -1 ? allLines : allLines.slice(0, footerAt);
  const headings: { index: number; version: string; date: string | null }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = VERSION_HEADING_RE.exec(lines[i]!);
    if (m) headings.push({ index: i, version: m[1]!, date: m[2] ?? null });
  }

  return headings.map(({ index, version, date }, i) => {
    const end = i + 1 < headings.length ? headings[i + 1]!.index : lines.length;
    return { version, date, groups: parseGroups(lines.slice(index + 1, end)) };
  });
}

/** `raw` 에서 `## [version]` 절 하나만 잘라 파싱한다. 없으면 `null`. */
export function parseChangelogVersion(raw: string, version: string): ChangelogVersion | null {
  return parseAllChangelogVersions(raw).find((v) => v.version === version) ?? null;
}

/** `### 소제목` + `- 글머리`(2단, 연속 줄은 앞 항목에 이어붙임) 만 다룬다 — CHANGELOG.md 가
 *  실제로 쓰는 서식이 이것뿐이다. 표·코드블록 등은 여기 나온 적이 없어 다루지 않는다. */
function parseGroups(lines: readonly string[]): ChangelogGroup[] {
  const groups: ChangelogGroup[] = [];
  let group: ChangelogGroup | null = null;
  let item: ChangelogItem | null = null; // 최상위(레벨 1) 글머리
  let sub: ChangelogItem | null = null; // 그 아래(레벨 2) 글머리

  for (const raw of lines) {
    if (raw.startsWith('### ')) {
      group = { heading: raw.slice(4).trim(), items: [] };
      groups.push(group);
      item = null;
      sub = null;
      continue;
    }
    const subMatch = /^ {2}- (.*)$/.exec(raw);
    const topMatch = !subMatch && /^- (.*)$/.exec(raw);
    if (topMatch) {
      if (!group) {
        group = { heading: '', items: [] };
        groups.push(group);
      }
      item = { text: topMatch[1]!, children: [] };
      (group.items as ChangelogItem[]).push(item);
      sub = null;
      continue;
    }
    if (subMatch) {
      if (!item) continue; // 형식을 벗어난 줄(정본에 나온 적 없다) — 조용히 건너뛴다
      sub = { text: subMatch[1]!, children: [] };
      (item.children as ChangelogItem[]).push(sub);
      continue;
    }
    if (raw.trim() === '') continue; // 문단 사이 빈 줄
    // 이어지는 줄 — 직전 글머리(레벨 2 가 있으면 그쪽)에 공백 하나로 붙인다.
    const text = raw.trim();
    if (sub) (sub as { text: string }).text += ` ${text}`;
    else if (item) (item as { text: string }).text += ` ${text}`;
  }
  return groups;
}

// 변경 내역 모달이 읽는 소스 — CHANGELOG.md 그 자체(2026-09-03, 기현 지시: *"버전 클릭하면 이번
// 버전 changelog 보이는 모달 띄우자"*). 별도 데이터 파일을 만들지 않는다 — 두 벌을 유지하면
// 반드시 어긋난다(RULES-FIPFA-2025.md 를 정본으로 둔 것과 같은 이유). `?raw` 로 파일 내용을
// 문자열째 번들에 넣고 여기서 파싱한다.
//
// ⚠️ **일단 한국어만**이다. CHANGELOG.md 자체가 한국어로만 쓰이므로, 모달은 어느 로케일에서 열어도
// 이 텍스트를 그대로 보여준다 — 카드·규칙 화면과 같은 패턴("일단 한국어만" 지시가 반복해서 쓰는
// 뜻: 콘텐츠는 한 언어, 여는 문(버튼)은 세 언어 모두에 있다).

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

/** `raw`(CHANGELOG.md 전문)에서 `## [version]` 절 하나를 잘라 파싱한다. 없으면 `null`. */
export function parseChangelogVersion(raw: string, version: string): ChangelogVersion | null {
  const lines = raw.split('\n');
  let start = -1;
  let date: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const m = VERSION_HEADING_RE.exec(lines[i]!);
    if (m && m[1] === version) {
      start = i + 1;
      date = m[2] ?? null;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (VERSION_HEADING_RE.test(lines[i]!)) {
      end = i;
      break;
    }
  }

  return { version, date, groups: parseGroups(lines.slice(start, end)) };
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

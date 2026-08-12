// §5.6 — CSS **계약 테스트용 순수 파서**. 프로덕션 번들은 이 파일을 import 하지 않는다.
//
// 왜 테스트 파일 안에 인라인하지 않고 모듈로 뺐는가:
//   print.test.ts 는 파서를 자기 안에 인라인했다. 그래서 파서 자체는 **아무 단언도 받지 않는다** —
//   `mediaPrintBlock` 이 빈 문자열을 돌려주도록 망가지면 `expect(block).toContain(...)` 이 전부
//   빨개지니 다행이지만, 반대로 **너무 많이** 돌려주는 고장(닫는 괄호를 못 찾아 파일 끝까지 반환)은
//   모든 `toContain` 을 통과시킨다. 이 저장소가 겪은 헛통과 4형태 중 "성질이 함수 뒤에 숨는다" 가
//   정확히 그것이다. 파서를 밖으로 빼면 파서에 직접 단언을 걸 수 있다(cssContract.test.ts).
//
// 규약: `head` 는 셀렉터/at-rule 서두의 **문자 그대로**다(정규식 아님). 공백까지 파일과 같아야
// 맞는다 — 대신 오탈자가 나면 `null`/`[]` 이 돌아와 계약 테스트가 빨개진다(조용히 통과하지 않는다).

/** 주석 제거. 이 저장소의 CSS 는 주석이 본문보다 길고 그 안에 규칙을 **인용**한다 —
 *  안 걷어내면 규칙을 설명하는 주석이 블록 시작으로 잡힌다(print.test.ts 가 실제로 겪었다). */
export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** `open` 위치의 `{` 와 짝이 맞는 `}` 사이 본문. 중첩(`@media { .a { } }`)을 세어 자른다.
 *  짝을 못 찾으면 `null` — **파일 끝까지 반환하지 않는다**(그 고장이 모든 toContain 을 통과시킨다). */
function braceBody(css: string, open: number): string | null {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return null;
}

/** `head { … }` 의 본문 전부(같은 head 가 여러 번 나오면 등장 순서대로). */
export function blocksOf(css: string, head: string): string[] {
  const out: string[] = [];
  let i = 0;
  for (;;) {
    const at = css.indexOf(head, i);
    if (at < 0) return out;
    i = at + head.length;
    // head 뒤에 (공백을 사이에 두고) 곧바로 `{` 가 와야 한다. `.rule-zone` 을 찾을 때
    // `.rule-zone-x { }` 에 걸리는 것을 이 검사가 막는다.
    const m = /^\s*\{/.exec(css.slice(i));
    if (!m) continue;
    // head 앞은 규칙 경계여야 한다. 이게 없으면 `:root` 로 `:root[data-theme="light"]` 를
    // 찾아버린다(앞 검사만으로는 `[data-theme…]` 가 걸러지지만 반대 방향은 안 걸러진다).
    const before = css.slice(0, at).trimEnd().slice(-1);
    if (before !== '' && before !== '}' && before !== '{' && before !== ';') continue;
    const body = braceBody(css, i + m[0].length - 1);
    if (body !== null) out.push(body);
  }
}

/** 첫 번째 `head { … }` 본문. 없으면 `null`. */
export function blockOf(css: string, head: string): string | null {
  return blocksOf(css, head)[0] ?? null;
}

/** 규칙 본문 한 덩이 → 선언 표. 중첩 규칙(`{ … }`)이 섞인 조각은 그 부분을 건너뛴다.
 *  같은 프로퍼티가 여러 번이면 **뒤가 이긴다**(CSS 캐스케이드와 같다). */
export function declarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  // 중첩 규칙 본문을 통째로 지운다 — `@media` 본문을 그대로 넘겨도 바깥 선언만 남는다.
  let depth = 0;
  let flat = '';
  for (const ch of block) {
    if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    else if (depth === 0) flat += ch;
  }
  for (const part of flat.split(';')) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const prop = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (prop === '' || value === '') continue;
    out[prop] = value;
  }
  return out;
}

/** 같은 head 의 블록 전부를 합친 선언 표(뒤에 나온 블록이 이긴다). tokens.css 처럼
 *  `:root` 가 두 번 나뉘어 있는 파일에서 토큰 값을 읽을 때 쓴다. */
export function declarationsOf(css: string, head: string): Record<string, string> {
  return Object.assign({}, ...blocksOf(css, head).map(declarations)) as Record<string, string>;
}

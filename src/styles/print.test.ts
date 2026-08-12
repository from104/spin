// §6.3 인쇄 스타일 계약. **jsdom 은 CSS 를 적용하지 않으므로 이게 유일한 방법이다** —
// 인쇄 규칙이 하나 사라져도 렌더 테스트는 전건 초록불이고, 사고는 종이에서만 드러난다.
// (선례: appShell.contract.test.ts · a11y.test.ts — "CSS 한 줄은 리팩터링 중에 조용히
// 사라지고, 사라져도 초록불이다" 를 이 저장소는 이미 겪었다.)
//
// `?raw` 임포트는 vitest 기본 설정(test.css:false)이 .css 요청을 빈 문자열로 치환해버려 못
// 쓴다 — node:fs 로 직접 읽는다(a11y.test.ts 와 같은 이유·같은 방식).
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRINT_COURT_CLASS, PRINT_PAGE_CLASS, PRINT_ROOT_CLASS } from '../features/print/printDom.ts';

const read = (p: string): string => readFileSync(p, 'utf-8');
/** 주석을 먼저 걷어낸다. 이 저장소의 CSS 는 주석이 본문보다 길고 그 안에 규칙을 **인용**한다
 *  — 안 걷어내면 `@media print` 를 설명하는 주석이 블록 시작으로 잡힌다(실제로 그랬다). */
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const printCss = stripComments(read('src/styles/print.css'));
const shellCss = stripComments(read('src/styles/appShell.css'));
const mainTsx = read('src/main.tsx');

/** `@media print { … }` 본문. 중괄호를 세어 자른다 — 안에 `@page { … }` 가 중첩돼 있어
 *  정규식 한 방(`[^}]*`)으로는 첫 닫는 괄호에서 잘려 나간다. */
function mediaPrintBlock(css: string): string {
  const at = css.indexOf('@media print');
  if (at < 0) return '';
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return '';
}
const block = mediaPrintBlock(printCss);
/** `@media print` **밖**(= 화면에도 적용되는 부분). */
const outside = printCss.slice(0, printCss.indexOf('@media print'));

/** 규칙 본문 하나를 셀렉터로 찾는다. 셀렉터는 정규식 문자열로 받는다. */
function ruleBody(css: string, selector: string): string {
  // 'm' 플래그를 쓰지 않는다 — 줄머리 ^ 가 `html,\n  body {` 의 둘째 줄에도 걸려
  // 'body' 규칙을 물으면 묶음 규칙이 돌아온다(실제로 그랬다).
  const m = new RegExp(`(?:^|[};])\\s*${selector}\\s*\\{([^}]*)\\}`).exec(css);
  return m?.[1] ?? '';
}

describe('대조군 — 해제 대상이 appShell.css 에 실제로 있다', () => {
  // 이게 빨간불이면 인쇄 스타일이 **없는 것을 되돌리고 있다**는 뜻이다(셸이 바뀌었다).
  it('앱 셸이 여전히 height:100% · overflow:hidden 으로 페이지를 가둔다', () => {
    expect(shellCss).toMatch(/html,\s*body,\s*#root\s*\{[^}]*height:\s*100%/s);
    expect(shellCss).toMatch(/html,\s*body,\s*#root\s*\{[^}]*overflow:\s*hidden/s);
    expect(shellCss).toMatch(/overscroll-behavior:\s*none/);
  });

  it('#root 가 여전히 safe-area 패딩을 먹는다', () => {
    expect(shellCss).toMatch(/#root\s*\{[^}]*env\(safe-area-inset-/s);
  });

  it('body 가 여전히 touch-action·user-select 를 잠근다', () => {
    expect(shellCss).toMatch(/body\s*\{[^}]*touch-action:\s*manipulation/s);
    expect(shellCss).toMatch(/body\s*\{[^}]*user-select:\s*none/s);
  });
});

describe('1순위 [A-11] — 인쇄 시 앱 셸 가둠을 전부 해제한다', () => {
  it('@media print 블록이 있다', () => {
    expect(block.length).toBeGreaterThan(0);
  });

  it('html·body 의 height 를 auto 로 푼다 — 이게 없으면 60스텝이 1페이지로 잘린다', () => {
    const body = ruleBody(block, 'html,\\s*body');
    expect(body).toMatch(/height:\s*auto\s*!important/);
    expect(body).toMatch(/min-height:\s*0\s*!important/);
  });

  it('html·body 의 overflow 를 visible 로 푼다', () => {
    expect(ruleBody(block, 'html,\\s*body')).toMatch(/overflow:\s*visible\s*!important/);
  });

  it('overscroll-behavior 를 되돌린다', () => {
    expect(ruleBody(block, 'html,\\s*body')).toMatch(/overscroll-behavior:\s*auto\s*!important/);
  });

  it('body 의 touch-action·user-select 를 되돌리고 배경을 흰 종이로 만든다', () => {
    const body = ruleBody(block, 'body');
    expect(body, 'var(--bg) 로 두면 다크 테마 사용자가 종이를 잉크로 덮는다').toMatch(/background:\s*#fff\s*!important/);
    expect(body).toMatch(/touch-action:\s*auto\s*!important/);
    expect(body).toMatch(/user-select:\s*auto\s*!important/);
  });

  it('#root 의 safe-area 패딩을 0 으로 만든다', () => {
    expect(ruleBody(block, '#root')).toMatch(/padding:\s*0\s*!important/);
  });

  it('#root 의 height·overflow 도 함께 푼다', () => {
    const root = ruleBody(block, '#root');
    expect(root).toMatch(/height:\s*auto\s*!important/);
    expect(root).toMatch(/overflow:\s*visible\s*!important/);
  });

  it('#root 를 접어 고정 위치 바(하단 트랜스포트·시트)가 장마다 겹쳐 찍히는 것을 막는다', () => {
    expect(ruleBody(block, '#root')).toMatch(/display:\s*none\s*!important/);
  });
});

describe('인쇄 트리는 평소 숨어 있고 인쇄에서만 보인다', () => {
  it(`화면 기본값: .${PRINT_ROOT_CLASS} { display:none } 이 @media print 밖에 있다`, () => {
    expect(ruleBody(outside, `\\.${PRINT_ROOT_CLASS}`)).toMatch(/display:\s*none/);
  });

  it('인쇄에서는 보인다', () => {
    expect(ruleBody(block, `\\.${PRINT_ROOT_CLASS}`)).toMatch(/display:\s*block\s*!important/);
  });

  it('화면 기본 규칙이 !important 가 아니다 — 그러면 인쇄에서 되살릴 수 없다', () => {
    expect(ruleBody(outside, `\\.${PRINT_ROOT_CLASS}`)).not.toContain('!important');
  });
});

describe('색·페이지 나눔', () => {
  it('⚠️ print-color-adjust:exact — 없으면 초록 코트(#1f7a46)가 흰색으로 인쇄된다', () => {
    expect(block).toMatch(/[^-]print-color-adjust:\s*exact/);
    expect(block, '웹킷 접두사 폴백도 함께 있어야 한다').toMatch(/-webkit-print-color-adjust:\s*exact/);
  });

  it('@page 에 크기와 여백이 있다', () => {
    const page = ruleBody(block, '@page');
    expect(page).toMatch(/size:\s*A4\s+landscape/);
    expect(page).toMatch(/margin:\s*\d/);
  });

  it(`.${PRINT_PAGE_CLASS} 가 장 단위다 — break-inside:avoid + break-after:page`, () => {
    const page = ruleBody(block, `\\.${PRINT_PAGE_CLASS}`);
    expect(page).toMatch(/break-inside:\s*avoid/);
    expect(page).toMatch(/break-after:\s*page/);
    // 구형 엔진 폴백 — 새 속성만 쓰면 사파리 계열에서 장 나눔이 통째로 무시된다.
    expect(page).toMatch(/page-break-after:\s*always/);
  });

  it('마지막 장 뒤에는 개행을 넣지 않는다 — 빈 종이 한 장이 더 나온다', () => {
    expect(ruleBody(block, `\\.${PRINT_PAGE_CLASS}:last-child`)).toMatch(/break-after:\s*auto/);
  });

  it('코트 그림은 높이로 잡는다 — 폭 100% 로 두면 그림이 종이보다 커져 1장 1스텝이 깨진다', () => {
    const court = ruleBody(block, `\\.${PRINT_COURT_CLASS}`);
    expect(court).toMatch(/height:\s*\d+mm/);
    expect(court).toMatch(/max-width:\s*100%/);
  });
});

describe('import 순서 — 같은 특정도면 나중 것이 이긴다', () => {
  it('main.tsx 가 print.css 를 읽는다', () => {
    expect(mainTsx).toContain("import './styles/print.css'");
  });

  it('⚠️ print.css 가 **마지막** 스타일시트다 — 앞으로 옮기면 셸 가둠을 못 이긴다', () => {
    const imports = Array.from(mainTsx.matchAll(/import '([^']+\.css)'/g)).map((m) => m[1]!);
    expect(imports.length).toBeGreaterThan(1);
    expect(imports.at(-1)).toBe('./styles/print.css');
    // 특히 appShell.css 보다 뒤여야 한다(되돌리는 선언의 원본이 거기 있다).
    expect(imports.indexOf('./styles/print.css')).toBeGreaterThan(imports.indexOf('./styles/appShell.css'));
  });
});

describe('CSS 와 마크업이 같은 이름을 쓴다 — 한쪽만 개명하면 종이만 빈다', () => {
  it.each([PRINT_ROOT_CLASS, PRINT_PAGE_CLASS, PRINT_COURT_CLASS])('print.css 에 .%s 규칙이 있다', (cls) => {
    expect(printCss).toContain(`.${cls}`);
  });

  it('인쇄 트리가 data-print-root / data-print-page 를 실제로 단다', () => {
    expect(read('src/features/print/PrintRoot.tsx')).toContain('data-print-root');
    expect(read('src/features/print/PrintDrillSheet.tsx')).toContain('data-print-page="step"');
    const plan = read('src/features/print/PrintSessionPlan.tsx');
    expect(plan).toContain('data-print-page="cover"');
    expect(plan).toContain('data-print-page="drill"');
  });
});

describe('인쇄 트리는 테마 토큰을 쓰지 않는다', () => {
  // 다크 테마 사용자가 인쇄해도 **종이는 언제나 같아야** 한다. var(--panel) 같은 토큰이
  // 한 줄만 섞여도 그 부분만 검게 인쇄되고, jsdom 은 그것을 절대 못 잡는다.
  it.each(['PrintRoot.tsx', 'PrintCourt.tsx', 'PrintDrillSheet.tsx', 'PrintSessionPlan.tsx'])('%s 에 var(--) 가 없다', (f) => {
    expect(read(`src/features/print/${f}`)).not.toMatch(/var\(--[a-z]/);
  });

  it('대조군: 화면 컴포넌트는 토큰을 쓴다 — 위 단언이 "아무 데도 없다" 로 헛통과하지 않게', () => {
    expect(read('src/features/library/SessionTab.tsx')).toMatch(/var\(--[a-z]/);
  });
});

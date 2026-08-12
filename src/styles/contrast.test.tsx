// §5.6 고대비·강제색 계약. **jsdom 은 CSS 를 적용하지 않으므로 이게 유일한 방법이다** —
// contrast.css 의 규칙이 하나 사라져도 나머지 렌더 테스트 2000여 건은 전부 초록불이고, 사고는 저시력
// 사용자의 화면에서만 드러난다(선례: print.test.ts · a11y.test.ts 머리말).
//
// 이 파일이 못박는 것 네 가지:
//   ① 판(board)을 강제색에서 제외하는 두 줄이 **미디어쿼리 밖**에 있다(조건부가 되면 안 된다).
//   ② prefers-contrast: more 의 토큰이 실제로 대비를 **올린다** — 기준선 값과 같이 재서
//      "무엇을 넣어도 통과" 를 막는다. less 는 반대 방향으로 내려간다(양쪽에 단언을 둔다).
//   ③ forced-colors 블록에는 hex 가 **하나도 없다**(사용자 팔레트와 싸우지 않는다).
//   ④ CSS 가 부르는 이름(.stage-svg·.grid-line·.on-accent·규칙 존의 파선 패턴)이 마크업에
//      **실제로** 있다. 한쪽만 개명하면 규칙은 살아 있는데 아무것도 안 맞는 상태가 된다.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from '../ui/Button.tsx';
import { GridOverlay } from '../render/GridOverlay.tsx';
import { RuleZones } from '../render/RuleZones.tsx';
import { blockOf, declarations, declarationsOf, stripCssComments } from './cssContract.ts';
import { contrastRatio } from './contrastMath.ts';

const read = (p: string): string => stripCssComments(readFileSync(p, 'utf-8'));
const contrastCss = read('src/styles/contrast.css');
const tokensCss = read('src/styles/tokens.css');
const mainTsx = readFileSync('src/main.tsx', 'utf-8');

const MORE = '@media (prefers-contrast: more)';
const LESS = '@media (prefers-contrast: less)';
const FORCED = '@media (forced-colors: active)';
const moreBlock = blockOf(contrastCss, MORE);
const lessBlock = blockOf(contrastCss, LESS);
const forcedBlock = blockOf(contrastCss, FORCED);
/** 어떤 미디어쿼리에도 안 들어간 부분(= 항상 적용되는 규칙). */
const alwaysOn = contrastCss.slice(0, contrastCss.indexOf('@media'));
/** 규칙 존 갈고리 — RuleZones.tsx 에 클래스를 붙이면 판 DOM 스냅샷 계약이 깨져서(contrast.css ②
 *  주석) 존의 파선 패턴 자체를 셀렉터로 쓴다. */
const ZONE_SEL = '.stage-svg rect[stroke-dasharray="8 6"]';

describe('구조 — 세 미디어쿼리가 존재하고 순서가 계약이다', () => {
  it.each([
    ['prefers-contrast: more', moreBlock],
    ['prefers-contrast: less', lessBlock],
    ['forced-colors: active', forcedBlock],
  ])('%s 블록이 있다', (_n, block) => {
    expect(block).not.toBeNull();
    expect(block!.length).toBeGreaterThan(20); // 대조군: 빈 블록으로 통과하지 못한다
  });

  it('⚠️ forced-colors 가 prefers-contrast 뒤에 온다 — 둘은 동시에 켜지고 그때 시스템 팔레트가 이겨야 한다', () => {
    expect(contrastCss.indexOf(FORCED)).toBeGreaterThan(contrastCss.indexOf(MORE));
    expect(contrastCss.indexOf(FORCED)).toBeGreaterThan(contrastCss.indexOf(LESS));
  });

  it('구식 문법(prefers-contrast: high)을 쓰지 않는다', () => {
    expect(contrastCss).not.toContain('prefers-contrast: high');
  });

  it('main.tsx 가 a11y.css 뒤 · print.css 앞에서 contrast.css 를 읽는다', () => {
    const imports = Array.from(mainTsx.matchAll(/import '([^']+\.css)'/g)).map((m) => m[1]!);
    expect(imports).toContain('./styles/contrast.css');
    expect(imports.indexOf('./styles/contrast.css')).toBeGreaterThan(imports.indexOf('./styles/a11y.css'));
    expect(imports.at(-1)).toBe('./styles/print.css'); // print 는 계속 맨 마지막이다
  });
});

describe('① 판을 강제색에서 제외한다 — 미디어쿼리 **밖**에 있어야 한다', () => {
  it('.stage-svg · .spin-print-court 가 forced-color-adjust: none 이다', () => {
    expect(alwaysOn.length).toBeGreaterThan(0);
    expect(alwaysOn).toMatch(/\.stage-svg\s*,\s*\.spin-print-court\s*\{[^}]*forced-color-adjust:\s*none/);
  });

  it('대조군 — 그 선언이 forced-colors 블록 **안**에 숨어 있지 않다(안에 있으면 순환이라 무효다)', () => {
    expect(forcedBlock!).not.toContain('forced-color-adjust');
  });

  it('CSS 가 부르는 이름이 실제 마크업의 이름이다', () => {
    // 한쪽만 개명하면 규칙은 살아 있는데 판은 그대로 치환된다 — 화면에서만 드러나는 사고다.
    expect(readFileSync('src/render/CourtStage.tsx', 'utf-8')).toContain('className="stage-svg"');
    expect(readFileSync('src/features/print/printDom.ts', 'utf-8')).toContain("'spin-print-court'");
  });
});

// ── ② 토큰 대비 ──────────────────────────────────────────────────────────────────────
type Tokens = Record<string, string>;
const resolve = (t: Tokens, v: string): string => {
  const m = /^var\((--[\w-]+)\)$/.exec(v.trim());
  return m ? resolve(t, t[m[1]!] ?? '') : v.trim();
};
const darkBase = declarationsOf(tokensCss, ':root');
const lightBase = { ...darkBase, ...declarationsOf(tokensCss, '[data-theme="light"]') };
const darkMore = declarations(blockOf(moreBlock!, ':root:not([data-theme="light"])') ?? '');
const lightMore = declarations(blockOf(moreBlock!, ':root[data-theme="light"]') ?? '');
const SURFACES = ['--bg', '--panel', '--panel-2', '--elev'] as const;
/** 네 표면에 대한 대비의 **최솟값** — 가장 불리한 표면에서도 기준을 넘어야 한다. */
const minRatio = (t: Tokens, color: string): number =>
  Math.min(...SURFACES.map((s) => contrastRatio(resolve(t, color), resolve(t, t[s]!))));

/** 텍스트류는 AAA(7:1), 테두리류는 비텍스트 하한(3:1). */
const THRESHOLD: Record<string, number> = {
  '--text': 7,
  '--muted': 7,
  '--faint': 7,
  '--faint-text': 7,
  '--accent-text': 7,
  '--border': 3,
  '--border-strong': 3,
};

describe.each([
  ['다크', darkBase, darkMore],
  ['라이트', lightBase, lightMore],
])('② prefers-contrast: more — %s 테마 토큰이 실제로 대비를 올린다', (_theme, base, more) => {
  it('대조군 — 덮어쓰는 토큰이 6개 이상이다 (0개라서 통과하는 것을 막는다)', () => {
    expect(Object.keys(more).length).toBeGreaterThanOrEqual(6);
  });

  it('대조군 — 기준선에는 실제로 미달이 있었다 (없는 문제를 고친 척하지 않는다)', () => {
    for (const name of ['--muted', '--faint', '--faint-text', '--border', '--border-strong']) {
      expect(minRatio(base, base[name]!), `${name} 기준선`).toBeLessThan(THRESHOLD[name]!);
    }
  });

  it.each(Object.keys(more).filter((k) => k !== '--accent-ink-strong'))(
    '%s — 기준선보다 엄격히 높고, 임계를 넘는다',
    (name) => {
      const beforeR = minRatio(base, base[name]!);
      const afterR = minRatio({ ...base, ...more }, more[name]!);
      expect(afterR, `${name}: 덮어쓴 값이 기준선보다 낮거나 같다`).toBeGreaterThan(beforeR);
      expect(afterR, `${name}: 임계 미달`).toBeGreaterThanOrEqual(THRESHOLD[name] ?? 3);
    },
  );

  it('--accent-ink-strong 은 표면이 아니라 --accent **위**에서 잰다 (주 버튼 글자색)', () => {
    const accent = resolve(base, base['--accent']!);
    const beforeR = contrastRatio(resolve(base, base['--accent-ink-strong']!), accent);
    const afterR = contrastRatio(resolve(base, more['--accent-ink-strong']!), accent);
    expect(afterR).toBeGreaterThan(beforeR);
    expect(afterR).toBeGreaterThanOrEqual(7);
  });
});

describe('② prefers-contrast — more 와 less 는 **반대 방향**이다 (뒷문장에도 단언을 둔다)', () => {
  // 판 위 두 장식(격자선·규칙 존)의 기준값은 컴포넌트가 갖고 있다. 아래 ④ 가 그 값을 DOM 에서
  // 직접 읽어 오므로, 여기 숫자는 세 곳(컴포넌트·more·less)이 어긋나면 반드시 빨개진다.
  // ⚠️ `!` 로 단정하지 않는다 — 규칙을 지우고 반증할 때 모듈 최상위에서 TypeError 로 죽으면
  //    "무엇이 왜 빨간지" 가 사라진다(실제로 그랬다. 2026-08-13 반증 F11).
  const rule = (block: string | null, sel: string): Record<string, string> => declarations(blockOf(block ?? '', sel) ?? '');
  const zoneMore = rule(moreBlock, ZONE_SEL);
  const zoneLess = rule(lessBlock, ZONE_SEL);
  const gridMore = rule(moreBlock, '.grid-line');
  const gridLess = rule(lessBlock, '.grid-line');

  it('규칙 존: less < 기준(2 / .14) < more', () => {
    expect(Object.keys(zoneLess), 'less 블록에 규칙 존 규칙이 없다').not.toHaveLength(0);
    expect(Object.keys(zoneMore), 'more 블록에 규칙 존 규칙이 없다').not.toHaveLength(0);
    expect(Number(zoneLess['stroke-width'])).toBeLessThan(2);
    expect(Number(zoneMore['stroke-width'])).toBeGreaterThan(2);
    expect(Number(zoneLess['opacity'])).toBeLessThan(0.14);
    expect(Number(zoneMore['opacity'])).toBeGreaterThan(0.14);
  });

  it('격자선: less < 기준(1) < more', () => {
    expect(Object.keys(gridLess), 'less 블록에 격자선 규칙이 없다').not.toHaveLength(0);
    expect(Object.keys(gridMore), 'more 블록에 격자선 규칙이 없다').not.toHaveLength(0);
    expect(Number(gridLess['stroke-width'])).toBeLessThan(1);
    expect(Number(gridMore['stroke-width'])).toBeGreaterThan(1);
  });

  it('less 는 **글자색을 건드리지 않는다** — 요청대로 낮췄더니 AA 아래로 내려가면 안 된다', () => {
    expect(lessBlock!).not.toContain('--text');
    expect(lessBlock!).not.toContain('--muted');
    expect(lessBlock!).not.toContain('--faint');
  });

  it('more 는 포커스 링을 굵히되 **색은 a11y.css 계산을 그대로 쓴다**', () => {
    const focus = rule(moreBlock, ':focus-visible');
    expect(Number.parseFloat(focus['outline-width'] ?? '0')).toBeGreaterThan(2);
    expect(focus['outline-color']).toBeUndefined(); // 색을 새로 정하지 않는다
    // 판 위 이중 링도 같이 굵어진다(기준 5 / 2.5 — a11y.css).
    expect(Number(rule(moreBlock, '.court-obj:focus-visible .focus-ind-outer')['stroke-width'])).toBeGreaterThan(5);
    expect(Number(rule(moreBlock, '.court-obj:focus-visible .focus-ind-inner')['stroke-width'])).toBeGreaterThan(2.5);
  });
});

describe('③ forced-colors 블록은 시스템 팔레트만 쓴다', () => {
  it('⚠️ hex 색이 하나도 없다 — 사용자가 고른 팔레트와 싸우면 안 된다', () => {
    expect(forcedBlock!).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('대조군 — 같은 정규식이 more 블록에서는 hex 를 찾아낸다(정규식이 죽어 있지 않다)', () => {
    expect(moreBlock!).toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('우리 토큰(var(--…))도 쓰지 않는다 — 토큰은 전부 hex 에서 나온다', () => {
    expect(forcedBlock!).not.toMatch(/var\(--/);
  });

  it("'켜짐'을 배경색으로만 말하던 자리를 Highlight 로 되살린다", () => {
    // forced-colors 는 background-color 를 Canvas 로 강제해 켜짐/꺼짐이 같은 그림이 된다.
    expect(forcedBlock!).toContain('background: Highlight');
    expect(forcedBlock!).toContain('color: HighlightText');
    for (const hook of ['.on-accent', '[aria-pressed="true"]', '[aria-checked="true"]', '[aria-selected="true"]', '[aria-current]']) {
      expect(forcedBlock!, `${hook} 가 갈고리에서 빠졌다`).toContain(hook);
    }
  });

  it('⚠️ 판 위 칩(.court-obj)은 그 규칙에서 제외한다 — SVG <g> 에 HTML 배경을 얹으면 칩이 상자로 덮인다', () => {
    expect(forcedBlock!).toContain('[aria-pressed="true"]:not(.court-obj)');
  });

  it('사라지는 box-shadow(4px accent 헤일로)를 outline 으로 대체한다', () => {
    expect(forcedBlock!).toContain('box-shadow: none');
    expect(forcedBlock!).toMatch(/outline:\s*3px solid CanvasText/);
  });

  it('판에 시스템 색 테두리를 둘러 그림 영역임을 표시한다', () => {
    expect(blockOf(forcedBlock!, '.stage-svg,\n  .spin-print-court')).toMatch(/outline:\s*1px solid CanvasText/);
  });
});

describe('④ CSS 가 부르는 이름이 마크업에 실제로 붙어 있다', () => {
  it('규칙 존 — CSS 갈고리(파선 패턴)와 기준값 2 / .14 가 컴포넌트와 일치한다', () => {
    const { container } = render(
      <svg>
        <RuleZones mode="full" visible />
      </svg>,
    );
    const rects = container.querySelectorAll('rect[stroke-dasharray]');
    expect(rects.length).toBeGreaterThan(0); // 대조군: 0개라서 통과하지 못한다
    expect(rects[0]!.getAttribute('stroke-width')).toBe('2');
    expect(rects[0]!.getAttribute('opacity')).toBe('0.14');
    // ★ 갈고리 자체를 DOM 에서 읽어 CSS 와 맞춘다 — 한쪽만 바뀌면 여기서 빨개진다.
    //   (파선 테두리는 규칙 존의 **기능 채널**이기도 하다 — 면이 아니라 이쪽이 정보를 나른다.)
    const dash = rects[0]!.getAttribute('stroke-dasharray');
    expect(dash).toBe('8 6');
    expect(moreBlock!, 'CSS 갈고리가 컴포넌트의 파선 패턴과 어긋났다').toContain(`rect[stroke-dasharray="${dash}"]`);
    expect(lessBlock!).toContain(`rect[stroke-dasharray="${dash}"]`);
  });

  it('GridOverlay 가 .grid-line 을 달고, 기준 굵기가 1 이다', () => {
    const { container } = render(
      <svg>
        <GridOverlay mode="full" showLabels={false} />
      </svg>,
    );
    const lines = container.querySelectorAll('line.grid-line');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]!.parentElement!.getAttribute('stroke-width')).toBe('1');
  });

  it('주 버튼이 .on-accent 를 단다 (강제색에서 Highlight 로 되살릴 갈고리)', () => {
    const { container } = render(<Button variant="primary">저장</Button>);
    expect(container.querySelector('button')!.classList.contains('on-accent')).toBe(true);
    // 대조군 — 보조 버튼에는 붙지 않는다(무엇에나 붙어서 통과하는 것 방지).
    const { container: c2 } = render(<Button variant="secondary">취소</Button>);
    expect(c2.querySelector('button')!.classList.contains('on-accent')).toBe(false);
  });
});

// §7.2 포커스 링 회귀 테스트. 감사 지적: 라이트 테마에서 outline 색으로 쓰던 `--accent`
// 가 모든 표면(--bg/--panel/--panel-2/--elev) 대비 2.49~2.90:1 로 SC 1.4.11(3:1) 미달이었다.
// `?raw` 임포트는 vitest 기본 설정(test.css:false)이 .css 요청을 확장자만 보고 빈 문자열로
// 치환해버려 못 쓴다(쿼리스트링을 붙여도 매칭됨) — node:fs 로 직접 읽는다. tsconfig.app.json
// 은 전역 node 타입을 안 두므로 이 파일에만 삼중 슬래시 참조로 국소 적용한다(공유 설정 불변경).
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { relLuminance } from '../core/colors.ts';

// vitest 는 프로젝트 루트를 cwd 로 실행한다(다른 스토리지 테스트들도 이 전제를 공유).
const CSS_FILES: Record<string, string> = {
  'a11y.css': readFileSync('src/styles/a11y.css', 'utf-8'),
  'tokens.css': readFileSync('src/styles/tokens.css', 'utf-8'),
};

const contrastRatio = (hexA: string, hexB: string): number => {
  const la = relLuminance(hexA);
  const lb = relLuminance(hexB);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

describe('포커스 링 CSS 소스 — outline 색이 accent 가 아니라 accent-text 를 참조한다', () => {
  it.each(Object.keys(CSS_FILES))('%s 의 :focus-visible 규칙이 var(--accent-text) 를 쓴다', (file) => {
    const css = CSS_FILES[file]!;
    // ":focus-visible {" 로 시작하는 (on-accent 가 아닌) 최상위 규칙 블록만 추출한다.
    const match = css.match(/(?<![.\w])(:focus-visible\s*\{[^}]*\})/);
    expect(match, `${file} 에 :focus-visible 규칙이 있어야 한다`).toBeTruthy();
    const rule = match![1]!;
    expect(rule).toContain('var(--accent-text)');
    expect(rule).not.toMatch(/outline:\s*2px solid var\(--accent\)[;\s]/);
  });
});

describe('라이트 테마 --accent-text 를 outline 색으로 쓰면 모든 표면에서 3:1 을 넘는다 (SC 1.4.11)', () => {
  // tokens.css §2.8 의 실제 라이트 토큰값을 그대로 옮겨왔다(중복 정의는 의도적 — colors.test.ts 와 같은 관례).
  const LIGHT_ACCENT = '#6ba80f'; // 기존 outline 색 — 회귀 확인용 대조군(3:1 미달이어야 정상)
  const LIGHT_ACCENT_TEXT = '#446f00'; // 수정된 outline 색
  const LIGHT_SURFACES: Record<string, string> = {
    bg: '#eaeef3',
    panel: '#ffffff',
    'panel-2': '#f4f7fa',
    elev: '#eef2f7',
  };

  it('대조군: 기존 --accent 는 어떤 라이트 표면에서도 3:1 을 못 채운다 (회귀가 실제로 있었음을 증명)', () => {
    for (const hex of Object.values(LIGHT_SURFACES)) {
      expect(contrastRatio(LIGHT_ACCENT, hex)).toBeLessThan(3);
    }
  });

  it.each(Object.entries(LIGHT_SURFACES))('--accent-text vs --%s ≥ 3:1', (_name, hex) => {
    expect(contrastRatio(LIGHT_ACCENT_TEXT, hex)).toBeGreaterThanOrEqual(3);
  });
});

describe('§7.8 a11y.reduceMotion="always" 접합부 — SettingsProvider 가 documentElement 에 심는 ' +
  'data-reduce-motion="true" 를 CSS 가 실제로 소비한다', () => {
  // SettingsProvider.tsx 의 §7.8 주석이 styles 담당 에이전트에게 요청한 CSS 규칙. JS 쪽(속성 걸기)은
  // SettingsProvider.test.tsx 가 이미 검증하지만, CSS 쪽(그 속성을 실제로 억제 규칙에 연결)은 감사
  // 이후 아무 파일에도 추가되지 않아 '항상 켬' 을 선택해도 CSS 애니메이션·트랜지션이 안 죽는
  // 회귀가 있었다 — 여기서 소스 텍스트로 그 접합을 고정한다.
  const tokensCss = CSS_FILES['tokens.css']!;

  it('tokens.css 에 :root[data-reduce-motion="true"] 를 스코프로 하는 규칙이 있다', () => {
    expect(tokensCss).toMatch(/:root\[data-reduce-motion=["']true["']\]/);
  });

  it('그 규칙이 OS 미디어쿼리 블록과 동일한 억제 선언(애니메이션·트랜지션 즉시화)을 포함한다', () => {
    const match = tokensCss.match(/:root\[data-reduce-motion=["']true["']\][^{]*\{([^}]*)\}/);
    expect(match, 'data-reduce-motion 스코프 규칙 블록을 찾을 수 없다').toBeTruthy();
    const body = match![1]!;
    expect(body).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(body).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(body).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });
});

describe('다크 테마는 accent == accent-text 라 값 변경이 무영향이다', () => {
  const DARK_ACCENT_TEXT = '#c2f74e';
  const DARK_SURFACES: Record<string, string> = {
    bg: '#0b0f14',
    panel: '#12181f',
    'panel-2': '#0e141b',
    elev: '#1a222c',
  };

  it.each(Object.entries(DARK_SURFACES))('--accent-text vs --%s ≥ 3:1', (_name, hex) => {
    expect(contrastRatio(DARK_ACCENT_TEXT, hex)).toBeGreaterThanOrEqual(3);
  });
});

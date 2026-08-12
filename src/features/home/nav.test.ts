// nav.ts 는 screen-home-library 가 바깥과 주고받는 **유일한 통로**의 계약이다. 이 파일은 두
// 가지를 못박는다: (1) 기본 탭 규칙(계획서 2.9) (2) 그 통로가 정말 유일한가(계획서 2.8).
//
// (2)는 소스 정적 검사다 — 런타임 렌더로는 "그 코드 경로를 안 밟았을 뿐" 인 경우를 못 가른다.
// 조사가 짚은 충돌은 *한 화면이 `HomeNav` prop 통로와 `useAppNav` 직접 통로를 함께 쓰면 같은
// 이동이 두 경로로 일어나 히스토리가 어긋난다* 는 것이고, 그건 import 한 줄만 있어도 성립한다.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultLibraryTab } from './nav.ts';

describe('defaultLibraryTab — 세션 개수가 기본 탭을 정한다 (계획서 2.9)', () => {
  it('세션 0개면 [드릴]', () => {
    expect(defaultLibraryTab(0)).toBe('drills');
  });

  it('세션이 하나라도 있으면 [세션]', () => {
    expect(defaultLibraryTab(1)).toBe('sessions');
    expect(defaultLibraryTab(7)).toBe('sessions');
  });
});

// ── §8 소유권 · 통로 단일화 정적 검사 ────────────────────────────────────────────────────
const HERE = dirname(fileURLToPath(import.meta.url)); // src/features/home
const OWNED_DIRS = [HERE, join(HERE, '..', 'library')];

/** 소스 파일(테스트 제외)만. 테스트는 검사 대상이 아니다 — 대조군을 세우려면 테스트가
 *  일부러 app-shell 을 import 해야 하고, 그것까지 막으면 이 계약을 관측할 수단이 없어진다. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    if (!/\.tsx?$/.test(e.name) || e.name.includes('.test.')) return [];
    return [p];
  });
}

/** 소스에서 app-shell 을 가리키는 import 지정자만 뽑는다. `import ... from '…'` · `import('…')`
 *  · `export … from '…'` 전부 같은 꼴이라 지정자 문자열로 판정한다. */
function appShellImports(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)) {
    const spec = m[1]!;
    if (/(^|\/)app\//.test(spec)) found.push(spec);
  }
  return found;
}

describe('screen-home-library 는 app-shell 을 import 하지 않는다 (§8 · 계획서 2.8)', () => {
  it('검출기 자체가 실제로 검출한다 — 대조군', () => {
    // 이 대조군이 없으면 정규식이 아무것도 못 잡게 망가져도 아래 it 이 조용히 초록불이다.
    expect(appShellImports(`import { useAppNav } from '../../app/useAppHistory.ts';`)).toEqual(['../../app/useAppHistory.ts']);
    expect(appShellImports(`const m = await import('../../app/AppShell.tsx');`)).toEqual(['../../app/AppShell.tsx']);
    // 남의 이름에 'app' 이 들어간 것까지 잡으면 안 된다(거짓 양성).
    expect(appShellImports(`import { x } from '../../store/snapshot/appState.ts';`)).toEqual([]);
  });

  it('home·library 의 소스 파일 어디에도 app-shell import 가 없다 — 통로는 HomeNav prop 하나다', () => {
    const files = OWNED_DIRS.flatMap(sourceFiles);
    // 대조군 — 스캔이 실제로 파일을 읽었다. 경로가 틀려 빈 목록이면 아래 단언이 공짜로 통과한다.
    expect(files.length).toBeGreaterThan(5);

    const offenders = files
      .map((f) => ({ file: relative(HERE, f), specs: appShellImports(readFileSync(f, 'utf-8')) }))
      .filter((r) => r.specs.length > 0);
    expect(offenders).toEqual([]);
  });
});
